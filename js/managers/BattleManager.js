/**
 * 通用棋盘战斗管理器 - 单例模式
 */
class BattleManager {
    constructor() {
        if (BattleManager.instance) {
            return BattleManager.instance;
        }
        this.heroes = [];
        this.enemies = [];
        this.pendingBossWaves = [];
        this.scene = this.resolveSceneConfig('standard_9x9');
        this.battleLog = [];
        this.currentRound = 0;
        this.isBattling = false;
        this.result = null;
        this.currentActor = null;
        this.decisionProvider = null;
        this.autoBattleOverride = null;
        this.maxRounds = 200;
        this.isBossEntrancePlaying = false;
        this.battleItemUsage = {};
        BattleManager.instance = this;
    }

    initBattle({ heroes, enemies, bossWaves = [], sceneId = 'standard_9x9', battlefield = null }) {
        this.heroes = heroes || [];
        this.enemies = enemies || [];
        this.pendingBossWaves = (bossWaves || []).map((wave, index) => ({
            id: wave.id || `boss_wave_${index + 1}`,
            spawnRound: Number(wave.spawnRound) || DungeonConfig.defaultBossSpawnRound,
            spawnOnClearBeforeRound: wave.spawnOnClearBeforeRound !== false,
            bosses: [...(wave.bosses || [])],
            isSpawned: false
        }));
        this.scene = this.resolveSceneConfig(sceneId, battlefield);
        this.battleLog = [];
        this.currentRound = 0;
        this.isBattling = true;
        this.result = null;
        this.currentActor = null;
        this.autoBattleOverride = null;
        this.isBossEntrancePlaying = false;
        this.battleItemUsage = {
            stimulant: {
                maxUses: Math.min(2, itemManager.getItemCount('stimulant')),
                used: 0
            }
        };
        this.placeUnits();
        this.initializeProgress();
        this.addLog('battle', '战斗开始！');
        this.emitStateChange();
        eventManager.emit('battleStart', this.getSnapshot());
    }

    setDecisionProvider(provider) {
        this.decisionProvider = provider;
    }

    resolveSceneConfig(sceneId = 'standard_9x9', battlefield = null) {
        const baseScene = BattleSceneConfig.getScene(sceneId);
        const width = Math.max(1, Number(battlefield?.cols ?? battlefield?.width ?? baseScene?.width) || 1);
        const height = Math.max(1, Number(battlefield?.rows ?? battlefield?.height ?? baseScene?.height) || 1);
        const heroSpawn = battlefield?.heroSpawn || {};
        const enemySpawn = battlefield?.enemySpawn || {};
        return {
            ...baseScene,
            width,
            height,
            actionTimeout: Math.max(1, Number(battlefield?.actionTimeout ?? baseScene?.actionTimeout) || 15),
            heroSpawn: {
                ...(baseScene?.heroSpawn || {}),
                ...heroSpawn,
                startRow: Utils.clamp(
                    Number(heroSpawn.startRow ?? (battlefield ? (height - 1) : (baseScene?.heroSpawn?.startRow ?? (height - 1)))) || (height - 1),
                    0,
                    height - 1
                ),
                direction: Number(heroSpawn.direction ?? baseScene?.heroSpawn?.direction) >= 0 ? 1 : -1
            },
            enemySpawn: {
                ...(baseScene?.enemySpawn || {}),
                ...enemySpawn,
                startRow: Utils.clamp(
                    Number(enemySpawn.startRow ?? (battlefield ? 0 : (baseScene?.enemySpawn?.startRow ?? 0))) || 0,
                    0,
                    height - 1
                ),
                direction: Number(enemySpawn.direction ?? baseScene?.enemySpawn?.direction) >= 0 ? 1 : -1
            },
            obstacles: this.normalizeObstacles(battlefield?.obstacles, width, height)
        };
    }

    normalizeObstacles(obstacles = [], width = this.scene?.width || 0, height = this.scene?.height || 0) {
        if (!Array.isArray(obstacles)) {
            return [];
        }
        const occupiedKeys = new Set();
        return obstacles.reduce((result, entry, index) => {
            const normalized = this.normalizeObstacleEntry(entry, width, height, index);
            if (!normalized) {
                return result;
            }
            const key = `${normalized.x},${normalized.y}`;
            if (occupiedKeys.has(key)) {
                return result;
            }
            occupiedKeys.add(key);
            result.push(normalized);
            return result;
        }, []);
    }

