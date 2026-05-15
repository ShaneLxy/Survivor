/**
 * 閬撳叿绠＄悊鍣?- 鍗曚緥妯″紡
 */
class ItemManager {
    constructor() {
        if (ItemManager.instance) {
            return ItemManager.instance;
        }
        this.items = [];
        this.equipmentItems = [];
        this.maxItemSlots = 1024;
        this.maxEquipmentSlots = 1024;
        this.maxSlots = this.maxItemSlots + this.maxEquipmentSlots;
        ItemManager.instance = this;
    }

    init(saveData) {
        this.items = [];
        this.equipmentItems = [];

        const normalized = this.normalizeSaveData(saveData);
        if (normalized.items.length > 0 || normalized.equipment.length > 0 || Object.keys(normalized.migratedResources).length > 0) {
            Object.entries(normalized.migratedResources).forEach(([resourceId, count]) => {
                if ((Number(count) || 0) > 0) {
                    shelterManager.addResource(resourceId, count);
                }
            });

            normalized.items.forEach(itemData => {
                const config = ItemConfig.getItemConfig(itemData.id);
                if (!config) {
                    return;
                }
                this.items.push(new Item(config, itemData.count));
            });

            normalized.equipment.forEach(equipmentData => {
                const equipment = Equipment.fromSaveData(equipmentData);
                if (equipment) {
                    this.equipmentItems.push(equipment);
                }
            });
        } else {
            this.addInitialItems();
        }
    }

    getLegacyResourceMigration(entry) {
        const legacyMap = {
            wood: { type: 'resource', id: 'wood' },
            stone: { type: 'resource', id: 'stone' },
            meat: { type: 'resource', id: 'meat' },
            water: { type: 'item', id: 'exp_potion' },
            gold_ore: { type: 'resource', id: 'iron_ore' },
            iron_ore: { type: 'resource', id: 'iron_ore' },
            diamond: { type: 'resource', id: 'diamond' }
        };
        return legacyMap[entry?.id] || null;
    }

    normalizeSaveData(saveData) {
        const normalized = {
            items: [],
            equipment: [],
            migratedResources: {}
        };

        if (!saveData) {
            return normalized;
        }

        const pushMigration = (migration, count) => {
            const value = Math.max(0, Number(count) || 0);
            if (value <= 0 || !migration) {
                return;
            }
            if (migration.type === 'resource') {
                normalized.migratedResources[migration.id] = (normalized.migratedResources[migration.id] || 0) + value;
                return;
            }
            normalized.items.push({ id: migration.id, count: value });
        };

        if (Array.isArray(saveData)) {
            saveData.forEach(entry => {
                const migration = this.getLegacyResourceMigration(entry);
                if (migration) {
                    pushMigration(migration, entry.count);
                    return;
                }
                const config = ItemConfig.getItemConfig(entry.id);
                if (!config) {
                    return;
                }
                if (this.isLegacyEquipmentConfig(config)) {
                    const count = Math.max(1, Number(entry.count) || 1);
                    for (let index = 0; index < count; index++) {
                        const legacyEquipment = EquipmentConfig.createLegacyEquipment(config);
                        if (legacyEquipment) {
                            normalized.equipment.push(legacyEquipment.getSaveData());
                        }
                    }
                    return;
                }
                const stackLimit = Math.max(1, ItemConfig.getStackLimit(entry.id));
                this.splitStackCounts(entry.count, stackLimit).forEach(stackCount => {
                    normalized.items.push({ id: entry.id, count: stackCount });
                });
            });
            return normalized;
        }

        (Array.isArray(saveData.items) ? saveData.items : []).forEach(entry => {
            const migration = this.getLegacyResourceMigration(entry);
            if (migration) {
                pushMigration(migration, entry.count);
                return;
            }
            const stackLimit = Math.max(1, ItemConfig.getStackLimit(entry.id));
            this.splitStackCounts(entry.count, stackLimit).forEach(stackCount => {
                normalized.items.push({ id: entry.id, count: stackCount });
            });
        });
        normalized.equipment = Array.isArray(saveData.equipment) ? saveData.equipment : [];
        return normalized;
    }

