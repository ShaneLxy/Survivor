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

    createUnitsFromEntries(entries = []) {
        const enemyUnits = [];
        entries.forEach((enemyEntry) => {
            const config = DungeonConfig.getEnemyConfig(enemyEntry.id);
            if (!config) {
                return;
            }
            const count = Math.max(0, Number(enemyEntry.count) || 0);
            for (let index = 0; index < count; index++) {
                const stats = DungeonConfig.calculateEnemyStats(enemyEntry.id, this.level, enemyEntry.multiplier);
                const enemy = new BattleUnit({
                    id: Utils.generateId(),
                    configId: enemyEntry.id,
                    name: config.name,
                    icon: config.icon,
                    type: 'enemy',
                    camp: 'enemy',
                    rank: config.rank || 'normal',
                    description: config.description || '',
                    skill: config.skill ? { ...config.skill } : null,
                    baseStats: enemyEntry.overrideStats ? { ...stats, ...enemyEntry.overrideStats } : stats
                });
                enemyUnits.push(enemy);
            }
        });
        return enemyUnits;
    }

    createBattleSetup() {
        return {
            initialEnemies: this.createUnitsFromEntries(this.initialEnemies),
            bossWaves: this.bossWaves.map((wave) => ({
                id: wave.id,
                spawnRound: wave.spawnRound,
                spawnOnClearBeforeRound: wave.spawnOnClearBeforeRound,
                bosses: this.createUnitsFromEntries(wave.bosses)
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
                    rewards.items.push({ id: rewardId, count: 1 });
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
            enemyCount: this.getEnemyCount(),
            rewards: this.rewards
        };
    }
}

window.Dungeon = Dungeon;
