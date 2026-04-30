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
        this.formationStates = [];
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
        this.formationStates = [];
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
        this.getAllUnits().forEach(unit => unit.setBattleContext?.(this));
    }

    setInitialProgress(unit) {
        const shouldUseSpeedStart = unit.camp === 'hero' || ['elite', 'boss', 'player'].includes(unit.rank);
        unit.progress = shouldUseSpeedStart ? Math.min(100, unit.getEffectiveSpeed?.() || unit.speed) : 0;
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
            unit.setBattleContext?.(this);
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

    getActiveTaunt(actor) {
        if (!actor?.getStatusEffects) {
            return null;
        }
        const tauntEffect = actor.getStatusEffects().find(effect => effect.type === 'taunt');
        if (!tauntEffect) {
            return null;
        }

        const source = tauntEffect.sourceUnitId ? this.findUnitById(tauntEffect.sourceUnitId) : null;
        const validSource = source?.isAlive?.() && source.isAlive() && source.camp !== actor.camp;
        if (!validSource) {
            actor.removeStatusEffectsWhere?.(effect => effect.type === 'taunt' && effect.sourceUnitId === tauntEffect.sourceUnitId);
            return null;
        }

        return { effect: tauntEffect, source };
    }

    chooseBestMoveToward(actor, targetUnit) {
        const reachableCells = this.getReachableCells(actor);
        if (!targetUnit?.position || reachableCells.length === 0) {
            return null;
        }

        reachableCells.sort((cellA, cellB) => {
            const distanceA = this.distanceBetween(cellA, targetUnit.position);
            const distanceB = this.distanceBetween(cellB, targetUnit.position);
            if (distanceA !== distanceB) {
                return distanceA - distanceB;
            }
            const currentDistance = this.distanceBetween(actor.position, targetUnit.position);
            const progressA = currentDistance - distanceA;
            const progressB = currentDistance - distanceB;
            if (progressA !== progressB) {
                return progressB - progressA;
            }
            return cellA.y - cellB.y || cellA.x - cellB.x;
        });
        return reachableCells[0] || null;
    }

    getTauntedAction(actor) {
        const taunt = this.getActiveTaunt(actor);
        if (!taunt) {
            return null;
        }

        if (this.isCellTargetable(actor, taunt.source.position, actor.attackRange)) {
            return { type: 'attack', targetId: taunt.source.id, forcedByTaunt: true };
        }

        const moveCell = this.chooseBestMoveToward(actor, taunt.source);
        if (moveCell) {
            return {
                type: 'taunt_chase',
                targetId: taunt.source.id,
                position: moveCell,
                forcedByTaunt: true
            };
        }

        return {
            type: 'defend',
            targetId: taunt.source.id,
            forcedByTaunt: true
        };
    }

    getSkillTargetCandidates(actor, skillIndex = 0, options = {}) {
        const ignoreUsable = options.ignoreUsable === true;
        const targetType = actor.getSkillTargetType?.(skillIndex) || 'enemy';
        const range = Number(actor.getSkillRange?.(skillIndex));
        if (!ignoreUsable && !this.canActorUseSkill(actor, skillIndex)) {
            return [];
        }
        if (targetType === 'self') {
            return [actor];
        }
        const targetPool = targetType === 'ally'
            ? this.getAllies(actor)
            : this.getOpponents(actor);
        return targetPool.filter(target => target.isAlive() && this.isCellTargetable(actor, target.position, range));
    }

    getSkillRangeCells(actor, skillIndex = 0, options = {}) {
        const targetType = actor.getSkillTargetType?.(skillIndex) || 'enemy';
        const range = Number(actor.getSkillRange?.(skillIndex));
        if (targetType === 'self') {
            return [{ x: actor.position.x, y: actor.position.y }];
        }
        if (options.previewRaw) {
            return this.getRawRangeCells(actor, range);
        }
        if (!options.ignoreUsable && !this.canActorUseSkill(actor, skillIndex)) {
            return [];
        }
        return this.getRawRangeCells(actor, range).filter(position => !this.hasObstacleBetween(actor.position, position));
    }

    getSelectedSkillTargets(actor, primaryTarget, skillIndex = 0) {
        const targetType = actor.getSkillTargetType?.(skillIndex) || 'enemy';
        if (targetType === 'self') {
            return [actor];
        }
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
                range: Number.isFinite(Number(actor.getSkillRange?.(index))) ? Number(actor.getSkillRange?.(index)) : actor.attackRange,
                targetType: actor.getSkillTargetType?.(index) || 'enemy',
                targetCount: actor.getSkillTargetCount?.(index) || 1,
                cooldownTurns: state.cooldownTurns || 0,
                cooldownRemaining: state.cooldownRemaining || 0,
                hpCost,
                canUse: this.canActorUseSkill(actor, index)
            };
        });
    }

    getAttackRangeCells(actor) {
        return this.getRawRangeCells(actor, actor.attackRange);
    }

    chooseRandomUnits(units = [], count = 1) {
        const pool = Array.isArray(units) ? [...units] : [];
        for (let index = pool.length - 1; index > 0; index--) {
            const swapIndex = Math.floor(Math.random() * (index + 1));
            [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
        }
        return pool.slice(0, Math.max(0, Number(count) || 0));
    }

    consumePassiveHpCost(actor, hpCostPercent = 0) {
        const normalizedPercent = Math.max(0, Number(hpCostPercent) || 0);
        if (!actor || normalizedPercent <= 0) {
            return 0;
        }
        const rawCost = Math.max(1, Math.floor(actor.hp * normalizedPercent / 100));
        const actualCost = Math.min(rawCost, Math.max(0, actor.hp - 1));
        if (actualCost > 0) {
            actor.hp = Math.max(1, actor.hp - actualCost);
        }
        return actualCost;
    }

    applyPassiveStatusEffectsToAllies(actor, passiveEffect = {}) {
        const statusEffects = Array.isArray(passiveEffect?.allyStatusEffects) ? passiveEffect.allyStatusEffects : [];
        if (!actor || !statusEffects.length) {
            return [];
        }
        const includeSelf = passiveEffect.allyStatusTarget !== 'allies_only';
        const allies = this.getAllies(actor).filter(unit => includeSelf || unit.id !== actor.id);
        const appliedResults = [];
        allies.forEach((ally) => {
            const appliedEffects = ally.applyStatusEffects(statusEffects, actor);
            if (appliedEffects.length > 0) {
                appliedResults.push({
                    unit: ally,
                    appliedEffects
                });
            }
        });
        return appliedResults;
    }

    getAlliesInRange(actor, range = 1, options = {}) {
        const normalizedRange = Math.max(0, Number(range) || 0);
        return this.getAllies(actor).filter((ally) => {
            if (!ally?.isAlive?.() || !ally.isAlive()) {
                return false;
            }
            if (options.excludeSelf && ally.id === actor.id) {
                return false;
            }
            if (normalizedRange <= 0) {
                return ally.id === actor.id;
            }
            return this.isCellTargetable(actor, ally.position, normalizedRange);
        });
    }

    triggerDamageTakenPassives(actor, context = {}) {
        if (!actor?.isAlive?.() || !actor.isAlive()) {
            return [];
        }

        const damage = Math.max(0, Number(context.damage) || 0);
        if (damage <= 0) {
            return [];
        }

        const passiveEffects = actor?.getPassiveEffects?.('damage_taken_threshold') || [];
        const results = [];
        passiveEffects.forEach((passiveEffect) => {
            if (passiveEffect.sourceOpponentOnly && (!context.sourceUnit || context.sourceUnit.camp === actor.camp)) {
                return;
            }

            const chance = Utils.clamp(Number(passiveEffect?.chance ?? 1) || 0, 0, 1);
            if (chance <= 0 || Math.random() > chance) {
                return;
            }

            const thresholdRatio = Math.max(0, Number(passiveEffect?.thresholdMaxHpRatio) || 0);
            const healMissingHpRatio = Math.max(0, Number(passiveEffect?.healMissingHpRatio) || 0);
            if (thresholdRatio <= 0 || healMissingHpRatio <= 0) {
                return;
            }

            const threshold = Math.max(1, Math.floor(actor.maxHp * thresholdRatio));
            const stateKey = passiveEffect.id || passiveEffect.name || 'damage_taken_threshold';
            actor.passiveState = actor.passiveState || {};
            const previous = Math.max(0, Number(actor.passiveState[stateKey]?.accumulatedDamage) || 0);
            const total = previous + damage;
            const availableTriggers = Math.floor(total / threshold);
            const maxTriggers = Math.max(1, Number(passiveEffect?.maxTriggersPerHit) || availableTriggers || 1);
            const triggerCount = Math.min(availableTriggers, maxTriggers);

            actor.passiveState[stateKey] = {
                accumulatedDamage: availableTriggers > maxTriggers
                    ? total % threshold
                    : total - triggerCount * threshold
            };

            if (triggerCount <= 0) {
                return;
            }

            const range = Math.max(0, Number(passiveEffect?.range ?? 1) || 0);
            const targetCount = Math.max(1, Number(passiveEffect?.targetCount ?? 1) || 1);
            const allyStatusEffects = Array.isArray(passiveEffect?.allyStatusEffects)
                ? passiveEffect.allyStatusEffects
                : [];

            for (let triggerIndex = 0; triggerIndex < triggerCount; triggerIndex++) {
                const candidates = this.getAlliesInRange(actor, range, { excludeSelf: passiveEffect.excludeSelf !== false });
                const targets = this.chooseRandomUnits(candidates, targetCount);
                const healedEntries = [];

                targets.forEach((ally) => {
                    const missingHp = Math.max(0, ally.maxHp - ally.hp);
                    const actualHeal = missingHp > 0
                        ? ally.heal(Math.max(1, Math.floor(missingHp * healMissingHpRatio)))
                        : 0;
                    const appliedEffects = allyStatusEffects.length > 0
                        ? ally.applyStatusEffects(allyStatusEffects, actor)
                        : [];

                    if (actualHeal <= 0 && appliedEffects.length <= 0) {
                        return;
                    }

                    healedEntries.push({ ally, heal: actualHeal, appliedEffects });
                    eventManager.emit('battleUnitAction', {
                        attacker: actor,
                        target: ally,
                        damage: 0,
                        actionType: 'status',
                        result: {
                            hit: true,
                            heal: actualHeal,
                            appliedEffects,
                            statusName: passiveEffect?.name || '被动恢复',
                            triggerName: passiveEffect?.name || '被动'
                        }
                    });
                });

                if (healedEntries.length > 0) {
                    const summary = healedEntries
                        .map(entry => `${entry.ally.name}${entry.heal > 0 ? ` +${entry.heal}` : ''}`)
                        .join('、');
                    this.addLog('heal', `${actor.name} 触发 ${passiveEffect?.name || '被动'}，支援 ${summary}`);
                    results.push({
                        effect: passiveEffect,
                        triggerIndex,
                        targets: healedEntries
                    });
                }
            }
        });

        return results;
    }

    getNextPassiveChainMultiplier(passiveEffect = {}, currentMultiplier = 0) {
        const decayRatio = Utils.clamp(Number(passiveEffect?.chainDecayRatio ?? 0.35) || 0.35, 0, 0.95);
        const minMultiplier = Math.max(0, Number(passiveEffect?.chainMinMultiplier ?? 0.3) || 0.3);
        return Math.max(minMultiplier, currentMultiplier * (1 - decayRatio));
    }

    triggerMoveEndPassives(actor) {
        const passiveEffects = actor?.getPassiveEffects?.('move_end') || [];
        passiveEffects.forEach((passiveEffect) => {
            const chance = Utils.clamp(Number(passiveEffect?.chance ?? 1) || 0, 0, 1);
            if (chance <= 0 || Math.random() > chance) {
                return;
            }
            const targets = this.getAttackableTargets(actor);
            const target = this.chooseRandomUnits(targets, 1)[0] || null;
            if (!target) {
                return;
            }

            const attackResult = actor.performConfiguredAttack(target, {
                multiplier: Number(passiveEffect?.multiplier ?? 1) || 1,
                canCrit: passiveEffect?.canCrit === true,
                defensePenBonus: Math.max(0, Number(passiveEffect?.defensePenBonus ?? 0) || 0),
                triggerName: passiveEffect?.name || '被动'
            });

            let hpCost = 0;
            if (attackResult.hit && attackResult.damage > 0) {
                hpCost = this.consumePassiveHpCost(actor, passiveEffect?.hpCostPercent);
            }
            attackResult.hpCost = hpCost;

            if (!attackResult.hit) {
                this.addLog('miss', `${actor.name} 位移后触发 ${passiveEffect?.name || '被动'}，但对 ${target.name} 的追击被闪避了`);
            } else {
                const hpCostText = hpCost > 0 ? `，并消耗 ${hpCost} 点生命` : '';
                this.addLog('damage', `${actor.name} 位移后触发 ${passiveEffect?.name || '被动'}，对 ${target.name} 造成 ${attackResult.damage} 点伤害${hpCostText}`);
            }

            eventManager.emit('battleUnitAction', {
                attacker: actor,
                target,
                damage: attackResult.damage,
                actionType: 'attack',
                result: attackResult
            });

            if (!target.isAlive()) {
                this.processDefeatedUnit(target, {
                    attacker: actor,
                    reason: 'move_end_passive'
                });
            }
        });
    }

    triggerKillPassives(actor, defeatedUnit, context = {}) {
        const passiveEffects = actor?.getPassiveEffects?.('kill') || [];
        passiveEffects.forEach((passiveEffect) => {
            const healMissingHpRatio = Math.max(0, Number(passiveEffect?.selfHealMissingHpRatio) || 0);
            if (healMissingHpRatio > 0) {
                const missingHp = Math.max(0, actor.maxHp - actor.hp);
                if (missingHp > 0) {
                    const actualHeal = actor.heal(Math.max(1, Math.floor(missingHp * healMissingHpRatio)));
                    if (actualHeal > 0) {
                        this.addLog('heal', `${actor.name} 触发 ${passiveEffect?.name || '被动'}，恢复 ${actualHeal} 点生命`);
                        eventManager.emit('battleUnitAction', {
                            attacker: actor,
                            target: actor,
                            damage: 0,
                            actionType: 'status',
                            result: {
                                hit: true,
                                heal: actualHeal,
                                statusName: passiveEffect?.name || '被动恢复'
                            }
                        });
                    }
                }
            }

            const allyBuffResults = this.applyPassiveStatusEffectsToAllies(actor, passiveEffect);
            if (allyBuffResults.length > 0) {
                const buffName = allyBuffResults[0]?.appliedEffects?.[0]?.name || passiveEffect?.name || '增益';
                const allyNames = allyBuffResults.map(entry => entry.unit.name).join('、');
                this.addLog('control', `${actor.name} 触发 ${passiveEffect?.name || '被动'}，使 ${allyNames} 获得 ${buffName}`);
                allyBuffResults.forEach((entry) => {
                    eventManager.emit('battleUnitAction', {
                        attacker: actor,
                        target: entry.unit,
                        damage: 0,
                        actionType: 'status',
                        result: {
                            hit: true,
                            statusName: passiveEffect?.name || buffName,
                            appliedEffects: entry.appliedEffects,
                            triggerName: passiveEffect?.name || buffName
                        }
                    });
                });
            }

            const currentMultiplier = Number.isFinite(Number(context?.chainMultiplier))
                ? Number(context.chainMultiplier)
                : Math.max(0, Number(passiveEffect?.chainInitialMultiplier ?? 0) || 0);
            if (currentMultiplier <= 0) {
                return;
            }

            const chainTargets = this.getAttackableTargets(actor);
            const chainTarget = this.chooseRandomUnits(chainTargets, 1)[0] || null;
            if (!chainTarget) {
                return;
            }

            const chainResult = actor.performConfiguredAttack(chainTarget, {
                multiplier: currentMultiplier,
                canCrit: passiveEffect?.canCrit === true,
                defensePenBonus: Math.max(0, Number(passiveEffect?.defensePenBonus ?? 0) || 0),
                triggerName: passiveEffect?.name || '被动'
            });

            const multiplierText = `${Math.round(currentMultiplier * 100)}%`;
            if (!chainResult.hit) {
                this.addLog('miss', `${actor.name} 触发 ${passiveEffect?.name || '被动'}，追击 ${chainTarget.name} 时被闪避了`);
            } else {
                this.addLog('damage', `${actor.name} 触发 ${passiveEffect?.name || '被动'}，对 ${chainTarget.name} 追加 ${multiplierText} 伤害，造成 ${chainResult.damage} 点伤害`);
            }

            eventManager.emit('battleUnitAction', {
                attacker: actor,
                target: chainTarget,
                damage: chainResult.damage,
                actionType: 'attack',
                result: chainResult
            });

            if (!chainTarget.isAlive()) {
                this.processDefeatedUnit(chainTarget, {
                    attacker: actor,
                    reason: 'kill_chain',
                    chainMultiplier: this.getNextPassiveChainMultiplier(passiveEffect, currentMultiplier)
                });
            }
        });
    }

    clearTauntsFromSource(sourceUnit) {
        if (!sourceUnit?.id) {
            return [];
        }

        const cleared = [];
        this.getAllUnits().forEach((unit) => {
            const removedEffects = unit.removeStatusEffectsWhere?.(effect => effect.type === 'taunt' && effect.sourceUnitId === sourceUnit.id) || [];
            if (removedEffects.length > 0) {
                cleared.push({ unit, removedEffects });
                eventManager.emit('battleUnitAction', {
                    attacker: sourceUnit,
                    target: unit,
                    damage: 0,
                    actionType: 'status_expire',
                    result: { expiredEffects: removedEffects }
                });
            }
        });
        return cleared;
    }

    processDefeatedUnit(unit, context = {}) {
        if (!unit || unit.isAlive()) {
            return false;
        }
        this.addLog('death', `${unit.name} 倒下了！`);
        eventManager.emit('battleUnitDie', { unit });
        this.clearTauntsFromSource(unit);
        if (context?.attacker?.isAlive?.() && context.attacker.isAlive()) {
            this.triggerKillPassives(context.attacker, unit, context);
        }
        return true;
    }

    canActorUseSkill(actor, skillIndex = 0) {
        if (!actor?.canUseSkill?.(skillIndex)) {
            return false;
        }
        const skill = actor.getSkill?.(skillIndex) || {};
        const customEffect = skill?.customEffect || null;
        if (!customEffect) {
            return true;
        }
        if (customEffect.type === 'augment_formation') {
            const formationState = this.getFormationState(actor.id);
            return Boolean(
                formationState
                && formationState.effects?.[customEffect.requiredFormationType || 'defense']
            );
        }
        return true;
    }

    getFormationState(ownerId) {
        return this.formationStates.find(state => state.ownerId === ownerId) || null;
    }

    removeFormationState(ownerId) {
        const previousLength = this.formationStates.length;
        this.formationStates = this.formationStates.filter(state => state.ownerId !== ownerId);
        return this.formationStates.length !== previousLength;
    }

    getFormationBehindDirection(owner) {
        return owner?.camp === 'hero' ? 1 : -1;
    }

    getFormationAreaCells(state, owner) {
        if (!state || !owner?.position) {
            return [];
        }
        const anchor = state.anchorPosition || owner.position;
        const behindDirection = this.getFormationBehindDirection(owner);
        const rowY = anchor.y + behindDirection;
        const cells = [{ x: anchor.x, y: anchor.y }];
        if (rowY >= 0 && rowY < this.scene.height) {
            for (let xOffset = -1; xOffset <= 1; xOffset++) {
                const cell = { x: anchor.x + xOffset, y: rowY };
                if (this.isInsideBoard(cell)) {
                    cells.push(cell);
                }
            }
        }
        const unique = new Map();
        cells.forEach(cell => {
            if (this.isInsideBoard(cell)) {
                unique.set(`${cell.x},${cell.y}`, cell);
            }
        });
        return [...unique.values()];
    }

    isFormationEffectActive(effect = {}) {
        return (Number(effect.pendingOwnerTurns) || 0) <= 0;
    }

    isUnitInsideFormation(unit, state, owner) {
        if (!unit?.position || !state || !owner?.isAlive?.() || !owner.isAlive()) {
            return false;
        }
        if (state.anchorPosition && (owner.position.x !== state.anchorPosition.x || owner.position.y !== state.anchorPosition.y)) {
            return false;
        }
        const effectShape = state.shape || 'self_and_rear_row';
        if (effectShape !== 'self_and_rear_row') {
            return false;
        }
        return this.getFormationAreaCells(state, owner).some(cell => cell.x === unit.position.x && cell.y === unit.position.y);
    }

    getUnitBattleModifiers(unit) {
        const modifiers = {
            attackPercentBonus: 0,
            defensePercentBonus: 0,
            damageReduction: 0
        };
        if (!unit?.isAlive?.() || !unit.isAlive()) {
            return modifiers;
        }

        this.formationStates.forEach((state) => {
            const owner = this.findUnitById(state.ownerId);
            if (!owner?.isAlive?.() || !owner.isAlive() || owner.camp !== unit.camp) {
                return;
            }
            if (!this.isUnitInsideFormation(unit, state, owner)) {
                return;
            }

            Object.values(state.effects || {}).forEach((effect) => {
                if (!effect || !this.isFormationEffectActive(effect)) {
                    return;
                }
                modifiers.attackPercentBonus += Number(effect.attackPercentBonus) || 0;
                modifiers.defensePercentBonus += Number(effect.defensePercentBonus) || 0;
                modifiers.damageReduction += Number(effect.damageReduction) || 0;
            });
        });

        modifiers.damageReduction = Utils.clamp(modifiers.damageReduction, 0, 0.95);
        return modifiers;
    }

    normalizeFormationEffect(effect = {}) {
        return {
            name: effect.name || '阵地',
            pendingOwnerTurns: Math.max(0, Number(effect.pendingOwnerTurns) || 0),
            upkeepHpCostPercent: Math.max(0, Number(effect.upkeepHpCostPercent) || 0),
            damageReduction: Math.max(0, Number(effect.damageReduction) || 0),
            attackPercentBonus: Math.max(0, Number(effect.attackPercentBonus) || 0),
            healMissingHpRatio: Math.max(0, Number(effect.healMissingHpRatio) || 0),
            excludeOwnerFromHeal: effect.excludeOwnerFromHeal !== false,
            sourceSkillName: effect.sourceSkillName || null
        };
    }

    upsertFormationEffect(owner, effectType, effectConfig = {}) {
        if (!owner) {
            return null;
        }
        let state = this.getFormationState(owner.id);
        if (!state) {
            state = {
                ownerId: owner.id,
                shape: effectConfig.shape || 'self_and_rear_row',
                anchorPosition: { x: owner.position.x, y: owner.position.y },
                effects: {}
            };
            this.formationStates.push(state);
        } else {
            state.anchorPosition = { x: owner.position.x, y: owner.position.y };
            state.shape = effectConfig.shape || state.shape || 'self_and_rear_row';
        }
        state.effects[effectType] = this.normalizeFormationEffect(effectConfig);
        return state;
    }

    deactivateFormationByMovement(actor) {
        if (!actor) {
            return false;
        }
        const removed = this.removeFormationState(actor.id);
        if (removed) {
            this.addLog('control', `${actor.name} 移动后，原地阵地随之解除`);
        }
        return removed;
    }

    processFormationTurnStart(actor) {
        const events = [];
        if (!actor?.isAlive?.() || !actor.isAlive()) {
            return events;
        }

        const state = this.getFormationState(actor.id);
        if (state) {
            if (state.anchorPosition && (actor.position.x !== state.anchorPosition.x || actor.position.y !== state.anchorPosition.y)) {
                this.removeFormationState(actor.id);
                events.push({ type: 'formation_removed', ownerOnly: true, message: `${actor.name} 离开原位，阵地解除` });
            } else {
                Object.entries(state.effects || {}).forEach(([effectType, effect]) => {
                    if (!effect) {
                        return;
                    }
                    if ((Number(effect.pendingOwnerTurns) || 0) > 0) {
                        effect.pendingOwnerTurns = Math.max(0, (Number(effect.pendingOwnerTurns) || 0) - 1);
                    }
                    const upkeepPercent = Number(effect.upkeepHpCostPercent) || 0;
                    if (upkeepPercent > 0) {
                        const rawCost = Math.max(1, Math.floor(actor.hp * upkeepPercent / 100));
                        const actualCost = Math.min(rawCost, Math.max(0, actor.hp - 1));
                        if (actualCost > 0) {
                            actor.hp = Math.max(1, actor.hp - actualCost);
                            events.push({
                                type: 'formation_upkeep',
                                ownerOnly: true,
                                effectType,
                                effectName: effect.name || '阵地',
                                cost: actualCost
                            });
                        } else {
                            delete state.effects[effectType];
                            events.push({
                                type: 'formation_removed',
                                ownerOnly: true,
                                effectType,
                                message: `${actor.name} 生命不足，${effect.name || '阵地'}无法继续维持`
                            });
                        }
                    }
                });
                if (Object.keys(state.effects || {}).length === 0) {
                    this.removeFormationState(actor.id);
                }
            }
        }

        this.formationStates.forEach((formationState) => {
            const owner = this.findUnitById(formationState.ownerId);
            if (!owner?.isAlive?.() || !owner.isAlive() || owner.camp !== actor.camp) {
                return;
            }
            if (!this.isUnitInsideFormation(actor, formationState, owner)) {
                return;
            }
            Object.values(formationState.effects || {}).forEach((effect) => {
                if (!effect || !this.isFormationEffectActive(effect)) {
                    return;
                }
                const healMissingHpRatio = Number(effect.healMissingHpRatio) || 0;
                if (healMissingHpRatio <= 0) {
                    return;
                }
                if (effect.excludeOwnerFromHeal && owner.id === actor.id) {
                    return;
                }
                const missingHp = Math.max(0, actor.maxHp - actor.hp);
                if (missingHp <= 0) {
                    return;
                }
                const actualHeal = actor.heal(Math.max(1, Math.floor(missingHp * healMissingHpRatio)));
                if (actualHeal > 0) {
                    events.push({
                        type: 'formation_heal',
                        sourceUnitId: owner.id,
                        sourceName: owner.name,
                        effectName: effect.name || '阵地',
                        heal: actualHeal
                    });
                }
            });
        });

        return events;
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
        const tauntedAction = this.getTauntedAction(actor);
        if (tauntedAction) {
            return tauntedAction;
        }

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
        const tauntedAction = this.getTauntedAction(actor);
        if (tauntedAction) {
            return tauntedAction;
        }

        if (actor.camp === 'hero' && !this.isAutoBattleEnabled() && typeof this.decisionProvider === 'function') {
            const action = await this.decisionProvider({
                actor,
                attackTargets: this.getAttackableTargets(actor),
                moveCells: this.getReachableCells(actor),
                usableItems: this.getUsableBattleItems(actor),
                usableSkills: this.getUsableSkills(actor),
                timeout: this.scene.actionTimeout || 25
            });

            return action || { type: 'defend' };
        }
        return this.chooseAutoAction(actor);
    }

    findUnitById(unitId) {
        return this.getAllUnits().find(unit => unit.id === unitId) || null;
    }

    formatStatusDescription(effect = {}) {
        const name = effect.name || '状态';
        const duration = Math.max(1, Number(effect.remainingTurns ?? effect.durationTurns) || 1);
        switch (effect.type) {
            case 'slow':
                return `${name}${Math.round(Math.abs((Number(effect.value) || 0) * 100))}%（持续${duration}回合）`;
            case 'stun':
                return `${name}（持续${duration}回合）`;
            case 'silence':
                return `${name}（持续${duration}回合）`;
            case 'taunt':
                return effect.sourceName
                    ? `${name}（来源：${effect.sourceName}，持续${duration}回合）`
                    : `${name}（持续${duration}回合）`;
            case 'haze_mark': {
                const bonus = Math.round((Number(effect.damageTakenDebuffBonus) || 0) * 100);
                return bonus > 0
                    ? `${name}（易伤${bonus}%，持续${duration}回合）`
                    : `${name}（持续${duration}回合）`;
            }
            case 'black_wall': {
                const defenseBonus = Math.round((Number(effect.value) || 0) * 100);
                const reduction = Math.round((Number(effect.damageReduction) || 0) * 1000) / 10;
                const reductionText = reduction > 0 ? `，减伤${reduction}%` : '';
                return `${name}（防御+${defenseBonus}%${reductionText}，持续${duration}回合）`;
            }
            case 'battle_guard': {
                const reduction = Math.round((Number(effect.damageReduction) || 0) * 100);
                return reduction > 0
                    ? `${name}（减伤${reduction}%，持续${duration}回合）`
                    : `${name}（持续${duration}回合）`;
            }
            case 'bleed':
                return `${name}（持续${duration}回合）`;
            case 'burn':
                return `${name}（持续${duration}回合，可叠加）`;
            default:
                return `${name}（持续${duration}回合）`;
        }
    }

    applySkillStatusEffects(actor, targetUnit, skillIndex = 0, attackResult = {}) {
        if (!attackResult?.hit || !targetUnit?.isAlive()) {
            return [];
        }
        const statusEffects = actor.getSkillStatusEffects?.(skillIndex) || [];
        if (!statusEffects.length) {
            return [];
        }
        const appliedEffects = targetUnit.applyStatusEffects(statusEffects, actor);
        const extraStatusEffects = actor.getSkillExtraStatusEffects?.(skillIndex) || [];
        const skill = actor.getSkill?.(skillIndex);
        const extraStatusEffectChance = Number(skill?.extraStatusEffectChance) || 0;

        if (extraStatusEffects.length > 0 && extraStatusEffectChance > 0 && Math.random() <= extraStatusEffectChance) {
            appliedEffects.push(...targetUnit.applyStatusEffects(extraStatusEffects, actor));
        }

        return appliedEffects;
    }

    applyBasicAttackEffects(actor, targetUnit, attackResult = {}) {
        if (!attackResult?.hit || !targetUnit?.isAlive()) {
            return [];
        }

        const attackEffects = actor.getBasicAttackEffects?.('hit') || [];
        const appliedEffects = [];
        attackResult.basicAttackTriggers = [];
        attackEffects.forEach((effect) => {
            const chance = Utils.clamp(Number(effect?.chance ?? 1) || 0, 0, 1);
            if (chance <= 0 || Math.random() > chance) {
                return;
            }
            const selfHealMissingHpRatio = Math.max(0, Number(effect?.selfHealMissingHpRatio) || 0);
            if (selfHealMissingHpRatio > 0) {
                const missingHp = Math.max(0, actor.maxHp - actor.hp);
                if (missingHp > 0) {
                    const actualHeal = actor.heal(Math.max(1, Math.floor(missingHp * selfHealMissingHpRatio)));
                    if (actualHeal > 0) {
                        attackResult.selfHeal = (Number(attackResult.selfHeal) || 0) + actualHeal;
                        attackResult.basicAttackTriggers.push({
                            type: 'self_heal',
                            heal: actualHeal
                        });
                    }
                }
            }
            const statuses = Array.isArray(effect?.statusEffects) ? effect.statusEffects : [];
            if (!statuses.length) {
                return;
            }
            const selectedStatuses = effect.statusSelection === 'random_one'
                ? [statuses[Math.floor(Math.random() * statuses.length)]].filter(Boolean)
                : statuses;
            appliedEffects.push(...targetUnit.applyStatusEffects(selectedStatuses, actor));
        });
        return appliedEffects;
    }

    resolveCustomSkillEffect(actor, targetUnit, skillIndex = 0, attackResult = {}) {
        if (!attackResult?.hit || !targetUnit?.isAlive()) {
            return null;
        }

        const skill = actor.getSkill?.(skillIndex);
        const customEffect = skill?.customEffect;
        if (!customEffect) {
            return null;
        }

        if (customEffect.type === 'activate_formation') {
            this.upsertFormationEffect(actor, customEffect.formationType || 'defense', {
                ...customEffect,
                sourceSkillName: skill?.name || null
            });
            return {
                type: 'activate_formation',
                formationType: customEffect.formationType || 'defense',
                effectName: customEffect.name || skill?.name || '阵地',
                pendingOwnerTurns: Math.max(0, Number(customEffect.pendingOwnerTurns) || 0)
            };
        }

        if (customEffect.type === 'augment_formation') {
            const formationState = this.getFormationState(actor.id);
            const requiredFormationType = customEffect.requiredFormationType || 'defense';
            if (!formationState?.effects?.[requiredFormationType]) {
                return {
                    type: 'augment_formation',
                    failed: true,
                    reason: `需先展开${customEffect.requiredFormationName || '御阵'}`
                };
            }
            this.upsertFormationEffect(actor, customEffect.formationType || 'offense', {
                ...customEffect,
                sourceSkillName: skill?.name || null
            });
            return {
                type: 'augment_formation',
                formationType: customEffect.formationType || 'offense',
                effectName: customEffect.name || skill?.name || '阵地',
                pendingOwnerTurns: Math.max(0, Number(customEffect.pendingOwnerTurns) || 0)
            };
        }

        if (customEffect.type !== 'consume_status_damage') {
            return null;
        }

        const statusType = customEffect.statusType || 'burn';
        const consumedStacks = targetUnit.countStatusStacks?.(statusType) || 0;
        const extraMultiplier = Math.max(0, Number(customEffect.extraMultiplier) || 0);
        let extraDamage = 0;

        if (consumedStacks > 0 && extraMultiplier > 0) {
            const rawDamage = Math.floor(actor._attack * actor.attackCoefficient * consumedStacks * extraMultiplier);
            extraDamage = targetUnit.takeStatusDamage(rawDamage, customEffect.ignoreDefense !== false);
            attackResult.damage += extraDamage;
        }

        if (consumedStacks > 0 && customEffect.consumeStatus !== false) {
            targetUnit.removeStatusEffectsByType?.(statusType);
        }

        return {
            statusType,
            consumedStacks,
            extraDamage
        };
    }

    applyReactiveEffects(owner, trigger, context = {}) {
        if (!owner?.triggerReactiveEffects) {
            return [];
        }

        const reactions = owner.triggerReactiveEffects(trigger, context);
        reactions.forEach((reaction) => {
            const appliedEffects = Array.isArray(reaction?.appliedEffects) ? reaction.appliedEffects : [];
            if (!appliedEffects.length || !reaction?.targetUnit) {
                return;
            }
            const statusText = appliedEffects.map(effect => this.formatStatusDescription(effect)).join('、');
            this.addLog('control', `${owner.name} 触发 ${reaction.effect?.name || '被动'}，使 ${reaction.targetUnit.name} 陷入${statusText}`);
            eventManager.emit('battleUnitAction', {
                attacker: owner,
                target: reaction.targetUnit,
                damage: 0,
                actionType: 'status',
                result: {
                    hit: true,
                    statusName: appliedEffects.map(effect => effect.name || '状态').join('、'),
                    appliedEffects,
                    triggerName: reaction.effect?.name || '被动'
                }
            });
        });
        return reactions;
    }

    handleTurnStartEffects(actor, turnStartResult = {}) {
        const events = Array.isArray(turnStartResult?.events) ? turnStartResult.events : [];
        events.forEach((event) => {
            if (event.type === 'formation_upkeep' && event.cost > 0) {
                this.addLog('control', `${actor.name} 维持${event.effectName || '阵地'}，额外消耗 ${event.cost} 点生命`);
                return;
            }

            if (event.type === 'formation_heal' && event.heal > 0) {
                this.addLog('heal', `${actor.name} 受到${event.sourceName || '阵地'}的防护，恢复 ${event.heal} 点生命`);
                eventManager.emit('battleUnitAction', {
                    attacker: this.findUnitById(event.sourceUnitId) || actor,
                    target: actor,
                    damage: 0,
                    actionType: 'status',
                    result: {
                        hit: true,
                        heal: event.heal,
                        statusName: event.effectName || '阵地恢复'
                    }
                });
                return;
            }

            if (event.type === 'formation_removed' && event.message) {
                this.addLog('control', event.message);
                return;
            }

            if (event.type === 'status_damage' && event.damage > 0) {
                this.addLog('damage', `${actor.name} 受到${event.statusName || '持续伤害'}影响，损失 ${event.damage} 点生命`);
                eventManager.emit('battleUnitAction', {
                    attacker: this.findUnitById(event.sourceUnitId) || actor,
                    target: actor,
                    damage: event.damage,
                    actionType: 'status',
                    result: {
                        hit: true,
                        damage: event.damage,
                        statusType: event.statusType,
                        statusName: event.statusName,
                        sourceName: event.sourceName
                    }
                });
                this.applyReactiveEffects(actor, 'damaged', {
                    damage: event.damage,
                    sourceUnit: this.findUnitById(event.sourceUnitId) || null,
                    reason: 'status'
                });
                this.triggerDamageTakenPassives(actor, {
                    damage: event.damage,
                    sourceUnit: this.findUnitById(event.sourceUnitId) || null,
                    reason: 'status'
                });
                if (!actor.isAlive()) {
                    this.addLog('death', `${actor.name} 倒下了！`);
                    eventManager.emit('battleUnitDie', { unit: actor });
                    this.clearTauntsFromSource(actor);
                }
            }

            if (event.type === 'skip_action') {
                this.addLog('control', `${actor.name} 受${event.statusName || '控制'}影响，本回合无法行动`);
            }
        });
        this.emitStateChange();
    }

    async executeAction(actor, action) {
        if (!actor.isAlive()) {
            return;
        }
        const finalAction = action || { type: 'defend' };

        if (finalAction.type === 'taunt_chase') {
            const taunt = this.getActiveTaunt(actor);
            const source = taunt?.source || this.findUnitById(finalAction.targetId);
            const reachable = this.getReachableCells(actor).some(cell => cell.x === finalAction.position?.x && cell.y === finalAction.position?.y);
            if (!source?.isAlive?.() || !source.isAlive() || !reachable) {
                return this.executeAction(actor, { type: 'defend', forcedByTaunt: true, targetId: source?.id || finalAction.targetId });
            }

            const fromPosition = { x: actor.position.x, y: actor.position.y };
            this.deactivateFormationByMovement(actor);
            actor.setPosition(finalAction.position);
            this.addLog('move', `${actor.name} 受嘲讽影响，向 ${source.name} 移动到了 (${finalAction.position.x + 1}, ${finalAction.position.y + 1})`);
            eventManager.emit('battleUnitMove', {
                unit: actor,
                fromPosition,
                position: finalAction.position,
                toPosition: finalAction.position
            });
            this.emitStateChange();

            if (source.isAlive() && this.isCellTargetable(actor, source.position, actor.attackRange)) {
                await this.executeAction(actor, { type: 'attack', targetId: source.id, forcedByTaunt: true });
            } else {
                this.addLog('control', `${actor.name} 受嘲讽牵引，移动后仍无法攻击 ${source.name}`);
                eventManager.emit('battleUnitAction', {
                    attacker: actor,
                    target: source,
                    damage: 0,
                    actionType: 'defend',
                    result: { forcedByTaunt: true, statusName: taunt?.effect?.name || '嘲讽' }
                });
            }
            return;
        }

        if (finalAction.type === 'move') {
            const reachable = this.getReachableCells(actor).some(cell => cell.x === finalAction.position?.x && cell.y === finalAction.position?.y);
            if (!reachable) {
                return this.executeAction(actor, { type: 'defend' });
            }
            const fromPosition = { x: actor.position.x, y: actor.position.y };
            this.deactivateFormationByMovement(actor);
            actor.setPosition(finalAction.position);
            this.addLog('move', `${actor.name} 移动到了 (${finalAction.position.x + 1}, ${finalAction.position.y + 1})`);
            eventManager.emit('battleUnitMove', {
                unit: actor,
                fromPosition,
                position: finalAction.position,
                toPosition: finalAction.position
            });
            this.triggerMoveEndPassives(actor);
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
            eventManager.emit('battleUnitAction', {
                attacker: actor,
                target,
                damage: 0,
                actionType: 'item',
                itemId: finalAction.itemId,
                itemName: item.name || ItemConfig.getItemConfig(finalAction.itemId)?.name || '道具',
                message: result.message,
                result
            });
            this.emitStateChange();
            return;
        }

        if (finalAction.type === 'attack' || finalAction.type === 'skill') {
            const target = this.findUnitById(finalAction.targetId);
            const skillIndex = Number.isFinite(Number(finalAction.skillIndex)) ? Number(finalAction.skillIndex) : 0;
            const isSkill = finalAction.type === 'skill';
            const taunt = this.getActiveTaunt(actor);
            if (taunt && (isSkill || target?.id !== taunt.source.id)) {
                const tauntedAction = this.getTauntedAction(actor);
                return this.executeAction(actor, tauntedAction || { type: 'defend', forcedByTaunt: true, targetId: taunt.source.id });
            }
            const validTargets = isSkill
                ? this.getSkillTargetCandidates(actor, skillIndex)
                : this.getAttackableTargets(actor);
            if (!target || !target.isAlive() || !validTargets.some(unit => unit.id === target.id)) {
                return this.executeAction(actor, { type: 'defend' });
            }
            if (isSkill && !this.canActorUseSkill(actor, skillIndex)) {
                return this.executeAction(actor, { type: 'defend' });
            }

            if (isSkill) {
                const skill = actor.getSkill(skillIndex);
                const targets = this.getSelectedSkillTargets(actor, target, skillIndex);
                const hpCost = actor.consumeSkillCost(skillIndex);
                const skillLogs = [];
                const actionTargets = [];
                const defeatedTargets = [];
                const effectType = actor.getSkillState(skillIndex)?.effectType || 'damage';

                targets.forEach((targetUnit) => {
                    if (!targetUnit?.isAlive?.() || !targetUnit.isAlive()) {
                        return;
                    }
                    if (effectType === 'heal') {
                        const healValue = Math.max(1, Math.floor(actor._attack * actor.attackCoefficient * (Number(skill?.multiplier) || 1)));
                        const actualHeal = targetUnit.heal(healValue);
                        skillLogs.push(`${actor.name} 对 ${targetUnit.name} 施放 ${skill?.name || '特技'}，恢复 ${actualHeal} 点生命`);
                        actionTargets.push({ target: targetUnit, result: { hit: true, heal: actualHeal, useSkill: true, skillName: skill?.name || null } });
                    } else if (effectType === 'utility') {
                        const utilityResult = actor.buildSkillResultBase?.(targetUnit, skillIndex) || {
                            hit: true,
                            useSkill: true,
                            skillIndex,
                            skillName: skill?.name || null
                        };
                        utilityResult.hit = true;
                        const appliedEffects = this.applySkillStatusEffects(actor, targetUnit, skillIndex, utilityResult);
                        utilityResult.appliedEffects = appliedEffects;
                        const customEffectResult = this.resolveCustomSkillEffect(actor, targetUnit, skillIndex, utilityResult);
                        utilityResult.customEffectResult = customEffectResult;
                        if (customEffectResult?.failed) {
                            skillLogs.push(`${actor.name} 施放 ${skill?.name || '特技'} 失败：${customEffectResult.reason || '条件不足'}`);
                        } else if (customEffectResult?.type === 'activate_formation') {
                            const startText = customEffectResult.pendingOwnerTurns > 0
                                ? `将在${customEffectResult.pendingOwnerTurns}次自身行动后生效`
                                : '立即生效';
                            skillLogs.push(`${actor.name} 在原地展开 ${customEffectResult.effectName || skill?.name || '阵地'}，${startText}`);
                        } else if (customEffectResult?.type === 'augment_formation') {
                            const startText = customEffectResult.pendingOwnerTurns > 0
                                ? `将在${customEffectResult.pendingOwnerTurns}次自身行动后生效`
                                : '立即生效';
                            skillLogs.push(`${actor.name} 为阵地追加 ${customEffectResult.effectName || skill?.name || '强化'}，${startText}`);
                        } else if (appliedEffects.length > 0) {
                            const statusText = appliedEffects.map(effect => this.formatStatusDescription(effect)).join('、');
                            skillLogs.push(`${actor.name} 对 ${targetUnit.name} 施放 ${skill?.name || '特技'}，施加${statusText}`);
                        } else {
                            skillLogs.push(`${actor.name} 施放 ${skill?.name || '特技'}`);
                        }
                        actionTargets.push({ target: targetUnit, result: utilityResult });
                    } else {
                        const attackResult = actor.attackTarget(targetUnit, true, skillIndex);
                        if (!attackResult.hit) {
                            skillLogs.push(`${actor.name} 对 ${targetUnit.name} 施放 ${skill?.name || '特技'}，但被闪避了`);
                        } else {
                            const appliedEffects = this.applySkillStatusEffects(actor, targetUnit, skillIndex, attackResult);
                            attackResult.appliedEffects = appliedEffects;
                            const customEffectResult = this.resolveCustomSkillEffect(actor, targetUnit, skillIndex, attackResult);
                            attackResult.customEffectResult = customEffectResult;
                            const reactiveResults = this.applyReactiveEffects(targetUnit, 'damaged', {
                                damage: attackResult.damage,
                                sourceUnit: actor,
                                reason: 'skill',
                                attackResult
                            });
                            const damageTakenPassiveResults = this.triggerDamageTakenPassives(targetUnit, {
                                damage: attackResult.damage,
                                sourceUnit: actor,
                                reason: 'skill',
                                attackResult
                            });
                            attackResult.reactiveEffects = reactiveResults;
                            attackResult.damageTakenPassives = damageTakenPassiveResults;
                            const statusText = appliedEffects.length > 0
                                ? `，并施加${appliedEffects.map(effect => this.formatStatusDescription(effect)).join('、')}`
                                : '';
                            const customText = customEffectResult?.consumedStacks > 0
                                ? `，结算${customEffectResult.consumedStacks}层${customEffectResult.statusType === 'burn' ? '灼烧' : '状态'}追加 ${customEffectResult.extraDamage} 点伤害`
                                : '';
                            skillLogs.push(`${actor.name} 对 ${targetUnit.name} 施放 ${skill?.name || '特技'}，造成 ${attackResult.damage} 点伤害${attackResult.isCritical ? '（暴击）' : ''}${statusText}${customText}`);
                        }
                        actionTargets.push({ target: targetUnit, result: attackResult });
                        if (!targetUnit.isAlive()) {
                            defeatedTargets.push(targetUnit);
                        }
                    }
                });

                if (hpCost > 0) {
                    skillLogs.push(`${actor.name} 额外消耗 ${hpCost} 点生命施放特技`);
                }
                const skillLogType = effectType === 'heal'
                    ? 'heal'
                    : (effectType === 'utility' ? 'control' : 'damage');
                skillLogs.forEach(message => this.addLog(skillLogType, message));
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
                defeatedTargets.forEach((targetUnit) => {
                    this.processDefeatedUnit(targetUnit, {
                        attacker: actor,
                        reason: 'skill'
                    });
                });
                this.emitStateChange();
                return;
            }

            const attackResult = actor.attackTarget(target, false);
            if (!attackResult.hit) {
                this.addLog('miss', `${actor.name} 攻击 ${target.name}，但被闪避了`);
            } else {
                const appliedEffects = this.applyBasicAttackEffects(actor, target, attackResult);
                attackResult.appliedEffects = appliedEffects;
                const reactiveResults = this.applyReactiveEffects(target, 'damaged', {
                    damage: attackResult.damage,
                    sourceUnit: actor,
                    reason: 'attack',
                    attackResult
                });
                const damageTakenPassiveResults = this.triggerDamageTakenPassives(target, {
                    damage: attackResult.damage,
                    sourceUnit: actor,
                    reason: 'attack',
                    attackResult
                });
                attackResult.reactiveEffects = reactiveResults;
                attackResult.damageTakenPassives = damageTakenPassiveResults;
                const statusText = appliedEffects.length > 0
                    ? `，并施加${appliedEffects.map(effect => this.formatStatusDescription(effect)).join('、')}`
                    : '';
                const healText = attackResult.selfHeal > 0
                    ? `，并恢复自身 ${attackResult.selfHeal} 点生命`
                    : '';
                const logText = `${actor.name} 对 ${target.name} 造成 ${attackResult.damage} 点伤害${attackResult.isCritical ? '（暴击）' : ''}${statusText}${healText}`;
                this.addLog('damage', logText);
            }
            eventManager.emit('battleUnitAction', { attacker: actor, target, damage: attackResult.damage, actionType: finalAction.type, result: attackResult });
            if (!target.isAlive()) {
                this.processDefeatedUnit(target, {
                    attacker: actor,
                    reason: finalAction.type
                });
            }
            this.emitStateChange();
            return;
        }

        if (finalAction.forcedByTaunt) {
            const source = this.findUnitById(finalAction.targetId);
            this.addLog('control', `${actor.name} 受嘲讽影响，但无法接近 ${source?.name || '来源单位'}，本回合结束`);
            eventManager.emit('battleUnitAction', {
                attacker: actor,
                target: actor,
                damage: 0,
                actionType: 'defend',
                result: { forcedByTaunt: true, statusName: '嘲讽' }
            });
            this.emitStateChange();
            return;
        } else {
            this.addLog('defend', `${actor.name} 进入防御姿态，防御提升10%`);
        }
        actor.defend();
        eventManager.emit('battleUnitAction', {
            attacker: actor,
            target: actor,
            damage: 0,
            actionType: 'defend',
            result: undefined
        });
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
            const speedDiff = (b.getEffectiveSpeed?.() || b.speed) - (a.getEffectiveSpeed?.() || a.speed);
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
            const time = remaining / Math.max(1, unit.getEffectiveSpeed?.() || unit.speed);
            if (time < minTime) {
                minTime = time;
            }
        });

        aliveUnits.forEach(unit => {
            unit.progress = Math.min(100, unit.progress + (unit.getEffectiveSpeed?.() || unit.speed) * minTime);
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
                const formationEvents = this.processFormationTurnStart(actor);
                const turnStartResult = actor.processTurnStartEffects?.() || { preventedAction: false, events: [] };
                if (formationEvents.length > 0) {
                    turnStartResult.events = [...formationEvents, ...(Array.isArray(turnStartResult.events) ? turnStartResult.events : [])];
                }
                if (turnStartResult.events?.length) {
                    this.handleTurnStartEffects(actor, turnStartResult);
                    await this.waitForActionPresentation();
                }
                if (!this.isBattling || !actor.isAlive()) {
                    actor.progress = 0;
                    this.currentActor = null;
                    this.emitStateChange();
                    await this.checkAndSpawnBossWaves('actionEnd');
                    if (this.checkBattleEnd()) {
                        return this.result;
                    }
                    continue;
                }
                if (turnStartResult.preventedAction) {
                    const expiredEffects = actor.processTurnEndEffects?.() || [];
                    if (expiredEffects.length > 0) {
                        eventManager.emit('battleUnitAction', {
                            attacker: actor,
                            target: actor,
                            damage: 0,
                            actionType: 'status_expire',
                            result: { expiredEffects }
                        });
                    }
                    actor.progress = 0;
                    this.currentActor = null;
                    this.emitStateChange();
                    await this.checkAndSpawnBossWaves('actionEnd');
                    if (this.checkBattleEnd()) {
                        return this.result;
                    }
                    continue;
                }
                const action = await this.resolveActionForActor(actor);
                if (!this.isBattling) {
                    break;
                }
                await this.executeAction(actor, action);
                await this.waitForActionPresentation();
                const expiredEffects = actor.processTurnEndEffects?.() || [];
                if (expiredEffects.length > 0) {
                    eventManager.emit('battleUnitAction', {
                        attacker: actor,
                        target: actor,
                        damage: 0,
                        actionType: 'status_expire',
                        result: { expiredEffects }
                    });
                    await this.waitForActionPresentation();
                }
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