    isLegacyEquipmentConfig(config) {
        return config && ['weapon', 'armor'].includes(config.type);
    }

    addInitialItems() {
        [{ id: 'medicine', count: 3 }].forEach(item => this.addItem(item.id, item.count));
    }

    splitStackCounts(totalCount, stackLimit) {
        const remainingTotal = Math.max(0, Number(totalCount) || 0);
        const limit = Math.max(1, Number(stackLimit) || 1);
        if (remainingTotal <= 0) {
            return [];
        }

        const groups = [];
        let remaining = remainingTotal;
        while (remaining > 0) {
            const current = Math.min(limit, remaining);
            groups.push(current);
            remaining -= current;
        }
        return groups;
    }

    getItemsById(itemId) {
        return this.items.filter(item => item.id === itemId);
    }

    getItemCount(itemId) {
        return this.getItemsById(itemId).reduce((total, item) => total + (Number(item.count) || 0), 0);
    }

    getUsedItemSlots() {
        return this.items.length;
    }

    getUsedEquipmentSlots() {
        return this.equipmentItems.length;
    }

    getRemainingItemSlots() {
        return Math.max(0, this.maxItemSlots - this.getUsedItemSlots());
    }

    getRemainingEquipmentSlots() {
        return Math.max(0, this.maxEquipmentSlots - this.getUsedEquipmentSlots());
    }

    getCapacityLimitMessage() {
        return '背包容量达到上限';
    }

    getRequiredItemSlots(itemId, count = 1) {
        const config = ItemConfig.getItemConfig(itemId);
        if (!config || this.isLegacyEquipmentConfig(config)) {
            return Infinity;
        }

        let remaining = Math.max(0, Number(count) || 0);
        if (remaining <= 0) {
            return 0;
        }

        const stackLimit = Math.max(1, Number(config.stackLimit) || 1);
        if (stackLimit > 1) {
            this.items
                .filter(item => item.id === itemId && item.count < item.stackLimit)
                .forEach(item => {
                    if (remaining <= 0) {
                        return;
                    }
                    remaining -= Math.min(remaining, Math.max(0, item.stackLimit - item.count));
                });
        }

        return Math.ceil(Math.max(0, remaining) / stackLimit);
    }

    canAddItem(itemId, count = 1) {
        const config = ItemConfig.getItemConfig(itemId);
        if (!config || this.isLegacyEquipmentConfig(config)) {
            return { success: false, message: '道具不存在' };
        }

        const amount = Math.max(0, Number(count) || 0);
        if (amount <= 0) {
            return { success: false, message: '道具数量无效' };
        }

        const requiredSlots = this.getRequiredItemSlots(itemId, amount);
        const availableSlots = this.getRemainingItemSlots();
        if (requiredSlots > availableSlots) {
            return { success: false, message: this.getCapacityLimitMessage(), requiredSlots, availableSlots };
        }

        return { success: true, requiredSlots, availableSlots };
    }

    canAddItemBundle(entries = []) {
        const aggregated = new Map();
        (Array.isArray(entries) ? entries : []).forEach(entry => {
            const itemId = entry?.id || entry?.itemId;
            const count = Math.max(0, Number(entry?.count ?? entry?.amount) || 0);
            if (!itemId || count <= 0) {
                return;
            }
            const config = ItemConfig.getItemConfig(itemId);
            if (!config || this.isLegacyEquipmentConfig(config)) {
                return;
            }
            aggregated.set(itemId, (aggregated.get(itemId) || 0) + count);
        });

        let requiredSlots = 0;
        aggregated.forEach((count, itemId) => {
            requiredSlots += this.getRequiredItemSlots(itemId, count);
        });

        const availableSlots = this.getRemainingItemSlots();
        if (requiredSlots > availableSlots) {
            return { success: false, message: this.getCapacityLimitMessage(), requiredSlots, availableSlots };
        }

        return { success: true, requiredSlots, availableSlots };
    }

