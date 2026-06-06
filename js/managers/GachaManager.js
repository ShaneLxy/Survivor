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
        // 保底:每池单独计数，连续未出史诗的次数；满 50 时强制出一发史诗
        this.PITY_THRESHOLD = 50;
        this.pityCounters = { hero_pool: 0, equipment_pool: 0 };
        GachaManager.instance = this;
    }

    init(savedData) {
        this.currentPool = 'hero_pool';
        this.pityCounters = { hero_pool: 0, equipment_pool: 0 };
        if (savedData && typeof savedData === 'object') {
            if (savedData.currentPool && GachaConfig.getPoolConfig(savedData.currentPool)) {
                this.currentPool = savedData.currentPool;
            }
            if (savedData.pityCounters && typeof savedData.pityCounters === 'object') {
                Object.keys(this.pityCounters).forEach((poolId) => {
                    const val = Number(savedData.pityCounters[poolId]);
                    if (Number.isFinite(val) && val >= 0) {
                        this.pityCounters[poolId] = Math.min(Math.floor(val), this.PITY_THRESHOLD);
                    }
                });
            }
        }
        this.poolValidationReport = GachaConfig.validatePools?.() || null;
    }

    getPityState(poolId = this.currentPool) {
        const current = this.pityCounters[poolId] || 0;
        const threshold = this.PITY_THRESHOLD;
        return {
            poolId,
            current,
            threshold,
            remaining: Math.max(0, threshold - current),
            percent: Math.min(100, (current / threshold) * 100)
        };
    }

    _isEpicOrAbove(rarity) {
        return rarity === 'epic' || rarity === 'legendary';
    }

    /**
     * 保底判定：仅
     *  - 英雄池(hero_pool) 命中"史诗或更高的完整英雄(type='hero')"算数；史诗碎片/史诗道具不算
     *  - 装备池(equipment_pool) 命中"史诗或更高品质的装备(type='equipment')"算数；史诗道具不算
     */
    _isPityHittingReward(poolId, reward) {
        if (!reward) return false;
        if (!this._isEpicOrAbove(reward.rarity)) return false;
        if (poolId === 'hero_pool') {
            return reward.type === 'hero';
        }
        if (poolId === 'equipment_pool') {
            return reward.type === 'equipment';
        }
        return false;
    }

    _bumpPity(poolId, reward) {
        if (!this.pityCounters.hasOwnProperty(poolId)) {
            return;
        }
        if (this._isPityHittingReward(poolId, reward)) {
            this.pityCounters[poolId] = 0;
        } else {
            this.pityCounters[poolId] = Math.min(this.PITY_THRESHOLD, (this.pityCounters[poolId] || 0) + 1);
        }
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

        // 失败回滚保护：先记录原 pity，后续如果库存/扣费失败需还原
        const pityBackup = this.pityCounters[poolId] || 0;
        const results = [];
        const pityTriggered = [];
        for (let index = 0; index < count; index++) {
            const currentPity = this.pityCounters[poolId] || 0;
            let reward = this.drawRewardWithRetry(poolId);
            const wouldHitPity = currentPity + 1 >= this.PITY_THRESHOLD;
            const isAlreadyPityHitting = this._isPityHittingReward(poolId, reward);

            if (wouldHitPity && !isAlreadyPityHitting) {
                const forced = GachaConfig.createForcedEpicResult?.(poolId);
                if (forced) {
                    reward = forced;
                    pityTriggered.push(index);
                }
            }

            if (reward) {
                results.push(reward);
                this._bumpPity(poolId, reward);
            }
        }

        if (results.length !== count) {
            console.error(`[GachaManager] Pull count mismatch for ${poolId}: expected ${count}, got ${results.length}.`);
        }

        const inventoryCheck = this.canAcceptResults(results);
        if (!inventoryCheck.success) {
            this.pityCounters[poolId] = pityBackup; // 回滚保底进度
            return { success: false, message: inventoryCheck.message || '背包容量达到上限' };
        }

        if (!this.consumePayment(cost)) {
            this.pityCounters[poolId] = pityBackup; // 回滚保底进度
            return { success: false, message: `${costLabel}不足，需要 ${cost?.amount || 0}` };
        }

        eventManager.emit('gachaPull', { poolId, results, cost, pityTriggered });
        return { success: true, poolId, results, cost, pityTriggered, pityState: this.getPityState(poolId) };
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
            currentPool: this.currentPool,
            pityCounters: { ...this.pityCounters }
        };
    }
}

const gachaManager = new GachaManager();
window.gachaManager = gachaManager;
