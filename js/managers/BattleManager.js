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
        this.specialTileWarnings = [];
        this.currentRound = 0;
        this.isBattling = false;
        this.result = null;
        this.currentActor = null;
        this.decisionProvider = null;
        this.autoBattleOverride = null;
        this.maxRounds = 999;
        this.isBossEntrancePlaying = false;
        this.battleItemUsage = {};
        this.formationStates = [];
        this.environmentEffect = 'none';
        this.terrainRuntimeState = this.createEmptyTerrainRuntimeState();
        this.heroVoiceLastPlayedAt = {};
        this.battleStats = this.createEmptyBattleStats();
        this.processedDeathUnitIds = new Set();
        this.battleStatsUnsubscribe = null;
        this.boardCacheVersion = 0;
        this.boardCache = this.createEmptyBoardCache();
        this.pendingStateChangeFrame = null;
        BattleManager.instance = this;
    }

    createEmptyBoardCache() {
        return {
            obstacleMap: null,
            obstacleKey: '',
            specialTileMap: null,
            specialTileKey: '',
            unitMap: null,
            unitKey: '',
            pathDistance: new Map(),
            lineObstacle: new Map(),
            rawRange: new Map()
        };
    }

    invalidateBoardCache() {
        this.boardCacheVersion += 1;
        this.boardCache = this.createEmptyBoardCache();
    }

    getCellKey(position) {
        return `${position?.x ?? ''},${position?.y ?? ''}`;
    }

    initBattle({ heroes, enemies, bossWaves = [], sceneId = 'standard_9x9', battlefield = null, environmentEffect = 'none' }) {
        this.heroes = heroes || [];
        this.enemies = enemies || [];
        this.pendingBossWaves = (bossWaves || []).map((wave, index) => ({
            id: wave.id || `boss_wave_${index + 1}`,
            spawnRound: Number(wave.spawnRound) || DungeonConfig.defaultBossSpawnRound,
            spawnOnClearBeforeRound: wave.spawnOnClearBeforeRound !== false,
            guardianKey: String(wave.guardianKey || wave.guardian?.key || wave.guardian?.enemyKey || '').trim(),
            bosses: [...(wave.bosses || [])],
            isSpawned: false
        }));
        this.scene = this.resolveSceneConfig(sceneId, battlefield);
        this.environmentEffect = this.normalizeEnvironmentEffect(environmentEffect || battlefield?.environmentEffect);
        this.specialTileWarnings = [];
        this.currentRound = 0;
        this.isBattling = true;
        this.result = null;
        this.currentActor = null;
        this.autoBattleOverride = null;
        this.isBossEntrancePlaying = false;
        this.formationStates = [];
        this.heroVoiceLastPlayedAt = {};
        this.processedDeathUnitIds = new Set();
        this.invalidateBoardCache();
        this.terrainRuntimeState = this.createEmptyTerrainRuntimeState();
        this.teardownBattleStats();
        this.battleStats = this.createEmptyBattleStats();
        this.battleItemUsage = {
            stimulant: {
                maxUses: Math.min(2, itemManager.getItemCount('stimulant')),
                used: 0
            }
        };
        this.placeUnits();
        this.initializeProgress();
        this.initializeTerrainRuntimeState();
        this.syncTerrainStateForAllUnits();
        this.setupBattleStats();
        this.addLog('battle', '战斗开始！');
        this.emitStateChange();
        eventManager.emit('battleStart', this.getSnapshot());
    }

    setDecisionProvider(provider) {
        this.decisionProvider = provider;
    }

    createEmptyBattleStats() {
        return {
            startedAt: 0,
            finishedAt: 0,
            heroOrder: [],
            heroEntries: {}
        };
    }

    createEmptyTerrainRuntimeState() {
        return {
            unitStates: {},
            miasmaSources: []
        };
    }

    createTerrainUnitState() {
        return {
            healStreak: 0,
            fireMomentumStacks: 0,
            swampAttackPrimed: false
        };
    }

    initializeTerrainRuntimeState() {
        this.terrainRuntimeState = this.createEmptyTerrainRuntimeState();
        const tiles = Array.isArray(this.scene?.specialTiles) ? this.scene.specialTiles : [];
        this.terrainRuntimeState.miasmaSources = tiles
            .filter(tile => tile?.type === 'miasma')
            .map((tile, index) => ({
                id: `miasma_source_${tile.id || index + 1}`,
                originX: tile.x,
                originY: tile.y,
                spreadCount: 0,
                maxSpreadCount: 2,
                expandRounds: [15, 30],
                lastExpandedRound: 0,
                tileName: tile.name || this.getSpecialTileTypeLabel('miasma')
            }));
    }

    getTerrainUnitState(unitOrId, createIfMissing = true) {
        const unitId = typeof unitOrId === 'string' ? unitOrId : unitOrId?.id;
        if (!unitId) {
            return createIfMissing ? this.createTerrainUnitState() : null;
        }
        if (!this.terrainRuntimeState || typeof this.terrainRuntimeState !== 'object') {
            this.terrainRuntimeState = this.createEmptyTerrainRuntimeState();
        }
        if (!this.terrainRuntimeState.unitStates) {
            this.terrainRuntimeState.unitStates = {};
        }
        if (!this.terrainRuntimeState.unitStates[unitId] && createIfMissing) {
            this.terrainRuntimeState.unitStates[unitId] = this.createTerrainUnitState();
        }
        return this.terrainRuntimeState.unitStates[unitId] || null;
    }

    syncTerrainStateForAllUnits() {
        this.getAllUnits().forEach((unit) => {
            if (!unit?.id) {
                return;
            }
            this.terrainRuntimeState.unitStates[unit.id] = this.createTerrainUnitState();
            if (unit.position) {
                this.handleTerrainPositionChange(unit, null, unit.position);
            }
        });
    }

    handleTerrainPositionChange(unit, fromPosition = null, toPosition = null) {
        this.invalidateBoardCache();
        if (!unit?.id) {
            return;
        }
        const state = this.getTerrainUnitState(unit);
        const fromTile = fromPosition ? this.getSpecialTileAt(fromPosition) : null;
        const toTile = toPosition ? this.getSpecialTileAt(toPosition) : null;
        const fromType = fromTile?.type || '';
        const toType = toTile?.type || '';

        if (fromType === 'heal' && toType !== 'heal') {
            state.healStreak = 0;
        } else if (fromType !== 'heal' && toType === 'heal') {
            state.healStreak = 0;
        }

        if (toType === 'swamp' && fromType !== 'swamp') {
            state.swampAttackPrimed = true;
        } else if (toType !== 'swamp') {
            state.swampAttackPrimed = false;
        }

    }

    recordBattleCommandAchievement(actor, commandType, action = {}) {
        if (!actor || actor.camp !== 'hero' || !commandType) {
            return;
        }
        if (this.isAutoBattleEnabled() || action?.reason === 'timeout' || action?.reason === 'fallback' || action?.forcedByTaunt || action?.forcedByCharm) {
            return;
        }
        eventManager.emit('battleCommand', {
            unit: actor,
            unitId: actor.id,
            commandType,
            battleMode: 'manual'
        });
    }

    recordSpecialTileEnterAchievement(actor, position, action = {}) {
        if (!actor || actor.camp !== 'hero' || this.isAutoBattleEnabled()) {
            return;
        }
        if (action?.reason === 'timeout' || action?.reason === 'fallback' || action?.forcedByTaunt || action?.forcedByCharm) {
            return;
        }
        const tile = this.getSpecialTileAt(position);
        const tileType = tile?.type || '';
        if (!['heal', 'fire', 'swamp', 'miasma'].includes(tileType)) {
            return;
        }
        eventManager.emit('battleSpecialTileEnter', {
            unit: actor,
            unitId: actor.id,
            tileType,
            battleMode: 'manual'
        });
    }

    getHealTileStageConfig(streak = 0) {
        const stage = Math.max(1, Number(streak) || 1);
        if (stage === 1) {
            return { stage, mode: 'heal', ratio: 0.2 };
        }
        if (stage === 2) {
            return { stage, mode: 'heal', ratio: 0.15 };
        }
        if (stage === 3) {
            return { stage, mode: 'heal', ratio: 0.08 };
        }
        if (stage === 4) {
            return { stage, mode: 'damage', ratio: 0.05 };
        }
        return { stage, mode: 'damage', ratio: 0.1 };
    }

    getProjectedHealTileStage(unit, position) {
        if (!unit?.id || !position) {
            return 0;
        }
        const tile = this.getSpecialTileAt(position);
        if (tile?.type !== 'heal') {
            return 0;
        }
        const currentTile = this.getSpecialTileAt(unit.position);
        const state = this.getTerrainUnitState(unit, false);
        const currentStreak = Math.max(0, Number(state?.healStreak) || 0);
        return currentTile?.type === 'heal' ? currentStreak + 1 : 1;
    }

    getProjectedHealTileOutcome(unit, position) {
        const tile = this.getSpecialTileAt(position);
        if (tile?.type !== 'heal') {
            return null;
        }
        const stage = this.getProjectedHealTileStage(unit, position);
        const stageConfig = this.getHealTileStageConfig(stage || 1);
        return {
            stage,
            ...stageConfig
        };
    }

    isHealTileBacklashPosition(unit, position = unit?.position) {
        return this.getProjectedHealTileOutcome(unit, position)?.mode === 'damage';
    }

    getUnitTerrainStatusEffects(unit) {
        if (!unit?.id) {
            return [];
        }
        const state = this.getTerrainUnitState(unit, false);
        if (!state) {
            return [];
        }
        const effects = [];
        const currentTile = this.getSpecialTileAt(unit.position);
        if (currentTile?.type === 'heal') {
            const healStage = Math.max(1, Number(state.healStreak) || 1);
            const healStageConfig = this.getHealTileStageConfig(healStage);
            if (healStageConfig.mode === 'heal') {
                const remainingHealRounds = Math.max(0, 4 - healStage);
                effects.push({
                    id: `terrain_heal_cycle_${unit.id}`,
                    type: 'terrain_heal_cycle',
                    name: '治疗地格',
                    effectType: 'terrain_state',
                    countsAsDebuff: false,
                    isBuff: true,
                    stackCount: remainingHealRounds,
                    remainingTurns: remainingHealRounds,
                    ratio: healStageConfig.ratio,
                    stage: healStage
                });
            } else {
                effects.push({
                    id: `terrain_heal_backlash_${unit.id}`,
                    type: 'terrain_heal_backlash',
                    name: '地格反噬',
                    effectType: 'terrain_state',
                    countsAsDebuff: true,
                    isBuff: false,
                    remainingTurns: 1,
                    ratio: healStageConfig.ratio,
                    stage: healStage
                });
            }
        }
        const fireMomentumStacks = Math.max(0, Number(state.fireMomentumStacks) || 0);
        if (fireMomentumStacks > 0) {
            const isOnFireTile = this.getSpecialTileAt(unit.position)?.type === 'fire';
            effects.push({
                id: `terrain_fire_momentum_${unit.id}`,
                type: 'terrain_fire_momentum',
                name: '燃势',
                effectType: 'terrain_state',
                countsAsDebuff: false,
                stackCount: fireMomentumStacks,
                isBuff: true,
                activeWhileOnFire: isOnFireTile,
                damagePercentBonus: fireMomentumStacks * 0.1
            });
        }
        return effects;
    }

    processTerrainRoundStart() {
        if (!Array.isArray(this.terrainRuntimeState?.miasmaSources) || this.terrainRuntimeState.miasmaSources.length === 0) {
            return [];
        }
        const events = [];
        this.terrainRuntimeState.miasmaSources.forEach((source) => {
            if (!source || source.spreadCount >= source.maxSpreadCount) {
                return;
            }
            const expandRounds = Array.isArray(source.expandRounds) ? source.expandRounds : [];
            const nextExpandRound = Math.max(1, Number(expandRounds[source.spreadCount]) || 0);
            if (!nextExpandRound) {
                source.spreadCount = source.maxSpreadCount;
                return;
            }
            if (this.currentRound < nextExpandRound || source.lastExpandedRound === this.currentRound) {
                return;
            }
            const nextRing = source.spreadCount + 1;
            const tiles = this.buildMiasmaSpreadTiles(source, nextRing);
            source.spreadCount = nextRing;
            source.lastExpandedRound = this.currentRound;
            if (!tiles.length) {
                return;
            }
            this.scene.specialTiles.push(...tiles);
            this.invalidateBoardCache();
            this.addLog('control', `${source.tileName || '瘴气地格'} 扩散，新增 ${tiles.length} 个地格`);
            events.push({
                type: 'miasma_expand',
                sourceId: source.id,
                ring: nextRing,
                tiles
            });
        });
        return events;
    }

    buildMiasmaSpreadTiles(source, radius = 1) {
        const spreadIndex = Math.max(1, Number(radius) || 1);
        const minDistance = spreadIndex === 1 ? 1 : 3;
        const maxDistance = spreadIndex === 1 ? 2 : 4;
        const candidates = [];
        for (let y = source.originY - maxDistance; y <= source.originY + maxDistance; y++) {
            for (let x = source.originX - maxDistance; x <= source.originX + maxDistance; x++) {
                const position = { x, y };
                const distance = this.distanceBetween({ x: source.originX, y: source.originY }, position);
                if (!this.isInsideBoard(position) || distance < minDistance || distance > maxDistance) {
                    continue;
                }
                if (this.isObstacleAt(position)) {
                    continue;
                }
                if (this.getSpecialTileAt(position)) {
                    continue;
                }
                candidates.push(position);
            }
        }
        return Utils.shuffle(candidates).slice(0, 2).map((position, index) => ({
            id: `${source.id}_spread_${spreadIndex}_${index + 1}`,
            type: 'miasma',
            name: this.getSpecialTileTypeLabel('miasma'),
            icon: this.getSpecialTileIcon('miasma'),
            x: position.x,
            y: position.y,
            value: 0,
            generatedBy: source.id
        }));
    }

    setupBattleStats() {
        this.battleStats = this.createEmptyBattleStats();
        this.battleStats.startedAt = Date.now();
        (this.heroes || []).forEach((unit) => {
            if (!unit?.id) {
                return;
            }
            this.battleStats.heroOrder.push(unit.id);
            this.battleStats.heroEntries[unit.id] = {
                heroId: unit.id,
                name: unit.name || unit.id,
                damage: 0,
                heal: 0,
                takenDamage: 0
            };
        });
        this.battleStatsUnsubscribe = eventManager.on('battleUnitAction', (data) => {
            this.updateBattleStatsFromAction(data);
        });
    }

    teardownBattleStats() {
        if (typeof this.battleStatsUnsubscribe === 'function') {
            this.battleStatsUnsubscribe();
        }
        this.battleStatsUnsubscribe = null;
    }

    isHeroBattleStatsUnit(unit) {
        return Boolean(unit && unit.camp === 'hero' && unit.id);
    }

    ensureBattleStatsEntry(unit) {
        if (!this.isHeroBattleStatsUnit(unit)) {
            return null;
        }
        if (!this.battleStats?.heroEntries) {
            this.battleStats = this.createEmptyBattleStats();
        }
        if (!Array.isArray(this.battleStats.heroOrder)) {
            this.battleStats.heroOrder = [];
        }
        if (!this.battleStats.heroEntries[unit.id]) {
            this.battleStats.heroEntries[unit.id] = {
                heroId: unit.id,
                name: unit.name || unit.id,
                damage: 0,
                heal: 0,
                takenDamage: 0
            };
        }
        if (!this.battleStats.heroOrder.includes(unit.id)) {
            this.battleStats.heroOrder.push(unit.id);
        }
        return this.battleStats.heroEntries[unit.id];
    }

    extractBattleStatsDamage(result = {}, actionData = {}) {
        const amount = result?.damage ?? result?.reflectiveDamage ?? actionData?.damage ?? 0;
        return Math.max(0, Number(amount) || 0);
    }

    extractBattleStatsHeal(result = {}, actionData = {}) {
        const directHeal = Math.max(0, Number(result?.heal) || 0);
        if (directHeal > 0) {
            return directHeal;
        }
        const effect = result?.effect || actionData?.result?.effect || null;
        if (effect && (effect.type === 'heal' || effect.type === 'revive')) {
            return Math.max(0, Number(effect.value) || 0);
        }
        return 0;
    }

    recordBattleStatsDamage(sourceUnit, targetUnit, amount, options = {}) {
        const sourceDamage = Math.max(0, Number(options?.sourceDamage ?? amount) || 0);
        const targetDamage = Math.max(0, Number(options?.targetDamage ?? amount) || 0);
        if (sourceDamage <= 0 && targetDamage <= 0) {
            return;
        }
        if (sourceDamage > 0 && this.isHeroBattleStatsUnit(sourceUnit) && targetUnit && targetUnit.camp !== 'hero') {
            const sourceEntry = this.ensureBattleStatsEntry(sourceUnit);
            if (sourceEntry) {
                sourceEntry.damage += sourceDamage;
            }
        }
        if (targetDamage > 0 && this.isHeroBattleStatsUnit(targetUnit)) {
            const targetEntry = this.ensureBattleStatsEntry(targetUnit);
            if (targetEntry) {
                targetEntry.takenDamage += targetDamage;
            }
        }
    }

    recordBattleStatsHeal(sourceUnit, targetUnit, amount) {
        const heal = Math.max(0, Number(amount) || 0);
        if (heal <= 0) {
            return;
        }
        if (!this.isHeroBattleStatsUnit(sourceUnit) || !this.isHeroBattleStatsUnit(targetUnit)) {
            return;
        }
        const sourceEntry = this.ensureBattleStatsEntry(sourceUnit);
        if (sourceEntry) {
            sourceEntry.heal += heal;
        }
    }

    shouldIgnoreBattleStatsAction(actionData = {}) {
        if (actionData?.ignoreBattleStats) {
            return true;
        }
        const result = actionData?.result || {};
        const statusType = String(result?.statusType || '').trim();
        return statusType === 'terrain_heal_cycle'
            || statusType === 'terrain_heal_backlash'
            || statusType === 'terrain_fire_momentum';
    }

    updateBattleStatsFromAction(actionData = {}) {
        if (!this.isBattling || !this.battleStats?.heroEntries) {
            return;
        }
        if (this.shouldIgnoreBattleStatsAction(actionData)) {
            return;
        }
        const attacker = actionData?.attacker || null;
        const fallbackTarget = actionData?.target || null;
        const result = actionData?.result || {};
        const isRedirectAction = actionData?.actionType === 'redirect';
        if (Array.isArray(result.targets) && result.targets.length > 0) {
            result.targets.forEach((entry) => {
                const targetUnit = this.findUnitById(entry?.id) || (fallbackTarget?.id === entry?.id ? fallbackTarget : null);
                const damage = this.extractBattleStatsDamage(entry, actionData);
                const targetDamage = isRedirectAction
                    ? damage
                    : Math.max(0, Number(entry?.damageToTarget ?? entry?.targetDamage ?? damage) || 0);
                const heal = this.extractBattleStatsHeal(entry, actionData);
                if (damage > 0 || targetDamage > 0) {
                    this.recordBattleStatsDamage(attacker, targetUnit, damage, {
                        sourceDamage: isRedirectAction ? 0 : damage,
                        targetDamage
                    });
                }
                if (heal > 0) {
                    this.recordBattleStatsHeal(attacker, targetUnit, heal);
                }
                const selfHeal = Math.max(0, Number(entry?.selfHeal) || 0);
                if (selfHeal > 0) {
                    this.recordBattleStatsHeal(attacker, attacker, selfHeal);
                }
                const customHeal = Math.max(0, Number(entry?.customEffectResult?.heal) || 0);
                if (customHeal > 0) {
                    this.recordBattleStatsHeal(attacker, attacker, customHeal);
                }
            });
        } else {
            const damage = this.extractBattleStatsDamage(result, actionData);
            const targetDamage = isRedirectAction
                ? damage
                : Math.max(0, Number(result?.damageToTarget ?? result?.targetDamage ?? damage) || 0);
            const heal = this.extractBattleStatsHeal(result, actionData);
            if (damage > 0 || targetDamage > 0) {
                this.recordBattleStatsDamage(attacker, fallbackTarget, damage, {
                    sourceDamage: isRedirectAction ? 0 : damage,
                    targetDamage
                });
            }
            if (heal > 0) {
                this.recordBattleStatsHeal(attacker, fallbackTarget, heal);
            }
        }

        const selfHeal = Math.max(0, Number(result?.selfHeal) || 0);
        if (selfHeal > 0) {
            this.recordBattleStatsHeal(attacker, attacker, selfHeal);
        }
        const customHeal = Math.max(0, Number(result?.customEffectResult?.heal) || 0);
        if (customHeal > 0) {
            this.recordBattleStatsHeal(attacker, attacker, customHeal);
        }
    }

    getBattleStatsSummary() {
        const stats = this.battleStats?.heroEntries || {};
        const order = Array.isArray(this.battleStats?.heroOrder) ? this.battleStats.heroOrder : [];
        const baseEntries = order.map((heroId) => {
            const unit = this.findUnitById(heroId) || this.heroes.find(hero => hero?.id === heroId) || null;
            const raw = stats[heroId] || {
                heroId,
                name: unit?.name || heroId,
                damage: 0,
                heal: 0,
                takenDamage: 0
            };
            return {
                heroId,
                unit,
                name: unit?.name || raw.name || heroId,
                damage: Math.max(0, Number(raw.damage) || 0),
                heal: Math.max(0, Number(raw.heal) || 0),
                takenDamage: Math.max(0, Number(raw.takenDamage) || 0),
                isAlive: unit?.isAlive?.() !== false
            };
        });
        const totals = baseEntries.reduce((summary, entry) => {
            summary.damage += entry.damage;
            summary.heal += entry.heal;
            summary.takenDamage += entry.takenDamage;
            return summary;
        }, { damage: 0, heal: 0, takenDamage: 0 });
        const entries = baseEntries.map((entry) => {
            const damageShare = totals.damage > 0 ? entry.damage / totals.damage : 0;
            const healShare = totals.heal > 0 ? entry.heal / totals.heal : 0;
            const takenDamageShare = totals.takenDamage > 0 ? entry.takenDamage / totals.takenDamage : 0;
            return {
                ...entry,
                damageShare,
                healShare,
                takenDamageShare,
                mvpScore: entry.damage * 0.5 + entry.heal * 0.3 + entry.takenDamage * 0.2
            };
        });
        let mvpHeroId = null;
        let bestEntry = null;
        entries.forEach((entry) => {
            if (!bestEntry) {
                bestEntry = entry;
                mvpHeroId = entry.heroId;
                return;
            }
            if (entry.mvpScore > bestEntry.mvpScore) {
                bestEntry = entry;
                mvpHeroId = entry.heroId;
                return;
            }
            if (entry.mvpScore === bestEntry.mvpScore && entry.damage > bestEntry.damage) {
                bestEntry = entry;
                mvpHeroId = entry.heroId;
            }
        });
        return {
            startedAt: this.battleStats?.startedAt || 0,
            finishedAt: this.battleStats?.finishedAt || 0,
            totals,
            mvpHeroId,
            entries: entries.map((entry) => ({
                ...entry,
                isMvp: entry.heroId === mvpHeroId
            }))
        };
    }

    finalizeBattleStats(result = this.result) {
        if (!this.battleStats) {
            this.battleStats = this.createEmptyBattleStats();
        }
        this.battleStats.finishedAt = Date.now();
        const summary = this.getBattleStatsSummary();
        if (result && typeof result === 'object') {
            result.battleStats = summary;
        }
        return summary;
    }

    normalizeEnvironmentEffect(effect) {
        const rawType = typeof effect === 'object' && effect !== null
            ? (effect.type || effect.id || effect.effect || 'none')
            : effect;
        const type = String(rawType || 'none').trim().toLowerCase().replace(/[\s-]+/g, '_');
        const aliases = {
            poison: 'poison_fog',
            toxic: 'poison_fog',
            toxic_fog: 'poison_fog',
            dust: 'dust_smoke',
            sand: 'dust_smoke',
            storm: 'storm_night',
            stormnight: 'storm_night',
            heavy_rain: 'storm_night',
            lightning_rain: 'storm_night',
            ember: 'ash',
            embers: 'ash',
            cinder: 'ash',
            cinders: 'ash',
            ashes: 'ash',
            black_ash: 'ash'
        };
        const normalized = aliases[type] || type;
        return ['smoke', 'rain', 'snow', 'poison_fog', 'dust_smoke', 'storm_night', 'ash'].includes(normalized) ? normalized : 'none';
    }

    resolveSceneConfig(sceneId = 'standard_9x9', battlefield = null) {
        const baseScene = BattleSceneConfig.getScene(sceneId);
        const width = Math.max(1, Number(battlefield?.cols ?? battlefield?.width ?? baseScene?.width) || 1);
        const height = Math.max(1, Number(battlefield?.rows ?? battlefield?.height ?? baseScene?.height) || 1);
        const heroSpawn = battlefield?.heroSpawn || {};
        const enemySpawn = battlefield?.enemySpawn || {};
        const baseHeroSpawn = baseScene?.heroSpawn || {};
        const baseEnemySpawn = baseScene?.enemySpawn || {};
        const obstacles = this.normalizeObstacles(battlefield?.obstacles, width, height);
        return {
            ...baseScene,
            width,
            height,
            actionTimeout: Math.max(1, Number(battlefield?.actionTimeout ?? baseScene?.actionTimeout) || 15),
            heroSpawn: this.normalizeSpawnConfig({
                ...baseHeroSpawn,
                ...heroSpawn,
                startRow: heroSpawn.startRow ?? (battlefield ? (height - 1) : (baseHeroSpawn.startRow ?? (height - 1))),
                direction: heroSpawn.direction ?? baseHeroSpawn.direction ?? -1
            }, width, height, height - 1, -1),
            enemySpawn: this.normalizeSpawnConfig({
                ...baseEnemySpawn,
                ...enemySpawn,
                startRow: enemySpawn.startRow ?? (battlefield ? 0 : (baseEnemySpawn.startRow ?? 0)),
                direction: enemySpawn.direction ?? baseEnemySpawn.direction ?? 1
            }, width, height, 0, 1),
            obstacles,
            specialTiles: this.normalizeSpecialTiles(battlefield?.specialTiles, width, height)
                .filter(tile => !obstacles.some(obstacle => obstacle.x === tile.x && obstacle.y === tile.y))
        };
    }

    normalizeSpawnConfig(spawnConfig = {}, width, height, defaultStartRow = 0, defaultDirection = 1) {
        const rawStartRow = Number(spawnConfig.startRow);
        const startRow = Utils.clamp(
            Number.isFinite(rawStartRow) ? Math.floor(rawStartRow) : defaultStartRow,
            0,
            height - 1
        );
        const rawDirection = Number(spawnConfig.direction);
        const direction = Number.isFinite(rawDirection)
            ? (rawDirection >= 0 ? 1 : -1)
            : (defaultDirection >= 0 ? 1 : -1);
        return {
            ...spawnConfig,
            startRow,
            direction,
            positions: this.normalizeSpawnPositions(
                spawnConfig.positions || spawnConfig.points || spawnConfig.cells,
                width,
                height
            )
        };
    }

    normalizeSpawnPositions(positions = [], width, height) {
        if (!Array.isArray(positions)) {
            return [];
        }
        const occupiedKeys = new Set();
        return positions.reduce((result, entry) => {
            const normalized = this.normalizeSpawnPositionEntry(entry, width, height);
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

    normalizeSpawnPositionEntry(entry, width, height) {
        let x = null;
        let y = null;
        if (Array.isArray(entry)) {
            y = Number(entry[0]) - 1;
            x = Number(entry[1]) - 1;
        } else if (entry && typeof entry === 'object') {
            if (entry.row !== undefined || entry.col !== undefined) {
                y = Number(entry.row) - 1;
                x = Number(entry.col) - 1;
            } else {
                x = Number(entry.x);
                y = Number(entry.y);
            }
        }
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return null;
        }
        const position = { x: Math.floor(x), y: Math.floor(y) };
        if (position.x < 0 || position.y < 0 || position.x >= width || position.y >= height) {
            return null;
        }
        return position;
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

    normalizeSpecialTiles(tiles = [], width = this.scene?.width || 0, height = this.scene?.height || 0) {
        const entries = this.expandSpecialTileEntries(tiles);
        if (!Array.isArray(entries)) {
            return [];
        }
        const occupiedKeys = new Set();
        return entries.reduce((result, entry, index) => {
            const normalized = this.normalizeSpecialTileEntry(entry, width, height, index);
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

    expandSpecialTileEntries(tiles) {
        if (Array.isArray(tiles)) {
            return tiles.flatMap(entry => this.expandSpecialTileEntry(entry));
        }
        if (tiles && typeof tiles === 'object') {
            if (tiles.type && Array.isArray(tiles.positions || tiles.coords || tiles.cells || tiles.points || tiles.list)) {
                return this.expandSpecialTileEntry(tiles);
            }
            return Object.entries(tiles).flatMap(([type, positions]) => {
                const group = Array.isArray(positions) ? positions : positions?.positions;
                if (!Array.isArray(group)) {
                    return [];
                }
                return group.map((position, index) => this.createSpecialTileEntryFromPosition({ type }, position, index));
            });
        }
        return [];
    }

    expandSpecialTileEntry(entry) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            return [entry];
        }
        const positions = entry.positions || entry.coords || entry.cells || entry.points || entry.list;
        if (!Array.isArray(positions)) {
            return [entry];
        }
        return positions.map((position, index) => this.createSpecialTileEntryFromPosition(entry, position, index));
    }

    createSpecialTileEntryFromPosition(source, position, index = 0) {
        const base = { ...(source || {}) };
        const baseId = base.id;
        delete base.id;
        delete base.positions;
        delete base.coords;
        delete base.cells;
        delete base.points;
        delete base.list;
        const normalizedPosition = Array.isArray(position)
            ? { row: position[0], col: position[1] }
            : (position && typeof position === 'object' ? { ...position } : {});
        const entry = { ...base, ...normalizedPosition };
        if (!entry.id && baseId) {
            entry.id = `${baseId}_${index + 1}`;
        }
        return entry;
    }

    normalizeSpecialTileEntry(entry, width, height, index = 0) {
        const tile = entry && typeof entry === 'object' && !Array.isArray(entry) ? entry : {};
        let row = null;
        let col = null;
        if (Array.isArray(entry)) {
            row = Number(entry[0]);
            col = Number(entry[1]);
            if (entry[2] !== undefined) {
                tile.type = entry[2];
            }
        } else if (entry && typeof entry === 'object') {
            row = entry.row !== undefined ? Number(entry.row) : Number(entry.y) + 1;
            col = entry.col !== undefined ? Number(entry.col) : Number(entry.x) + 1;
        }
        if (!Number.isFinite(row) || !Number.isFinite(col)) {
            return null;
        }
        const position = { x: Math.floor(col) - 1, y: Math.floor(row) - 1 };
        if (position.x < 0 || position.y < 0 || position.x >= width || position.y >= height) {
            return null;
        }
        const type = this.normalizeSpecialTileType(tile.type || tile.kind || tile.effect || tile.id);
        if (type === 'none') {
            return null;
        }
        return {
            id: tile.id || `special_tile_${index + 1}`,
            type,
            name: tile.name || this.getSpecialTileTypeLabel(type),
            icon: tile.icon || this.getSpecialTileIcon(type),
            x: position.x,
            y: position.y,
            value: Number(tile.value) || 0
        };
    }

    normalizeSpecialTileType(type) {
        const raw = String(type || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
        const aliases = {
            heal: 'heal',
            recovery: 'heal',
            recover: 'heal',
            fire: 'fire',
            flame: 'fire',
            swamp: 'swamp',
            bog: 'swamp',
            miasma: 'miasma',
            gas: 'miasma'
        };
        return aliases[raw] || raw || 'none';
    }

    getSpecialTileTypeLabel(type) {
        const labels = {
            heal: '恢复地格',
            fire: '火焰地格',
            swamp: '沼泽地格',
            miasma: '瘴气地格'
        };
        return labels[type] || '特殊地格';
    }

    getSpecialTileIcon(type) {
        const icons = {
            heal: '+',
            fire: '火',
            swamp: '沼',
            miasma: '雾'
        };
        return icons[type] || '·';
    }

    getSpecialTileDescription(type) {
        const descriptions = {
            heal: '回合开始时,按驻留回合恢复20%/15%/8%已损生命,久留后会转为反噬。',
            fire: '回合开始时,受到当前生命值10%的火焰伤害,并积累燃势;离开后首攻消耗燃势增伤。',
            swamp: '速度与移动距离-30%;从沼泽发起的首次攻击会附带减速。',
            miasma: '防御力-50%,第15回合与第30回合各向外扩散一圈,之后停止扩散。'
        };
        return descriptions[type] || '';
    }

    getObstacleDescription() {
        return '不可破坏的障碍物,会阻挡移动与攻击路径,无法在其上停留或与之互动。';
    }

    normalizeObstacleEntry(entry, width, height, index = 0) {
        let row = null;
        let col = null;
        const obstacleConfig = entry && typeof entry === 'object' && !Array.isArray(entry) ? entry : {};
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
            name: obstacleConfig.name || '障碍物',
            icon: obstacleConfig.icon || '■',
            iconSrc: obstacleConfig.iconSrc || obstacleConfig.image || obstacleConfig.src || 'assets/images/battle/obstacle-barricade.png',
            x: position.x,
            y: position.y
        };
    }

    getAllUnits() {
        return [...this.heroes, ...this.enemies];
    }

    placeSide(units, spawnConfig, occupiedKeys = new Set()) {
        units.forEach(unit => {
            const preferredPosition = this.normalizeSpawnPositionEntry(
                unit.preferredSpawnPosition || unit.spawnPosition,
                this.scene.width,
                this.scene.height
            );
            const position = preferredPosition && this.isSpawnPositionAvailable(preferredPosition, occupiedKeys)
                ? preferredPosition
                : this.findSpawnPosition(spawnConfig, occupiedKeys);
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
        const pickRandom = (positions) => positions.length
            ? positions[Math.floor(Math.random() * positions.length)]
            : null;
        const configuredPositions = (Array.isArray(spawnConfig?.positions) ? spawnConfig.positions : [])
            .map(position => this.normalizeSpawnPositionEntry(position, this.scene.width, this.scene.height))
            .filter(Boolean);

        for (let radius = 0; radius <= 3; radius++) {
            const candidates = [];
            configuredPositions.forEach((origin) => {
                for (let y = origin.y - radius; y <= origin.y + radius; y++) {
                    for (let x = origin.x - radius; x <= origin.x + radius; x++) {
                        const position = { x, y };
                        const distance = Math.abs(origin.x - x) + Math.abs(origin.y - y);
                        if (distance <= radius && this.isSpawnPositionAvailable(position, occupiedKeys)) {
                            candidates.push(position);
                        }
                    }
                }
            });
            const position = pickRandom(candidates);
            if (position) {
                return position;
            }
        }

        const rowCandidates = [];
        for (let rowOffset = 0; rowOffset < this.scene.height; rowOffset++) {
            const y = spawnConfig.startRow + rowOffset * spawnConfig.direction;
            if (y < 0 || y >= this.scene.height) {
                continue;
            }
            for (let x = 0; x < this.scene.width; x++) {
                const position = { x, y };
                if (this.isSpawnPositionAvailable(position, occupiedKeys)) {
                    rowCandidates.push(position);
                }
            }
            if (rowCandidates.length > 0) {
                return pickRandom(rowCandidates);
            }
        }

        const fallbackCandidates = [];
        for (let y = 0; y < this.scene.height; y++) {
            for (let x = 0; x < this.scene.width; x++) {
                const position = { x, y };
                if (this.isSpawnPositionAvailable(position, occupiedKeys)) {
                    fallbackCandidates.push(position);
                }
            }
        }

        return pickRandom(fallbackCandidates);
    }

    isSpawnPositionAvailable(position, occupiedKeys = new Set()) {
        if (!position || !this.isInsideBoard(position)) {
            return false;
        }
        const key = `${position.x},${position.y}`;
        return !occupiedKeys.has(key) && !this.isObstacleAt(position);
    }

    placeSpawnedUnits(units, spawnConfig = this.scene.enemySpawn, appendToEnemies = false) {
        const occupiedKeys = new Set(
            this.getAllUnits()
                .filter(unit => unit.isAlive())
                .map(unit => `${unit.position.x},${unit.position.y}`)
        );
        units.forEach((unit) => {
            const preferredPosition = this.normalizeSpawnPositionEntry(
                unit.preferredSpawnPosition || unit.spawnPosition,
                this.scene.width,
                this.scene.height
            );
            const position = preferredPosition && this.isSpawnPositionAvailable(preferredPosition, occupiedKeys)
                ? preferredPosition
                : this.findSpawnPosition(spawnConfig, occupiedKeys);
            if (position) {
                unit.setPosition(position);
                this.getTerrainUnitState(unit);
                this.handleTerrainPositionChange(unit, null, position);
                occupiedKeys.add(`${position.x},${position.y}`);
            }
            unit.setBattleContext?.(this);
            this.setInitialProgress(unit);
            if (appendToEnemies && !this.enemies.includes(unit)) {
                this.enemies.push(unit);
            }
        });
        this.invalidateBoardCache();
    }


    hasPendingBossWaves() {
        return this.pendingBossWaves.some(wave => !wave.isSpawned);
    }

    getAliveNonBossEnemies() {
        return this.enemies.filter(unit => unit.isAlive() && unit.rank !== 'boss');
    }

    getAliveFieldEnemies() {
        return this.enemies.filter(unit => unit.isAlive());
    }

    getRoundTriggeredBossWaves() {
        return this.pendingBossWaves.filter(wave => !wave.isSpawned && this.currentRound >= wave.spawnRound);
    }

    getClearTriggeredBossWaves() {
        if (this.getAliveFieldEnemies().length > 0) {
            return [];
        }
        return this.pendingBossWaves.filter(wave => !wave.isSpawned && wave.spawnOnClearBeforeRound);
    }

    findBossWaveGuardian(wave) {
        const key = String(wave?.guardianKey || '').trim();
        if (!key) {
            return null;
        }
        return this.enemies.find(unit => unit?.entryKey === key || unit?.key === key) || null;
    }

    resolveBossGuardianState(wave) {
        const key = String(wave?.guardianKey || '').trim();
        if (!key) {
            return { key, unit: null, alive: false, enabled: false };
        }
        const unit = this.findBossWaveGuardian(wave);
        return { key, unit, alive: Boolean(unit?.isAlive?.()), enabled: true };
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

        const spawnableWaves = [];
        normalizedWaves.forEach((wave) => {
            const guardian = this.resolveBossGuardianState(wave);
            if (guardian.enabled && !guardian.alive) {
                wave.isSpawned = true;
                this.addLog('boss', `${guardian.key} 已倒下，${wave.id} 不再登场。`);
                return;
            }
            spawnableWaves.push(wave);
        });

        if (spawnableWaves.length === 0) {
            this.emitStateChange();
            return true;
        }

        const bosses = [];
        spawnableWaves.forEach((wave) => {
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
            waveIds: spawnableWaves.map(wave => wave.id),
            bosses
        });
        spawnableWaves.forEach((wave) => {
            const guardian = this.resolveBossGuardianState(wave);
            if (guardian.enabled && guardian.alive) {
                guardian.unit.hp = 0;
                this.processDefeatedUnit(guardian.unit, { bossGuardian: true });
                this.addLog('boss', `${guardian.unit.name} 因领主登场而倒下。`);
            }
        });
        this.placeSpawnedUnits(bosses, this.scene.enemySpawn, true);
        this.addLog('boss', `${bossNames} 登场了！`);
        this.emitStateChange();
        if (window.battleView && typeof window.battleView.forceBattleStateRender === 'function') {
            window.battleView.forceBattleStateRender();
        }
        await new Promise(resolve => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(resolve) : setTimeout(resolve, 0)));
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

    addLog() {
    }

    getBattleLog() {
        return [];
    }

    getSnapshot(options = {}) {
        const snapshot = {
            scene: this.scene,
            environmentEffect: this.environmentEffect,
            currentRound: this.currentRound,
            isBattling: this.isBattling,
            isBossEntrancePlaying: this.isBossEntrancePlaying,
            pendingBossWaveCount: this.pendingBossWaves.filter(wave => !wave.isSpawned).length,
            currentActorId: this.currentActor?.id || null,
            heroes: this.heroes,
            enemies: this.enemies,
            fallenHeroes: this.getFallenHeroes(),
            specialTileWarnings: this.specialTileWarnings.map(warning => ({
                ...warning,
                cells: (warning.cells || []).map(cell => ({ ...cell }))
            })),
            battleItemUsage: { ...this.battleItemUsage },
        };
        if (options.includeBattleStats === true) {
            snapshot.battleStats = this.getBattleStatsSummary();
        }
        return snapshot;
    }

    emitStateChange() {
        if (this.pendingStateChangeFrame) {
            return;
        }
        const schedule = typeof requestAnimationFrame === 'function'
            ? requestAnimationFrame
            : (callback) => setTimeout(callback, 0);
        this.pendingStateChangeFrame = schedule(() => {
            this.pendingStateChangeFrame = null;
            eventManager.emit('battleStateChange', this.getSnapshot());
        });
    }

    flushStateChange() {
        if (!this.pendingStateChangeFrame) {
            return;
        }
        if (typeof cancelAnimationFrame === 'function') {
            cancelAnimationFrame(this.pendingStateChangeFrame);
        } else {
            clearTimeout(this.pendingStateChangeFrame);
        }
        this.pendingStateChangeFrame = null;
        eventManager.emit('battleStateChange', this.getSnapshot());
    }

    cancelPendingStateChange() {
        if (!this.pendingStateChangeFrame) {
            return;
        }
        if (typeof cancelAnimationFrame === 'function') {
            cancelAnimationFrame(this.pendingStateChangeFrame);
        } else {
            clearTimeout(this.pendingStateChangeFrame);
        }
        this.pendingStateChangeFrame = null;
    }

    isInsideBoard(position) {
        return position.x >= 0 && position.y >= 0 && position.x < this.scene.width && position.y < this.scene.height;
    }

    buildPositionMap(entries = [], valueFactory = item => item) {
        const map = new Map();
        entries.forEach((entry) => {
            if (!entry || !Number.isFinite(Number(entry.x)) || !Number.isFinite(Number(entry.y))) {
                return;
            }
            map.set(`${entry.x},${entry.y}`, valueFactory(entry));
        });
        return map;
    }

    getObstacleMap() {
        const obstacles = this.scene?.obstacles || [];
        const key = obstacles.map(obstacle => `${obstacle.x},${obstacle.y},${obstacle.id || obstacle.type || ''}`).join('|');
        if (!this.boardCache.obstacleMap || this.boardCache.obstacleKey !== key) {
            this.boardCache.obstacleMap = this.buildPositionMap(obstacles);
            this.boardCache.obstacleKey = key;
            this.boardCache.lineObstacle.clear();
            this.boardCache.pathDistance.clear();
        }
        return this.boardCache.obstacleMap;
    }

    getSpecialTileMap() {
        const tiles = this.scene?.specialTiles || [];
        const key = tiles.map(tile => `${tile.x},${tile.y},${tile.id || tile.type || ''}`).join('|');
        if (!this.boardCache.specialTileMap || this.boardCache.specialTileKey !== key) {
            this.boardCache.specialTileMap = this.buildPositionMap(tiles);
            this.boardCache.specialTileKey = key;
        }
        return this.boardCache.specialTileMap;
    }

    getUnitPositionMap() {
        const units = this.getAllUnits().filter(unit => unit?.isAlive?.() && unit.isAlive() && unit.position);
        const key = units.map(unit => `${unit.id}:${unit.position.x},${unit.position.y}`).join('|');
        if (!this.boardCache.unitMap || this.boardCache.unitKey !== key) {
            const map = new Map();
            units.forEach(unit => {
                map.set(this.getCellKey(unit.position), unit);
            });
            this.boardCache.unitMap = map;
            this.boardCache.unitKey = key;
            this.boardCache.pathDistance.clear();
        }
        return this.boardCache.unitMap;
    }

    getObstacleAt(position) {
        if (!position) {
            return null;
        }
        return this.getObstacleMap().get(this.getCellKey(position)) || null;
    }

    getSpecialTileAt(position) {
        if (!position) {
            return null;
        }
        return this.getSpecialTileMap().get(this.getCellKey(position)) || null;
    }

    isObstacleAt(position) {
        return Boolean(this.getObstacleAt(position));
    }

    getUnitAt(position, ignoreUnitId = null) {
        if (!position) {
            return null;
        }
        const unit = this.getUnitPositionMap().get(this.getCellKey(position)) || null;
        return unit && unit.id !== ignoreUnitId ? unit : null;
    }

    isCellBlocked(position, ignoreUnitId = null) {
        return this.isObstacleAt(position) || Boolean(this.getUnitAt(position, ignoreUnitId));
    }

    getUnitStatPercentBonus(unit, statKey) {
        const tile = this.getSpecialTileAt(unit?.position);
        let bonus = 0;
        if (unit?.configId === 'hero_029') {
            const instinct = this.getPoYuDesperateInstinctState(unit);
            if (instinct) {
                if (statKey === 'crit') {
                    bonus += instinct.critBonus;
                }
            }
        }
        if (statKey === 'attackRange' && unit?.isAlive?.() && unit.isAlive()) {
            const allies = this.getAllies?.(unit) || [];
            for (const ally of allies) {
                const aura = this.getProfessionSynergyAura(ally);
                if (aura && aura.attackRangeBonus > 0 && ally.profession === unit.profession) {
                    bonus += aura.attackRangeBonus;
                    break;
                }
            }
        }
        if (!tile || !unit || !statKey) {
            return bonus;
        }
        if (tile.type === 'swamp') {
            if (statKey === 'speed' || statKey === 'moveRange') {
                bonus += -0.3;
            }
        }
        if (tile.type === 'miasma' && statKey === 'defense') {
            bonus += -0.5;
        }
        return bonus;
    }

    getSpecialTileMoveRangeMultiplier(unit) {
        const tile = this.getSpecialTileAt(unit?.position);
        if (!tile || tile.type !== 'swamp') {
            return 1;
        }
        return 0.7;
    }

    getSpecialTileTriggerEffects(unit) {
        const tile = this.getSpecialTileAt(unit?.position);
        if (!tile) {
            return [];
        }
        const terrainState = this.getTerrainUnitState(unit);
        if (tile.type === 'heal') {
            const nextStage = Math.max(1, Number(terrainState?.healStreak) || 0) + 1;
            const stageConfig = this.getHealTileStageConfig(nextStage);
            terrainState.healStreak = nextStage;
            if (stageConfig.mode === 'heal') {
                const missingHp = Math.max(0, unit.maxHp - unit.hp);
                const heal = Math.max(0, Math.floor(missingHp * stageConfig.ratio));
                return heal > 0
                    ? [{ type: 'heal', heal, tileName: tile.name || '恢复地格', stage: nextStage }]
                    : [];
            }
            const damage = Math.max(1, Math.floor(unit.hp * stageConfig.ratio));
            return [{ type: 'damage', damage, tileName: tile.name || '恢复地格', stage: nextStage }];
        }
        if (tile.type === 'fire') {
            terrainState.fireMomentumStacks = Math.min(5, Math.max(0, Number(terrainState.fireMomentumStacks) || 0) + 1);
            const damage = Math.max(1, Math.floor(unit.hp * 0.1));
            return [{
                type: 'damage',
                damage,
                tileName: tile.name || '火焰地格',
                gainedFireMomentum: 1,
                fireMomentumStacks: terrainState.fireMomentumStacks
            }];
        }
        return [];
    }

    isCellBlockedForMovement(position, actor, destination = null) {
        if (this.isObstacleAt(position)) {
            return true;
        }

        const occupyingUnit = this.getUnitAt(position, actor?.id || null);
        if (!occupyingUnit) {
            return false;
        }

        const isDestination = destination
            && destination.x === position.x
            && destination.y === position.y;
        if (isDestination) {
            return true;
        }

        return !actor || occupyingUnit.camp !== actor.camp;
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

    distanceBetweenByMetric(a, b, metric = 'manhattan') {
        if (!a || !b) {
            return Infinity;
        }
        const dx = Math.abs(a.x - b.x);
        const dy = Math.abs(a.y - b.y);
        if (metric === 'chebyshev') {
            return Math.max(dx, dy);
        }
        return dx + dy;
    }

    getNeighborCells(position) {
        return [
            { x: position.x + 1, y: position.y },
            { x: position.x - 1, y: position.y },
            { x: position.x, y: position.y + 1 },
            { x: position.x, y: position.y - 1 }
        ].filter(cell => this.isInsideBoard(cell));
    }

    getPathDistance(start, target, actor = null) {
        if (!start || !target || !this.isInsideBoard(start) || !this.isInsideBoard(target)) {
            return Infinity;
        }
        if (start.x === target.x && start.y === target.y) {
            return 0;
        }
        this.getObstacleMap();
        this.getUnitPositionMap();
        const actorKey = actor ? `${actor.id}:${actor.camp}` : '';
        const cacheKey = `${actorKey};${start.x},${start.y};${target.x},${target.y};${this.boardCache.unitKey};${this.boardCache.obstacleKey}`;
        if (this.boardCache.pathDistance.has(cacheKey)) {
            return this.boardCache.pathDistance.get(cacheKey);
        }
        if (this.isCellBlockedForMovement(target, actor, target)) {
            this.boardCache.pathDistance.set(cacheKey, Infinity);
            return Infinity;
        }

        const queue = [{ position: { x: start.x, y: start.y }, steps: 0 }];
        const visited = new Set([`${start.x},${start.y}`]);

        while (queue.length > 0) {
            const current = queue.shift();
            const neighbors = this.getNeighborCells(current.position);
            for (const neighbor of neighbors) {
                const key = `${neighbor.x},${neighbor.y}`;
                if (visited.has(key) || this.isCellBlockedForMovement(neighbor, actor, target)) {
                    continue;
                }
                const nextSteps = current.steps + 1;
                if (neighbor.x === target.x && neighbor.y === target.y) {
                    this.boardCache.pathDistance.set(cacheKey, nextSteps);
                    return nextSteps;
                }
                visited.add(key);
                queue.push({ position: neighbor, steps: nextSteps });
            }
        }

        this.boardCache.pathDistance.set(cacheKey, Infinity);
        return Infinity;
    }

    getRawRangeCells(actor, range) {
        const normalizedRange = Math.max(0, Number(range) || 0);
        const cacheKey = `actor:${actor?.position?.x ?? ''},${actor?.position?.y ?? ''}:${normalizedRange}:${this.scene.width}x${this.scene.height}`;
        if (this.boardCache.rawRange.has(cacheKey)) {
            return this.boardCache.rawRange.get(cacheKey);
        }
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
        this.boardCache.rawRange.set(cacheKey, cells);
        return cells;
    }

    getRawRangeCellsByMetric(origin, range, metric = 'manhattan') {
        if (!origin || !this.isInsideBoard(origin)) {
            return [];
        }
        const normalizedRange = Math.max(0, Number(range) || 0);
        const cacheKey = `${origin.x},${origin.y}:${normalizedRange}:${metric}:${this.scene.width}x${this.scene.height}`;
        if (this.boardCache.rawRange.has(cacheKey)) {
            return this.boardCache.rawRange.get(cacheKey);
        }
        const cells = [];
        for (let x = 0; x < this.scene.width; x++) {
            for (let y = 0; y < this.scene.height; y++) {
                const position = { x, y };
                const distance = this.distanceBetweenByMetric(origin, position, metric);
                if (distance > 0 && distance <= normalizedRange) {
                    cells.push(position);
                }
            }
        }
        this.boardCache.rawRange.set(cacheKey, cells);
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
        this.getObstacleMap();
        const cacheKey = `${start.x},${start.y};${end.x},${end.y};${this.boardCache.obstacleKey}`;
        if (this.boardCache.lineObstacle.has(cacheKey)) {
            return this.boardCache.lineObstacle.get(cacheKey);
        }
        const blocked = this.getCellsOnLine(start, end).some(cell => this.isObstacleAt(cell))
            || this.hasObstacleBlockedDiagonalCorner(start, end);
        this.boardCache.lineObstacle.set(cacheKey, blocked);
        return blocked;
    }

    hasObstacleBlockedDiagonalCorner(start, end) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        if (dx === 0 || dy === 0) {
            return false;
        }
        const steps = Math.max(Math.abs(dx), Math.abs(dy));
        let previous = { x: start.x, y: start.y };

        for (let step = 1; step <= steps; step++) {
            const current = {
                x: Math.round(start.x + dx * (step / steps)),
                y: Math.round(start.y + dy * (step / steps))
            };
            const stepX = Math.sign(current.x - previous.x);
            const stepY = Math.sign(current.y - previous.y);
            if (stepX !== 0 && stepY !== 0
                && this.isObstacleAt({ x: previous.x + stepX, y: previous.y })
                && this.isObstacleAt({ x: previous.x, y: previous.y + stepY })) {
                return true;
            }
            previous = current;
        }
        return false;
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

    isCellTargetableByMetric(actor, position, range, metric = 'manhattan') {
        if (!actor || !position || !this.isInsideBoard(position)) {
            return false;
        }
        const normalizedRange = Math.max(0, Number(range) || 0);
        const distance = this.distanceBetweenByMetric(actor.position, position, metric);
        if (distance <= 0 || distance > normalizedRange) {
            return false;
        }
        if (this.isObstacleAt(position)) {
            return false;
        }
        return !this.hasObstacleBetween(actor.position, position);
    }

    isPositionTargetable(fromPosition, targetPosition, range) {
        if (!fromPosition || !targetPosition || !this.isInsideBoard(fromPosition) || !this.isInsideBoard(targetPosition)) {
            return false;
        }
        const normalizedRange = Math.max(0, Number(range) || 0);
        const distance = this.distanceBetween(fromPosition, targetPosition);
        if (distance <= 0 || distance > normalizedRange) {
            return false;
        }
        if (this.isObstacleAt(targetPosition)) {
            return false;
        }
        return !this.hasObstacleBetween(fromPosition, targetPosition);
    }

    getAttackPositionsNearTarget(actor, targetUnit) {
        if (!actor || !targetUnit?.position) {
            return [];
        }
        const positions = [];
        const range = Math.max(1, Number(actor.attackRange) || 1);
        for (let x = 0; x < this.scene.width; x++) {
            for (let y = 0; y < this.scene.height; y++) {
                const position = { x, y };
                if (!this.isPositionTargetable(position, targetUnit.position, range)) {
                    continue;
                }
                if (this.getPathDistance(actor.position, position, actor) !== Infinity) {
                    positions.push(position);
                }
            }
        }
        return positions;
    }

    getNearestPathDistanceToCells(fromPosition, cells, actor) {
        if (!fromPosition || !Array.isArray(cells) || cells.length === 0) {
            return Infinity;
        }
        return cells.reduce((best, cell) => {
            const distance = this.getPathDistance(fromPosition, cell, actor);
            return Math.min(best, distance);
        }, Infinity);
    }

    getUniqueExpiredEffects(effects = []) {
        const seen = new Set();
        return (Array.isArray(effects) ? effects : []).filter((effect) => {
            const key = `${effect?.type || effect?.statusType || ''}:${effect?.name || effect?.statusName || ''}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    getReachableCells(actor) {
        const moveRange = Math.max(1, Math.floor((Number(actor.moveRange) || 1) * this.getSpecialTileMoveRangeMultiplier(actor)));
        const cells = [];
        for (let x = 0; x < this.scene.width; x++) {
            for (let y = 0; y < this.scene.height; y++) {
                const position = { x, y };
                if (this.distanceBetween(actor.position, position) === 0) {
                    continue;
                }
                if (this.getPathDistance(actor.position, position, actor) <= moveRange) {
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
        const attackPositions = this.getAttackPositionsNearTarget(actor, targetUnit);
        if (attackPositions.length > 0) {
            const currentPathDistance = this.getNearestPathDistanceToCells(actor.position, attackPositions, actor);
            reachableCells.sort((cellA, cellB) => {
                const canAttackA = this.isPositionTargetable(cellA, targetUnit.position, actor.attackRange);
                const canAttackB = this.isPositionTargetable(cellB, targetUnit.position, actor.attackRange);
                if (canAttackA !== canAttackB) {
                    return canAttackA ? -1 : 1;
                }
                const pathA = canAttackA ? 0 : this.getNearestPathDistanceToCells(cellA, attackPositions, actor);
                const pathB = canAttackB ? 0 : this.getNearestPathDistanceToCells(cellB, attackPositions, actor);
                if (pathA !== pathB) {
                    return pathA - pathB;
                }
                const progressA = currentPathDistance - pathA;
                const progressB = currentPathDistance - pathB;
                if (progressA !== progressB) {
                    return progressB - progressA;
                }
                const distanceA = this.distanceBetween(cellA, targetUnit.position);
                const distanceB = this.distanceBetween(cellB, targetUnit.position);
                if (distanceA !== distanceB) {
                    return distanceA - distanceB;
                }
                return cellA.y - cellB.y || cellA.x - cellB.x;
            });
            if (this.getNearestPathDistanceToCells(reachableCells[0], attackPositions, actor) !== Infinity
                || this.isPositionTargetable(reachableCells[0], targetUnit.position, actor.attackRange)) {
                return reachableCells[0] || null;
            }
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

    getActiveCharm(actor) {
        if (!actor?.getStatusEffects) {
            return null;
        }
        const charmEffect = actor.getStatusEffects().find(effect => effect.type === 'charm');
        if (!charmEffect) {
            return null;
        }

        const source = charmEffect.sourceUnitId ? this.findUnitById(charmEffect.sourceUnitId) : null;
        const validSource = source?.isAlive?.() && source.isAlive();
        if (!validSource) {
            actor.removeStatusEffectsWhere?.(effect => effect.type === 'charm' && effect.sourceUnitId === charmEffect.sourceUnitId);
            return null;
        }

        return { effect: charmEffect, source };
    }

    getCharmedAction(actor) {
        const charm = this.getActiveCharm(actor);
        if (!charm) {
            return null;
        }

        const moveCell = this.chooseBestMoveToward(actor, charm.source);
        if (moveCell && (moveCell.x !== actor.position.x || moveCell.y !== actor.position.y)) {
            return {
                type: 'move',
                position: moveCell,
                forcedByCharm: true,
                charmSourceId: charm.source.id
            };
        }

        return {
            type: 'defend',
            forcedByCharm: true,
            charmSourceId: charm.source.id
        };
    }

    getSkillTargetCandidates(actor, skillIndex = 0, options = {}) {
        const ignoreUsable = options.ignoreUsable === true;
        const targetType = actor.getSkillTargetType?.(skillIndex) || 'enemy';
        const range = Number(actor.getSkillRange?.(skillIndex));
        const rangeMetric = actor.getSkillState?.(skillIndex)?.rangeMetric || 'manhattan';
        if (!ignoreUsable && !this.canActorUseSkill(actor, skillIndex)) {
            return [];
        }
        if (targetType === 'self') {
            return [actor];
        }
        const targetPool = targetType === 'ally'
            ? this.getAllies(actor)
            : this.getOpponents(actor);
        return targetPool.filter(target => target.isAlive() && this.isCellTargetableByMetric(actor, target.position, range, rangeMetric));
    }

    getPoYuBladeFlashContext(actor, skillIndex = 0) {
        const skill = actor?.getSkill?.(skillIndex) || null;
        const customEffect = skill?.customEffect || null;
        if (!actor || customEffect?.type !== 'desperate_blade_flash') {
            return null;
        }
        const currentHpPercent = Utils.clamp((Number(actor.hp) || 0) / Math.max(1, Number(actor.maxHp) || 1), 0, 1) * 100;
        const desperateCast = currentHpPercent < (Number(customEffect.lowHpThresholdPercent) || 20);
        return {
            skill,
            customEffect,
            desperateCast,
            range: desperateCast
                ? Math.max(1, Number(customEffect.lowHpRange) || Number(skill.range) || 1)
                : Math.max(1, Number(skill.range) || 1),
            multiplier: desperateCast
                ? Math.max(0, Number(customEffect.lowHpMultiplier) || Number(skill.multiplier) || 1)
                : Math.max(0, Number(skill.multiplier) || 1),
            healMissingHpRatioPerHit: desperateCast
                ? Math.max(0, Number(customEffect.healMissingHpRatioPerHit) || 0)
                : 0
        };
    }

    getPoYuBladeFlashTargets(actor, skillIndex = 0) {
        const context = this.getPoYuBladeFlashContext(actor, skillIndex);
        if (!context) {
            return [];
        }
        return this.getOpponents(actor).filter(target => target.isAlive() && this.isCellTargetable(actor, target.position, context.range));
    }

    getSkillRangeCells(actor, skillIndex = 0, options = {}) {
        const targetType = actor.getSkillTargetType?.(skillIndex) || 'enemy';
        const range = Number(actor.getSkillRange?.(skillIndex));
        const rangeMetric = actor.getSkillState?.(skillIndex)?.rangeMetric || 'manhattan';
        if (targetType === 'self') {
            const bladeFlashContext = this.getPoYuBladeFlashContext(actor, skillIndex);
            if (bladeFlashContext) {
                if (!options.ignoreUsable && !this.canActorUseSkill(actor, skillIndex)) {
                    return [];
                }
                const cells = this.getRawRangeCells(actor, bladeFlashContext.range);
                return options.previewRaw
                    ? cells
                    : cells.filter(position => !this.hasObstacleBetween(actor.position, position));
            }
            return [{ x: actor.position.x, y: actor.position.y }];
        }
        if (options.previewRaw) {
            return this.getRawRangeCellsByMetric(actor.position, range, rangeMetric);
        }
        if (!options.ignoreUsable && !this.canActorUseSkill(actor, skillIndex)) {
            return [];
        }
        return this.getRawRangeCellsByMetric(actor.position, range, rangeMetric).filter(position => !this.hasObstacleBetween(actor.position, position));
    }

    getSelectedSkillTargets(actor, primaryTarget, skillIndex = 0) {
        const targetType = actor.getSkillTargetType?.(skillIndex) || 'enemy';
        if (targetType === 'self') {
            const bladeFlashTargets = this.getPoYuBladeFlashTargets(actor, skillIndex);
            if (bladeFlashTargets.length > 0) {
                return bladeFlashTargets;
            }
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
        if (!actor?.position) {
            return [];
        }
        return this.getRawRangeCells(actor, actor.attackRange).filter((position) => (
            this.isPositionTargetable(actor.position, position, actor.attackRange)
        ));
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

            const terrainAttackState = this.getTerrainAttackStatePreview(actor);
            const attackResult = actor.performConfiguredAttack(target, {
                multiplier: Number(passiveEffect?.multiplier ?? 1) || 1,
                canCrit: passiveEffect?.canCrit === true,
                defensePenBonus: Math.max(0, Number(passiveEffect?.defensePenBonus ?? 0) || 0),
                triggerName: passiveEffect?.name || '被动'
            });
            this.applyTerrainAttackConsequences(actor, target, attackResult, attackResult.appliedEffects || [], terrainAttackState);
            this.playAttackActionSfx(attackResult);
            this.triggerHeroDamageVoice(actor, attackResult);

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

            if (attackResult.hit && attackResult.damage > 0) {
                this.handleDamageReflect(target, actor, attackResult.damage);
                this.handleCounterAttack(target, actor);
            }
            if (!target.isAlive()) {
                this.processDefeatedUnit(target, {
                    attacker: actor,
                    reason: 'move_end_passive'
                });
            }
        });
    }

    triggerKillPassives(actor, defeatedUnit, context = {}) {
        if (actor?.configId === 'hero_029') {
            const instinct = this.getPoYuDesperateInstinctState(actor);
            const healRatio = Math.max(0, Number(instinct?.effect?.despairKillHealMaxHpRatio) || 0);
            if (instinct?.despairActive && healRatio > 0) {
                const actualHeal = actor.heal(Math.max(1, Math.floor(actor.maxHp * healRatio)));
                if (actualHeal > 0) {
                    this.addLog('heal', `${actor.name} 触发 ${instinct.effect?.name || '绝境本能'}，恢复 ${actualHeal} 点生命`);
                    eventManager.emit('battleUnitAction', {
                        attacker: actor,
                        target: actor,
                        damage: 0,
                        actionType: 'status',
                        result: {
                            hit: true,
                            heal: actualHeal,
                            statusName: instinct.effect?.name || '绝境本能'
                        }
                    });
                }
            }
        }

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

            const terrainAttackState = this.getTerrainAttackStatePreview(actor);
            const chainResult = actor.performConfiguredAttack(chainTarget, {
                multiplier: currentMultiplier,
                canCrit: passiveEffect?.canCrit === true,
                defensePenBonus: Math.max(0, Number(passiveEffect?.defensePenBonus ?? 0) || 0),
                triggerName: passiveEffect?.name || '被动'
            });
            this.applyTerrainAttackConsequences(actor, chainTarget, chainResult, chainResult.appliedEffects || [], terrainAttackState);
            this.playAttackActionSfx(chainResult);
            this.triggerHeroDamageVoice(actor, chainResult);

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

            if (chainResult.hit && chainResult.damage > 0) {
                this.handleDamageReflect(chainTarget, actor, chainResult.damage);
                this.handleCounterAttack(chainTarget, actor);
            }
            if (!chainTarget.isAlive()) {
                this.processDefeatedUnit(chainTarget, {
                    attacker: actor,
                    reason: 'kill_chain',
                    chainMultiplier: this.getNextPassiveChainMultiplier(passiveEffect, currentMultiplier)
                });
            }
        });
    }

    isHeroUnit(unit) {
        return unit?.camp === 'hero' || unit?.type === 'hero';
    }

    triggerHeroVoice(unit, cue, options = {}) {
        if (!this.isHeroUnit(unit) || !window.audioManager?.hasHeroVoiceCue?.(unit, cue)) {
            return null;
        }
        const cooldownMs = Math.max(0, Number(options.cooldownMs ?? 900) || 0);
        const key = `${unit.id || unit.configId || unit.name}:${cue}`;
        const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        const lastPlayedAt = Number(this.heroVoiceLastPlayedAt?.[key]) || 0;
        if (cooldownMs > 0 && now - lastPlayedAt < cooldownMs) {
            return null;
        }
        this.heroVoiceLastPlayedAt[key] = now;
        return window.audioManager.playHeroVoiceCue(unit, cue, options);
    }

    triggerHeroDamageVoice(actor, attackResult) {
        if (!attackResult?.hit || Number(attackResult.damage) <= 0) {
            return;
        }
        if (attackResult.isCritical) {
            this.triggerHeroVoice(actor, 'critical', {
                priority: 2,
                cooldownMs: 1000
            });
        }
    }

    triggerHeroHealVoice(actor, actionTargets = []) {
        const targets = Array.isArray(actionTargets) ? actionTargets : [actionTargets];
        const hasActualHeal = targets.some(entry => Number(entry?.result?.heal) > 0);
        if (!hasActualHeal) {
            return;
        }
        this.triggerHeroVoice(actor, 'heal', {
            priority: 2,
            cooldownMs: 1000
        });
    }

    playAttackActionSfx(attackResults) {
        const results = Array.isArray(attackResults) ? attackResults : [attackResults];
        const validResults = results.filter(result => result?.hit && Number(result.damage) > 0);
        if (!validResults.length) {
            return;
        }
        const hasCritical = validResults.some(result => result.isCritical);
        window.audioManager?.playSFX?.(hasCritical ? 'battle_critical' : 'battle_attack', hasCritical ? 0.36 : 0.3);
    }

    clearTauntsFromSource(sourceUnit) {
        if (!sourceUnit?.id) {
            return [];
        }

        const cleared = [];
        this.getAllUnits().forEach((unit) => {
            const removedEffects = unit.removeStatusEffectsWhere?.(effect => (effect.type === 'taunt' || effect.type === 'charm') && effect.sourceUnitId === sourceUnit.id) || [];
            if (removedEffects.length > 0) {
                const expiredEffects = this.getUniqueExpiredEffects(removedEffects);
                cleared.push({ unit, removedEffects });
                eventManager.emit('battleUnitAction', {
                    attacker: sourceUnit,
                    target: unit,
                    damage: 0,
                    actionType: 'status_expire',
                    result: { expiredEffects }
                });
            }
        });
        return cleared;
    }

    processDefeatedUnit(unit, context = {}) {
        if (!unit || unit.isAlive()) {
            return false;
        }
        this.invalidateBoardCache();
        if (unit.id && this.processedDeathUnitIds?.has(unit.id)) {
            return false;
        }
        if (unit.id) {
            this.processedDeathUnitIds.add(unit.id);
        }
        if (unit.id && this.terrainRuntimeState?.unitStates) {
            this.terrainRuntimeState.unitStates[unit.id] = this.createTerrainUnitState();
        }
        this.addLog('death', `${unit.name} 倒下了！`);
        eventManager.emit('battleUnitDie', { unit });
        this.triggerHeroVoice(unit, 'death', {
            priority: 4,
            cooldownMs: 0
        });
        this.specialTileWarnings = this.specialTileWarnings.filter(warning => warning.sourceUnitId !== unit.id);
        unit.removeStatusEffectsByType?.('warning_guard');
        this.clearTauntsFromSource(unit);
        if (context?.attacker?.isAlive?.() && context.attacker.isAlive()) {
            this.triggerHeroVoice(context.attacker, 'kill', {
                priority: 3,
                cooldownMs: 800
            });
            this.triggerKillPassives(context.attacker, unit, context);
            this.grantExtraActionOnKill(context.attacker, unit);
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
        if (customEffect.type === 'desperate_blade_flash') {
            return this.getPoYuBladeFlashTargets(actor, skillIndex).length > 0;
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
            damageReduction: 0,
            skillDamageBonus: 0,
            healBonus: 0
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

        if (unit.configId === 'hero_029') {
            const instinct = this.getPoYuDesperateInstinctState(unit);
            if (instinct) {
                modifiers.attackPercentBonus += instinct.attackBonus;
            }
        }

        const alliesAura = this.getAllies?.(unit) || [];
        for (const ally of alliesAura) {
            if (!ally.isAlive()) { continue; }
            const synergy = this.getProfessionSynergyAura(ally);
            if (synergy && synergy.skillDamageBonus > 0 && ally.profession === unit.profession) {
                modifiers.skillDamageBonus = Math.max(modifiers.skillDamageBonus, synergy.skillDamageBonus);
                modifiers.healBonus = Math.max(modifiers.healBonus, synergy.healBonus);
            }
            const teamDr = this.getTeamDamageReductionAura(ally);
            if (teamDr > modifiers.damageReduction) {
                modifiers.damageReduction = teamDr;
            }
        }

        modifiers.damageReduction = Utils.clamp(modifiers.damageReduction, 0, 0.95);
        return modifiers;
    }

    getPoYuDesperateInstinctState(unit) {
        if (!unit?.isAlive?.() || !unit.isAlive() || unit.configId !== 'hero_029') {
            return null;
        }
        const effect = unit.getPassiveEffects?.().find(item => item?.type === 'desperate_instinct');
        if (!effect) {
            return null;
        }
        const currentHpPercent = Utils.clamp((Number(unit.hp) || 0) / Math.max(1, Number(unit.maxHp) || 1), 0, 1) * 100;
        const missingHpPercent = Math.max(0, 100 - currentHpPercent);
        const stepDivisor = Math.max(1, Number(effect.stepDivisor) || 5);
        const attackPerStep = Number(effect.attackPerStep) || 0;
        const critPerStep = Number(effect.critPerStep) || 0;
        const stepCount = Math.max(0, Math.floor(missingHpPercent / stepDivisor));
        return {
            effect,
            currentHpPercent,
            missingHpPercent,
            stepCount,
            attackBonus: stepCount * attackPerStep,
            critBonus: stepCount * critPerStep,
            despairActive: currentHpPercent < (Number(effect.despairThresholdPercent) || 30)
        };
    }

    getAttackContextModifiers(attacker, target, config = {}) {
        const modifiers = {
            defensePenBonus: 0,
            damageBonus: 0
        };
        if (!attacker?.isAlive?.() || !attacker.isAlive()) {
            return modifiers;
        }
        if (attacker.configId === 'hero_029') {
            const instinct = this.getPoYuDesperateInstinctState(attacker);
            if (instinct?.despairActive) {
                modifiers.defensePenBonus += Math.max(0, Number(instinct.effect?.despairDefensePenBonus) || 0);
            }
        }
        (target?.getStatusEffects?.() || []).forEach((effect) => {
            const bonus = Math.max(0, Number(effect?.alliedDefensePenBonus) || 0);
            if (bonus <= 0) {
                return;
            }
            if (effect.sourceOnly === true && effect.sourceUnitId && effect.sourceUnitId !== attacker.id) {
                return;
            }
            if (effect.sourceUnitId) {
                const sourceUnit = this.findUnitById(effect.sourceUnitId);
                if (sourceUnit && sourceUnit.camp !== attacker.camp) {
                    return;
                }
            }
            modifiers.defensePenBonus += bonus;
        });
        const terrainState = this.getTerrainUnitState(attacker, false);
        const tile = this.getSpecialTileAt(attacker.position);
        const fireMomentumStacks = Math.max(0, Number(terrainState?.fireMomentumStacks) || 0);
        if (fireMomentumStacks > 0 && tile?.type !== 'fire') {
            modifiers.damageBonus += fireMomentumStacks * 0.1;
            modifiers.fireMomentumStacks = fireMomentumStacks;
        }
        return modifiers;
    }

    getTerrainAttackStatePreview(attacker) {
        if (!attacker?.id) {
            return {
                tileType: '',
                fireMomentumStacks: 0,
                canConsumeFireMomentum: false,
                swampAttackPrimed: false
            };
        }
        const state = this.getTerrainUnitState(attacker, false);
        const tile = this.getSpecialTileAt(attacker.position);
        const tileType = tile?.type || '';
        const fireMomentumStacks = Math.max(0, Number(state?.fireMomentumStacks) || 0);
        return {
            tileType,
            fireMomentumStacks,
            canConsumeFireMomentum: fireMomentumStacks > 0 && tileType !== 'fire',
            swampAttackPrimed: Boolean(state?.swampAttackPrimed && tileType === 'swamp')
        };
    }

    applyTerrainHitEffects(actor, targetUnit, attackResult = {}, terrainAttackState = null) {
        const preview = terrainAttackState || this.getTerrainAttackStatePreview(actor);
        if (!preview.swampAttackPrimed || !attackResult?.hit || !targetUnit?.isAlive?.() || !targetUnit.isAlive()) {
            return [];
        }
        return targetUnit.applyStatusEffects([{
            type: 'slow',
            name: '泥沼牵制',
            value: -0.25,
            durationTurns: 1,
            modifierType: 'percent',
            effectType: 'stat_modifier',
            countsAsDebuff: true
        }], actor);
    }

    finalizeTerrainAttackAction(actor, terrainAttackState = null) {
        if (!actor?.id) {
            return { consumedFireMomentum: 0, consumedSwampPrime: false };
        }
        const preview = terrainAttackState || this.getTerrainAttackStatePreview(actor);
        const state = this.getTerrainUnitState(actor, false);
        if (!state) {
            return { consumedFireMomentum: 0, consumedSwampPrime: false };
        }
        const consumedFireMomentum = preview.canConsumeFireMomentum ? Math.max(0, Number(state.fireMomentumStacks) || 0) : 0;
        if (consumedFireMomentum > 0) {
            state.fireMomentumStacks = 0;
        }
        const consumedSwampPrime = Boolean(preview.swampAttackPrimed);
        if (consumedSwampPrime) {
            state.swampAttackPrimed = false;
        }
        return {
            consumedFireMomentum,
            consumedSwampPrime
        };
    }

    applyTerrainAttackConsequences(actor, targetUnit, attackResult = {}, appliedEffects = [], terrainAttackState = null) {
        const combinedEffects = Array.isArray(appliedEffects) ? [...appliedEffects] : [];
        const preview = terrainAttackState || this.getTerrainAttackStatePreview(actor);
        const terrainAppliedEffects = attackResult?.hit
            ? this.applyTerrainHitEffects(actor, targetUnit, attackResult, preview)
            : [];
        if (terrainAppliedEffects.length > 0) {
            combinedEffects.push(...terrainAppliedEffects);
        }
        const terrainFinalization = this.finalizeTerrainAttackAction(actor, preview);
        attackResult.appliedEffects = combinedEffects;
        attackResult.terrainAppliedEffects = terrainAppliedEffects;
        attackResult.consumedFireMomentum = terrainFinalization.consumedFireMomentum;
        attackResult.consumedSwampPrime = terrainFinalization.consumedSwampPrime;
        attackResult.fireMomentumDamageBonus = terrainFinalization.consumedFireMomentum * 0.1;
        return {
            appliedEffects: combinedEffects,
            terrainAppliedEffects,
            terrainFinalization
        };
    }

    tryPreventFatalDamage(unit, damage, attacker = null) {
        if (!unit?.isAlive?.() || !unit.isAlive()) {
            return false;
        }
        const effect = unit.getPassiveEffects?.().find(item => item?.type === 'fatal_survival_once');
        if (!effect) {
            return false;
        }
        unit.passiveState = unit.passiveState || {};
        if (unit.passiveState.fatalSurvivalUsed) {
            return false;
        }
        unit.passiveState.fatalSurvivalUsed = true;
        unit.passiveState.pendingFatalRecovery = {
            healRatio: Math.max(0, Number(effect.healRatio) || 0),
            sourceName: effect.name || '不屈之刃',
            skillIndexToReset: Number.isFinite(Number(effect.resetSkillIndex)) ? Number(effect.resetSkillIndex) : null,
            damageReductionBuff: Math.max(0, Number(effect.teamDamageReduction) || 0),
            turns: Math.max(1, Number(effect.teamDamageReductionDurationTurns) || 9999)
        };
        unit.hp = 1;
        if (Number.isFinite(unit.passiveState.pendingFatalRecovery.skillIndexToReset)) {
            const state = unit.getSkillState?.(unit.passiveState.pendingFatalRecovery.skillIndexToReset);
            if (state) {
                state.cooldownRemaining = 0;
            }
        }
        const allies = this.getAllies(unit);
        const teamBuff = effect.teamStatusEffect || {
            type: 'battle_guard',
            name: effect.teamStatusName || '不屈之刃',
            effectType: 'stat_modifier',
            durationTurns: unit.passiveState.pendingFatalRecovery.turns,
            damageReduction: unit.passiveState.pendingFatalRecovery.damageReductionBuff,
            countsAsDebuff: false,
            stackMode: 'replace'
        };
        allies.forEach((ally) => {
            ally.applyStatusEffects?.([teamBuff], unit);
        });
        this.addLog('control', `${unit.name} 触发 ${effect.name || '不屈之刃'}，生命锁定为1`);
        eventManager.emit('battleUnitAction', {
            attacker: attacker?.sourceUnitId ? this.findUnitById(attacker.sourceUnitId) || unit : unit,
            target: unit,
            damage: 0,
            actionType: 'status',
            result: {
                hit: true,
                statusName: effect.name || '不屈之刃'
            }
        });
        return true;
    }

    tryDamageRedirect(unit, damage, attacker = null) {
        if (!unit?.isAlive?.() || !unit.isAlive()) {
            return damage;
        }
        const allies = this.getAllies(unit);
        for (const ally of allies) {
            if (ally.id === unit.id || !ally.isAlive()) {
                continue;
            }
            const redirectEffect = ally.getPassiveEffects?.('ally_damage_redirect').find(eff =>
                eff?.redirectRatio > 0
            );
            if (!redirectEffect) {
                continue;
            }
            const redirectRatio = Utils.clamp(Number(redirectEffect.redirectRatio) || 0, 0, 1);
            const redirectedAmount = Math.floor(damage * redirectRatio);
            if (redirectedAmount <= 0) {
                continue;
            }
            ally.takeDamage(redirectedAmount, attacker);
            this.addLog('control', `${ally.name} 替 ${unit.name} 分担了 ${redirectedAmount} 点伤害`);
            eventManager.emit('battleUnitAction', {
                attacker: attacker?.sourceUnitId ? this.findUnitById(attacker.sourceUnitId) || unit : unit,
                target: ally,
                damage: redirectedAmount,
                actionType: 'redirect',
                result: {
                    hit: true,
                    redirectedFrom: unit.id,
                    redirectedFromName: unit.name,
                    statusName: redirectEffect.name || '伤害分担'
                }
            });
            return damage - redirectedAmount;
        }
        return damage;
    }

    tryAllyFatalIntercept(unit, damage, attacker = null) {
        if (!unit?.isAlive?.() || !unit.isAlive()) {
            return false;
        }
        const allies = this.getAllies(unit);
        for (const ally of allies) {
            if (ally.id === unit.id || !ally.isAlive()) {
                continue;
            }
            const interceptEffect = ally.getPassiveEffects?.('fatal_ally_intercept').find(eff =>
                eff?.type === 'fatal_ally_intercept'
            );
            if (!interceptEffect) {
                continue;
            }
            ally.passiveState = ally.passiveState || {};
            const maxGlobalUses = Math.max(1, Number(interceptEffect.maxGlobalUses) || 2);
            const totalUsed = ally.passiveState.fatalInterceptUsed || 0;
            if (totalUsed >= maxGlobalUses) {
                continue;
            }
            const allyUsedKey = `allyIntercepted_${unit.id}`;
            if (ally.passiveState[allyUsedKey]) {
                continue;
            }
            ally.passiveState.fatalInterceptUsed = totalUsed + 1;
            ally.passiveState[allyUsedKey] = true;
            const healRatio = Utils.clamp(Number(interceptEffect.healRatio) || 0.3, 0.05, 1);
            const healAmount = Math.max(1, Math.floor(unit.maxHp * healRatio));
            unit.hp = healAmount;
            const appliedEffects = Array.isArray(interceptEffect.allyStatusEffects) && interceptEffect.allyStatusEffects.length > 0
                ? unit.applyStatusEffects(interceptEffect.allyStatusEffects, ally)
                : [];
            this.addLog('control', `${ally.name} 触发 ${interceptEffect.name || '复燃'}，将 ${unit.name} 从致命伤害中救回，恢复 ${healAmount} 点生命`);
            eventManager.emit('battleUnitAction', {
                attacker: ally,
                target: unit,
                damage: 0,
                actionType: 'status',
                result: {
                    hit: true,
                    heal: healAmount,
                    statusName: interceptEffect.name || '复燃',
                    appliedEffects
                }
            });
            return true;
        }
        return false;
    }

    tryPreventFatalDamageExtended(unit, damage, attacker = null) {
        if (this.tryAllyFatalIntercept(unit, damage, attacker)) {
            return true;
        }
        return this.tryPreventFatalDamage(unit, damage, attacker);
    }

    getProfessionSynergyAura(unit) {
        if (!unit?.isAlive?.() || !unit.isAlive()) {
            return { skillDamageBonus: 0, healBonus: 0, attackRangeBonus: 0, count: 0 };
        }
        const auraEffect = unit.getPassiveEffects?.('profession_synergy').find(eff =>
            eff?.type === 'profession_synergy'
        );
        if (!auraEffect) {
            return { skillDamageBonus: 0, healBonus: 0, attackRangeBonus: 0, count: 0 };
        }
        const profession = auraEffect.profession || unit.profession;
        if (!profession) {
            return { skillDamageBonus: 0, healBonus: 0, attackRangeBonus: 0, count: 0 };
        }
        const allies = this.getAllies(unit);
        const professionAllies = allies.filter(ally =>
            ally.isAlive() && (ally.profession === profession || ally.id === unit.id)
        );
        const count = Math.min(professionAllies.length, Number(auraEffect.maxCount) || 4);
        const skillDamagePerUnit = Number(auraEffect.skillDamagePerUnit) || 0;
        const healPerUnit = Number(auraEffect.healPerUnit) || 0;
        const attackRangeBonusPerUnit = Number(auraEffect.attackRangeBonusPerUnit) || 0;
        return {
            skillDamageBonus: count * skillDamagePerUnit,
            healBonus: count * healPerUnit,
            attackRangeBonus: count * attackRangeBonusPerUnit,
            count
        };
    }

    getTeamDamageReductionAura(unit) {
        if (!unit?.isAlive?.() || !unit.isAlive()) {
            return 0;
        }
        const auraEffect = unit.getPassiveEffects?.('team_damage_reduction').find(eff =>
            eff?.type === 'team_damage_reduction' && eff?.reductionPerAlly > 0
        );
        if (!auraEffect) {
            return 0;
        }
        const allies = this.getAllies(unit);
        const livingAllies = allies.filter(ally => ally.isAlive());
        return Utils.clamp(livingAllies.length * Number(auraEffect.reductionPerAlly) || 0, 0, Number(auraEffect.maxReduction) || 0.95);
    }

    getExtraActionOnKillState(unit) {
        if (!unit?.isAlive?.() || !unit.isAlive()) {
            return null;
        }
        const effect = unit.getPassiveEffects?.().find(eff =>
            eff?.type === 'extra_action_on_kill'
        );
        if (!effect) {
            return null;
        }
        unit.passiveState = unit.passiveState || {};
        return {
            effect,
            maxPerTurn: Math.max(1, Number(effect.maxPerTurn) || 2),
            usedThisTurn: Number(unit.passiveState.extraActionsThisTurn) || 0,
            pending: Boolean(unit.passiveState.extraActionPending),
            critGuaranteed: Boolean(effect.critGuaranteed === true && (unit.passiveState.extraActionsThisTurn || 0) >= 0)
        };
    }

    grantExtraActionOnKill(unit, defeatedUnit = null) {
        const state = this.getExtraActionOnKillState(unit);
        if (!state) {
            return false;
        }
        const requiredStatusType = state.effect?.requiredTargetStatusType || (unit.configId === 'hero_030' ? 'break_armor' : null);
        if (requiredStatusType && !defeatedUnit?.hasStatus?.(requiredStatusType)) {
            return false;
        }
        if (state.usedThisTurn >= state.maxPerTurn) {
            return false;
        }
        unit.passiveState.extraActionsThisTurn = state.usedThisTurn + 1;
        unit.passiveState.extraActionPending = true;
        return true;
    }

    resetExtraActionState(unit) {
        if (!unit) return;
        unit.passiveState = unit.passiveState || {};
        unit.passiveState.extraActionsThisTurn = 0;
        unit.passiveState.extraActionPending = false;
    }

    getFocusedStationaryEffect(unit) {
        if (!unit?.isAlive?.() || !unit.isAlive()) {
            return null;
        }
        const attackEffects = unit.getBasicAttackEffects?.('hit') || [];
        return attackEffects.find(effect => effect?.damageBonusType === 'focused_stationary') || null;
    }

    getFocusedAimStatusEffect(unit, effect = null) {
        const focusedEffect = effect || this.getFocusedStationaryEffect(unit);
        if (!focusedEffect) {
            return null;
        }
        return {
            type: 'focused_aim',
            name: focusedEffect.statusName || '瞄准就绪',
            effectType: 'stat_modifier',
            stat: 'attack',
            value: 0,
            modifierType: 'percent',
            damageBonus: Math.max(0, Number(focusedEffect.damageBonus) || 0),
            extraCritChance: Math.max(0, Number(focusedEffect.extraCritChance) || 0),
            durationTurns: 1,
            remainingTurns: 1,
            countsAsDebuff: false,
            stackMode: 'replace',
            skipNextTurnEndDecay: true
        };
    }

    refreshFocusedStationaryState(unit) {
        if (!unit) {
            return false;
        }
        const focusedEffect = this.getFocusedStationaryEffect(unit);
        unit.passiveState = unit.passiveState || {};
        if (!focusedEffect) {
            unit.removeStatusEffectsByType?.('focused_aim');
            return false;
        }
        const requiredIdleTurns = Math.max(1, Number(focusedEffect.requiredIdleTurns) || 1);
        const streak = Math.max(0, Number(unit.passiveState.stationaryTurnStreak) || 0);
        if (streak >= requiredIdleTurns) {
            unit.applyStatusEffects?.([this.getFocusedAimStatusEffect(unit, focusedEffect)], unit);
            return true;
        }
        unit.removeStatusEffectsByType?.('focused_aim');
        return false;
    }

    updateFocusedStationaryTurnStart(unit) {
        if (!unit) {
            return false;
        }
        unit.passiveState = unit.passiveState || {};
        const movedLastOwnTurn = unit.passiveState.movedThisTurn === true;
        const previousStreak = Math.max(0, Number(unit.passiveState.stationaryTurnStreak) || 0);
        unit.passiveState.stationaryTurnStreak = movedLastOwnTurn ? 0 : (previousStreak + 1);
        unit.passiveState.movedThisTurn = false;
        return this.refreshFocusedStationaryState(unit);
    }

    clearFocusedStationaryState(unit) {
        if (!unit) {
            return;
        }
        unit.passiveState = unit.passiveState || {};
        unit.passiveState.movedThisTurn = true;
        unit.passiveState.stationaryTurnStreak = 0;
        unit.removeStatusEffectsByType?.('focused_aim');
    }

    buildBasicAttackConfig(actor, action = {}) {
        const config = {};
        const focusedEffect = this.getFocusedStationaryEffect(actor);
        if (focusedEffect && actor?.hasStatus?.('focused_aim')) {
            config.damageBonus = Number(focusedEffect.damageBonus) || 0;
            config.extraCritChance = Number(focusedEffect.extraCritChance) || 0;
            config.triggerName = focusedEffect.name || '冷凝瞄准';
        }
        if (action?._critGuaranteed === true) {
            config.critGuaranteed = true;
        }
        return config;
    }

    applyReflectLifesteal(unit, damage, triggerName = '反击') {
        if (!unit?.isAlive?.() || !unit.isAlive()) {
            return 0;
        }
        const effect = unit.getPassiveEffects?.().find(eff =>
            eff?.type === 'reflect_lifesteal' && Number(eff?.lifestealRatio) > 0
        );
        if (!effect) {
            return 0;
        }
        const hpThreshold = Math.max(0, Number(effect.hpThresholdPercent) || 0);
        if (hpThreshold > 0) {
            const hpPercent = (unit.hp / Math.max(1, unit.maxHp)) * 100;
            if (hpPercent >= hpThreshold) {
                return 0;
            }
        }
        const healAmount = Math.max(0, Math.floor(Math.max(0, Number(damage) || 0) * Number(effect.lifestealRatio)));
        if (healAmount <= 0) {
            return 0;
        }
        const actualHeal = unit.heal(healAmount);
        if (actualHeal <= 0) {
            return 0;
        }
        this.addLog('heal', `${unit.name} 触发 ${effect.name || '不灭熔炉'}，因${triggerName}恢复 ${actualHeal} 点生命`);
        eventManager.emit('battleUnitAction', {
            attacker: unit,
            target: unit,
            damage: 0,
            actionType: 'status',
            result: {
                hit: true,
                heal: actualHeal,
                statusName: effect.name || '不灭熔炉',
                triggerName
            }
        });
        return actualHeal;
    }

    handleCounterAttack(unit, sourceUnit) {
        if (!unit?.isAlive?.() || !unit.isAlive() || !sourceUnit?.isAlive?.() || !sourceUnit.isAlive()) {
            return null;
        }
        const counterEffect = unit.getPassiveEffects?.('hit').find(eff =>
            eff?.type === 'counter_attack' && eff?.chance > 0
        );
        if (!counterEffect) {
            return null;
        }
        const chance = Utils.clamp(Number(counterEffect.chance) || 0, 0, 1);
        if (Math.random() > chance) {
            return null;
        }
        const distance = unit.distanceTo(sourceUnit);
        if (distance > unit.attackRange) {
            return null;
        }
        const multiplier = Number(counterEffect.multiplier) || 1;
        const terrainAttackState = this.getTerrainAttackStatePreview(unit);
        const counterResult = unit.performConfiguredAttack(sourceUnit, {
            multiplier,
            canCrit: counterEffect.canCrit !== false,
            defensePenBonus: Math.max(0, Number(counterEffect.defensePenBonus) || 0),
            maxDamageAttackRatio: Math.max(0, Number(counterEffect.maxDamageAttackRatio) || 0),
            triggerName: counterEffect.name || '反击'
        });
        this.applyTerrainAttackConsequences(unit, sourceUnit, counterResult, counterResult.appliedEffects || [], terrainAttackState);
        this.playAttackActionSfx(counterResult);
        this.triggerHeroDamageVoice(unit, counterResult);
        if (counterResult.hit && counterResult.damage > 0) {
            this.addLog('damage', `${unit.name} 触发 ${counterEffect.name || '怒锤反击'}，对 ${sourceUnit.name} 造成 ${counterResult.damage} 点伤害`);
        } else {
            this.addLog('miss', `${unit.name} 触发 ${counterEffect.name || '怒锤反击'}，但被 ${sourceUnit.name} 闪避了`);
        }
        eventManager.emit('battleUnitAction', {
            attacker: unit,
            target: sourceUnit,
            damage: counterResult.damage,
            actionType: 'attack',
            result: counterResult
        });
        if (counterResult.hit && counterResult.damage > 0) {
            this.applyReflectLifesteal(unit, counterResult.damage, counterEffect.name || '反击');
        }
        if (!sourceUnit.isAlive()) {
            this.processDefeatedUnit(sourceUnit, {
                attacker: unit,
                reason: 'counter_attack'
            });
        }
        return counterResult;
    }

    handleDamageReflect(unit, sourceUnit, incomingDamage) {
        if (!unit?.isAlive?.() || !unit.isAlive() || !sourceUnit?.isAlive?.() || !sourceUnit.isAlive()) {
            return null;
        }
        if (incomingDamage <= 0) {
            return null;
        }
        const reflectEffect = unit.getPassiveEffects?.('damaged').find(eff =>
            eff?.type === 'damage_reflect' && eff?.reflectRatio > 0
        );
        if (!reflectEffect) {
            return null;
        }
        const reflectRatio = Utils.clamp(Number(reflectEffect.reflectRatio) || 0, 0, 5);
        let reflectedDamage = Math.floor(incomingDamage * reflectRatio);
        const hpThreshold = Number(reflectEffect.hpThresholdPercent) || 0;
        if (hpThreshold > 0) {
            const hpPercent = (unit.hp / Math.max(1, unit.maxHp)) * 100;
            if (hpPercent < hpThreshold && reflectEffect.belowThresholdMultiplier > 0) {
                reflectedDamage = Math.floor(reflectedDamage * Number(reflectEffect.belowThresholdMultiplier));
            }
        }
        if (reflectedDamage <= 0) {
            return null;
        }
        const reflectResult = sourceUnit.takeDamage(reflectedDamage, { defensePen: 0 });
        const debuffEffect = reflectEffect.statusEffects?.[0] || null;
        if (debuffEffect && reflectResult > 0) {
            sourceUnit.applyStatusEffects([debuffEffect], unit);
        }
        this.addLog('damage', `${unit.name} 反弹 ${reflectResult} 点伤害给 ${sourceUnit.name}`);
        eventManager.emit('battleUnitAction', {
            attacker: unit,
            target: sourceUnit,
            damage: reflectResult,
            actionType: 'status',
            result: {
                hit: true,
                statusName: reflectEffect.name || '反弹',
                reflectiveDamage: reflectResult
            }
        });
        if (reflectResult > 0) {
            this.applyReflectLifesteal(unit, reflectResult, reflectEffect.name || '反弹');
        }
        if (!sourceUnit.isAlive()) {
            this.processDefeatedUnit(sourceUnit, {
                attacker: unit,
                reason: 'damage_reflect'
            });
        }
        return { reflectResult, reflectEffect };
    }

    handlePostDamageEffects(target, sourceUnit, damageResult) {
        if (!target?.isAlive || !sourceUnit?.isAlive?.()) {
            return;
        }
        const damage = Number(damageResult?.damage) || 0;
        if (target.isAlive() && damage > 0) {
            this.handleDamageReflect(target, sourceUnit, damage);
            this.handleCounterAttack(target, sourceUnit);
        }
        if (!target.isAlive() && sourceUnit.isAlive()) {
            this.processDefeatedUnit(target, {
                attacker: sourceUnit,
                reason: damageResult?.useSkill ? 'skill' : 'attack'
            });
        }
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

    processHeroPassiveTurnStart(actor) {
        const events = [];
        if (!actor?.isAlive?.() || !actor.isAlive()) {
            return events;
        }

        actor.passiveState = actor.passiveState || {};
        const pendingFatalRecovery = actor.passiveState.pendingFatalRecovery;
        if (pendingFatalRecovery && Number(pendingFatalRecovery.healRatio) > 0) {
            const heal = actor.heal(Math.max(1, Math.floor(actor.maxHp * Number(pendingFatalRecovery.healRatio))));
            if (heal > 0) {
                events.push({
                    type: 'passive_heal',
                    heal,
                    effectName: pendingFatalRecovery.sourceName || '不屈之刃'
                });
            }
            delete actor.passiveState.pendingFatalRecovery;
        }

        const hpLossEffects = actor.getPassiveEffects?.().filter(effect => effect?.type === 'turn_start_hp_loss') || [];
        hpLossEffects.forEach((effect) => {
            const ratio = Math.max(0, Number(effect.maxHpLossRatio) || 0);
            if (ratio <= 0) {
                return;
            }
            const damage = actor.takeStatusDamage(Math.max(1, Math.floor(actor.maxHp * ratio)), true);
            if (damage > 0) {
                events.push({
                    type: 'passive_self_damage',
                    damage,
                    effectName: effect.name || '刃嗜'
                });
            }
        });

        const healAllyEffects = actor.getPassiveEffects?.().filter(effect =>
            (effect?.type === 'heal_lowest_ally' || (effect?.type === 'heal_over_time' && effect?.healTarget === 'lowest_hp_percent_ally'))
        ) || [];
        healAllyEffects.forEach((effect) => {
            const healRatio = Math.max(0, Number(effect.healMissingHpRatio) || 0);
            if (healRatio <= 0) {
                return;
            }
            const allies = this.getAllies(actor);
            const livingAllies = allies.filter(a => a.isAlive());
            if (livingAllies.length === 0) {
                return;
            }
            let lowestAlly = livingAllies[0];
            let lowestRatio = lowestAlly.hp / Math.max(1, lowestAlly.maxHp);
            livingAllies.forEach(a => {
                const ratio = a.hp / Math.max(1, a.maxHp);
                if (ratio < lowestRatio) {
                    lowestRatio = ratio;
                    lowestAlly = a;
                }
            });
            const missingHp = Math.max(0, lowestAlly.maxHp - lowestAlly.hp);
            const healAmount = Math.max(1, Math.floor(missingHp * healRatio));
            const actualHeal = lowestAlly.heal(healAmount);
            if (actualHeal > 0) {
                const shieldFromLowHp = Number(effect.shieldIfLowHp) || 0;
                if (shieldFromLowHp > 0 && (lowestAlly.hp / Math.max(1, lowestAlly.maxHp)) < 0.3) {
                    lowestAlly.addShield?.(shieldFromLowHp, 2);
                }
                events.push({
                    type: 'passive_heal_ally',
                    heal: actualHeal,
                    targetId: lowestAlly.id,
                    targetName: lowestAlly.name,
                    effectName: effect.name || '灯语'
                });
                this.addLog('heal', `${actor.name} 触发 ${effect.name || '灯语'}，为 ${lowestAlly.name} 恢复 ${actualHeal} 点生命`);
                eventManager.emit('battleUnitAction', {
                    attacker: actor,
                    target: lowestAlly,
                    damage: 0,
                    actionType: 'status',
                    result: {
                        hit: true,
                        heal: actualHeal,
                        statusName: effect.name || '灯语'
                    }
                });
            }
        });

        return events;
    }

    chooseBestMove(actor) {
        const reachableCells = this.getReachableCells(actor);
        if (reachableCells.length === 0) {
            return null;
        }
        const opponents = this.getOpponents(actor);
        const opponentPlans = opponents.map(target => ({
            target,
            attackPositions: this.getAttackPositionsNearTarget(actor, target)
        })).filter(plan => plan.attackPositions.length > 0);
        const hpRatio = actor.maxHp > 0 ? actor.hp / actor.maxHp : 1;
        const hasHealTile = (this.scene?.specialTiles || []).some(tile => tile?.type === 'heal');
        const aggressiveContext = this.getAggressiveAdvanceContext(actor, opponents, opponentPlans, hpRatio);
        const stayEvaluation = this.evaluateMoveCell(actor, actor.position, opponents, hpRatio, hasHealTile, opponentPlans, aggressiveContext);

        const scored = reachableCells.map(cell => ({
            cell,
            ...this.evaluateMoveCell(actor, cell, opponents, hpRatio, hasHealTile, opponentPlans, aggressiveContext)
        }));

        const best = this.sortMoveEvaluations(scored)[0];
        if (!best) {
            return null;
        }
        if (actor.camp === 'enemy') {
            const forcedAdvance = this.shouldEnemyForceAdvance(actor, best, stayEvaluation.score, aggressiveContext);
            if (forcedAdvance) {
                return best.cell;
            }
        }
        if (best.score <= stayEvaluation.score) {
            return null;
        }
        return best.cell;
    }

    sortMoveEvaluations(entries = []) {
        return [...entries].sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            if (a.cell.y !== b.cell.y) {
                return a.cell.y - b.cell.y;
            }
            return a.cell.x - b.cell.x;
        });
    }

    chooseUrgentTerrainEscapeMove(actor) {
        if (!actor?.position || !this.isHealTileBacklashPosition(actor, actor.position)) {
            return null;
        }
        const reachableCells = this.getReachableCells(actor);
        if (reachableCells.length === 0) {
            return null;
        }
        const opponents = this.getOpponents(actor);
        const opponentPlans = opponents.map(target => ({
            target,
            attackPositions: this.getAttackPositionsNearTarget(actor, target)
        })).filter(plan => plan.attackPositions.length > 0);
        const hpRatio = actor.maxHp > 0 ? actor.hp / actor.maxHp : 1;
        const hasHealTile = (this.scene?.specialTiles || []).some(tile => tile?.type === 'heal');
        const aggressiveContext = this.getAggressiveAdvanceContext(actor, opponents, opponentPlans, hpRatio);
        const stayEvaluation = this.evaluateMoveCell(actor, actor.position, opponents, hpRatio, hasHealTile, opponentPlans, aggressiveContext);
        const scored = this.sortMoveEvaluations(
            reachableCells
                .map(cell => ({
                    cell,
                    ...this.evaluateMoveCell(actor, cell, opponents, hpRatio, hasHealTile, opponentPlans, aggressiveContext)
                }))
                .filter(entry => !this.isHealTileBacklashPosition(actor, entry.cell))
        );
        if (scored.length === 0) {
            return null;
        }
        const safeCandidates = scored.filter(entry => this.getSpecialTileAt(entry.cell)?.type !== 'fire');
        if (safeCandidates.length > 0) {
            return safeCandidates[0].cell;
        }
        const best = scored[0];
        return best && best.score > stayEvaluation.score + 10 ? best.cell : null;
    }

    getAggressiveAdvanceContext(actor, opponents = [], opponentPlans = [], hpRatio = 1) {
        const plans = Array.isArray(opponentPlans) ? opponentPlans : [];
        const nearestOpponentDistance = Array.isArray(opponents) && opponents.length > 0
            ? Math.min(...opponents.map(target => this.distanceBetween(actor.position, target.position)))
            : Infinity;
        const nearestAttackPath = plans.length > 0
            ? Math.min(...plans.map(plan => this.getNearestPathDistanceToCells(actor.position, plan.attackPositions, actor)))
            : Infinity;
        const engagedAllies = this.getAllies(actor).filter(ally => (
            ally?.id !== actor?.id
            && this.getOpponents(actor).some(target => this.isCellTargetable(ally, target.position, ally.attackRange))
        ));
        return {
            actorCamp: actor?.camp || 'enemy',
            isEnemy: actor?.camp === 'enemy',
            hpRatio,
            nearestOpponentDistance,
            nearestAttackPath,
            engagedAllyCount: engagedAllies.length
        };
    }

    shouldEnemyForceAdvance(actor, bestMove, stayScore, aggressiveContext = {}) {
        if (actor?.camp !== 'enemy' || !bestMove?.cell) {
            return false;
        }
        const hpRatio = Math.max(0, Number(aggressiveContext?.hpRatio ?? (actor.maxHp > 0 ? actor.hp / actor.maxHp : 1)) || 0);
        if (hpRatio <= 0.18) {
            return false;
        }
        const scoreGap = Number(bestMove.score) - Number(stayScore);
        const tile = this.getSpecialTileAt(bestMove.cell);
        const dangerousTile = tile?.type === 'fire';
        if (dangerousTile && hpRatio < 0.55) {
            return false;
        }
        const progressToAttack = Math.max(0, Number(aggressiveContext?.nearestAttackPath) || 0)
            - Math.max(0, Number(bestMove.meta?.nearestAttackPath) || 0);
        const progressToTarget = Math.max(0, Number(aggressiveContext?.nearestOpponentDistance) || 0)
            - Math.max(0, Number(bestMove.meta?.nearestOpponentDistance) || 0);
        if (bestMove.meta?.canAttack) {
            return true;
        }
        if (progressToAttack >= 1 && scoreGap >= -14) {
            return true;
        }
        if (progressToTarget >= 1 && Number(aggressiveContext?.engagedAllyCount) > 0 && scoreGap >= -10) {
            return true;
        }
        return false;
    }

    evaluateMoveCell(actor, cell, opponents, hpRatio, hasHealTile = false, opponentPlans = null, aggressiveContext = null) {
        let score = 0;
        const tile = this.getSpecialTileAt(cell);
        const terrainState = this.getTerrainUnitState(actor, false);
        const isEnemy = actor?.camp === 'enemy';
        const currentHealBacklash = this.isHealTileBacklashPosition(actor, actor?.position);
        if (tile) {
            if (tile.type === 'heal') {
                const missing = 1 - hpRatio;
                const projectedOutcome = this.getProjectedHealTileOutcome(actor, cell);
                const projectedStage = Math.max(1, Number(projectedOutcome?.stage) || 1);
                const stageConfig = projectedOutcome || this.getHealTileStageConfig(projectedStage || 1);
                if (stageConfig.mode === 'heal') {
                    const stageWeight = projectedStage <= 1 ? 10 : (projectedStage === 2 ? 5 : 1);
                    score += stageWeight + missing * (projectedStage <= 1 ? 66 : (projectedStage === 2 ? 38 : 18));
                } else {
                    const backlashPenalty = projectedStage === 4
                        ? (42 + hpRatio * 18)
                        : (68 + hpRatio * 26);
                    score -= backlashPenalty;
                }
            } else if (tile.type === 'fire') {
                const currentStacks = Math.max(0, Number(terrainState?.fireMomentumStacks) || 0);
                score -= 12 + hpRatio * 8;
                if (currentStacks < 5) {
                    score += 6 - currentStacks;
                }
            } else if (tile.type === 'swamp') {
                score -= isEnemy ? 4 : 7;
            } else if (tile.type === 'miasma') {
                score -= isEnemy ? 8 : 26;
            }
        }
        if (currentHealBacklash) {
            if (!tile) {
                score += 28;
            } else if (tile.type === 'heal') {
                if (this.isHealTileBacklashPosition(actor, cell)) {
                    score -= 32;
                }
            } else if (tile.type === 'fire') {
                score += 4;
            } else {
                score += 20;
            }
        }

        let moveMeta = {
            canAttack: false,
            nearestAttackPath: Infinity,
            nearestOpponentDistance: Infinity
        };
        if (opponents && opponents.length > 0) {
            const plans = Array.isArray(opponentPlans) && opponentPlans.length > 0
                ? opponentPlans
                : opponents.map(target => ({
                    target,
                    attackPositions: this.getAttackPositionsNearTarget(actor, target)
                })).filter(plan => plan.attackPositions.length > 0);
            let minDist = Infinity;
            let canAttack = false;
            const attackRange = Math.max(1, Number(actor.attackRange) || 1);
            plans.forEach((plan) => {
                if (this.isPositionTargetable(cell, plan.target.position, attackRange)) {
                    canAttack = true;
                    minDist = Math.min(minDist, 0);
                    return;
                }
                minDist = Math.min(minDist, this.getNearestPathDistanceToCells(cell, plan.attackPositions, actor));
            });
            if (minDist === Infinity) {
                minDist = Math.min(...opponents.map(target => this.distanceBetween(cell, target.position)));
            }
            moveMeta = {
                canAttack,
                nearestAttackPath: minDist,
                nearestOpponentDistance: Math.min(...opponents.map(target => this.distanceBetween(cell, target.position)))
            };
            if (canAttack) {
                score += isEnemy ? 34 : 16;
                if (tile?.type === 'swamp' && !terrainState?.swampAttackPrimed) {
                    score += 6;
                }
            }
            if (!isEnemy && hpRatio < 0.4 && hasHealTile) {
                score += minDist * 1.4;
            } else {
                score -= minDist * (isEnemy ? 1.8 : 1.1);
            }
            if (isEnemy) {
                const context = aggressiveContext || this.getAggressiveAdvanceContext(actor, opponents, plans, hpRatio);
                const currentAttackPath = Number(context?.nearestAttackPath);
                const currentOpponentDistance = Number(context?.nearestOpponentDistance);
                if (Number.isFinite(currentAttackPath) && Number.isFinite(minDist)) {
                    const attackProgress = currentAttackPath - minDist;
                    score += Math.max(0, attackProgress) * 12;
                }
                if (Number.isFinite(currentOpponentDistance) && Number.isFinite(moveMeta.nearestOpponentDistance)) {
                    const distanceProgress = currentOpponentDistance - moveMeta.nearestOpponentDistance;
                    score += Math.max(0, distanceProgress) * 8;
                }
                if (Number(context?.engagedAllyCount) > 0 && moveMeta.nearestOpponentDistance <= Math.max(2, attackRange + 1)) {
                    score += 12 + Number(context.engagedAllyCount) * 4;
                }
                if (tile?.type === 'miasma') {
                    if (canAttack) {
                        score += 18;
                    } else if (moveMeta.nearestAttackPath <= 1) {
                        score += 10;
                    }
                }
            }
        }
        return {
            score,
            meta: moveMeta
        };
    }

    chooseTarget(actor) {
        const targets = this.getAttackableTargets(actor);
        if (targets.length === 0) {
            return null;
        }
        return [...targets].sort((a, b) => {
            const killA = a.hp <= Math.max(1, actor.getEffectiveAttack?.() || actor._attack || 1) ? 0 : 1;
            const killB = b.hp <= Math.max(1, actor.getEffectiveAttack?.() || actor._attack || 1) ? 0 : 1;
            if (killA !== killB) {
                return killA - killB;
            }
            if (actor.camp === 'enemy') {
                const supportA = (a.profession === 'psionic') ? 0 : 1;
                const supportB = (b.profession === 'psionic') ? 0 : 1;
                if (supportA !== supportB) {
                    return supportA - supportB;
                }
            }
            const badA = this.isUnitOnNegativeTile(a) ? 0 : 1;
            const badB = this.isUnitOnNegativeTile(b) ? 0 : 1;
            if (badA !== badB) {
                return badA - badB;
            }
            if (a.hp !== b.hp) {
                return a.hp - b.hp;
            }
            return actor.distanceTo(a) - actor.distanceTo(b);
        })[0];
    }

    isUnitOnNegativeTile(unit) {
        const tile = this.getSpecialTileAt(unit?.position);
        if (!tile) {
            return false;
        }
        if (tile.type === 'heal') {
            return this.isHealTileBacklashPosition(unit, unit?.position);
        }
        return tile.type === 'fire' || tile.type === 'swamp' || tile.type === 'miasma';
    }

    chooseSkillAction(actor) {
        const usable = this.getUsableSkills(actor).filter(skill => skill.canUse);
        if (usable.length === 0) {
            return null;
        }
        let best = null;
        for (const skill of usable) {
            if (actor.camp === 'enemy' && this.isWarningSkill(skill)) {
                continue;
            }
            const candidates = this.getSkillTargetCandidates(actor, skill.index);
            if (candidates.length === 0) {
                continue;
            }
            for (const target of candidates) {
                const score = this.scoreSkillAction(actor, skill, target);
                if (best === null || score > best.score) {
                    best = { skill, target, score };
                }
            }
        }
        if (!best || best.score <= 0) {
            return null;
        }
        return {
            type: 'skill',
            targetId: best.target.id,
            skillIndex: best.skill.index
        };
    }

    scoreSkillAction(actor, skill, target) {
        let score = (Number(skill.multiplier) || 1) * 10;
        const customEffect = skill.customEffect || null;
        const isSelfTarget = target?.id === actor?.id;

        if (customEffect?.type === 'desperate_blade_flash' && isSelfTarget) {
            const bladeFlashContext = this.getPoYuBladeFlashContext(actor, skill.index);
            const targets = this.getPoYuBladeFlashTargets(actor, skill.index);
            if (!bladeFlashContext || targets.length === 0) {
                return -1;
            }
            score += targets.length * 36;
            if (bladeFlashContext.desperateCast) {
                score += 24;
            }
            const focusScore = targets.reduce((total, entry) => {
                const hpRatio = entry.maxHp > 0 ? entry.hp / entry.maxHp : 1;
                return total + (1 - hpRatio) * 18;
            }, 0);
            return score + focusScore;
        }

        if (skill.effectType === 'heal' && isSelfTarget) {
            const hpRatio = actor.maxHp > 0 ? actor.hp / actor.maxHp : 1;
            if (hpRatio > 0.85) {
                return -1;
            }
            score += (1 - hpRatio) * 80;
            return score;
        }

        if (skill.effectType === 'heal' && target && !isSelfTarget) {
            const targetHpRatio = target.maxHp > 0 ? target.hp / target.maxHp : 1;
            if (targetHpRatio > 0.85) {
                return -1;
            }
            score += (1 - targetHpRatio) * 70;
            return score;
        }

        if (skill.targetType === 'self' && skill.effectType === 'utility') {
            score += 12;
            return score;
        }

        if (target && !isSelfTarget) {
            if (target.maxHp > 0) {
                const targetHpRatio = target.hp / target.maxHp;
                score += (1 - targetHpRatio) * 28;
            }
            if (this.isUnitOnNegativeTile(target)) {
                score += 12;
            }
        }

        if (customEffect?.type === 'lifesteal' && target && !isSelfTarget) {
            const selfHpRatio = actor.maxHp > 0 ? actor.hp / actor.maxHp : 1;
            score += (1 - selfHpRatio) * 35;
        }

        if (customEffect?.type === 'displace' && target && !isSelfTarget) {
            const result = this.computeDisplaceEffect(actor, target, customEffect);
            if (result.moved <= 0) {
                score -= 28;
            } else {
                const landing = this.getSpecialTileAt(result.toPosition);
                if (landing?.type === 'fire') {
                    score += 90;
                } else if (landing?.type === 'swamp') {
                    score += 45;
                } else if (landing?.type === 'miasma') {
                    score += 40;
                } else if (landing?.type === 'heal') {
                    score -= 40;
                }
                const atEdge = result.toPosition.x === 0
                    || result.toPosition.x === this.scene.width - 1
                    || result.toPosition.y === 0
                    || result.toPosition.y === this.scene.height - 1;
                if (result.mode === 'push' && atEdge) {
                    score += 8;
                }
            }
        }

        return score;
    }

    getUsableBattleItems(actor) {
        if (actor.camp !== 'hero') {
            return [];
        }
        const itemMap = new Map();
        itemManager.getAllItems().forEach(item => {
            if (!['heal', 'revive', 'battle_status', 'max_hp'].includes(item.effect?.type)) {
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
            if (item.effect?.target === 'self' && !actor?.isAlive?.()) {
                return false;
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
        const charmedAction = this.getCharmedAction(actor);
        if (charmedAction) {
            return charmedAction;
        }

        const tauntedAction = this.getTauntedAction(actor);
        if (tauntedAction) {
            return tauntedAction;
        }

        if (actor.camp === 'enemy') {
            const warningAction = this.chooseEnemyWarningSkillAction(actor);
            if (warningAction) {
                return warningAction;
            }
        }

        const healItems = this.getUsableBattleItems(actor).filter(item => item.effect?.type === 'heal');
        if (actor.camp === 'hero' && actor.hp / actor.maxHp <= 0.4 && healItems.length > 0) {
            return { type: 'item', itemId: healItems[0].id, targetId: actor.id };
        }

        const urgentTerrainEscapeMove = this.chooseUrgentTerrainEscapeMove(actor);
        if (urgentTerrainEscapeMove) {
            return { type: 'move', position: urgentTerrainEscapeMove };
        }

        const skillAction = this.chooseSkillAction(actor);
        if (skillAction) {
            return skillAction;
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

    isAutoBattleAllowed() {
        // 卓越特权解锁后才可使用自动战斗
        return Boolean(window.checkinManager?.isMonthCardActive?.('welfare_month_card'));
    }

    isAutoBattleEnabled() {
        // 运行时硬闸：未解锁卓越特权一律视为关闭，但不修改用户已存的偏好
        if (!this.isAutoBattleAllowed()) {
            return false;
        }
        if (typeof this.autoBattleOverride === 'boolean') {
            return this.autoBattleOverride;
        }
        return Boolean(window.game.settings.autoBattle);
    }

    setAutoBattleOverride(enabled = null) {
        // 无权限时禁止开启 override；显式关闭仍允许
        if (enabled === true && !this.isAutoBattleAllowed()) {
            this.autoBattleOverride = null;
            return false;
        }
        this.autoBattleOverride = typeof enabled === 'boolean' ? enabled : null;
        return true;
    }

    async waitForActionPresentation() {
        this.flushStateChange();
        const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
        const startedAt = now();
        if (window.battleView && typeof window.battleView.waitForActionQueueIdle === 'function') {
            await window.battleView.waitForActionQueueIdle();
        }
        const elapsed = now() - startedAt;
        const minDelay = 180;
        if (this.isBattling && elapsed < minDelay) {
            await (typeof Utils !== 'undefined' && Utils.delay
                ? Utils.delay(minDelay - elapsed)
                : new Promise(resolve => setTimeout(resolve, minDelay - elapsed)));
        }
        if (window.battleView && typeof window.battleView.waitForBattleOverlayRelease === 'function') {
            await window.battleView.waitForBattleOverlayRelease();
        }
    }

    async resolveActionForActor(actor) {
        const charmedAction = this.getCharmedAction(actor);
        if (charmedAction) {
            return charmedAction;
        }

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

    getStatusPassiveAdjustmentText(effect = {}) {
        const passiveName = String(effect?.reducedByPassiveName || '').trim();
        if (!passiveName) {
            return '';
        }
        if (effect?.convertedFromType) {
            return `，${passiveName}降级`;
        }
        const reducedTurns = Math.max(0, Number(effect?.durationReducedByPassive) || 0);
        if (reducedTurns > 0) {
            return `，${passiveName}-${reducedTurns}回合`;
        }
        return '';
    }

    formatStatusDescription(effect = {}) {
        const name = effect.name || '状态';
        const duration = Math.max(1, Number(effect.remainingTurns ?? effect.durationTurns) || 1);
        const passiveAdjustmentText = this.getStatusPassiveAdjustmentText(effect);
        switch (effect.type) {
            case 'slow':
                return `${name}${Math.round(Math.abs((Number(effect.value) || 0) * 100))}%（持续${duration}回合${passiveAdjustmentText}）`;
            case 'stun':
                return `${name}（持续${duration}回合${passiveAdjustmentText}）`;
            case 'charm':
                return effect.sourceName
                    ? `${name}（来源：${effect.sourceName}，持续${duration}回合${passiveAdjustmentText}）`
                    : `${name}（持续${duration}回合${passiveAdjustmentText}）`;
            case 'silence':
                return `${name}（持续${duration}回合${passiveAdjustmentText}）`;
            case 'taunt':
                return effect.sourceName
                    ? `${name}（来源：${effect.sourceName}，持续${duration}回合${passiveAdjustmentText}）`
                    : `${name}（持续${duration}回合${passiveAdjustmentText}）`;
            case 'haze_mark': {
                const bonus = Math.round((Number(effect.damageTakenDebuffBonus) || 0) * 100);
                return bonus > 0
                    ? `${name}（易伤${bonus}%，持续${duration}回合${passiveAdjustmentText}）`
                    : `${name}（持续${duration}回合${passiveAdjustmentText}）`;
            }
            case 'crack': {
                const bonus = Math.round((Number(effect.damageTakenDebuffBonus) || 0) * 100);
                return bonus > 0
                    ? `${name}（受伤提高${bonus}%，持续${duration}回合${passiveAdjustmentText}）`
                    : `${name}（持续${duration}回合${passiveAdjustmentText}）`;
            }
            case 'break_formation': {
                const pen = Math.round((Number(effect.alliedDefensePenBonus) || 0));
                return pen > 0
                    ? `${name}（友军无视防御${pen}%，持续${duration}回合${passiveAdjustmentText}）`
                    : `${name}（持续${duration}回合${passiveAdjustmentText}）`;
            }
            case 'break_wound': {
                const bonus = Math.round((Number(effect.damageTakenDebuffBonus) || 0) * 100);
                return bonus > 0
                    ? `${name}（受伤提高${bonus}%，持续${duration}回合${passiveAdjustmentText}）`
                    : `${name}（持续${duration}回合${passiveAdjustmentText}）`;
            }
            case 'black_wall': {
                const defenseBonus = Math.round((Number(effect.value) || 0) * 100);
                const reduction = Math.round((Number(effect.damageReduction) || 0) * 1000) / 10;
                const reductionText = reduction > 0 ? `，减伤${reduction}%` : '';
                return `${name}（防御+${defenseBonus}%${reductionText}，持续${duration}回合${passiveAdjustmentText}）`;
            }
            case 'battle_guard': {
                const reduction = Math.round((Number(effect.damageReduction) || 0) * 100);
                return reduction > 0
                    ? `${name}（减伤${reduction}%，持续${duration}回合${passiveAdjustmentText}）`
                    : `${name}（持续${duration}回合${passiveAdjustmentText}）`;
            }
            case 'warning_guard': {
                const reduction = Math.round((Number(effect.damageReduction) || 0) * 100);
                const details = [];
                if (reduction > 0) {
                    details.push(`减伤${reduction}%`);
                }
                if (effect.immuneStun) {
                    details.push('免疫眩晕');
                }
                if (effect.immuneDisplace) {
                    details.push('免疫击退/拉拽');
                }
                return details.length > 0
                    ? `${name}（${details.join('，')}，持续${duration}回合${passiveAdjustmentText}）`
                    : `${name}（持续${duration}回合${passiveAdjustmentText}）`;
            }
            case 'focused_aim': {
                const bonus = Math.round((Number(effect.damageBonus) || 0) * 100);
                const crit = Math.round((Number(effect.extraCritChance) || 0));
                const details = [];
                if (bonus > 0) {
                    details.push(`普攻增伤${bonus}%`);
                }
                if (crit > 0) {
                    details.push(`暴击率+${crit}%`);
                }
                return details.length > 0
                    ? `${name}（${details.join('，')}，持续${duration}回合${passiveAdjustmentText}）`
                    : `${name}（持续${duration}回合${passiveAdjustmentText}）`;
            }
            case 'break_armor': {
                const bonus = Math.round((Number(effect.damageTakenDebuffBonus) || 0) * 100);
                return bonus > 0
                    ? `${name}（受伤提高${bonus}%，持续${duration}回合${passiveAdjustmentText}）`
                    : `${name}（持续${duration}回合${passiveAdjustmentText}）`;
            }
            case 'bleed':
                return `${name}（持续${duration}回合${passiveAdjustmentText}）`;
            case 'burn':
                return `${name}（持续${duration}回合，可叠加${passiveAdjustmentText}）`;
            default:
                if ((effect.modifierType === 'percent' || effect.modifierType === 'flat') && Number.isFinite(Number(effect.value))) {
                    const statNameMap = {
                        attack: '攻击力',
                        defense: '防御力',
                        speed: '速度'
                    };
                    const statName = statNameMap[effect.stat] || '属性';
                    const value = effect.modifierType === 'flat'
                        ? Math.abs(Number(effect.value) || 0)
                        : Math.round(Math.abs(Number(effect.value) || 0) * 100);
                    const suffix = effect.modifierType === 'flat' ? '' : '%';
                    const sign = (Number(effect.value) || 0) >= 0 ? '+' : '-';
                    return `${name}（${statName}${sign}${value}${suffix}，持续${duration}回合${passiveAdjustmentText}）`;
                }
                return `${name}（持续${duration}回合${passiveAdjustmentText}）`;
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

    shouldApplyBlockedStatusesForDisplace(customEffect = {}, displaceResult = null) {
        if (!displaceResult?.blocked || (Number(displaceResult?.moved) || 0) > 0) {
            return false;
        }
        if (displaceResult.blockReason === 'immune_displace') {
            return false;
        }
        const allowedReasons = Array.isArray(customEffect?.blockedStatusReasons)
            ? customEffect.blockedStatusReasons.filter(Boolean)
            : [];
        if (allowedReasons.length === 0) {
            return true;
        }
        return allowedReasons.includes(displaceResult.blockReason);
    }

    applyControlMarkPassive(actor, targetUnit, context = {}) {
        if (!actor?.isAlive?.() || !actor.isAlive() || !targetUnit?.isAlive?.() || !targetUnit.isAlive()) {
            return [];
        }
        const passiveEffect = actor.getPassiveEffects?.().find(effect =>
            effect?.type === 'control_mark' && effect?.markStatusEffect
        );
        if (!passiveEffect) {
            return [];
        }
        const displaceMoved = Math.max(0, Number(context?.displaceMoved) || 0);
        const appliedEffects = Array.isArray(context?.appliedEffects) ? context.appliedEffects : [];
        const causedStun = appliedEffects.some(effect => effect?.type === 'stun');
        if (displaceMoved <= 0 && !causedStun) {
            return [];
        }
        return targetUnit.applyStatusEffects([passiveEffect.markStatusEffect], actor);
    }

    commitForcedMoveEffect(unit, toPosition, options = {}) {
        if (!unit?.isAlive?.() || !unit.isAlive() || !toPosition || !this.isInsideBoard(toPosition)) {
            return false;
        }
        if (unit.position.x === toPosition.x && unit.position.y === toPosition.y) {
            return false;
        }
        if (this.isObstacleAt(toPosition) || this.getUnitAt(toPosition, unit.id)) {
            return false;
        }
        const fromPosition = { x: unit.position.x, y: unit.position.y };
        this.deactivateFormationByMovement(unit);
        unit.setPosition(toPosition);
        this.handleTerrainPositionChange(unit, fromPosition, toPosition);
        eventManager.emit('battleUnitMove', {
            unit,
            fromPosition,
            position: toPosition,
            toPosition,
            reason: options.reason || 'forced_move',
            mode: options.mode || 'advance',
            causedBy: options.causedBy || null
        });
        return true;
    }

    applyMissingHpRegenEffect(actor, targetUnit, customEffect = {}) {
        const ratio = Math.max(0, Number(customEffect?.healMissingHpRatio) || 0);
        const durationTurns = Math.max(1, Number(customEffect?.durationTurns) || 1);
        if (ratio <= 0 || durationTurns <= 0) {
            return { type: 'apply_missing_hp_regen', appliedEffects: [] };
        }

        const targets = [];
        if (customEffect.includeTarget !== false && targetUnit?.isAlive?.()) {
            targets.push(targetUnit);
        }
        if (customEffect.includeCaster === true && actor?.isAlive?.() && !targets.some(unit => unit.id === actor.id)) {
            targets.push(actor);
        }

        const statusEffect = {
            type: customEffect.statusType || 'missing_hp_regen',
            name: customEffect.name || '持续恢复',
            effectType: 'heal_over_time',
            tickTiming: customEffect.tickTiming || 'turnStart',
            durationTurns,
            remainingTurns: durationTurns,
            healMissingHpRatio: ratio,
            stackMode: customEffect.stackMode || 'replace',
            countsAsDebuff: false
        };

        const appliedEffects = [];
        targets.forEach(unit => {
            const applied = unit.applyStatusEffects([{
                ...statusEffect,
                skipNextTurnEndDecay: Boolean(unit.id === actor?.id)
            }], actor);
            applied.forEach(effect => {
                appliedEffects.push({ target: unit, effect });
            });
        });

        return {
            type: 'apply_missing_hp_regen',
            appliedEffects
        };
    }

    applyBasicAttackEffects(actor, targetUnit, attackResult = {}) {
        if (!attackResult?.hit) {
            return [];
        }

        const attackEffects = actor.getBasicAttackEffects?.('hit') || [];
        const appliedEffects = [];
        attackResult.basicAttackTriggers = [];
        attackEffects.forEach((effect) => {
            if (effect?.damageBonusType === 'focused_stationary') {
                return;
            }
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
            const customEffect = effect?.customEffect;
            if (customEffect?.type === 'displace') {
                if (!targetUnit?.isAlive?.() || !targetUnit.isAlive()) {
                    return;
                }
                const displaceResult = this.computeDisplaceEffect(actor, targetUnit, customEffect);
                const customAppliedEffects = [];
                attackResult.basicAttackTriggers.push({
                    type: 'displace',
                    mode: displaceResult.mode,
                    moved: displaceResult.moved,
                    blocked: displaceResult.blocked,
                    blockReason: displaceResult.blockReason || null
                });
                if (displaceResult.moved > 0) {
                    this.commitDisplaceEffect(targetUnit, displaceResult, actor);
                } else if (this.shouldApplyBlockedStatusesForDisplace(customEffect, displaceResult)) {
                    const blockedStatusEffects = Array.isArray(customEffect?.blockedStatusEffects)
                        ? customEffect.blockedStatusEffects
                        : [];
                    if (blockedStatusEffects.length > 0) {
                        customAppliedEffects.push(...targetUnit.applyStatusEffects(blockedStatusEffects, actor));
                    }
                }
                if (customAppliedEffects.length > 0) {
                    appliedEffects.push(...customAppliedEffects);
                }
                const markEffects = this.applyControlMarkPassive(actor, targetUnit, {
                    displaceMoved: displaceResult.moved,
                    appliedEffects: customAppliedEffects
                });
                if (markEffects.length > 0) {
                    appliedEffects.push(...markEffects);
                }
            }
            const statuses = Array.isArray(effect?.statusEffects) ? effect.statusEffects : [];
            if (!statuses.length) {
                return;
            }
            const selectedStatuses = effect.statusSelection === 'random_one'
                ? [statuses[Math.floor(Math.random() * statuses.length)]].filter(Boolean)
                : statuses;
            const statusTargets = effect.extraTargets === 'attack_range'
                ? this.getAttackableTargets(actor)
                : [targetUnit];
            statusTargets.forEach((statusTarget) => {
                if (!statusTarget?.isAlive?.() || !statusTarget.isAlive()) {
                    return;
                }
                appliedEffects.push(...statusTarget.applyStatusEffects(selectedStatuses, actor));
            });
        });
        return appliedEffects;
    }

    isWarningSkill(skill = {}) {
        return skill?.customEffect?.type === 'warning_area_damage'
            || skill?.effectType === 'warning_area_damage'
            || skill?.warningArea;
    }

    chooseEnemyWarningSkillAction(actor) {
        const skills = this.getUsableSkills(actor).filter(skill => skill.canUse && this.isWarningSkill(skill));
        for (const skill of skills) {
            const target = this.chooseTargetForWarningSkill(actor, skill.index);
            if (target) {
                return { type: 'skill', targetId: target.id, skillIndex: skill.index };
            }
        }
        return null;
    }

    chooseTargetForWarningSkill(actor, skillIndex = 0) {
        const targets = this.getSkillTargetCandidates(actor, skillIndex);
        if (!targets.length) {
            return null;
        }
        return [...targets].sort((a, b) => a.hp - b.hp || actor.distanceTo(a) - actor.distanceTo(b))[0] || null;
    }

    buildWarningChargeGuardEffect(delayTurns = 2) {
        const turns = Math.max(1, Number(delayTurns) || 1);
        return {
            type: 'warning_guard',
            name: '蓄力护体',
            durationTurns: turns,
            remainingTurns: turns,
            damageReduction: 0.35,
            countsAsDebuff: false,
            skipNextTurnEndDecay: true,
            immuneDisplace: true,
            immuneStun: true
        };
    }

    applyWarningChargeGuard(actor, delayTurns = 2) {
        if (!actor?.isAlive?.() || !actor.isAlive()) {
            return [];
        }
        return actor.applyStatusEffects([this.buildWarningChargeGuardEffect(delayTurns)], actor);
    }

    clearWarningChargeGuard(actor) {
        if (!actor?.removeStatusEffectsByType) {
            return [];
        }
        return actor.removeStatusEffectsByType('warning_guard');
    }

    createWarningSkill(actor, targetUnit, skillIndex = 0, skill = actor?.getSkill?.(skillIndex) || {}) {
        const customEffect = skill?.customEffect || {};
        const shape = customEffect.shape || skill?.warningShape || 'around_self';
        const delayTurns = Math.max(1, Number(customEffect.delayTurns ?? skill?.chargeTurns ?? 2) || 2);
        const cells = this.getWarningSkillCells(actor, targetUnit, { ...customEffect, shape });
        if (!cells.length) {
            return null;
        }
        const warning = {
            id: Utils.generateId(),
            sourceUnitId: actor.id,
            sourceName: actor.name,
            skillName: skill?.name || '蓄力技能',
            skillIndex,
            remainingTurns: delayTurns,
            delayTurns,
            shape,
            multiplier: Number(customEffect.multiplier ?? skill?.multiplier ?? 1.15) || 1.15,
            fixedDamage: Math.max(0, Number(customEffect.fixedDamage ?? skill?.fixedDamage ?? 0) || 0),
            randomDamageRatio: Math.max(0, Number(customEffect.randomDamageRatio ?? 0) || 0),
            canCrit: customEffect.canCrit === true,
            statusEffects: Array.isArray(customEffect.statusEffects) && customEffect.statusEffects.length > 0
                ? customEffect.statusEffects.map(effect => ({ ...effect }))
                : (Array.isArray(skill?.statusEffects) ? skill.statusEffects.map(effect => ({ ...effect })) : []),
            cells
        };
        this.specialTileWarnings.push(warning);
        actor.consumeSkillCost(skillIndex);
        const guardEffects = customEffect.grantChargeGuard === false
            ? []
            : this.applyWarningChargeGuard(actor, delayTurns);
        this.addLog(
            'control',
            `${actor.name} 开始蓄力 ${warning.skillName}，${delayTurns}次行动后爆发${guardEffects.length > 0 ? '，并进入蓄力护体' : ''}`
        );
        this.emitStateChange();
        return warning;
    }

    getWarningSkillCells(actor, targetUnit, config = {}) {
        const shape = config.shape || 'around_self';
        const radius = Math.max(1, Number(config.radius ?? 1) || 1);
        if (shape === 'line_to_target') {
            return this.getLineWarningCells(actor.position, targetUnit?.position, Number(config.length) || this.scene.height);
        }
        if (shape === 'random_cells') {
            return this.getRandomWarningCells(Number(config.count) || 4, config);
        }
        if (shape === 'target_cross') {
            return this.getCrossWarningCells(targetUnit?.position || actor.position, radius);
        }
        return this.getAreaWarningCells(actor.position, radius, true);
    }

    getAreaWarningCells(center, radius, excludeCenter = false) {
        if (!center) {
            return [];
        }
        const cells = [];
        for (let y = center.y - radius; y <= center.y + radius; y++) {
            for (let x = center.x - radius; x <= center.x + radius; x++) {
                const position = { x, y };
                if (!this.isInsideBoard(position) || this.isObstacleAt(position)) {
                    continue;
                }
                if (excludeCenter && x === center.x && y === center.y) {
                    continue;
                }
                if (this.distanceBetween(center, position) <= radius) {
                    cells.push(position);
                }
            }
        }
        return cells;
    }

    getCrossWarningCells(center, radius = 1) {
        if (!center) {
            return [];
        }
        const cells = [];
        for (let offset = -radius; offset <= radius; offset++) {
            [{ x: center.x + offset, y: center.y }, { x: center.x, y: center.y + offset }]
                .forEach(position => {
                    const key = `${position.x},${position.y}`;
                    if (this.isInsideBoard(position) && !this.isObstacleAt(position) && !cells.some(cell => `${cell.x},${cell.y}` === key)) {
                        cells.push(position);
                    }
                });
        }
        return cells;
    }

    getLineWarningCells(start, target, maxLength = 8) {
        if (!start || !target) {
            return [];
        }
        const dx = Math.abs(target.x - start.x) >= Math.abs(target.y - start.y)
            ? Math.sign(target.x - start.x)
            : 0;
        const dy = dx === 0 ? Math.sign(target.y - start.y) : 0;
        const cells = [];
        for (let step = 1; step <= maxLength; step++) {
            const position = { x: start.x + dx * step, y: start.y + dy * step };
            if (!this.isInsideBoard(position) || this.isObstacleAt(position)) {
                break;
            }
            cells.push(position);
        }
        return cells;
    }

    getRandomWarningCells(count = 4, config = {}) {
        const targetCount = Math.max(1, Math.floor(Number(count) || 1));
        const candidates = [];
        for (let y = 0; y < this.scene.height; y++) {
            for (let x = 0; x < this.scene.width; x++) {
                const position = { x, y };
                if (!this.isObstacleAt(position)) {
                    candidates.push(position);
                }
            }
        }
        const cells = [];
        const selectedKeys = new Set();
        const pickRandomCells = (pool = []) => {
            while (pool.length && cells.length < targetCount) {
                const index = Math.floor(Math.random() * pool.length);
                const cell = pool.splice(index, 1)[0];
                const key = `${cell.x},${cell.y}`;
                if (selectedKeys.has(key)) {
                    continue;
                }
                selectedKeys.add(key);
                cells.push(cell);
            }
        };

        if (config?.preferHeroes === true) {
            const heroRadius = Math.max(0, Math.floor(Number(config.heroRadius ?? 1) || 1));
            const preferredCells = [];
            const preferredKeys = new Set();
            (this.heroes || [])
                .filter(hero => hero?.isAlive?.() && hero.isAlive())
                .forEach((hero) => {
                    for (let y = hero.position.y - heroRadius; y <= hero.position.y + heroRadius; y++) {
                        for (let x = hero.position.x - heroRadius; x <= hero.position.x + heroRadius; x++) {
                            const position = { x, y };
                            const key = `${x},${y}`;
                            if (!this.isInsideBoard(position) || this.isObstacleAt(position) || preferredKeys.has(key)) {
                                continue;
                            }
                            if (this.distanceBetween(hero.position, position) <= heroRadius) {
                                preferredKeys.add(key);
                                preferredCells.push(position);
                            }
                        }
                    }
                });
            pickRandomCells(preferredCells);
        }

        pickRandomCells(candidates.filter(cell => !selectedKeys.has(`${cell.x},${cell.y}`)));
        return cells;
    }

    getWarningAt(position) {
        if (!position) {
            return null;
        }
        return [...this.specialTileWarnings]
            .filter(warning => warning.cells.some(cell => cell.x === position.x && cell.y === position.y))
            .sort((a, b) => a.remainingTurns - b.remainingTurns)[0] || null;
    }

    processWarningSkillTurnStart(actor) {
        const events = [];
        this.specialTileWarnings.forEach((warning) => {
            if (warning.sourceUnitId !== actor.id) {
                return;
            }
            warning.remainingTurns = Math.max(0, Number(warning.remainingTurns) - 1);
            if (warning.remainingTurns > 0) {
                events.push({ type: 'warning_tick', warning });
                return;
            }
            events.push(...this.resolveWarningSkill(warning, actor));
        });
        this.specialTileWarnings = this.specialTileWarnings.filter(warning => warning.remainingTurns > 0);
        if (!this.specialTileWarnings.some(warning => warning.sourceUnitId === actor.id)) {
            this.clearWarningChargeGuard(actor);
        }
        return events;
    }

    resolveWarningSkill(warning, actor) {
        const cellSet = new Set((warning.cells || []).map(cell => `${cell.x},${cell.y}`));
        const events = [];
        const effectSource = actor || { id: warning.sourceUnitId, name: warning.sourceName };
        const targets = this.getAllUnits().filter(unit => unit.isAlive() && cellSet.has(`${unit.position.x},${unit.position.y}`));
        targets.forEach((target) => {
            const rawDamage = warning.fixedDamage > 0
                ? warning.fixedDamage
                : Math.floor((actor?.getEffectiveAttack?.() || actor?._attack || 1) * warning.multiplier * (warning.randomDamageRatio > 0 ? Utils.randomFloat(1 - warning.randomDamageRatio, 1 + warning.randomDamageRatio) : 1));
            const damage = target.takeDamage(Math.max(1, rawDamage), { defensePen: actor?.defensePen || 0, sourceUnitId: actor?.id });
            const appliedEffects = target.isAlive() && Array.isArray(warning.statusEffects) && warning.statusEffects.length > 0
                ? target.applyStatusEffects(warning.statusEffects, effectSource)
                : [];
            events.push({
                type: 'warning_damage',
                warning,
                target,
                damage,
                sourceUnitId: actor?.id || warning.sourceUnitId,
                sourceName: actor?.name || warning.sourceName,
                skillName: warning.skillName,
                appliedEffects
            });
        });
        if (!targets.length) {
            events.push({ type: 'warning_empty', warning });
        }
        return events;
    }

    computeDisplaceEffect(actor, targetUnit, customEffect) {
        const distance = Math.max(0, Math.floor(Number(customEffect?.distance) || 0));
        const mode = customEffect?.mode === 'pull' ? 'pull' : 'push';
        if (!actor || !targetUnit || distance <= 0) {
            return { type: 'displace', mode, moved: 0, distance, blocked: false };
        }
        if (targetUnit.isEscortCart) {
            const currentPosition = { x: targetUnit.position.x, y: targetUnit.position.y };
            return {
                type: 'displace',
                mode,
                moved: 0,
                distance,
                blocked: true,
                blockReason: 'escort_cart_immune',
                fromPosition: currentPosition,
                toPosition: currentPosition
            };
        }
        if (targetUnit.getStatusEffects?.().some(effect => effect.immuneDisplace === true || effect.type === 'warning_guard')) {
            const currentPosition = { x: targetUnit.position.x, y: targetUnit.position.y };
            return {
                type: 'displace',
                mode,
                moved: 0,
                distance,
                blocked: true,
                blockReason: 'immune_displace',
                fromPosition: currentPosition,
                toPosition: currentPosition
            };
        }
        const dx = targetUnit.position.x - actor.position.x;
        const dy = targetUnit.position.y - actor.position.y;
        let stepX = 0;
        let stepY = 0;
        if (Math.abs(dx) >= Math.abs(dy)) {
            stepX = Math.sign(dx);
        } else {
            stepY = Math.sign(dy);
        }
        if (mode === 'pull') {
            stepX = -stepX;
            stepY = -stepY;
        }
        if (stepX === 0 && stepY === 0) {
            return { type: 'displace', mode, moved: 0, distance, blocked: true };
        }
        const fromPosition = { x: targetUnit.position.x, y: targetUnit.position.y };
        let current = { x: fromPosition.x, y: fromPosition.y };
        let moved = 0;
        let blocked = false;
        let blockReason = null;
        for (let i = 0; i < distance; i++) {
            const next = { x: current.x + stepX, y: current.y + stepY };
            if (!this.isInsideBoard(next)) {
                blocked = true;
                blockReason = 'edge';
                break;
            }
            if (this.isObstacleAt(next)) {
                blocked = true;
                blockReason = 'obstacle';
                break;
            }
            if (this.getUnitAt(next, targetUnit.id)) {
                blocked = true;
                blockReason = 'unit';
                break;
            }
            current = next;
            moved += 1;
        }
        return {
            type: 'displace',
            mode,
            moved,
            distance,
            blocked,
            blockReason,
            fromPosition,
            toPosition: current
        };
    }

    commitDisplaceEffect(targetUnit, displaceResult, actor = null) {
        if (!displaceResult || displaceResult.type !== 'displace' || displaceResult.moved <= 0 || !targetUnit?.isAlive()) {
            return false;
        }
        const { fromPosition, toPosition, mode } = displaceResult;
        targetUnit.setPosition(toPosition);
        this.handleTerrainPositionChange(targetUnit, fromPosition, toPosition);
        eventManager.emit('battleUnitMove', {
            unit: targetUnit,
            fromPosition,
            position: toPosition,
            toPosition,
            reason: 'displace',
            mode,
            causedBy: actor?.id || null
        });
        return true;
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

        if (customEffect.type === 'apply_missing_hp_regen') {
            return this.applyMissingHpRegenEffect(actor, targetUnit, customEffect);
        }

        if (customEffect.type === 'displace') {
            const result = this.computeDisplaceEffect(actor, targetUnit, customEffect);
            const blockedStatusEffects = Array.isArray(customEffect?.blockedStatusEffects)
                ? customEffect.blockedStatusEffects
                : [];
            result.appliedEffects = [];
            if (result.moved <= 0 && blockedStatusEffects.length > 0 && this.shouldApplyBlockedStatusesForDisplace(customEffect, result)) {
                result.appliedEffects = targetUnit.applyStatusEffects(blockedStatusEffects, actor);
            }
            if (result.moved > 0 && customEffect.followToSourcePositionOnSuccess === true) {
                result.followPosition = { ...result.fromPosition };
            }
            return result;
        }

        if (customEffect.type === 'apply_status_if_target_has_status') {
            const requiredStatusType = String(customEffect.requiredStatusType || '').trim();
            const statusEffects = Array.isArray(customEffect.statusEffects) ? customEffect.statusEffects : [];
            if (!requiredStatusType || statusEffects.length === 0 || !targetUnit.hasStatus?.(requiredStatusType)) {
                return {
                    type: 'apply_status_if_target_has_status',
                    requiredStatusType,
                    appliedEffects: []
                };
            }
            return {
                type: 'apply_status_if_target_has_status',
                requiredStatusType,
                appliedEffects: targetUnit.applyStatusEffects(statusEffects, actor)
            };
        }

        if (customEffect.type === 'lifesteal') {
            const ratio = Math.max(0, Math.min(1, Number(customEffect.ratio) || 0));
            const damageDealt = Math.max(0, Number(attackResult?.damage) || 0);
            const healAmount = Math.max(0, Math.floor(damageDealt * ratio));
            const actualHeal = healAmount > 0 && actor?.isAlive?.() ? actor.heal(healAmount) : 0;
            return {
                type: 'lifesteal',
                ratio,
                damage: damageDealt,
                heal: actualHeal
            };
        }

        if (customEffect.type !== 'consume_status_damage') {
            return null;
        }

        return this.resolveConsumeStatusDamage(actor, targetUnit, customEffect, attackResult);
    }

    resolveConsumeStatusDamage(actor, targetUnit, customEffect = {}, attackResult = {}) {
        const statusType = customEffect.statusType || 'burn';
        const consumedStacks = targetUnit.countStatusStacks?.(statusType) || 0;
        const extraMultiplier = Math.max(0, Number(customEffect.extraMultiplier ?? customEffect.damageMultiplierPerStack) || 0);
        let extraDamage = 0;

        if (consumedStacks > 0 && extraMultiplier > 0) {
            const sourceAttack = customEffect.sourceAttackMultiplier === true
                ? (actor.getEffectiveAttack?.() || actor._attack || 1)
                : (actor._attack || actor.getEffectiveAttack?.() || 1);
            const rawDamage = Math.floor(sourceAttack * actor.attackCoefficient * consumedStacks * extraMultiplier);
            extraDamage = targetUnit.takeStatusDamage(rawDamage, customEffect.ignoreDefense !== false);
            attackResult.damage += extraDamage;
        }

        if (consumedStacks > 0 && customEffect.consumeStatus !== false) {
            targetUnit.removeStatusEffectsByType?.(statusType);
        }

        return {
            type: 'consume_status_damage',
            statusType,
            consumedStacks,
            extraDamage
        };
    }

    getStatusEffectTemplate(actor, statusType) {
        const fromBasic = (actor.getBasicAttackEffects?.('hit') || [])
            .flatMap(effect => Array.isArray(effect?.statusEffects) ? effect.statusEffects : [])
            .find(effect => effect?.type === statusType);
        if (fromBasic) {
            return fromBasic;
        }
        const fromSkills = (actor.skills || [])
            .flatMap(skill => Array.isArray(skill?.statusEffects) ? skill.statusEffects : [])
            .find(effect => effect?.type === statusType);
        return fromSkills || null;
    }

    buildStatusStackEffects(actor, statusType, count) {
        const template = this.getStatusEffectTemplate(actor, statusType);
        const stackCount = Math.max(0, Math.floor(Number(count) || 0));
        if (!template || stackCount <= 0) {
            return [];
        }
        return Array.from({ length: stackCount }, () => ({ ...template }));
    }

    triggerDoubleConsumeStatusDamage(actor, skill, customEffect = {}) {
        if (!customEffect.doubleTrigger || actor.passiveState?.consumeStatusDoubleTriggered?.[skill?.name || customEffect.statusType]) {
            return null;
        }

        actor.passiveState = actor.passiveState || {};
        actor.passiveState.consumeStatusDoubleTriggered = actor.passiveState.consumeStatusDoubleTriggered || {};
        actor.passiveState.consumeStatusDoubleTriggered[skill?.name || customEffect.statusType] = true;

        const statusType = customEffect.statusType || 'burn';
        const targets = this.getOpponents(actor).filter(unit => unit?.isAlive?.() && unit.isAlive());
        const addedStatuses = this.buildStatusStackEffects(actor, statusType, customEffect.preAddStacksToAll);
        const appliedEffects = [];
        if (addedStatuses.length > 0) {
            targets.forEach((targetUnit) => {
                appliedEffects.push(...targetUnit.applyStatusEffects(addedStatuses, actor));
            });
        }

        const results = targets
            .filter(targetUnit => targetUnit?.isAlive?.() && targetUnit.isAlive())
            .map((targetUnit) => {
                const result = {
                    hit: true,
                    damage: 0,
                    useSkill: true,
                    skillName: skill?.name || null,
                    protocolFinale: true
                };
                result.customEffectResult = this.resolveConsumeStatusDamage(actor, targetUnit, customEffect, result);
                return { target: targetUnit, result };
            })
            .filter(entry => Number(entry.result?.customEffectResult?.consumedStacks) > 0 || Number(entry.result?.damage) > 0);

        return { targets: results, appliedCount: appliedEffects.length };
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
            if (event.type === 'passive_heal' && event.heal > 0) {
                this.addLog('heal', `${actor.name} 触发${event.effectName || '被动'}，恢复 ${event.heal} 点生命`);
                eventManager.emit('battleUnitAction', {
                    attacker: actor,
                    target: actor,
                    damage: 0,
                    actionType: 'status',
                    result: {
                        hit: true,
                        heal: event.heal,
                        statusName: event.effectName || '被动恢复'
                    }
                });
                return;
            }

            if (event.type === 'passive_self_damage' && event.damage > 0) {
                this.addLog('damage', `${actor.name} 受到${event.effectName || '被动'}影响，损失 ${event.damage} 点生命`);
                eventManager.emit('battleUnitAction', {
                    attacker: actor,
                    target: actor,
                    damage: event.damage,
                    actionType: 'status',
                    result: {
                        hit: true,
                        damage: event.damage,
                        statusName: event.effectName || '被动损伤'
                    }
                });
                if (!actor.isAlive()) {
                    this.processDefeatedUnit(actor, { reason: 'passive_self_damage' });
                }
                return;
            }

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

            if (event.type === 'special_tile_damage' && event.damage > 0) {
                const momentumText = event.fireMomentumStacks > 0
                    ? `，积蓄至${event.fireMomentumStacks}层燃势`
                    : '';
                this.addLog('damage', `${actor.name} 受到${event.tileName || '地格'}影响，损失 ${event.damage} 点生命${momentumText}`);
                eventManager.emit('battleUnitAction', {
                    attacker: actor,
                    target: actor,
                    damage: event.damage,
                    ignoreBattleStats: true,
                    actionType: 'status',
                    result: {
                        hit: true,
                        damage: event.damage,
                        statusType: event.effectType || event.type || 'terrain_state',
                        statusName: event.tileName || '地格伤害'
                    }
                });
                if (!actor.isAlive()) {
                    this.processDefeatedUnit(actor, { reason: 'special_tile' });
                }
                return;
            }

            if (event.type === 'special_tile_heal' && event.heal > 0) {
                this.addLog('heal', `${actor.name} 受到${event.tileName || '地格'}影响，恢复 ${event.heal} 点生命`);
                eventManager.emit('battleUnitAction', {
                    attacker: actor,
                    target: actor,
                    damage: 0,
                    ignoreBattleStats: true,
                    actionType: 'status',
                    result: {
                        hit: true,
                        heal: event.heal,
                        statusType: event.effectType || event.type || 'terrain_state',
                        statusName: event.tileName || '地格恢复'
                    }
                });
                return;
            }

            if (event.type === 'miasma_expand') {
                this.addLog('control', `${event.tileName || '瘴气地格'} 向外扩散了一圈`);
                return;
            }

            if (event.type === 'warning_tick') {
                this.addLog('control', `${event.warning.sourceName} 的 ${event.warning.skillName} 正在蓄力，还剩 ${event.warning.remainingTurns} 次行动`);
                eventManager.emit('battleUnitAction', {
                    attacker: actor,
                    target: actor,
                    damage: 0,
                    actionType: 'status',
                    result: {
                        hit: true,
                        statusName: `${event.warning.skillName} ${event.warning.remainingTurns}`
                    }
                });
                return;
            }

            if (event.type === 'warning_empty') {
                this.addLog('control', `${event.warning.sourceName} 的 ${event.warning.skillName} 爆发，但没有命中任何单位`);
                eventManager.emit('battleUnitAction', {
                    attacker: actor,
                    target: actor,
                    damage: 0,
                    actionType: 'status',
                    result: {
                        hit: true,
                        statusName: event.warning.skillName
                    }
                });
                return;
            }

            if (event.type === 'warning_damage' && event.target) {
                const appliedEffects = Array.isArray(event.appliedEffects) ? event.appliedEffects : [];
                const statusText = appliedEffects.length > 0
                    ? `，并施加${appliedEffects.map(effect => this.formatStatusDescription(effect)).join('、')}`
                    : '';
                this.addLog('damage', `${event.sourceName || actor.name} 的 ${event.skillName || '蓄力技能'} 命中 ${event.target.name}，造成 ${event.damage} 点伤害${statusText}`);
                eventManager.emit('battleUnitAction', {
                    attacker: actor,
                    target: event.target,
                    damage: event.damage,
                    actionType: 'status',
                    result: {
                        hit: true,
                        damage: event.damage,
                        statusName: event.skillName || '蓄力技能',
                        appliedEffects,
                        heavyImpact: true,
                        impactLevel: 'critical'
                    }
                });
                if (!event.target.isAlive()) {
                    this.processDefeatedUnit(event.target, {
                        attacker: actor,
                        reason: 'warning_skill'
                    });
                }
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
                    this.processDefeatedUnit(actor, { reason: 'status_damage' });
                }
            }

            if (event.type === 'status_heal' && event.heal > 0) {
                this.addLog('heal', `${actor.name} 受到${event.statusName || '持续恢复'}影响，恢复 ${event.heal} 点生命`);
                eventManager.emit('battleUnitAction', {
                    attacker: this.findUnitById(event.sourceUnitId) || actor,
                    target: actor,
                    damage: 0,
                    actionType: 'status',
                    result: {
                        hit: true,
                        heal: event.heal,
                        statusType: event.statusType,
                        statusName: event.statusName,
                        sourceName: event.sourceName
                    }
                });
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
            this.handleTerrainPositionChange(actor, fromPosition, finalAction.position);
            this.addLog('move', `${actor.name} 受嘲讽影响，向 ${source.name} 移动到了 (${finalAction.position.x + 1}, ${finalAction.position.y + 1})`);
            eventManager.emit('battleUnitMove', {
                unit: actor,
                fromPosition,
                position: finalAction.position,
                toPosition: finalAction.position
            });
            await this.waitForActionPresentation();
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
                return this.executeAction(actor, finalAction.forcedByCharm
                    ? { type: 'defend', forcedByCharm: true, charmSourceId: finalAction.charmSourceId }
                    : { type: 'defend' });
            }
            const fromPosition = { x: actor.position.x, y: actor.position.y };
            this.deactivateFormationByMovement(actor);
            this.clearFocusedStationaryState(actor);
            actor.setPosition(finalAction.position);
            this.handleTerrainPositionChange(actor, fromPosition, finalAction.position);
            if (finalAction.forcedByCharm) {
                const charmSource = finalAction.charmSourceId ? this.findUnitById(finalAction.charmSourceId) : null;
                this.addLog('control', `${actor.name} 受魅惑牵引${charmSource ? `,向 ${charmSource.name}` : ''}移动到了 (${finalAction.position.x + 1}, ${finalAction.position.y + 1})`);
            } else {
                this.addLog('move', `${actor.name} 移动到了 (${finalAction.position.x + 1}, ${finalAction.position.y + 1})`);
            }
            eventManager.emit('battleUnitMove', {
                unit: actor,
                fromPosition,
                position: finalAction.position,
                toPosition: finalAction.position
            });
            this.recordBattleCommandAchievement(actor, 'move', finalAction);
            this.recordSpecialTileEnterAchievement(actor, finalAction.position, finalAction);
            await this.waitForActionPresentation();
            this.triggerMoveEndPassives(actor);
            this.emitStateChange();
            return;
        }

        if (finalAction.type === 'item') {
            const item = itemManager.getItem(finalAction.itemId);
            if (!item) {
                return this.executeAction(actor, { type: 'defend', reason: 'fallback' });
            }
            const target = this.findUnitById(finalAction.targetId) || actor;
            if (item.effect?.type === 'revive') {
                const isValidReviveTarget = target && target.camp === 'hero' && !target.isAlive();
                if (!isValidReviveTarget || !this.canUseBattleItem(finalAction.itemId)) {
                    return this.executeAction(actor, { type: 'defend', reason: 'fallback' });
                }
            } else if (item.effect?.target === 'self' && target.id !== actor.id) {
                return this.executeAction(actor, { type: 'defend', reason: 'fallback' });
            }
            const result = itemManager.useItem(finalAction.itemId, target);
            if (!result.success) {
                return this.executeAction(actor, { type: 'defend', reason: 'fallback' });
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
            this.recordBattleCommandAchievement(actor, 'item', finalAction);
            await this.waitForActionPresentation();
            this.emitStateChange();
            return;
        }

        if (finalAction.type === 'attack' || finalAction.type === 'skill') {
            const target = this.findUnitById(finalAction.targetId);
            const skillIndex = Number.isFinite(Number(finalAction.skillIndex)) ? Number(finalAction.skillIndex) : 0;
            const isSkill = finalAction.type === 'skill';
            const charm = this.getActiveCharm(actor);
            if (charm) {
                const charmedAction = this.getCharmedAction(actor);
                return this.executeAction(actor, charmedAction || { type: 'defend', forcedByCharm: true, charmSourceId: charm.source.id });
            }
            const taunt = this.getActiveTaunt(actor);
            if (taunt && (isSkill || target?.id !== taunt.source.id)) {
                const tauntedAction = this.getTauntedAction(actor);
                return this.executeAction(actor, tauntedAction || { type: 'defend', forcedByTaunt: true, targetId: taunt.source.id });
            }
            const validTargets = isSkill
                ? this.getSkillTargetCandidates(actor, skillIndex)
                : this.getAttackableTargets(actor);
            if (!target || !target.isAlive() || !validTargets.some(unit => unit.id === target.id)) {
                return this.executeAction(actor, { type: 'defend', reason: 'fallback' });
            }
            if (isSkill && !this.canActorUseSkill(actor, skillIndex)) {
                return this.executeAction(actor, { type: 'defend', reason: 'fallback' });
            }

            if (isSkill) {
                const skill = actor.getSkill(skillIndex);
                if (this.isWarningSkill(skill)) {
                    const warning = this.createWarningSkill(actor, target, skillIndex, skill);
                    if (!warning) {
                return this.executeAction(actor, { type: 'defend', reason: 'fallback' });
                    }
                    eventManager.emit('battleUnitAction', {
                        attacker: actor,
                        target: actor,
                        damage: 0,
                        actionType: 'status',
                        result: {
                            hit: true,
                            statusName: `${warning.skillName} ${warning.remainingTurns}`,
                            skillName: warning.skillName
                        }
                    });
                    this.recordBattleCommandAchievement(actor, 'skill', finalAction);
                    await this.waitForActionPresentation();
                    this.emitStateChange();
                    return;
                }
                const bladeFlashContext = this.getPoYuBladeFlashContext(actor, skillIndex);
                if (bladeFlashContext) {
                    const targets = this.getPoYuBladeFlashTargets(actor, skillIndex);
                    const hpCost = actor.consumeSkillCost(skillIndex);
                    const skillLogs = [];
                    const actionTargets = [];
                    const defeatedTargets = [];

                    if (!targets.length) {
                        skillLogs.push(`${actor.name} 施放 ${skill?.name || '特技'}，但未命中任何敌人`);
                    }

                    targets.forEach((targetUnit) => {
                        const terrainAttackState = this.getTerrainAttackStatePreview(actor);
                        const attackResult = actor.performConfiguredAttack(targetUnit, {
                            multiplier: bladeFlashContext.multiplier,
                            canCrit: false,
                            defensePenBonus: actor.getSkillDefensePenBonus(skillIndex),
                            useSkill: true,
                            skillIndex,
                            skillName: skill?.name || null
                        });
                        if (!attackResult.hit) {
                            this.applyTerrainAttackConsequences(actor, targetUnit, attackResult, [], terrainAttackState);
                            skillLogs.push(`${actor.name} 对 ${targetUnit.name} 施放 ${skill?.name || '特技'}，但被闪避了`);
                            actionTargets.push({ target: targetUnit, result: attackResult });
                            return;
                        }

                        const baseAppliedEffects = this.applySkillStatusEffects(actor, targetUnit, skillIndex, attackResult);
                        const { appliedEffects } = this.applyTerrainAttackConsequences(
                            actor,
                            targetUnit,
                            attackResult,
                            baseAppliedEffects,
                            terrainAttackState
                        );
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
                        if (attackResult.hit && attackResult.damage > 0) {
                            this.handleDamageReflect(targetUnit, actor, attackResult.damage);
                            this.handleCounterAttack(targetUnit, actor);
                        }

                        let selfHeal = 0;
                        if (bladeFlashContext.healMissingHpRatioPerHit > 0) {
                            const missingHp = Math.max(0, actor.maxHp - actor.hp);
                            if (missingHp > 0) {
                                selfHeal = actor.heal(Math.max(1, Math.floor(missingHp * bladeFlashContext.healMissingHpRatioPerHit)));
                            }
                        }
                        attackResult.selfHeal = selfHeal;

                        const statusText = appliedEffects.length > 0
                            ? `，并施加${appliedEffects.map(effect => this.formatStatusDescription(effect)).join('、')}`
                            : '';
                        const healText = selfHeal > 0 ? `，并恢复自身 ${selfHeal} 点生命` : '';
                        skillLogs.push(`${actor.name} 对 ${targetUnit.name} 施放 ${skill?.name || '特技'}，造成 ${attackResult.damage} 点伤害${statusText}${healText}`);
                        actionTargets.push({ target: targetUnit, result: attackResult });
                        if (!targetUnit.isAlive()) {
                            defeatedTargets.push(targetUnit);
                        }
                    });
                    this.playAttackActionSfx(actionTargets.map(entry => entry.result));
                    if (actionTargets.some(entry => entry.result?.isCritical)) {
                        this.triggerHeroDamageVoice(actor, actionTargets.find(entry => entry.result?.isCritical)?.result);
                    }

                    if (hpCost > 0) {
                        skillLogs.push(`${actor.name} 额外消耗 ${hpCost} 点生命施放特技`);
                    }
                    skillLogs.forEach(message => this.addLog('damage', message));
                    eventManager.emit('battleUnitAction', {
                        attacker: actor,
                        target: actor,
                        damage: 0,
                        actionType: 'skill',
                        result: {
                            skillIndex,
                            skillName: skill?.name || null,
                            hpCost,
                            targets: actionTargets.map(entry => ({ id: entry.target.id, name: entry.target.name, ...entry.result }))
                        }
                    });
                    this.recordBattleCommandAchievement(actor, 'skill', finalAction);
                    await this.waitForActionPresentation();
                    defeatedTargets.forEach((targetUnit) => {
                        this.processDefeatedUnit(targetUnit, {
                            attacker: actor,
                            reason: 'skill'
                        });
                    });
                    this.emitStateChange();
                    return;
                }
                const targets = this.getSelectedSkillTargets(actor, target, skillIndex);
                const hpCost = actor.consumeSkillCost(skillIndex);
                const skillLogs = [];
                const actionTargets = [];
                const defeatedTargets = [];
                const effectType = actor.getSkillState(skillIndex)?.effectType || 'damage';

                if (effectType === 'group_heal' || effectType === 'cleanse' || effectType === 'group_grant_shield') {
                    const allyTargets = (this.getAllies?.(actor) || []).filter(a => a.isAlive());
                    const healRatioMaxHp = Number(skill?.healRatioMaxHp ?? skill?.multiplier ?? 0) || 0;
                    const cleanseCount = Math.max(0, Number(skill?.cleanseCount) || 0);
                    const shieldRatioMaxHp = Number(skill?.shieldRatioMaxHp) || 0;
                    const shieldDuration = Math.max(1, Number(skill?.shieldDurationTurns) || 1);
                    const allyStatusEffects = Array.isArray(skill?.allyStatusEffects) ? skill.allyStatusEffects : [];

                    allyTargets.forEach((allyUnit) => {
                        if (effectType === 'group_grant_shield' && shieldRatioMaxHp > 0) {
                            const shieldSource = skill?.shieldSourceMaxHp ? actor : allyUnit;
                            const shieldAmount = Math.floor(shieldSource.maxHp * shieldRatioMaxHp);
                            const added = allyUnit.addShield?.(shieldAmount, shieldDuration) || 0;
                            skillLogs.push(`${actor.name} 赋予 ${allyUnit.name} ${added} 点护盾`);
                            actionTargets.push({ target: allyUnit, result: { hit: true, shield: added, useSkill: true, skillName: skill?.name || null } });
                            return;
                        }
                        if (effectType === 'cleanse' && cleanseCount > 0) {
                            const removed = allyUnit.cleanseDebuffs?.(cleanseCount) || [];
                            const removedNames = removed.map(r => r.name || r.type || 'debuff').join('、');
                            if (removed.length > 0) {
                                skillLogs.push(`${actor.name} 驱散了 ${allyUnit.name} 的 ${removedNames}`);
                            }
                            if (healRatioMaxHp > 0) {
                                const healAmount = Math.floor(allyUnit.maxHp * healRatioMaxHp);
                                const actualHeal = allyUnit.heal(healAmount);
                                if (actualHeal > 0) {
                                    skillLogs.push(`${actor.name} 为 ${allyUnit.name} 恢复 ${actualHeal} 点生命`);
                                }
                                actionTargets.push({ target: allyUnit, result: { hit: true, heal: actualHeal, cleansed: removed.length, useSkill: true, skillName: skill?.name || null } });
                            } else {
                                actionTargets.push({ target: allyUnit, result: { hit: true, cleansed: removed.length, useSkill: true, skillName: skill?.name || null } });
                            }
                            if (allyStatusEffects.length > 0) {
                                allyUnit.applyStatusEffects?.(allyStatusEffects, actor);
                            }
                            return;
                        }
                        if (effectType === 'group_heal') {
                            let healAmount = 0;
                            if (healRatioMaxHp > 0) {
                                healAmount = Math.floor(allyUnit.maxHp * healRatioMaxHp);
                            } else {
                                healAmount = Math.floor(actor.getEffectiveAttack() * actor.attackCoefficient * (Number(skill?.multiplier) || 1));
                            }
                            const actualHeal = allyUnit.heal(healAmount);
                            const cleansed = cleanseCount > 0 ? (allyUnit.cleanseDebuffs?.(cleanseCount) || []).length : 0;
                            if (actualHeal > 0) {
                                skillLogs.push(`${actor.name} 为 ${allyUnit.name} 恢复 ${actualHeal} 点生命`);
                            }
                            if (cleansed > 0) {
                                skillLogs.push(`${actor.name} 驱散了 ${allyUnit.name} 的 ${cleansed} 个负面状态`);
                            }
                            if (allyStatusEffects.length > 0) {
                                allyUnit.applyStatusEffects?.(allyStatusEffects, actor);
                            }
                            actionTargets.push({ target: allyUnit, result: { hit: true, heal: actualHeal, cleansed, useSkill: true, skillName: skill?.name || null } });
                        }
                    });
                    if (hpCost > 0) {
                        skillLogs.push(`${actor.name} 额外消耗 ${hpCost} 点生命施放特技`);
                    }
                    skillLogs.forEach(message => this.addLog('heal', message));
                    this.triggerHeroHealVoice(actor, actionTargets);
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
                    await this.waitForActionPresentation();
                    this.emitStateChange();
                    return;
                }

                targets.forEach((targetUnit) => {
                    if (!targetUnit?.isAlive?.() || !targetUnit.isAlive()) {
                        return;
                    }
                    if (effectType === 'heal') {
                        const healValue = Math.max(1, Math.floor(actor.getEffectiveAttack() * actor.attackCoefficient * (Number(skill?.multiplier) || 1)));
                        const actualHeal = targetUnit.heal(healValue);
                        const healResult = { hit: true, heal: actualHeal, useSkill: true, skillName: skill?.name || null };
                        const customEffectResult = this.resolveCustomSkillEffect(actor, targetUnit, skillIndex, healResult);
                        healResult.customEffectResult = customEffectResult;
                        skillLogs.push(`${actor.name} 对 ${targetUnit.name} 施放 ${skill?.name || '特技'}，恢复 ${actualHeal} 点生命`);
                        if (customEffectResult?.type === 'apply_missing_hp_regen' && customEffectResult.appliedEffects?.length > 0) {
                            const statusText = customEffectResult.appliedEffects
                                .map(entry => `${entry.target.name}获得${entry.effect?.name || '持续恢复'}`)
                                .join('、');
                            skillLogs.push(`${actor.name} 施放 ${skill?.name || '特技'}，${statusText}`);
                        }
                        actionTargets.push({ target: targetUnit, result: healResult });
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
                        const terrainAttackState = this.getTerrainAttackStatePreview(actor);
                        const attackResult = actor.attackTarget(
                            targetUnit,
                            true,
                            skillIndex,
                            finalAction?._critGuaranteed ? { critGuaranteed: true, forceCrit: true } : {}
                        );
                        if (!attackResult.hit) {
                            this.applyTerrainAttackConsequences(actor, targetUnit, attackResult, [], terrainAttackState);
                            skillLogs.push(`${actor.name} 对 ${targetUnit.name} 施放 ${skill?.name || '特技'}，但被闪避了`);
                        } else {
                            const baseAppliedEffects = this.applySkillStatusEffects(actor, targetUnit, skillIndex, attackResult);
                            const { appliedEffects: terrainAppliedEffects } = this.applyTerrainAttackConsequences(
                                actor,
                                targetUnit,
                                attackResult,
                                baseAppliedEffects,
                                terrainAttackState
                            );
                            let appliedEffects = Array.isArray(terrainAppliedEffects) ? [...terrainAppliedEffects] : [];
                            const customEffectResult = this.resolveCustomSkillEffect(actor, targetUnit, skillIndex, attackResult);
                            attackResult.customEffectResult = customEffectResult;
                            if (Array.isArray(customEffectResult?.appliedEffects) && customEffectResult.appliedEffects.length > 0) {
                                appliedEffects.push(...customEffectResult.appliedEffects);
                            }
                            const controlMarkEffects = this.applyControlMarkPassive(actor, targetUnit, {
                                displaceMoved: customEffectResult?.type === 'displace' ? customEffectResult.moved : 0,
                                appliedEffects
                            });
                            if (controlMarkEffects.length > 0) {
                                appliedEffects.push(...controlMarkEffects);
                            }
                            attackResult.appliedEffects = appliedEffects;
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
                            if (attackResult.hit && attackResult.damage > 0) {
                                this.handleDamageReflect(targetUnit, actor, attackResult.damage);
                                this.handleCounterAttack(targetUnit, actor);
                            }
                            const statusText = appliedEffects.length > 0
                                ? `，并施加${appliedEffects.map(effect => this.formatStatusDescription(effect)).join('、')}`
                                : '';
                            const customText = customEffectResult?.consumedStacks > 0
                                ? `，结算${customEffectResult.consumedStacks}层${customEffectResult.statusType === 'burn' ? '灼烧' : '状态'}追加 ${customEffectResult.extraDamage} 点伤害`
                                : '';
                            let displaceText = '';
                            if (customEffectResult?.type === 'displace') {
                                if (customEffectResult.moved > 0) {
                                    const verb = customEffectResult.mode === 'pull' ? '拉近' : '击退';
                                    displaceText = `，${verb}${customEffectResult.moved}格`;
                                } else if (customEffectResult.blocked) {
                                    displaceText = '，但位移被阻挡';
                                }
                            }
                            const lifestealText = customEffectResult?.type === 'lifesteal' && customEffectResult.heal > 0
                                ? `，自身吸取 ${customEffectResult.heal} 点生命`
                                : '';
                            skillLogs.push(`${actor.name} 对 ${targetUnit.name} 施放 ${skill?.name || '特技'}，造成 ${attackResult.damage} 点伤害${attackResult.isCritical ? '（暴击）' : ''}${statusText}${customText}${displaceText}${lifestealText}`);
                            if (customEffectResult?.type === 'displace') {
                                this.commitDisplaceEffect(targetUnit, customEffectResult, actor);
                                if (customEffectResult.followPosition) {
                                    this.commitForcedMoveEffect(actor, customEffectResult.followPosition, {
                                        reason: 'skill_follow',
                                        mode: 'advance',
                                        causedBy: actor.id
                                    });
                                }
                            }
                        }
                        actionTargets.push({ target: targetUnit, result: attackResult });
                        if (!targetUnit.isAlive()) {
                            defeatedTargets.push(targetUnit);
                        }
                    }
                });
                if (effectType === 'damage') {
                    this.playAttackActionSfx(actionTargets.map(entry => entry.result));
                    if (actionTargets.some(entry => entry.result?.isCritical)) {
                        this.triggerHeroDamageVoice(actor, actionTargets.find(entry => entry.result?.isCritical)?.result);
                    }
                }

                const doubleTriggerResult = this.triggerDoubleConsumeStatusDamage(actor, skill, skill?.customEffect || {});
                if (doubleTriggerResult?.targets?.length > 0) {
                    skillLogs.push(`${actor.name} 启动协议终焉，为全场敌人追加噪点并再次过载`);
                    doubleTriggerResult.targets.forEach((entry) => {
                        const consumedStacks = Number(entry.result?.customEffectResult?.consumedStacks) || 0;
                        const extraDamage = Number(entry.result?.customEffectResult?.extraDamage) || 0;
                        skillLogs.push(`协议终焉引爆 ${entry.target.name} 的${consumedStacks}层噪点，造成 ${extraDamage} 点伤害`);
                        actionTargets.push(entry);
                        if (!entry.target.isAlive()) {
                            defeatedTargets.push(entry.target);
                        }
                    });
                }

                if (hpCost > 0) {
                    skillLogs.push(`${actor.name} 额外消耗 ${hpCost} 点生命施放特技`);
                }
                const skillLogType = effectType === 'heal'
                    ? 'heal'
                    : (effectType === 'utility' ? 'control' : 'damage');
                skillLogs.forEach(message => this.addLog(skillLogType, message));
                if (effectType === 'heal') {
                    this.triggerHeroHealVoice(actor, actionTargets);
                }
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
                this.recordBattleCommandAchievement(actor, 'skill', finalAction);
                await this.waitForActionPresentation();
                defeatedTargets.forEach((targetUnit) => {
                    this.processDefeatedUnit(targetUnit, {
                        attacker: actor,
                        reason: 'skill'
                    });
                });
                this.emitStateChange();
                return;
            }

            const terrainAttackState = this.getTerrainAttackStatePreview(actor);
            const attackConfig = this.buildBasicAttackConfig(actor, finalAction);
            const attackResult = actor.attackTarget(target, false, 0, attackConfig);
            if (!attackResult.hit) {
                this.applyTerrainAttackConsequences(actor, target, attackResult, [], terrainAttackState);
                this.addLog('miss', `${actor.name} 攻击 ${target.name}，但被闪避了`);
            } else {
                const baseAppliedEffects = this.applyBasicAttackEffects(actor, target, attackResult);
                const { appliedEffects } = this.applyTerrainAttackConsequences(
                    actor,
                    target,
                    attackResult,
                    baseAppliedEffects,
                    terrainAttackState
                );
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
            this.playAttackActionSfx(attackResult);
            this.triggerHeroDamageVoice(actor, attackResult);
            eventManager.emit('battleUnitAction', { attacker: actor, target, damage: attackResult.damage, actionType: finalAction.type, result: attackResult });
            this.recordBattleCommandAchievement(actor, finalAction.type, finalAction);
            await this.waitForActionPresentation();
            // 攻击动画呈现完后再触发反伤/反击/阵亡，确保阵亡动画在攻击动画之后入队
            if (attackResult.hit) {
                this.handlePostDamageEffects(target, actor, attackResult);
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
        } else if (finalAction.forcedByCharm) {
            const source = finalAction.charmSourceId ? this.findUnitById(finalAction.charmSourceId) : null;
            this.addLog('control', `${actor.name} 处于魅惑状态${source ? `,被 ${source.name} 牵引` : ''},无法行动`);
            eventManager.emit('battleUnitAction', {
                attacker: actor,
                target: actor,
                damage: 0,
                actionType: 'defend',
                result: { forcedByCharm: true, statusName: '魅惑' }
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
        this.recordBattleCommandAchievement(actor, 'defend', finalAction);
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
            this.finalizeBattleStats(this.result);
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
            this.finalizeBattleStats(this.result);
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
            this.processTerrainRoundStart();
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
                this.updateFocusedStationaryTurnStart(actor);
                this.currentActor = actor;
                this.emitStateChange();
                this.triggerHeroVoice(actor, 'turnStart', {
                    priority: 1,
                    interrupt: false,
                    cooldownMs: 1200
                });
                const passiveTurnStartEvents = this.processHeroPassiveTurnStart(actor);
                const formationEvents = this.processFormationTurnStart(actor);
                const warningEvents = this.processWarningSkillTurnStart(actor);
                const specialTileEvents = this.getSpecialTileTriggerEffects(actor).map((effect) => {
                    if (effect.type === 'damage') {
                        const damage = actor.takeStatusDamage(effect.damage, true);
                        return { type: 'special_tile_damage', damage, ...effect };
                    }
                    if (effect.type === 'heal') {
                        const heal = actor.heal(effect.heal);
                        return { type: 'special_tile_heal', heal, ...effect };
                    }
                    return null;
                }).filter(Boolean);
                const turnStartResult = actor.processTurnStartEffects?.() || { preventedAction: false, events: [] };
                if (passiveTurnStartEvents.length > 0 || formationEvents.length > 0 || warningEvents.length > 0 || specialTileEvents.length > 0) {
                    turnStartResult.events = [
                        ...passiveTurnStartEvents,
                        ...formationEvents,
                        ...warningEvents,
                        ...specialTileEvents,
                        ...(Array.isArray(turnStartResult.events) ? turnStartResult.events : [])
                    ];
                    turnStartResult.preventedAction = turnStartResult.preventedAction || warningEvents.length > 0;
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
                    const expiredEffects = this.getUniqueExpiredEffects(actor.processTurnEndEffects?.() || []);
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
                const expiredEffects = this.getUniqueExpiredEffects(actor.processTurnEndEffects?.() || []);
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

                while (actor.passiveState?.extraActionPending && actor.isAlive() && this.isBattling) {
                    const extraState = this.getExtraActionOnKillState(actor);
                    if (!extraState || extraState.usedThisTurn <= 0) {
                        actor.passiveState.extraActionPending = false;
                        break;
                    }
                    actor.passiveState.extraActionPending = false;
                    const extraAction = await this.resolveActionForActor(actor);
                    if (!this.isBattling) break;
                    const extraAttackTarget = extraAction?.type === 'attack'
                        ? extraAction
                        : { type: 'attack', targetId: extraAction?.targetId || this.getOpponents(actor)[0]?.id || '', forcedByTaunt: extraAction?.forcedByTaunt, forcedByCharm: extraAction?.forcedByCharm };
                    if (extraState.critGuaranteed !== undefined) {
                        extraAttackTarget._critGuaranteed = extraState.critGuaranteed;
                    }
                    await this.executeAction(actor, extraAttackTarget);
                    await this.waitForActionPresentation();
                    const extraExpiredEffects = this.getUniqueExpiredEffects(actor.processTurnEndEffects?.() || []);
                    if (extraExpiredEffects.length > 0) {
                        eventManager.emit('battleUnitAction', {
                            attacker: actor,
                            target: actor,
                            damage: 0,
                            actionType: 'status_expire',
                            result: { expiredEffects: extraExpiredEffects }
                        });
                        await this.waitForActionPresentation();
                    }
                    if (this.checkBattleEnd()) return this.result;
                    if (actor.passiveState.extraActionPending === undefined) {
                        actor.passiveState.extraActionPending = false;
                    }
                }
                this.resetExtraActionState(actor);
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
            this.finalizeBattleStats(this.result);
            this.addLog('result', '战斗超时，自动判定失败');
            eventManager.emit('battleEnd', this.result);
        }
        return this.result;
    }

    reset() {
        this.cancelPendingStateChange();
        this.teardownBattleStats();
        this.heroes = [];
        this.enemies = [];
        this.pendingBossWaves = [];
        this.currentRound = 0;
        this.isBattling = false;
        this.result = null;
        this.currentActor = null;
        this.decisionProvider = null;
        this.autoBattleOverride = null;
        this.isBossEntrancePlaying = false;
        this.battleItemUsage = {};
        this.environmentEffect = 'none';
        this.terrainRuntimeState = this.createEmptyTerrainRuntimeState();
        this.battleStats = this.createEmptyBattleStats();
        this.processedDeathUnitIds = new Set();
        this.emitStateChange();
    }
}

const battleManager = new BattleManager();
window.battleManager = battleManager;