    canAddEquipment(count = 1) {
        const amount = Math.max(0, Number(count) || 0);
        if (amount <= 0) {
            return { success: false, message: '装备数量无效' };
        }

        const availableSlots = this.getRemainingEquipmentSlots();
        if (amount > availableSlots) {
            return { success: false, message: this.getCapacityLimitMessage(), requiredSlots: amount, availableSlots };
        }

        return { success: true, requiredSlots: amount, availableSlots };
    }

    getAddableItemCount(itemId, count = 1) {
        const config = ItemConfig.getItemConfig(itemId);
        if (!config || this.isLegacyEquipmentConfig(config)) {
            return 0;
        }

        let capacity = 0;
        const stackLimit = Math.max(1, Number(config.stackLimit) || 1);
        if (stackLimit > 1) {
            this.items
                .filter(item => item.id === itemId && item.count < item.stackLimit)
                .forEach(item => {
                    capacity += Math.max(0, item.stackLimit - item.count);
                });
        }
        capacity += this.getRemainingItemSlots() * stackLimit;
        return Math.min(Math.max(0, Number(count) || 0), capacity);
    }

    addItem(itemId, count = 1) {
        const config = ItemConfig.getItemConfig(itemId);
        if (!config || this.isLegacyEquipmentConfig(config)) {
            return false;
        }

        let remaining = Math.max(0, Number(count) || 0);
        if (remaining <= 0) {
            return false;
        }

        if (!this.canAddItem(itemId, remaining).success) {
            return false;
        }

        let addedTotal = 0;
        if (config.stackLimit > 1) {
            this.items
                .filter(item => item.id === itemId && item.count < item.stackLimit)
                .forEach(item => {
                    if (remaining <= 0) {
                        return;
                    }
                    const added = item.addCount(remaining);
                    remaining -= added;
                    addedTotal += added;
                });
        }

        while (remaining > 0) {
            if (this.getUsedItemSlots() >= this.maxItemSlots) {
                break;
            }
            const stackCount = Math.min(config.stackLimit || 1, remaining);
            const item = new Item(config, stackCount);
            this.items.push(item);
            remaining -= stackCount;
            addedTotal += stackCount;
        }

        if (addedTotal > 0) {
            eventManager.emit('itemAdd', { itemId, count: addedTotal });
            return true;
        }
        return false;
    }

    addEquipment(equipment) {
        if (!(equipment instanceof Equipment)) {
            equipment = Equipment.fromSaveData(equipment);
        }
        if (!equipment || !this.canAddEquipment(1).success) {
            return false;
        }
        this.equipmentItems.push(equipment);
        eventManager.emit('equipmentAdd', { equipment });
        eventManager.emit('itemAdd', { item: equipment, count: 1 });
        return true;
    }

    getUsedSlots() {
        return this.items.length + this.equipmentItems.length;
    }

    removeItem(itemId, count = 1) {
        let remaining = Math.max(0, Number(count) || 0);
        if (remaining <= 0) {
            return false;
        }

        if (this.getItemCount(itemId) < remaining) {
            return false;
        }

        const targetStacks = [...this.getItemsById(itemId)].sort((a, b) => (Number(a.count) || 0) - (Number(b.count) || 0));
        targetStacks.forEach(item => {
            if (remaining <= 0) {
                return;
            }
            const removable = Math.min(item.count, remaining);
            item.removeCount(removable);
            remaining -= removable;
            if (item.isEmpty()) {
                this.items = this.items.filter(entry => entry !== item);
            }
        });

        if (remaining > 0) {
            return false;
        }
        eventManager.emit('itemRemove', { itemId, count });
        return true;
    }

    removeEquipment(instanceId) {
        const index = this.equipmentItems.findIndex(item => item.instanceId === instanceId);
        if (index === -1) {
            return null;
        }
        const [equipment] = this.equipmentItems.splice(index, 1);
        eventManager.emit('equipmentRemove', { equipment });
        eventManager.emit('itemRemove', { itemId: instanceId, count: 1 });
        return equipment;
    }

