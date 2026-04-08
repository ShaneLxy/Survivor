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
        this.scene = BattleSceneConfig.getScene('standard_9x9');
        this.battleLog = [];
        this.currentRound = 0;
        this.isBattling = false;
        this.result = null;
        this.currentActor = null;
        this.decisionProvider = null;
        this.autoBattleOverride = null;
        this.maxRounds = 200;
        this.isBossEntrancePlaying = false;
        BattleManager.instance = this;
    }

    initBattle({ heroes, enemies, bossWaves = [], sceneId = 'standard_9x9' }) {
        this.heroes = heroes || [];
        this.enemies = enemies || [];
        this.pendingBossWaves = (bossWaves || []).map((wave, index) => ({
            id: wave.id || `boss_wave_${index + 1}`,
            spawnRound: Number(wave.spawnRound) || DungeonConfig.defaultBossSpawnRound,
            spawnOnClearBeforeRound: wave.spawnOnClearBeforeRound !== false,
            bosses: [...(wave.bosses || [])],
            isSpawned: false
        }));
        this.scene = BattleSceneConfig.getScene(sceneId);
        this.battleLog = [];
        this.currentRound = 0;
        this.isBattling = true;
        this.result = null;
        this.currentActor = null;
        this.autoBattleOverride = null;
        this.isBossEntrancePlaying = false;
        this.placeUnits();
        this.initializeProgress();
        this.addLog('battle', '战斗开始！');
        this.emitStateChange();
        eventManager.emit('battleStart', this.getSnapshot());
    }

    setDecisionProvider(provider) {
        this.decisionProvider = provider;
    }

    getAllUnits() {
        return [...this.heroes, ...this.enemies];
    }

    placeSide(units, spawnConfig) {
        let x = 0;
        let y = spawnConfig.startRow;
        units.forEach(unit => {
            unit.setPosition({ x, y });
            x += 1;
            if (x >= this.scene.width) {
                x = 0;
                y += spawnConfig.direction;
            }
        });
    }

    placeUnits() {
        this.placeSide(this.enemies, this.scene.enemySpawn);
        this.placeSide(this.heroes, this.scene.heroSpawn);
    }

    setInitialProgress(unit) {
        const shouldUseSpeedStart = unit.camp === 'hero' || ['elite', 'boss', 'player'].includes(unit.rank);
        unit.progress = shouldUseSpeedStart ? Math.min(100, unit.speed) : 0;
    }

    initializeProgress() {
        this.getAllUnits().forEach(unit => this.setInitialProgress(unit));
    }

    findSpawnPosition(spawnConfig) {
        for (let rowOffset = 0; rowOffset < this.scene.height; rowOffset++) {
            const y = spawnConfig.startRow + rowOffset * spawnConfig.direction;
            if (y < 0 || y >= this.scene.height) {
                continue;
            }
            for (let x = 0; x < this.scene.width; x++) {
                const position = { x, y };
                if (!this.getUnitAt(position)) {
                    return position;
                }
            }
        }

        for (let y = 0; y < this.scene.height; y++) {
            for (let x = 0; x < this.scene.width; x++) {
                const position = { x, y };
                if (!this.getUnitAt(position)) {
                    return position;
                }
            }
        }

        return null;
    }

    placeSpawnedUnits(units, spawnConfig = this.scene.enemySpawn, appendToEnemies = false) {
        units.forEach((unit) => {
            const position = this.findSpawnPosition(spawnConfig);
            if (position) {
                unit.setPosition(position);
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
            logs: this.getBattleLog()
        };
    }

    emitStateChange() {
        eventManager.emit('battleStateChange', this.getSnapshot());
    }

    isInsideBoard(position) {
        return position.x >= 0 && position.y >= 0 && position.x < this.scene.width && position.y < this.scene.height;
    }

    getUnitAt(position, ignoreUnitId = null) {
        return this.getAllUnits().find(unit => unit.id !== ignoreUnitId && unit.isAlive() && unit.position.x === position.x && unit.position.y === position.y) || null;
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

    getReachableCells(actor) {
        const cells = [];
        for (let x = 0; x < this.scene.width; x++) {
            for (let y = 0; y < this.scene.height; y++) {
                const position = { x, y };
                if (this.distanceBetween(actor.position, position) === 0) {
                    continue;
                }
                if (this.distanceBetween(actor.position, position) <= actor.moveRange && !this.getUnitAt(position, actor.id)) {
                    cells.push(position);
                }
            }
        }
        return cells;
    }

    getAttackableTargets(actor) {
        return this.getOpponents(actor).filter(target => actor.distanceTo(target) <= actor.attackRange);
    }

    getAttackRangeCells(actor) {
        const cells = [];
        for (let x = 0; x < this.scene.width; x++) {
            for (let y = 0; y < this.scene.height; y++) {
                const position = { x, y };
                const distance = this.distanceBetween(actor.position, position);
                if (distance > 0 && distance <= actor.attackRange) {
                    cells.push(position);
                }
            }
        }
        return cells;
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
        return itemManager.getAllItems().filter(item => item.effect?.type === 'heal');
    }

    chooseAutoAction(actor) {
        const healItems = this.getUsableBattleItems(actor);
        if (actor.camp === 'hero' && actor.hp / actor.maxHp <= 0.4 && healItems.length > 0) {
            return { type: 'item', itemId: healItems[0].id, targetId: actor.id };
        }

        const target = this.chooseTarget(actor);
        if (target) {
            const useSkill = Boolean(actor.skill) && Math.random() < 0.35;
            return { type: useSkill ? 'skill' : 'attack', targetId: target.id };
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
            const target = this.findUnitById(finalAction.targetId) || actor;
            const result = itemManager.useItem(finalAction.itemId, target);
            if (!result.success) {
                return this.executeAction(actor, { type: 'defend' });
            }
            this.addLog('item', `${actor.name} 使用了 ${ItemConfig.getItemConfig(finalAction.itemId)?.name || '道具'}，${result.message}`);
            eventManager.emit('battleUnitAction', { attacker: actor, target, damage: 0, actionType: 'item', message: result.message });
            this.emitStateChange();
            return;
        }

        if (finalAction.type === 'attack' || finalAction.type === 'skill') {
            const target = this.findUnitById(finalAction.targetId);
            if (!target || !target.isAlive() || actor.distanceTo(target) > actor.attackRange) {
                return this.executeAction(actor, { type: 'defend' });
            }
            const attackResult = actor.attackTarget(target, finalAction.type === 'skill');
            if (!attackResult.hit) {
                this.addLog('miss', `${actor.name} 攻击 ${target.name} 但被闪避了`);
            } else {
                const logText = `${actor.name} 对 ${target.name} 造成 ${attackResult.damage} 点伤害${attackResult.isCritical ? '（暴击）' : ''}${attackResult.useSkill ? ` [${attackResult.skillName}]` : ''}`;
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
        const heroesAlive = this.heroes.some(unit => unit.isAlive());
        const enemiesAlive = this.enemies.some(unit => unit.isAlive());

        if (!enemiesAlive && !this.hasPendingBossWaves()) {
            this.result = {
                victory: true,
                participants: this.heroes.map(unit => unit.id),
                survivors: this.heroes.filter(unit => unit.isAlive()).map(unit => unit.id)
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
        this.emitStateChange();
    }
}

const battleManager = new BattleManager();
window.battleManager = battleManager;
