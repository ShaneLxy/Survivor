/**
 * 地牢模型
 */
class Dungeon {
    constructor(config) {
        this.id = config.id;
        this.name = config.name;
        this.icon = config.icon;
        this.level = config.level;
        this.energyCost = config.energyCost;
        this.sceneId = config.sceneId || 'standard_9x9';
        this.environmentEffect = this.normalizeEnvironmentEffect(
            config.environmentEffect ?? config.environmentEffectType ?? config.battleEnvironmentEffect ?? config.battlefield?.environmentEffect
        );
        this.battlefield = config.battlefield ? {
            ...config.battlefield,
            obstacles: Array.isArray(config.battlefield.obstacles)
                ? config.battlefield.obstacles.map(entry => Array.isArray(entry) ? [...entry] : { ...entry })
                : []
        } : null;
        this.initialEnemies = [...(config.initialEnemies || config.enemies || [])];
        this.bossWaves = (config.bossWaves || []).map((wave, index) => ({
            id: wave.id || `${config.id}_boss_wave_${index + 1}`,
            spawnRound: Number(wave.spawnRound) || DungeonConfig.defaultBossSpawnRound,
            spawnOnClearBeforeRound: wave.spawnOnClearBeforeRound !== false,
            bosses: [...(wave.bosses || [])]
        }));
        this.rewards = config.rewards || {};
        this.description = config.description;
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
            lightning_rain: 'storm_night'
        };
        const normalized = aliases[type] || type;
        return ['smoke', 'rain', 'snow', 'poison_fog', 'dust_smoke', 'storm_night'].includes(normalized) ? normalized : 'none';
    }

    createUnitsFromEntries(entries = []) {
        const enemyUnits = [];
        entries.forEach((enemyEntry) => {
            const config = DungeonConfig.getEnemyConfig(enemyEntry.id);
            if (!config) {
                return;
            }
            const count = Math.max(0, Number(enemyEntry.count) || 0);
            const spawnPositions = Array.isArray(enemyEntry.positions || enemyEntry.spawnPositions)
                ? (enemyEntry.positions || enemyEntry.spawnPositions)
                : [];
            for (let index = 0; index < count; index++) {
                const entryContext = {
                    ...enemyEntry,
                    sourceType: enemyEntry.sourceType || enemyEntry.encounterType || null
                };
                const stats = DungeonConfig.resolveEnemyEntryStats(entryContext, this.level);
                if (!stats) {
                    continue;
                }
                const skills = DungeonConfig.resolveEnemyEntrySkills(entryContext, config);
                const skill = skills[0] || null;
                const enemy = new BattleUnit({
                    id: Utils.generateId(),
                    configId: enemyEntry.id,
                    name: enemyEntry.name || config.name,
                    icon: config.icon,
                    portrait: enemyEntry.portrait || config.portrait || null,
                    type: 'enemy',
                    camp: 'enemy',
                    rank: DungeonConfig.getEnemyEntryRank(entryContext, config),
                    description: enemyEntry.description || config.description || '',
                    skills,
                    skill,
                    baseStats: stats
                });
                if (spawnPositions[index]) {
                    enemy.preferredSpawnPosition = Array.isArray(spawnPositions[index])
                        ? [...spawnPositions[index]]
                        : { ...spawnPositions[index] };
                }
                enemyUnits.push(enemy);
            }
        });
        return enemyUnits;
    }

    createBattleSetup() {
        return {
            environmentEffect: this.environmentEffect,
            battlefield: this.battlefield
                ? {
                    ...this.battlefield,
                    obstacles: Array.isArray(this.battlefield.obstacles)
                        ? this.battlefield.obstacles.map(entry => Array.isArray(entry) ? [...entry] : { ...entry })
                        : []
                }
                : null,
            initialEnemies: this.createUnitsFromEntries(this.initialEnemies),
            bossWaves: this.bossWaves.map((wave) => ({
                id: wave.id,
                spawnRound: wave.spawnRound,
                spawnOnClearBeforeRound: wave.spawnOnClearBeforeRound,
                bosses: this.createUnitsFromEntries((wave.bosses || []).map(entry => ({
                    ...entry,
                    sourceType: 'boss'
                })))
            }))
        };
    }

    createEnemies() {
        return this.createUnitsFromEntries(this.initialEnemies);
    }

    getAllEnemyEntries() {
        return [
            ...this.initialEnemies.map(entry => ({ ...entry, sourceType: 'initial' })),
            ...this.bossWaves.flatMap(wave => (wave.bosses || []).map(entry => ({
                ...entry,
                sourceType: 'boss',
                waveId: wave.id,
                spawnRound: wave.spawnRound,
                spawnOnClearBeforeRound: wave.spawnOnClearBeforeRound
            })))
        ];
    }

    getEnemyCount() {
        return this.getAllEnemyEntries().reduce((sum, enemy) => sum + (Number(enemy.count) || 0), 0);
    }

    calculateRewards() {
        const rewards = {
            gold: Utils.randomInt(this.rewards.gold.min, this.rewards.gold.max),
            exp: Utils.randomInt(this.rewards.exp.min, this.rewards.exp.max),
            items: []
        };

        if (Array.isArray(this.rewards.items)) {
            this.rewards.items.forEach(itemConfig => {
                const rewardId = itemConfig.id;
                const isKnownReward = shelterManager.isResourceType(rewardId) || Boolean(ItemConfig.getItemConfig(rewardId));
                if (Math.random() < itemConfig.chance && isKnownReward) {
                    const min = Math.max(1, Number(itemConfig.min ?? itemConfig.count ?? 1) || 1);
                    const max = Math.max(min, Number(itemConfig.max ?? itemConfig.count ?? min) || min);
                    rewards.items.push({ id: rewardId, count: Utils.randomInt(min, max) });
                }
            });
        }

        return rewards;
    }

    canEnter(playerLevel) {
        return playerLevel >= this.level;
    }

    getInfo() {
        return {
            id: this.id,
            name: this.name,
            icon: this.icon,
            level: this.level,
            energyCost: this.energyCost,
            description: this.description,
            sceneId: this.sceneId,
            environmentEffect: this.environmentEffect,
            battlefield: this.battlefield ? { ...this.battlefield } : null,
            enemyCount: this.getEnemyCount(),
            rewards: this.rewards
        };
    }
}

window.Dungeon = Dungeon;
