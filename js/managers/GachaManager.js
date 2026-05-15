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

    getTicketConfig(poolId, count) {
        const ticketMap = {
            hero_pool: {
                1: 'hero_summon',
                10: 'hero_recruit_ten_ticket'
            },
            equipment_pool: {
                1: 'weapon_forge_ticket',
                10: 'weapon_forge_ten_ticket'
            }
        };
        const itemId = ticketMap[poolId]?.[count === 10 ? 10 : 1] || null;
        const itemConfig = itemId ? ItemConfig.getItemConfig(itemId) : null;
        if (!itemId || !itemConfig) {
            return null;
        }
        return {
            type: 'item',
            itemId,
            amount: 1,
            name: itemConfig.name,
            icon: itemConfig.icon,
            iconSrc: itemConfig.iconSrc || null,
            rarity: itemConfig.rarity || 'common',
            owned: itemManager.getItemCount(itemId)
        };
    }

    getPaymentOption(poolIdOrCount, countMaybe) {
        const poolId = typeof countMaybe === 'number' ? poolIdOrCount : this.currentPool;
        const count = typeof countMaybe === 'number' ? countMaybe : poolIdOrCount;
        const ticket = this.getTicketConfig(poolId, count);
        if (ticket && ticket.owned >= ticket.amount) {
            return ticket;
        }

        const cost = this.calculateCost(poolId, count);
        return cost ? { ...cost, paymentType: 'resource' } : null;
    }

    hasEnoughPayment(payment) {
        if (!payment) {
            return false;
        }
        if (payment.type === 'item') {
            return itemManager.getItemCount(payment.itemId) >= payment.amount;
        }
        return shelterManager.getResource(payment.type) >= payment.amount;
    }

    consumePayment(payment) {
        if (!payment) {
            return false;
        }
        if (payment.type === 'item') {
            return itemManager.removeItem(payment.itemId, payment.amount);
        }
        return shelterManager.consumeResource(payment.type, payment.amount);
    }

    canAcceptResults(results = []) {
        const itemEntries = [];
        let equipmentCount = 0;

        (Array.isArray(results) ? results : []).forEach(result => {
            if (result?.type === 'item') {
                const itemConfig = ItemConfig.getItemConfig(result.itemId);
                if (itemConfig?.type !== 'fragment') {
                    itemEntries.push({ id: result.itemId, count: result.count || 1 });
                }
            }
            if (result?.type === 'equipment') {
                equipmentCount += 1;
            }
        });

        const itemCheck = itemManager.canAddItemBundle(itemEntries);
        if (!itemCheck.success) {
            return itemCheck;
        }
        if (equipmentCount > 0) {
            return itemManager.canAddEquipment(equipmentCount);
        }
        return { success: true };
    }

    getPaymentLabel(payment) {
        if (!payment) {
            return '资源';
        }
        if (payment.type === 'item') {
            return payment.name || ItemConfig.getItemConfig(payment.itemId)?.name || '招募券';
        }
        return shelterManager.getResourceInfo(payment.type)?.name || payment.type;
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

        const cost = this.getPaymentOption(poolId, count);
        const costLabel = this.getPaymentLabel(cost);
        if (!cost || !this.hasEnoughPayment(cost)) {
            return { success: false, message: `${costLabel}不足，需要 ${cost?.amount || 0}` };
        }

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

        const inventoryCheck = this.canAcceptResults(results);
        if (!inventoryCheck.success) {
            return { success: false, message: inventoryCheck.message || '背包容量达到上限' };
        }

        if (!this.consumePayment(cost)) {
            return { success: false, message: `${costLabel}不足，需要 ${cost?.amount || 0}` };
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
                const itemConfig = ItemConfig.getItemConfig(result.itemId);
                if (itemConfig?.type === 'fragment') {
                    const heroConfigId = itemConfig.fragmentHeroId || String(result.itemId || '').replace(/_fragment$/, '');
                    heroManager.addFragments(heroConfigId, result.count);
                    rewards.push(RewardModal.createFragmentReward(heroConfigId, result.count));
                    return;
                }
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
