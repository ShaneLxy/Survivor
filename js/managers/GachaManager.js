/**
 * 招募/打造管理器 - 单例模式
 */
class GachaManager {
    constructor() {
        if (GachaManager.instance) {
            return GachaManager.instance;
        }
        this.currentPool = 'hero_pool';
        this.guaranteedCounters = {
            hero_pool: 0,
            equipment_pool: 0
        };
        GachaManager.instance = this;
    }

    init(saveData) {
        const defaultCounters = { hero_pool: 0, equipment_pool: 0 };
        if (saveData?.guaranteedCounters) {
            this.guaranteedCounters = {
                ...defaultCounters,
                ...saveData.guaranteedCounters
            };
            return;
        }
        if (typeof saveData?.guaranteedCounter === 'number') {
            this.guaranteedCounters = {
                ...defaultCounters,
                hero_pool: saveData.guaranteedCounter
            };
            return;
        }
        this.guaranteedCounters = defaultCounters;
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
            const currentCounter = Number(this.guaranteedCounters[poolId]) || 0;
            let rarity;
            if (currentCounter + 1 >= pool.guaranteed.count) {
                rarity = pool.guaranteed.type;
                this.guaranteedCounters[poolId] = 0;
            } else {
                rarity = GachaConfig.randomRarity(pool.rates);
                this.guaranteedCounters[poolId] = currentCounter + 1;
            }

            if (pool.type === 'hero') {
                const heroConfig = GachaConfig.getRandomHero(rarity);
                if (heroConfig) {
                    results.push({ type: 'hero', poolId, rarity, configId: heroConfig.id, name: heroConfig.name, icon: heroConfig.icon });
                }
                continue;
            }

            if (pool.type === 'equipment') {
                const equipment = EquipmentConfig.createRandomEquipment(rarity);
                if (equipment) {
                    results.push({ type: 'equipment', poolId, rarity, equipment });
                }
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
            guaranteedCounters: { ...this.guaranteedCounters }
        };
    }
}

const gachaManager = new GachaManager();
window.gachaManager = gachaManager;