    normalizeObstacleEntry(entry, width, height, index = 0) {
        let row = null;
        let col = null;
        if (Array.isArray(entry)) {
            row = Number(entry[0]);
            col = Number(entry[1]);
        } else if (entry && typeof entry === 'object') {
            row = Number(entry.row ?? entry.y ?? (Number.isFinite(entry.y) ? entry.y + 1 : null));
            col = Number(entry.col ?? entry.x ?? (Number.isFinite(entry.x) ? entry.x + 1 : null));
        }
        if (!Number.isFinite(row) || !Number.isFinite(col)) {
            return null;
        }
        const position = { x: Math.floor(col) - 1, y: Math.floor(row) - 1 };
        if (position.x < 0 || position.y < 0 || position.x >= width || position.y >= height) {
            return null;
        }
        return {
            id: `obstacle_${index + 1}`,
            type: 'obstacle',
            name: '障碍物',
            icon: '■',
            x: position.x,
            y: position.y
        };
    }

    getAllUnits() {
        return [...this.heroes, ...this.enemies];
    }

    placeSide(units, spawnConfig, occupiedKeys = new Set()) {
        units.forEach(unit => {
            const position = this.findSpawnPosition(spawnConfig, occupiedKeys);
            if (position) {
                unit.setPosition(position);
                occupiedKeys.add(`${position.x},${position.y}`);
            }
        });
    }

    placeUnits() {
        const occupiedKeys = new Set();
        this.placeSide(this.enemies, this.scene.enemySpawn, occupiedKeys);
        this.placeSide(this.heroes, this.scene.heroSpawn, occupiedKeys);
    }

    setInitialProgress(unit) {
        const shouldUseSpeedStart = unit.camp === 'hero' || ['elite', 'boss', 'player'].includes(unit.rank);
        unit.progress = shouldUseSpeedStart ? Math.min(100, unit.speed) : 0;
    }

    initializeProgress() {
        this.getAllUnits().forEach(unit => this.setInitialProgress(unit));
    }

    findSpawnPosition(spawnConfig, occupiedKeys = new Set()) {
        for (let rowOffset = 0; rowOffset < this.scene.height; rowOffset++) {
            const y = spawnConfig.startRow + rowOffset * spawnConfig.direction;
            if (y < 0 || y >= this.scene.height) {
                continue;
            }
            for (let x = 0; x < this.scene.width; x++) {
                const position = { x, y };
                const key = `${x},${y}`;
                if (!occupiedKeys.has(key) && !this.isCellBlocked(position)) {
                    return position;
                }
            }
        }

        for (let y = 0; y < this.scene.height; y++) {
            for (let x = 0; x < this.scene.width; x++) {
                const position = { x, y };
                const key = `${x},${y}`;
                if (!occupiedKeys.has(key) && !this.isCellBlocked(position)) {
                    return position;
                }
            }
        }

        return null;
    }

    placeSpawnedUnits(units, spawnConfig = this.scene.enemySpawn, appendToEnemies = false) {
        const occupiedKeys = new Set(
            this.getAllUnits()
                .filter(unit => unit.isAlive())
                .map(unit => `${unit.position.x},${unit.position.y}`)
        );
        units.forEach((unit) => {
            const position = this.findSpawnPosition(spawnConfig, occupiedKeys);
            if (position) {
                unit.setPosition(position);
                occupiedKeys.add(`${position.x},${position.y}`);
            }
            this.setInitialProgress(unit);
            if (appendToEnemies && !this.enemies.includes(unit)) {
                this.enemies.push(unit);
            }
        });
    }


    hasPendingBossWaves() {
        return this.pendingBossWaves.some(wave => !wave.isSpawned);
    }

    getAliveNonBossEnemies() {
        return this.enemies.filter(unit => unit.isAlive() && unit.rank !== 'boss');
    }

    getRoundTriggeredBossWaves() {
        return this.pendingBossWaves.filter(wave => !wave.isSpawned && this.currentRound >= wave.spawnRound);
    }

    getClearTriggeredBossWaves() {
        if (this.getAliveNonBossEnemies().length > 0) {
            return [];
        }
        return this.pendingBossWaves.filter(wave => !wave.isSpawned && wave.spawnOnClearBeforeRound && this.currentRound < wave.spawnRound);
    }

