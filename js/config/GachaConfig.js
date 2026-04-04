/**
 * 招募/打造配置
 */
const GachaConfig = {
    pools: {
        hero_pool: {
            id: 'hero_pool',
            type: 'hero',
            name: '招募英雄',
            description: '招募随机英雄加入队伍',
            icon: '🦸',
            rates: {
                legendary: 0.005,
                epic: 0.04,
                rare: 0.255,
                common: 0.7
            },
            costs: {
                gold: { single: 100, ten: 900 }
            },
            guaranteed: {
                type: 'epic',
                count: 10
            }
        },
        equipment_pool: {
            id: 'equipment_pool',
            type: 'equipment',
            name: '打造装备',
            description: '打造随机品质与词条的装备',
            icon: '🛠️',
            rates: {
                legendary: 0.02,
                epic: 0.12,
                rare: 0.3,
                common: 0.56
            },
            costs: {
                gold: { single: 120, ten: 1080 }
            },
            guaranteed: {
                type: 'rare',
                count: 10
            }
        }
    },

    getPoolConfig(poolId) {
        return this.pools[poolId] || null;
    },

    getAllPools() {
        return Object.values(this.pools);
    },

    randomRarity(rates) {
        const random = Math.random();
        let cumulative = 0;
        for (const rarity of ['legendary', 'epic', 'rare', 'common']) {
            cumulative += Number(rates?.[rarity]) || 0;
            if (random < cumulative) {
                return rarity;
            }
        }
        return 'common';
    },

    getRandomHero(rarity) {
        const heroes = HeroConfig.getHeroesByRarity(rarity);
        if (heroes.length === 0) {
            const rarityOrder = ['legendary', 'epic', 'rare', 'common'];
            const currentIndex = rarityOrder.indexOf(rarity);
            if (currentIndex >= 0 && currentIndex < rarityOrder.length - 1) {
                return this.getRandomHero(rarityOrder[currentIndex + 1]);
            }
            return null;
        }
        return Utils.randomChoice(heroes);
    },

    calculateCost(poolId, count) {
        const pool = this.getPoolConfig(poolId);
        if (!pool) {
            return null;
        }
        const key = count === 10 ? 'ten' : 'single';
        return {
            type: 'gold',
            amount: pool.costs.gold[key] || 0
        };
    }
};

window.GachaConfig = GachaConfig;
