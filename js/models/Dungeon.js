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
        this.enemies = config.enemies || [];
        this.rewards = config.rewards || {};
        this.description = config.description;
    }

    /**
     * 创建敌人战斗单位
     * @param {number} playerLevel - 玩家等级
     * @returns {Array<BattleUnit>}
     */
    createEnemies(playerLevel) {
        const enemyUnits = [];

        for (const enemyConfig of this.enemies) {
            const config = DungeonConfig.getEnemyConfig(enemyConfig.id);
            if (!config) continue;

            for (let i = 0; i < enemyConfig.count; i++) {
                const stats = DungeonConfig.calculateEnemyStats(enemyConfig.id, playerLevel);
                const enemyConfigWithStats = {
                    ...config,
                    baseStats: stats
                };

                const enemy = new BattleUnit(enemyConfigWithStats);
                enemyUnits.push(enemy);
            }
        }

        return enemyUnits;
    }

    /**
     * 计算奖励
     * @param {number} playerLevel - 玩家等级
     * @returns {Object}
     */
    calculateRewards(playerLevel) {
        const rewards = {
            gold: Utils.randomInt(this.rewards.gold.min, this.rewards.gold.max),
            exp: Utils.randomInt(this.rewards.exp.min, this.rewards.exp.max),
            items: []
        };

        // 随机获得道具
        if (this.rewards.items) {
            for (const itemConfig of this.rewards.items) {
                if (Math.random() < itemConfig.chance) {
                    const itemDef = ItemConfig.getItemConfig(itemConfig.id);
                    if (itemDef) {
                        rewards.items.push(new Item(itemDef));
                    }
                }
            }
        }

        return rewards;
    }

    /**
     * 是否可进入
     * @param {number} playerLevel - 玩家等级
     * @returns {boolean}
     */
    canEnter(playerLevel) {
        return playerLevel >= this.level;
    }

    /**
     * 获取信息
     * @returns {Object}
     */
    getInfo() {
        return {
            id: this.id,
            name: this.name,
            icon: this.icon,
            level: this.level,
            energyCost: this.energyCost,
            description: this.description,
            enemyCount: this.enemies.reduce((sum, e) => sum + e.count, 0),
            rewards: this.rewards
        };
    }
}
