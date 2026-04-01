/**
 * 抽卡管理器 - 单例模式
 */
class GachaManager {
    constructor() {
        if (GachaManager.instance) {
            return GachaManager.instance;
        }
        this.currentPool = 'hero_pool';
        this.guaranteedCounter = 0;
        GachaManager.instance = this;
    }

    /**
     * 初始化
     */
    init(saveData) {
        if (saveData) {
            this.guaranteedCounter = saveData.guaranteedCounter || 0;
        } else {
            this.guaranteedCounter = 0;
        }
    }

    /**
     * 设置当前抽卡池
     * @param {string} poolId - 抽卡池ID
     */
    setPool(poolId) {
        this.currentPool = poolId;
    }

    /**
     * 获取抽卡池配置
     * @param {string} poolId - 抽卡池ID
     * @returns {Object|null}
     */
    getPoolConfig(poolId) {
        return GachaConfig.getPoolConfig(poolId || this.currentPool);
    }

    /**
     * 计算抽卡费用
     * @param {number} count - 抽取次数
     * @param {boolean} useTicket - 是否使用券
     * @returns {Object}
     */
    calculateCost(count, useTicket = false) {
        const pool = this.getPoolConfig();
        const costType = useTicket ? 'ticket' : 'gold';
        const costs = pool.costs[costType];

        if (count === 10) {
            return {
                type: costType,
                amount: costs.ten
            };
        } else {
            return {
                type: costType,
                amount: costs.single * count
            };
        }
    }

    /**
     * 抽取
     * @param {number} count - 抽取次数
     * @param {boolean} useTicket - 是否使用券
     * @returns {Object}
     */
    pull(count = 1, useTicket = false) {
        const pool = this.getPoolConfig();
        const cost = this.calculateCost(count, useTicket);

        // 检查资源是否足够
        if (useTicket) {
            const ticket = itemManager.getItem('hero_summon');
            if (!ticket || ticket.count < cost.amount) {
                return { success: false, message: '召唤券不足' };
            }
            itemManager.removeItem('hero_summon', cost.amount);
        } else {
            if (shelterManager.getResource('gold') < cost.amount) {
                return { success: false, message: '金币不足' };
            }
            shelterManager.consumeResource('gold', cost.amount);
        }

        // 执行抽卡
        const results = [];
        const tempCounter = this.guaranteedCounter;

        for (let i = 0; i < count; i++) {
            let rarity;

            // 保底逻辑
            if (this.guaranteedCounter >= pool.guaranteed.count) {
                rarity = pool.guaranteed.type;
                this.guaranteedCounter = 0;
            } else {
                rarity = GachaConfig.randomRarity(pool.rates);
                this.guaranteedCounter++;
            }

            const heroConfig = GachaConfig.getRandomHero(rarity);
            if (heroConfig) {
                results.push({
                    type: 'hero',
                    configId: heroConfig.id,
                    name: heroConfig.name,
                    icon: heroConfig.icon,
                    rarity: rarity
                });
            }
        }

        // 失败回滚计数器
        if (results.length === 0) {
            this.guaranteedCounter = tempCounter;
        }

        eventManager.emit('gachaPull', { results, cost });

        return {
            success: true,
            results,
            cost
        };
    }

    /**
     * 将抽卡结果添加到英雄列表
     * @param {Array} results - 抽卡结果
     * @returns {Array<Hero>}
     */
    addResultsToHeroes(results) {
        const addedHeroes = [];

        for (const result of results) {
            if (result.type === 'hero') {
                const config = HeroConfig.getHeroConfig(result.configId);
                // 检查是否已有该英雄
                const hasHero = heroManager.getAllHeroes().some(h => h.configId === result.configId);
                
                if (config && !hasHero) {
                    const hero = new Hero(config, 1);
                    heroManager.addHero(hero);
                    addedHeroes.push(hero);
                } else {
                    // 重复英雄，转换为50个该英雄碎片
                    heroManager.addFragments(result.configId, 50);
                    Toast.success(`重复英雄，获得50个${result.name}碎片`);
                }
            }
        }

        return addedHeroes;
    }

    /**
     * 计算重复英雄奖励
     * @param {string} rarity - 稀有度
     * @returns {number}
     */
    calculateDuplicateReward(rarity) {
        const rewards = {
            common: 50,
            rare: 150,
            epic: 400,
            legendary: 1000
        };
        return rewards[rarity] || 50;
    }

    /**
     * 获取保存数据
     * @returns {Object}
     */
    getSaveData() {
        return {
            guaranteedCounter: this.guaranteedCounter
        };
    }
}

// 导出单例
const gachaManager = new GachaManager();

// 暴露到全局
window.gachaManager = gachaManager;