    getItem(itemId) {
        return this.items.find(item => item.id === itemId) || null;
    }

    getEquipment(instanceId) {
        return this.equipmentItems.find(item => item.instanceId === instanceId) || null;
    }

    getEquipmentReference(instanceId) {
        const bagEquipment = this.getEquipment(instanceId);
        if (bagEquipment) {
            return { equipment: bagEquipment, location: 'bag', hero: null, slot: bagEquipment.slot };
        }

        const heroes = heroManager.getAllHeroes();
        for (const hero of heroes) {
            for (const [slot, equipment] of Object.entries(hero.equipment || {})) {
                if (equipment?.instanceId === instanceId) {
                    return { equipment, location: 'hero', hero, slot };
                }
            }
        }
        return null;
    }

    resolveEquipmentTarget(target) {
        if (!target) {
            return null;
        }
        if (target instanceof Equipment) {
            return this.getEquipmentReference(target.instanceId) || { equipment: target, location: 'unknown', hero: null, slot: target.slot };
        }
        if (typeof target === 'string') {
            return this.getEquipmentReference(target);
        }
        if (target.instanceId) {
            return this.getEquipmentReference(target.instanceId);
        }
        return null;
    }

    getAllItems() {
        return [...this.items].sort((left, right) => this.compareItems(left, right));
    }

    getAllEquipment() {
        return [...this.equipmentItems].sort((left, right) => this.compareEquipment(left, right));
    }

    getItemsByType(type) {
        return this.items.filter(item => item.type === type);
    }

    getEquipmentBySlot(slot) {
        return this.equipmentItems.filter(item => item.slot === slot);
    }

    getDisplayInventory(category = 'item') {
        if (category === 'equipment') {
            return this.getAllEquipment();
        }
        return this.getAllItems();
    }

    getItemRarityRank(rarity) {
        const rarityOrder = {
            legendary: 5,
            epic: 4,
            rare: 3,
            uncommon: 2,
            common: 1
        };
        return rarityOrder[String(rarity || '').toLowerCase()] || 0;
    }

    getItemTypeRank(type) {
        const typeOrder = {
            special: 6,
            consumable: 5,
            material: 4,
            quest: 3,
            fragment: 2,
            misc: 1
        };
        return typeOrder[String(type || '').toLowerCase()] || 0;
    }

    getEquipmentSortScore(equipment) {
        const stats = equipment?.stats || {};
        const score =
            (Number(stats.hp) || 0) +
            (Number(stats.attack) || 0) * 12 +
            (Number(stats.defense) || 0) * 10 +
            (Number(stats.speed) || 0) * 15 +
            (Number(stats.crit) || 0) * 18 +
            (Number(stats.antiCrit) || 0) * 14 +
            (Number(stats.defensePen) || 0) * 16 +
            (Number(stats.accuracy) || 0) * 12 +
            (Number(stats.dodge) || 0) * 12 +
            (Number(stats.attackRange) || 0) * 20 +
            (Number(stats.moveRange) || 0) * 18;
        return Math.round(score);
    }

    compareItems(left, right) {
        const rarityDiff = this.getItemRarityRank(right?.rarity) - this.getItemRarityRank(left?.rarity);
        if (rarityDiff !== 0) {
            return rarityDiff;
        }

        const nameCompare = String(left?.name || '').localeCompare(String(right?.name || ''), 'zh-CN');
        if (nameCompare !== 0) {
            return nameCompare;
        }

        const typeDiff = this.getItemTypeRank(right?.type) - this.getItemTypeRank(left?.type);
        if (typeDiff !== 0) {
            return typeDiff;
        }

        const countDiff = (Number(right?.count) || 0) - (Number(left?.count) || 0);
        if (countDiff !== 0) {
            return countDiff;
        }

        return String(left?.id || '').localeCompare(String(right?.id || ''), 'en');
    }

