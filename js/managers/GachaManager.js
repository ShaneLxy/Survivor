/**
 * 招募 / 打造管理器 - 单例模式
 */
class GachaManager {
    constructor() {
        if (GachaManager.instance) {
            return GachaManager.instance;
        }
        this.currentPool = 'hero_pool';
        this.poolValidationReport = null;
        GachaManager.instance = this;
    }

    init() {
        this.currentPool = 'hero_pool';
        this.poolValidationReport = GachaConfig.validatePools?.() || null;
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

    drawRewardWithRetry(poolId, maxAttempts = 20) {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const reward = GachaConfig.createPullResult(poolId);
            if (reward) {
                return reward;
            }
        }

        console.error(`[GachaManager] Failed to generate reward after ${maxAttempts} attempts for pool ${poolId}.`);
        return null;
    }

    pull(poolIdOrCount = 1, countMaybe) {
        const poolId = typeof countMaybe === 'number' ? poolIdOrCount : this.currentPool;
        const count = typeof countMaybe === 'number' ? countMaybe : poolIdOrCount;
        const pool = this.getPoolConfig(poolId);
        if (!pool) {
            return { success: false, message: '未知招募池' };
        }

        const cost = this.calculateCost(poolId, count);
        const resourceType = cost?.type || 'gold';
        const resourceLabel = shelterManager.getResourceInfo(resourceType)?.name || resourceType;
        if (!cost || shelterManager.getResource(resourceType) < cost.amount) {
            return { success: false, message: `${resourceLabel}不足，需要 ${cost?.amount || 0}` };
        }

        shelterManager.consumeResource(resourceType, cost.amount);
        const results = [];
        for (let index = 0; index < count; index++) {
            const reward = this.drawRewardWithRetry(poolId);
            if (reward) {
                results.push(reward);
            }
        }

        if (results.length !== count) {
            console.error(`[GachaManager] Pull count mismatch for ${poolId}: expected ${count}, got ${results.length}.`);
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
                        description: `重复英雄自动转化为 ${fragmentCount} 个 ${config?.name || '该英雄'} 碎片`
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
        return 50;
    }

    getSaveData() {
        return {
            currentPool: this.currentPool
        };
    }
}

const gachaManager = new GachaManager();
window.gachaManager = gachaManager;
