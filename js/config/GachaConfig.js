/**
 * 抽卡配置
 */
const GachaConfig = {
    // 抽卡池配置
    pools: {
        hero_pool: {
            id: 'hero_pool',
            name: '英雄召唤',
            description: '召唤随机英雄',
            icon: '🎲',
            rates: {
                legendary: 0.005, // 0.5%
                epic: 0.04, // 4%
                rare: 0.255, // 25.5%
                common: 0.7 // 70%
            },
            costs: {
                gold: { single: 100, ten: 900 },
                ticket: { single: 1, ten: 10 }
            },
            guaranteed: {
                type: 'epic', // 保底稀有度
                count: 10 // 保底次数
            }
        }
    },

    // 根据稀有度随机选择英雄
    getRandomHero(rarity) {
        const heroes = HeroConfig.getHeroesByRarity(rarity);
        if (heroes.length === 0) {
            // 如果没有指定稀有度的英雄,从低稀有度递归选择
            const rarityOrder = ['legendary', 'epic', 'rare', 'common'];
            const currentIndex = rarityOrder.indexOf(rarity);
            if (currentIndex < rarityOrder.length - 1) {
                return this.getRandomHero(rarityOrder[currentIndex + 1]);
            }
            return null;
        }
        return Utils.randomChoice(heroes);
    },

    // 抽卡逻辑
    pull(poolId, count = 1, useTicket = false) {
        const pool = this.pools[poolId];
        if (!pool) {
            throw new Error('未知的抽卡池');
        }

        const results = [];
        let guaranteedCount = 0;

        for (let i = 0; i < count; i++) {
            let rarity;
            guaranteedCount++;

            // 保底逻辑
            if (guaranteedCount >= pool.guaranteed.count) {
                rarity = pool.guaranteed.type;
                guaranteedCount = 0;
            } else {
                // 随机稀有度
                rarity = this.randomRarity(pool.rates);
            }

            const hero = this.getRandomHero(rarity);
            if (hero) {
                results.push({
                    type: 'hero',
                    data: hero,
                    rarity: rarity
                });
            }
        }

        return results;
    },

    // 随机稀有度
    randomRarity(rates) {
        const random = Math.random();
        let cumulative = 0;

        // 从高稀有度开始判断
        const rarityOrder = ['legendary', 'epic', 'rare', 'common'];
        for (const rarity of rarityOrder) {
            cumulative += rates[rarity];
            if (random < cumulative) {
                return rarity;
            }
        }

        return 'common';
    },

    // 获取抽卡池配置
    getPoolConfig(poolId) {
        return this.pools[poolId];
    },

    // 获取所有抽卡池
    getAllPools() {
        return Object.values(this.pools);
    },

    // 计算抽卡费用
    calculateCost(poolId, count, useTicket = false) {
        const pool = this.getPoolConfig(poolId);
        if (!pool) return null;

        const costType = useTicket ? 'ticket' : 'gold';
        const costs = pool.costs[costType];

        if (count === 10) {
            return costs.ten;
        } else {
            return costs.single * count;
        }
    }
};

// 暴露到全局
window.GachaConfig = GachaConfig;