    compareEquipment(left, right) {
        const rarityDiff = this.getItemRarityRank(right?.rarity) - this.getItemRarityRank(left?.rarity);
        if (rarityDiff !== 0) {
            return rarityDiff;
        }

        const nameCompare = String(left?.name || '').localeCompare(String(right?.name || ''), 'zh-CN');
        if (nameCompare !== 0) {
            return nameCompare;
        }

        const scoreDiff = this.getEquipmentSortScore(right) - this.getEquipmentSortScore(left);
        if (scoreDiff !== 0) {
            return scoreDiff;
        }

        const starDiff = (Number(right?.starLevel) || 0) - (Number(left?.starLevel) || 0);
        if (starDiff !== 0) {
            return starDiff;
        }

        const enhanceDiff = (Number(right?.enhanceLevel) || 0) - (Number(left?.enhanceLevel) || 0);
        if (enhanceDiff !== 0) {
            return enhanceDiff;
        }

        const slotDiff = String(left?.slot || '').localeCompare(String(right?.slot || ''), 'en');
        if (slotDiff !== 0) {
            return slotDiff;
        }

        return String(left?.instanceId || '').localeCompare(String(right?.instanceId || ''), 'en');
    }

    useItem(itemId, target, options = {}) {
        const item = this.getItem(itemId);
        const totalCount = this.getItemCount(itemId);
        if (!item || totalCount <= 0) {
            return { success: false, message: '道具不存在' };
        }

        if (item.effect?.type === 'hero_exp') {
            const hero = target?.id ? heroManager.getHero(target.id) || target : heroManager.getHero(target?.heroId || target);
            if (!hero) {
                return { success: false, message: '请选择要使用经验药水的英雄' };
            }
            const requestedCount = Math.max(1, Number(options.quantity) || 1);
            const actualCount = Math.min(requestedCount, totalCount);
            if (actualCount <= 0) {
                return { success: false, message: '经验药水数量不足' };
            }
            const expValue = Math.max(1, Number(item.effect.value) || 1);
            const totalExp = actualCount * expValue;
            const expResult = heroManager.addHeroExp(hero.id, totalExp, { maxLevel: window.game.player.level, source: 'manual_item' });
            if (!expResult.success) {
                return { success: false, message: expResult.reason === 'level_cap' ? '等级已达到当前星级上限！' : '英雄无法获得经验' };
            }
            this.removeItem(itemId, actualCount);
            eventManager.emit('itemUse', { item, target: hero, result: expResult, quantity: actualCount });
            return {
                success: true,
                message: `${hero.name} 获得 ${totalExp} 点经验`,
                effect: { type: 'hero_exp', value: totalExp },
                hero,
                quantity: actualCount
            };
        }

        const result = item.use(target, options);
        if (result.success) {
            if (result.effect?.type === 'energy') {
                window.game.player.energy = Math.min(window.game.player.maxEnergy, window.game.player.energy + result.effect.value);
                eventManager.emit('playerUpdate', {
                    energy: window.game.player.energy,
                    maxEnergy: window.game.player.maxEnergy
                });
            }
            if (item.isEmpty()) {
                this.items = this.items.filter(entry => entry !== item);
            }
            eventManager.emit('itemUse', { item, target, result });
        }
        return result;
    }