    async playBossEntranceEffect(payload) {
        this.isBossEntrancePlaying = true;
        this.emitStateChange();
        if (window.battleView && typeof window.battleView.playBossEntrance === 'function') {
            await window.battleView.playBossEntrance(payload);
        } else {
            await new Promise(resolve => setTimeout(resolve, payload?.duration || 2000));
        }
        this.isBossEntrancePlaying = false;
        this.emitStateChange();
    }

    async spawnBossWaves(waves, reason) {
        const normalizedWaves = (waves || []).filter(wave => wave && !wave.isSpawned);
        if (normalizedWaves.length === 0) {
            return false;
        }

        const bosses = [];
        normalizedWaves.forEach((wave) => {
            wave.isSpawned = true;
            bosses.push(...(wave.bosses || []));
        });

        if (bosses.length === 0) {
            return false;
        }

        const bossNames = bosses.map(unit => unit.name).join('、');
        this.addLog('boss', `${bossNames} 即将登场！`);
        await this.playBossEntranceEffect({
            duration: 2000,
            message: '领主登场!',
            reason,
            waveIds: normalizedWaves.map(wave => wave.id),
            bosses
        });
        this.placeSpawnedUnits(bosses, this.scene.enemySpawn, true);

        this.addLog('boss', `${bossNames} 登场了！`);
        this.emitStateChange();
        return true;
    }

    async checkAndSpawnBossWaves(trigger = 'actionEnd') {
        if (!this.isBattling || !this.hasPendingBossWaves()) {
            return false;
        }
        const roundWaves = this.getRoundTriggeredBossWaves();
        if (roundWaves.length > 0) {
            return this.spawnBossWaves(roundWaves, trigger === 'roundStart' ? 'round' : trigger);
        }
        const clearWaves = this.getClearTriggeredBossWaves();
        if (clearWaves.length > 0) {
            return this.spawnBossWaves(clearWaves, 'clear');
        }
        return false;
    }

    addLog(type, message) {
        this.battleLog.push({ round: this.currentRound, type, message, timestamp: Date.now() });
    }

    getBattleLog() {
        return [...this.battleLog];
    }

    getSnapshot() {
        return {
            scene: this.scene,
            currentRound: this.currentRound,
            isBattling: this.isBattling,
            isBossEntrancePlaying: this.isBossEntrancePlaying,
            pendingBossWaveCount: this.pendingBossWaves.filter(wave => !wave.isSpawned).length,
            currentActorId: this.currentActor?.id || null,
            heroes: this.heroes,
            enemies: this.enemies,
            fallenHeroes: this.getFallenHeroes(),
            battleItemUsage: { ...this.battleItemUsage },
            logs: this.getBattleLog()
        };
    }

    emitStateChange() {
        eventManager.emit('battleStateChange', this.getSnapshot());
    }

    isInsideBoard(position) {
        return position.x >= 0 && position.y >= 0 && position.x < this.scene.width && position.y < this.scene.height;
    }

    getObstacleAt(position) {
        if (!position) {
            return null;
        }
        return (this.scene?.obstacles || []).find(obstacle => obstacle.x === position.x && obstacle.y === position.y) || null;
    }

    isObstacleAt(position) {
        return Boolean(this.getObstacleAt(position));
    }

    getUnitAt(position, ignoreUnitId = null) {
        return this.getAllUnits().find(unit => unit.id !== ignoreUnitId && unit.isAlive() && unit.position.x === position.x && unit.position.y === position.y) || null;
    }

    isCellBlocked(position, ignoreUnitId = null) {
        return this.isObstacleAt(position) || Boolean(this.getUnitAt(position, ignoreUnitId));
    }

    getOpponents(actor) {
        return actor.camp === 'hero' ? this.enemies.filter(unit => unit.isAlive()) : this.heroes.filter(unit => unit.isAlive());
    }

    getAllies(actor) {
        return actor.camp === 'hero' ? this.heroes.filter(unit => unit.isAlive()) : this.enemies.filter(unit => unit.isAlive());
    }

    distanceBetween(a, b) {
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    }

    getNeighborCells(position) {
        return [
            { x: position.x + 1, y: position.y },
            { x: position.x - 1, y: position.y },
            { x: position.x, y: position.y + 1 },
            { x: position.x, y: position.y - 1 }
        ].filter(cell => this.isInsideBoard(cell));
    }

