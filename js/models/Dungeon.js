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
        this.enemies = config.enemies || [];
        this.rewards = config.rewards || {};
        this.description = config.description;
    }

    createEnemies(playerLevel) {
        const enemyUnits = [];
        for (const enemyConfig of this.enemies) {
            const config = DungeonConfig.getEnemyConfig(enemyConfig.id);
            if (!config) continue;
            for (let index = 0; index < enemyConfig.count; index++) {
                const stats = DungeonConfig.calculateEnemyStats(enemyConfig.id, playerLevel);
                const enemy = new BattleUnit({
                    id: Utils.generateId(),
                    name: config.name,
                    icon: config.icon,
                    type: 'enemy',
                    camp: 'enemy',
                    rank: config.rank || 'normal',
                    baseStats: stats
                });
                enemyUnits.push(enemy);
            }
        }
        return enemyUnits;
    }

    calculateRewards(playerLevel) {
        const rewards = {
            gold: Utils.randomInt(this.rewards.gold.min, this.rewards.gold.max),
            exp: Utils.randomInt(this.rewards.exp.min, this.rewards.exp.max),
            items: []
        };

        if (Array.isArray(this.rewards.items)) {
            this.rewards.items.forEach(itemConfig => {
                if (Math.random() < itemConfig.chance && ItemConfig.getItemConfig(itemConfig.id)) {
                    rewards.items.push({ id: itemConfig.id, count: 1 });
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
            enemyCount: this.enemies.reduce((sum, enemy) => sum + enemy.count, 0),
            rewards: this.rewards
        };
    }
}

window.Dungeon = Dungeon;