    getEquipmentEnhanceInfo(target) {
        const resolved = this.resolveEquipmentTarget(target);
        if (!resolved?.equipment) {
            return { success: false, message: '装备不存在' };
        }

        const equipment = resolved.equipment;
        const maxLevel = Math.max(0, (Number(window.game?.player?.level) || 1) * 5);
        const nextLevel = equipment.enhanceLevel + 1;
        const cost = EquipmentConfig.getEnhanceCost(equipment.rarity, nextLevel);
        const successRate = EquipmentConfig.getEnhanceSuccessRate(equipment.rarity, equipment.enhanceLevel);
        const preview = equipment.getNextEnhancePreview();
        const enoughGold = shelterManager.getResource('gold') >= cost.gold;
        const enoughIronOre = shelterManager.getResource('iron_ore') >= cost.iron_ore;
        const canEnhance = equipment.enhanceLevel < maxLevel && enoughGold && enoughIronOre;

        let message = '';
        if (equipment.enhanceLevel >= maxLevel) {
            message = `当前强化上限为 +${maxLevel}`;
        } else if (!enoughGold || !enoughIronOre) {
            message = '强化材料不足';
        }

        return {
            success: true,
            equipment,
            holder: resolved,
            maxLevel,
            nextLevel,
            cost,
            successRate,
            successRateText: EquipmentConfig.formatSuccessRate(successRate),
            preview,
            canEnhance,
            message
        };
    }

    enhanceEquipment(target) {
        const info = this.getEquipmentEnhanceInfo(target);
        if (!info.success) {
            return info;
        }
        if (info.equipment.enhanceLevel >= info.maxLevel) {
            return { success: false, message: `装备强化等级不能超过玩家等级 * 5（当前上限 +${info.maxLevel}）`, equipment: info.equipment };
        }
        if (!shelterManager.consumeResource('gold', info.cost.gold)) {
            return { success: false, message: '金币不足', equipment: info.equipment };
        }
        if (!shelterManager.consumeResource('iron_ore', info.cost.iron_ore)) {
            shelterManager.addResource('gold', info.cost.gold);
            return { success: false, message: '铁矿石不足', equipment: info.equipment };
        }

        const roll = Math.random();
        const success = roll < info.successRate;
        if (success) {
            info.equipment.increaseEnhanceLevel(1);
        }

        if (info.holder?.hero) {
            info.holder.hero.refreshStats(false);
            eventManager.emit('heroEquipmentChange', {
                heroId: info.holder.hero.id,
                slot: info.holder.slot,
                equipment: info.equipment
            });
            eventManager.emit('heroUpdate', info.holder.hero);
        }
        eventManager.emit('equipmentUpdate', {
            equipment: info.equipment,
            success,
            enhanceLevel: info.equipment.enhanceLevel
        });

        return {
            success: true,
            upgraded: success,
            equipment: info.equipment,
            cost: info.cost,
            successRate: info.successRate,
            successRateText: info.successRateText,
            message: success
                ? `${info.equipment.name} 强化成功，当前 +${info.equipment.enhanceLevel}`
                : `${info.equipment.name} 强化失败，已消耗金币和铁矿石`
        };
    }

    getStarConsumableCandidates(target) {
        const resolved = this.resolveEquipmentTarget(target);
        const equipment = resolved?.equipment;
        if (!equipment?.canStarUpgrade?.()) {
            return [];
        }

        return this.equipmentItems.filter(item => (
            item.instanceId !== equipment.instanceId &&
            item.templateId === equipment.templateId &&
            item.slot === equipment.slot &&
            item.starLevel === 0 &&
            item.enhanceLevel === 0 &&
            !item.locked
        )).sort((left, right) => this.compareEquipment(left, right));
    }

    getEquipmentStarInfo(target) {
        const resolved = this.resolveEquipmentTarget(target);
        if (!resolved?.equipment) {
            return { success: false, message: '装备不存在' };
        }

        const equipment = resolved.equipment;
        if (!equipment.canStarUpgrade()) {
            return { success: false, message: '当前装备不可升星' };
        }

        const maxStarLevel = EquipmentConfig.getStarMaxLevel(equipment.slot);
        const requiredCount = EquipmentConfig.getStarMaterialCount();
        const candidates = this.getStarConsumableCandidates(target);
        const selectedMaterials = candidates.slice(0, requiredCount);
        const preview = equipment.getStarUpgradePreview();
        const missingCount = Math.max(0, requiredCount - selectedMaterials.length);
        const canUpgrade = equipment.starLevel < maxStarLevel && missingCount === 0;

        let message = '';
        if (equipment.starLevel >= maxStarLevel) {
            message = `当前已升至 ${maxStarLevel} 星`;
        } else if (missingCount > 0) {
            message = `还需要 ${missingCount} 件同名 0 星装备`;
        }

        return {
            success: true,
            equipment,
            holder: resolved,
            maxStarLevel,
            requiredCount,
            candidates,
            selectedMaterials,
            preview,
            missingCount,
            canUpgrade,
            message
        };
    }