    getPathDistance(start, target, ignoreUnitId = null) {
        if (!start || !target || !this.isInsideBoard(start) || !this.isInsideBoard(target)) {
            return Infinity;
        }
        if (start.x === target.x && start.y === target.y) {
            return 0;
        }
        if (this.isCellBlocked(target, ignoreUnitId)) {
            return Infinity;
        }

        const queue = [{ position: { x: start.x, y: start.y }, steps: 0 }];
        const visited = new Set([`${start.x},${start.y}`]);

        while (queue.length > 0) {
            const current = queue.shift();
            const neighbors = this.getNeighborCells(current.position);
            for (const neighbor of neighbors) {
                const key = `${neighbor.x},${neighbor.y}`;
                if (visited.has(key) || this.isCellBlocked(neighbor, ignoreUnitId)) {
                    continue;
                }
                const nextSteps = current.steps + 1;
                if (neighbor.x === target.x && neighbor.y === target.y) {
                    return nextSteps;
                }
                visited.add(key);
                queue.push({ position: neighbor, steps: nextSteps });
            }
        }

        return Infinity;
    }

    getRawRangeCells(actor, range) {
        const normalizedRange = Math.max(0, Number(range) || 0);
        const cells = [];
        for (let x = 0; x < this.scene.width; x++) {
            for (let y = 0; y < this.scene.height; y++) {
                const position = { x, y };
                const distance = this.distanceBetween(actor.position, position);
                if (distance > 0 && distance <= normalizedRange) {
                    cells.push(position);
                }
            }
        }
        return cells;
    }

    getCellsOnLine(start, end) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const steps = Math.max(Math.abs(dx), Math.abs(dy));
        const cells = [];
        const keys = new Set();

        if (steps <= 1) {
            return cells;
        }

        for (let step = 1; step < steps; step++) {
            const ratio = step / steps;
            const x = Math.round(start.x + dx * ratio);
            const y = Math.round(start.y + dy * ratio);
            const key = `${x},${y}`;
            if (keys.has(key) || (x === start.x && y === start.y) || (x === end.x && y === end.y)) {
                continue;
            }
            keys.add(key);
            cells.push({ x, y });
        }

