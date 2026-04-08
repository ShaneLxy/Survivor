/**
 * 招募/打造管理器 - 单例模式
 */
class GachaManager {
    constructor() {
        if (GachaManager.instance) {
            return GachaManager.instance;
        }
        this.currentPool = 'hero_pool';
        GachaManager.instance = this;
    }

    init() {
        this.currentPool = 'hero_pool';
    }

    setPool(poolId) {
        if (GachaConfig.getPoolConfig(poolId)) {
            this.currentPool = poolId;
        }
    }

    getPoolConfig(poolId = this.currentPool) {
        return GachaConfig.getPoolConfig(poolId);
    }

    calculateCost(poolIdOrCount, countMaybe) {
        const poolId = typeof countMaybe === 'number' ? poolIdOrCount : this.currentPool;
        const count = typeof countMaybe === 'number' ? countMaybe : poolIdOrCount;
        return GachaConfig.calculateCost(poolId, count);
    }

    pull(poolIdOrCount = 1, countMaybe) {
        const poolId = typeof countMaybe === 'number' ? poolIdOrCount : this.currentPool;
        const count = typeof countMaybe === 'number' ? countMaybe : poolIdOrCount;
        const pool = this.getPoolConfig(poolId);
        if (!pool) {
            return { success: false, message: '未知招募池' };
        }

        const cost = this.calculateCost(poolId, count);
        if (!cost || shelterManager.getResource('gold') < cost.amount) {
            return { success: false, message: `金币不足,需要 ${cost?.amount || 0}` };
        }

        shelterManager.consumeResource('gold', cost.amount);
        const results = [];
        for (let index = 0; index < count; index++) {
            const reward = GachaConfig.createPullResult(poolId);
            if (reward) {
                results.push(reward);
            }
        }

        eventManager.emit('gachaPull', { poolId, results, cost });
        return { success: true, poolId, results, cost };
    }

    addResults(results) {
        const rewards = [];
        const addedHeroes = [];
        const addedEquipment = [];

        (results || []).forEach(result => {
            if (result.type === 'resource') {
                shelterManager.addResource(result.resourceId, result.count);
                rewards.push(RewardModal.createResourceReward(result.resourceId, result.count));
                return;
            }

            if (result.type === 'item') {
                itemManager.addItem(result.itemId, result.count);
                rewards.push(RewardModal.createItemReward(result.itemId, result.count));
                return;
            }

            if (result.type === 'fragment') {
                heroManager.addFragments(result.configId, result.count);
                rewards.push(RewardModal.createFragmentReward(result.configId, result.count));
                return;
            }

            if (result.type === 'hero') {
                const config = HeroConfig.getHeroConfig(result.configId);
                const hasHero = heroManager.getAllHeroes().some(hero => hero.configId === result.configId);
                if (config && !hasHero) {
                    const hero = new Hero(config, 1);
                    heroManager.addHero(hero);
                    addedHeroes.push(hero);
                    rewards.push(RewardModal.createHeroReward(result.configId));
                } else {
                    const fragmentCount = this.calculateDuplicateReward(result.rarity);
                    heroManager.addFragments(result.configId, fragmentCount);
                    rewards.push(RewardModal.createFragmentReward(result.configId, fragmentCount, {
                        description: `重复英雄自动转化为 ${fragmentCount} 个 ${config?.name || '该英雄'}碎片`
                    }));
                }
                return;
            }

            if (result.type === 'equipment' && result.equipment) {
                itemManager.addEquipment(result.equipment);
                addedEquipment.push(result.equipment);
                rewards.push(RewardModal.createEquipmentReward(result.equipment));
            }
        });

        return { rewards, addedHeroes, addedEquipment };
    }

    calculateDuplicateReward(rarity) {
        const rewards = {
            common: 50,
            rare: 150,
            epic: 400,
            legendary: 1000
        };
        return rewards[rarity] || 50;
    }

    getSaveData() {
        return {
            currentPool: this.currentPool
        };
    }
}

const gachaManager = new GachaManager();
window.gachaManager = gachaManager;