    upgradeEquipmentStar(target, materialInstanceIds = null) {
        const info = this.getEquipmentStarInfo(target);
        if (!info.success) {
            return info;
        }
        if (info.equipment.starLevel >= info.maxStarLevel) {
            return { success: false, message: `当前已达到 ${info.maxStarLevel} 星上限`, equipment: info.equipment };
        }

        const requestedIds = Array.isArray(materialInstanceIds) && materialInstanceIds.length > 0
            ? materialInstanceIds
            : info.selectedMaterials.map(item => item.instanceId);
        const requiredCount = info.requiredCount;
        const materialMap = new Map();

        requestedIds.forEach(instanceId => {
            const material = this.getEquipment(instanceId);
            if (!material) {
                return;
            }
            if (
                material.instanceId === info.equipment.instanceId ||
                material.templateId !== info.equipment.templateId ||
                material.slot !== info.equipment.slot ||
                material.starLevel !== 0 ||
                material.enhanceLevel !== 0 ||
                material.locked
            ) {
                return;
            }
            materialMap.set(material.instanceId, material);
        });

        const materials = Array.from(materialMap.values()).slice(0, requiredCount);
        if (materials.length < requiredCount) {
            return { success: false, message: `升星材料不足，还需要 ${requiredCount - materials.length} 件同名 0 星装备`, equipment: info.equipment };
        }

        materials.forEach(material => this.removeEquipment(material.instanceId));
        info.equipment.increaseStarLevel(1);

        if (info.holder?.hero) {
            info.holder.hero.refreshStats(false);
            eventManager.emit('heroEquipmentChange', {
                heroId: info.holder.hero.id,
                slot: info.holder.slot,
                equipment: info.equipment
            });
            eventManager.emit('heroUpdate', info.holder.hero);
        }

        eventManager.emit('equipmentUpdate', {
            equipment: info.equipment,
            starLevel: info.equipment.starLevel,
            consumedMaterials: materials.map(item => item.instanceId)
        });

        return {
            success: true,
            equipment: info.equipment,
            materials,
            message: `${info.equipment.name} 升星成功，当前 ${info.equipment.starLevel} 星`
        };
    }

    getEquipmentDismantleInfo(target) {
        const resolved = this.resolveEquipmentTarget(target);
        if (!resolved?.equipment) {
            return { success: false, message: '装备不存在' };
        }

        const equipment = resolved.equipment;
        if (equipment.locked) {
            return { success: false, message: '装备已锁定，无法分解' };
        }

        const baseIronOre = EquipmentConfig.getDismantleBaseReward(equipment.rarity);
        let refundedEnhanceIronOre = 0;
        for (let level = 1; level <= equipment.enhanceLevel; level++) {
            const cost = EquipmentConfig.getEnhanceCost(equipment.rarity, level);
            refundedEnhanceIronOre += Math.round((Number(cost.iron_ore) || 0) * 0.8);
        }
        const refundedStarIronOre = Math.round(baseIronOre * equipment.starLevel * EquipmentConfig.getStarMaterialCount() * 0.6);
        const totalIronOre = baseIronOre + refundedEnhanceIronOre + refundedStarIronOre;

        return {
            success: true,
            equipment,
            holder: resolved,
            rewards: {
                iron_ore: totalIronOre
            },
            detail: {
                baseIronOre,
                refundedEnhanceIronOre,
                refundedStarIronOre
            }
        };
    }