        return cells;
    }

    hasObstacleBetween(start, end) {
        return this.getCellsOnLine(start, end).some(cell => this.isObstacleAt(cell));
    }

    isCellTargetable(actor, position, range) {
        if (!actor || !position || !this.isInsideBoard(position)) {
            return false;
        }
        const normalizedRange = Math.max(0, Number(range) || 0);
        const distance = this.distanceBetween(actor.position, position);
        if (distance <= 0 || distance > normalizedRange) {
            return false;
        }
        if (this.isObstacleAt(position)) {
            return false;
        }
        return !this.hasObstacleBetween(actor.position, position);
    }

    getReachableCells(actor) {
        const cells = [];
        for (let x = 0; x < this.scene.width; x++) {
            for (let y = 0; y < this.scene.height; y++) {
                const position = { x, y };
                if (this.distanceBetween(actor.position, position) === 0) {
                    continue;
                }
                if (this.getPathDistance(actor.position, position, actor.id) <= actor.moveRange) {
                    cells.push(position);
                }
            }
        }
        return cells;
    }

    getAttackableTargets(actor) {
        return this.getOpponents(actor).filter(target => this.isCellTargetable(actor, target.position, actor.attackRange));
    }

    getSkillTargetCandidates(actor, skillIndex = 0, options = {}) {
        const ignoreUsable = options.ignoreUsable === true;
        const targetType = actor.getSkillTargetType?.(skillIndex) || 'enemy';
        const range = actor.getSkillRange?.(skillIndex) || actor.attackRange;
        if (!ignoreUsable && !actor.canUseSkill?.(skillIndex)) {
            return [];
        }
        const targetPool = targetType === 'ally'
            ? this.getAllies(actor)
            : this.getOpponents(actor);
        return targetPool.filter(target => target.isAlive() && this.isCellTargetable(actor, target.position, range));
    }

    getSkillRangeCells(actor, skillIndex = 0, options = {}) {
        const range = actor.getSkillRange?.(skillIndex) || actor.attackRange;
        if (options.previewRaw) {
            return this.getRawRangeCells(actor, range);
        }
        if (!options.ignoreUsable && !actor.canUseSkill?.(skillIndex)) {
            return [];
        }
        return this.getRawRangeCells(actor, range).filter(position => !this.hasObstacleBetween(actor.position, position));
    }

    getSelectedSkillTargets(actor, primaryTarget, skillIndex = 0) {
        const candidates = this.getSkillTargetCandidates(actor, skillIndex);
        const targetCount = actor.getSkillTargetCount?.(skillIndex) || 1;
        if (!primaryTarget) {
            return [];
        }
        const sorted = [...candidates].sort((a, b) => {
            if (a.id === primaryTarget.id) return -1;
            if (b.id === primaryTarget.id) return 1;
            const distanceDiff = this.distanceBetween(primaryTarget.position, a.position) - this.distanceBetween(primaryTarget.position, b.position);
            if (distanceDiff !== 0) {
                return distanceDiff;
            }
            return a.hp - b.hp;
        });
        return sorted.slice(0, targetCount);
    }

    getUsableSkills(actor) {
        if (!actor?.skills?.length) {
            return [];
        }
        return actor.skills.map((skill, index) => {
            const state = actor.getSkillState?.(index) || {};
            const hpCost = actor.getSkillHpCost?.(index) || 0;
            return {
                ...skill,
                index,
                range: actor.getSkillRange?.(index) || actor.attackRange,
                targetType: actor.getSkillTargetType?.(index) || 'enemy',
                targetCount: actor.getSkillTargetCount?.(index) || 1,
                cooldownTurns: state.cooldownTurns || 0,
                cooldownRemaining: state.cooldownRemaining || 0,
                hpCost,
                canUse: actor.canUseSkill?.(index) || false
            };
        });
    }

    getAttackRangeCells(actor) {
        return this.getRawRangeCells(actor, actor.attackRange);
    }

    chooseBestMove(actor) {
        const reachableCells = this.getReachableCells(actor);
        const opponents = this.getOpponents(actor);
        if (reachableCells.length === 0 || opponents.length === 0) {
            return null;
        }

        reachableCells.sort((cellA, cellB) => {
            const scoreA = Math.min(...opponents.map(target => this.distanceBetween(cellA, target.position)));
            const scoreB = Math.min(...opponents.map(target => this.distanceBetween(cellB, target.position)));
            if (scoreA !== scoreB) {
                return scoreA - scoreB;
            }
            return cellA.y - cellB.y;
        });
        return reachableCells[0] || null;
    }

    chooseTarget(actor) {
        const targets = this.getAttackableTargets(actor);
        if (targets.length === 0) {
            return null;
        }
        return [...targets].sort((a, b) => a.hp - b.hp || actor.distanceTo(a) - actor.distanceTo(b))[0];
    }

    getUsableBattleItems(actor) {
        if (actor.camp !== 'hero') {
            return [];
        }
        const itemMap = new Map();
        itemManager.getAllItems().forEach(item => {
            if (!['heal', 'revive'].includes(item.effect?.type)) {
                return;
            }
            if (!itemMap.has(item.id)) {
                itemMap.set(item.id, item);
            }
        });
        return Array.from(itemMap.values()).filter(item => {
            if (item.effect?.type === 'revive') {
                return this.canUseBattleItem('stimulant') && this.getFallenHeroes().length > 0;
            }
            return true;
        });
    }

    getBattleItemUsageState(itemId) {
        const state = this.battleItemUsage?.[itemId];
        return state ? { ...state } : { maxUses: 0, used: 0 };
    }

    canUseBattleItem(itemId) {
        const state = this.getBattleItemUsageState(itemId);
        return state.used < state.maxUses;
    }

    consumeBattleItemUse(itemId) {
        if (!this.battleItemUsage[itemId]) {
            return;
        }
        this.battleItemUsage[itemId].used = Math.min(
            this.battleItemUsage[itemId].maxUses,
            (this.battleItemUsage[itemId].used || 0) + 1
        );
    }

    getFallenHeroes() {
        return this.heroes.filter(unit => !unit.isAlive());
    }

    chooseAutoAction(actor) {
        const healItems = this.getUsableBattleItems(actor);
        if (actor.camp === 'hero' && actor.hp / actor.maxHp <= 0.4 && healItems.length > 0) {
            return { type: 'item', itemId: healItems[0].id, targetId: actor.id };
        }

        const usableSkills = this.getUsableSkills(actor).filter(skill => skill.canUse);
        const skillChoice = usableSkills.find(skill => {
            const candidates = this.getSkillTargetCandidates(actor, skill.index);
            return candidates.length > 0;
        });
        if (skillChoice) {
            const skillTarget = this.getSkillTargetCandidates(actor, skillChoice.index)[0];
            if (skillTarget) {
                return { type: 'skill', targetId: skillTarget.id, skillIndex: skillChoice.index };
            }
        }

        const target = this.chooseTarget(actor);
        if (target) {
            return { type: 'attack', targetId: target.id };
        }

        const moveCell = this.chooseBestMove(actor);
        if (moveCell) {
            return { type: 'move', position: moveCell };
        }

        return { type: 'defend' };
    }

    isAutoBattleEnabled() {
        if (typeof this.autoBattleOverride === 'boolean') {
            return this.autoBattleOverride;
        }
        return Boolean(window.game.settings.autoBattle);
    }

    setAutoBattleOverride(enabled = null) {
        this.autoBattleOverride = typeof enabled === 'boolean' ? enabled : null;
    }

    async waitForActionPresentation() {
        if (window.battleView && typeof window.battleView.waitForActionQueueIdle === 'function') {
            await window.battleView.waitForActionQueueIdle();
        }
    }

    async resolveActionForActor(actor) {
        if (actor.camp === 'hero' && !this.isAutoBattleEnabled() && typeof this.decisionProvider === 'function') {
            const action = await this.decisionProvider({
                actor,
                attackTargets: this.getAttackableTargets(actor),
                moveCells: this.getReachableCells(actor),
                usableItems: this.getUsableBattleItems(actor),
                usableSkills: this.getUsableSkills(actor),
                timeout: this.scene.actionTimeout || 15
            });

            return action || { type: 'defend' };
        }
        return this.chooseAutoAction(actor);
    }

    findUnitById(unitId) {
        return this.getAllUnits().find(unit => unit.id === unitId) || null;
    }

    async executeAction(actor, action) {
        if (!actor.isAlive()) {
            return;
        }
        const finalAction = action || { type: 'defend' };

        if (finalAction.type === 'move') {
            const reachable = this.getReachableCells(actor).some(cell => cell.x === finalAction.position?.x && cell.y === finalAction.position?.y);
            if (!reachable) {
                return this.executeAction(actor, { type: 'defend' });
            }
            const fromPosition = { x: actor.position.x, y: actor.position.y };
            actor.setPosition(finalAction.position);
            this.addLog('move', `${actor.name} 移动到了 (${finalAction.position.x + 1}, ${finalAction.position.y + 1})`);
            eventManager.emit('battleUnitMove', {
                unit: actor,
                fromPosition,
                position: finalAction.position,
                toPosition: finalAction.position
            });
            this.emitStateChange();
            return;
        }

        if (finalAction.type === 'item') {
            const item = itemManager.getItem(finalAction.itemId);
            if (!item) {
                return this.executeAction(actor, { type: 'defend' });
            }
            const target = this.findUnitById(finalAction.targetId) || actor;
            if (item.effect?.type === 'revive') {
                const isValidReviveTarget = target && target.camp === 'hero' && !target.isAlive();
                if (!isValidReviveTarget || !this.canUseBattleItem(finalAction.itemId)) {
                    return this.executeAction(actor, { type: 'defend' });
                }
            }
            const result = itemManager.useItem(finalAction.itemId, target);
            if (!result.success) {
                return this.executeAction(actor, { type: 'defend' });
            }
            if (item.effect?.type === 'revive') {
                this.consumeBattleItemUse(finalAction.itemId);
                this.addLog('item', `${actor.name} 对 ${target.name} 使用了 ${item.name}：${result.message}`);
                eventManager.emit('battleUnitRevive', { user: actor, target, itemId: finalAction.itemId, result });
            } else {
                this.addLog('item', `${actor.name} 使用了 ${ItemConfig.getItemConfig(finalAction.itemId)?.name || '道具'}：${result.message}`);
            }
            eventManager.emit('battleUnitAction', { attacker: actor, target, damage: 0, actionType: 'item', message: result.message });
            this.emitStateChange();
            return;
        }

        if (finalAction.type === 'attack' || finalAction.type === 'skill') {
            const target = this.findUnitById(finalAction.targetId);
            const skillIndex = Number.isFinite(Number(finalAction.skillIndex)) ? Number(finalAction.skillIndex) : 0;
            const isSkill = finalAction.type === 'skill';
            const validTargets = isSkill
                ? this.getSkillTargetCandidates(actor, skillIndex)
                : this.getAttackableTargets(actor);
            if (!target || !target.isAlive() || !validTargets.some(unit => unit.id === target.id)) {
                return this.executeAction(actor, { type: 'defend' });
            }
            if (isSkill && !actor.canUseSkill?.(skillIndex)) {
                return this.executeAction(actor, { type: 'defend' });
            }

            if (isSkill) {
                const skill = actor.getSkill(skillIndex);
                const targets = this.getSelectedSkillTargets(actor, target, skillIndex);
                const hpCost = actor.consumeSkillCost(skillIndex);
                const skillLogs = [];
                const actionTargets = [];
                const effectType = actor.getSkillState(skillIndex)?.effectType || 'damage';

                targets.forEach((targetUnit) => {
                    if (effectType === 'heal') {
                        const healValue = Math.max(1, Math.floor(actor._attack * actor.attackCoefficient * (Number(skill?.multiplier) || 1)));
                        const actualHeal = targetUnit.heal(healValue);
                        skillLogs.push(`${actor.name} 对 ${targetUnit.name} 施放 ${skill?.name || '特技'}，恢复 ${actualHeal} 点生命`);
                        actionTargets.push({ target: targetUnit, result: { hit: true, heal: actualHeal, useSkill: true, skillName: skill?.name || null } });
                    } else {
                        const attackResult = actor.attackTarget(targetUnit, true, skillIndex);
                        if (!attackResult.hit) {
                            skillLogs.push(`${actor.name} 对 ${targetUnit.name} 施放 ${skill?.name || '特技'}，但被闪避了`);
                        } else {
                            skillLogs.push(`${actor.name} 对 ${targetUnit.name} 施放 ${skill?.name || '特技'}，造成 ${attackResult.damage} 点伤害${attackResult.isCritical ? '（暴击）' : ''}`);
                        }
                        actionTargets.push({ target: targetUnit, result: attackResult });
                    }
                });

                if (hpCost > 0) {
                    skillLogs.push(`${actor.name} 额外消耗 ${hpCost} 点生命施放特技`);
                }
                skillLogs.forEach(message => this.addLog(effectType === 'heal' ? 'heal' : 'damage', message));
                eventManager.emit('battleUnitAction', {
                    attacker: actor,
                    target,
                    damage: 0,
                    actionType: 'skill',
                    result: {
                        skillIndex,
                        skillName: skill?.name || null,
                        hpCost,
                        targets: actionTargets.map(entry => ({ id: entry.target.id, name: entry.target.name, ...entry.result }))
                    }
                });
                targets.forEach((targetUnit) => {
                    if (!targetUnit.isAlive()) {
                        this.addLog('death', `${targetUnit.name} 倒下了！`);
                        eventManager.emit('battleUnitDie', { unit: targetUnit });
                    }
                });
                this.emitStateChange();
                return;
            }

            const attackResult = actor.attackTarget(target, false);
            if (!attackResult.hit) {
                this.addLog('miss', `${actor.name} 攻击 ${target.name}，但被闪避了`);
            } else {
                const logText = `${actor.name} 对 ${target.name} 造成 ${attackResult.damage} 点伤害${attackResult.isCritical ? '（暴击）' : ''}`;
                this.addLog('damage', logText);
            }
            eventManager.emit('battleUnitAction', { attacker: actor, target, damage: attackResult.damage, actionType: finalAction.type, result: attackResult });
            if (!target.isAlive()) {
                this.addLog('death', `${target.name} 倒下了！`);
                eventManager.emit('battleUnitDie', { unit: target });
            }
            this.emitStateChange();
            return;
        }

        actor.defend();
        this.addLog('defend', `${actor.name} 进入防御姿态，防御提升10%`);
        eventManager.emit('battleUnitAction', { attacker: actor, target: actor, damage: 0, actionType: 'defend' });
        this.emitStateChange();
    }

    getCampPriority(unit) {
        return unit.camp === 'hero' ? 0 : 1;
    }

    sortReadyUnits(units) {
        const randomTieBreakers = new Map();
        units.forEach(unit => {
            randomTieBreakers.set(unit.id, Math.random());
        });

        return [...units].sort((a, b) => {
            const speedDiff = b.speed - a.speed;
            if (speedDiff !== 0) {
                return speedDiff;
            }

            const powerDiff = b.getPower() - a.getPower();
            if (powerDiff !== 0) {
                return powerDiff;
            }

            const campDiff = this.getCampPriority(a) - this.getCampPriority(b);
            if (campDiff !== 0) {
                return campDiff;
            }

            return randomTieBreakers.get(b.id) - randomTieBreakers.get(a.id);
        });
    }

    advanceProgress() {
        const aliveUnits = this.getAllUnits().filter(unit => unit.isAlive());
        if (aliveUnits.length === 0) {
            return [];
        }

        let minTime = Infinity;
        aliveUnits.forEach(unit => {
            const remaining = Math.max(0, 100 - unit.progress);
            const time = remaining / Math.max(1, unit.speed);
            if (time < minTime) {
                minTime = time;
            }
        });

        aliveUnits.forEach(unit => {
            unit.progress = Math.min(100, unit.progress + unit.speed * minTime);
        });

        return this.sortReadyUnits(aliveUnits.filter(unit => unit.progress >= 100));
    }

    checkBattleEnd() {
        const livingHeroes = this.heroes.filter(unit => unit && unit.isAlive());
        const livingEnemies = this.enemies.filter(unit => unit && unit.isAlive());
        const heroesAlive = livingHeroes.length > 0;
        const enemiesAlive = livingEnemies.length > 0;

        if (!enemiesAlive && !this.hasPendingBossWaves()) {
            this.result = {
                victory: true,
                participants: this.heroes.map(unit => unit.id),
                survivors: livingHeroes.map(unit => unit.id)
            };
            this.isBattling = false;
            this.addLog('result', '战斗胜利！');
            eventManager.emit('battleEnd', this.result);
            return true;
        }

        if (!heroesAlive) {
            this.result = {
                victory: false,
                participants: this.heroes.map(unit => unit.id),
                survivors: []
            };
            this.isBattling = false;
            this.addLog('result', '战斗失败...');
            eventManager.emit('battleEnd', this.result);
            return true;
        }

        return false;
    }

    async executeBattle() {
        this.isBattling = true;
        await this.checkAndSpawnBossWaves('battleStart');
        if (this.checkBattleEnd()) {
            return this.result;
        }

        while (this.isBattling && this.currentRound < this.maxRounds) {
            const queue = this.advanceProgress();
            if (queue.length === 0) {
                break;
            }
            this.currentRound++;
            this.addLog('round', `第 ${this.currentRound} 回合`);
            this.emitStateChange();
            await this.checkAndSpawnBossWaves('roundStart');
            if (this.checkBattleEnd()) {
                return this.result;
            }

            for (const actor of queue) {
                if (!this.isBattling || !actor.isAlive()) {
                    continue;
                }
                actor.resetTurnState();
                this.currentActor = actor;
                this.emitStateChange();
                const action = await this.resolveActionForActor(actor);
                if (!this.isBattling) {
                    break;
                }
                await this.executeAction(actor, action);
                await this.waitForActionPresentation();
                actor.progress = 0;
                this.currentActor = null;
                this.emitStateChange();
                await this.checkAndSpawnBossWaves('actionEnd');
                if (this.checkBattleEnd()) {
                    return this.result;
                }
            }
        }

        if (!this.result) {
            this.result = {
                victory: false,
                reason: 'max_rounds',
                participants: this.heroes.map(unit => unit.id),
                survivors: this.heroes.filter(unit => unit.isAlive()).map(unit => unit.id)
            };
            this.isBattling = false;
            this.addLog('result', '战斗超时，自动判定失败');
            eventManager.emit('battleEnd', this.result);
        }
        return this.result;
    }

    reset() {
        this.heroes = [];
        this.enemies = [];
        this.pendingBossWaves = [];
        this.battleLog = [];
        this.currentRound = 0;
        this.isBattling = false;
        this.result = null;
        this.currentActor = null;
        this.decisionProvider = null;
        this.autoBattleOverride = null;
        this.isBossEntrancePlaying = false;
        this.battleItemUsage = {};
        this.emitStateChange();
    }
}

const battleManager = new BattleManager();
window.battleManager = battleManager;