    dismantleEquipment(target) {
        const info = this.getEquipmentDismantleInfo(target);
        if (!info.success) {
            return info;
        }

        const { equipment, holder, rewards } = info;
        if (holder?.hero) {
            holder.hero.unequip(holder.slot);
            holder.hero.refreshStats(false);
            eventManager.emit('heroEquipmentChange', {
                heroId: holder.hero.id,
                slot: holder.slot,
                equipment: null
            });
            eventManager.emit('heroUpdate', holder.hero);
        }

        this.removeEquipment(equipment.instanceId);

        Object.entries(rewards || {}).forEach(([resourceId, amount]) => {
            if ((Number(amount) || 0) > 0) {
                shelterManager.addResource(resourceId, amount);
            }
        });

        eventManager.emit('equipmentDismantle', {
            instanceId: equipment.instanceId,
            templateId: equipment.templateId,
            rewards
        });

        return {
            success: true,
            equipment,
            rewards,
            message: `${equipment.name} 已分解，获得 ${rewards.iron_ore} 铁矿石`
        };
    }

    sellItem(itemId, count = 1) {
        const item = this.getItem(itemId);
        const totalCount = this.getItemCount(itemId);
        if (!item) {
            return { success: false, message: '道具不存在' };
        }
        if (totalCount < count) {
            return { success: false, message: '道具数量不足' };
        }

        const sellPrice = this.calculateSellPrice(itemId, count, item.rarity);
        if (!this.removeItem(itemId, count)) {
            return { success: false, message: '出售失败' };
        }

        shelterManager.addResource('gold', sellPrice);
        eventManager.emit('itemSell', { itemId, count, gold: sellPrice });
        return { success: true, message: `出售成功，获得 ${sellPrice} 金币`, gold: sellPrice };
    }

    sellEquipment(instanceId) {
        const equipment = this.getEquipment(instanceId);
        if (!equipment) {
            return { success: false, message: '装备不存在' };
        }
        const sellPrice = this.calculateSellPrice(equipment.templateId, 1, equipment.rarity, true);
        this.removeEquipment(instanceId);
        shelterManager.addResource('gold', sellPrice);
        eventManager.emit('equipmentSell', { instanceId, gold: sellPrice });
        return { success: true, message: `出售成功，获得 ${sellPrice} 金币`, gold: sellPrice };
    }

    calculateSellPrice(itemId, count = 1, rarity = null, isEquipment = false) {
        const rarityMap = { common: 1, rare: 3, epic: 10, legendary: 30 };
        const itemConfig = ItemConfig.getItemConfig(itemId);
        const finalRarity = rarity || itemConfig?.rarity || 'common';
        const basePrice = isEquipment ? 30 : 10;
        return basePrice * (rarityMap[finalRarity] || 1) * Math.max(1, Number(count) || 1);
    }

    getAdSkipCardId() {
        return 'ad_skip_card';
    }

    getAdSkipCardCount() {
        return this.getItemCount(this.getAdSkipCardId());
    }

    hasAdSkipCard() {
        return this.getAdSkipCardCount() > 0;
    }

    consumeAdSkipCard(count = 1) {
        const amount = Math.max(1, Number(count) || 1);
        const itemId = this.getAdSkipCardId();
        if (this.getItemCount(itemId) < amount) {
            return { success: false, message: '免广告卡数量不足' };
        }
        if (!this.removeItem(itemId, amount)) {
            return { success: false, message: '免广告卡消耗失败' };
        }
        return {
            success: true,
            itemId,
            count: amount,
            remaining: this.getItemCount(itemId)
        };
    }

    getItemsByPage(page, pageSize, category = 'item') {
        const source = category === 'equipment' ? this.equipmentItems : this.items;
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const items = source.slice(start, end);
        return {
            items,
            page,
            pageSize,
            total: source.length,
            totalPages: Math.max(1, Math.ceil(source.length / pageSize))
        };
    }

    getSaveData() {
        return {
            items: this.items.map(item => ({ id: item.id, count: item.count })),
            equipment: this.equipmentItems.map(equipment => equipment.getSaveData())
        };
    }
}

const itemManager = new ItemManager();
window.itemManager = itemManager;
