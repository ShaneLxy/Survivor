/**
 * 道具管理器 - 单例模式
 */
class ItemManager {
    constructor() {
        if (ItemManager.instance) {
            return ItemManager.instance;
        }
        this.items = [];
        this.equipmentItems = [];
        this.maxSlots = 120;
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
                normalized.items.push({ id: entry.id, count: Number(entry.count) || 0 });
            });
            return normalized;
        }

        (Array.isArray(saveData.items) ? saveData.items : []).forEach(entry => {
            const migration = this.getLegacyResourceMigration(entry);
            if (migration) {
                pushMigration(migration, entry.count);
                return;
            }
            normalized.items.push({ id: entry.id, count: Number(entry.count) || 0 });
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

    addItem(itemId, count = 1) {
        const config = ItemConfig.getItemConfig(itemId);
        if (!config || this.isLegacyEquipmentConfig(config)) {
            return false;
        }

        if (config.stackLimit > 1) {
            const existingItem = this.items.find(item => item.id === itemId);
            if (existingItem) {
                const added = existingItem.addCount(count);
                eventManager.emit('itemAdd', { item: existingItem, count: added });
                return added > 0;
            }
        }

        if (this.getUsedSlots() >= this.maxSlots) {
            return false;
        }

        const item = new Item(config, count);
        this.items.push(item);
        eventManager.emit('itemAdd', { item, count });
        return true;
    }

    addEquipment(equipment) {
        if (!(equipment instanceof Equipment)) {
            equipment = Equipment.fromSaveData(equipment);
        }
        if (!equipment || this.getUsedSlots() >= this.maxSlots) {
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
        const item = this.getItem(itemId);
        if (!item) {
            return false;
        }

        if (!item.removeCount(count)) {
            return false;
        }

        if (item.isEmpty()) {
            this.items = this.items.filter(entry => entry !== item);
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
        return [...this.items];
    }

    getAllEquipment() {
        return [...this.equipmentItems];
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

    useItem(itemId, target, options = {}) {
        const item = this.getItem(itemId);
        if (!item) {
            return { success: false, message: '道具不存在' };
        }
        if (item.count <= 0) {
            return { success: false, message: '道具数量不足' };
        }

        if (item.effect?.type === 'hero_exp') {
            const hero = target?.id ? heroManager.getHero(target.id) || target : heroManager.getHero(target?.heroId || target);
            if (!hero) {
                return { success: false, message: '请选择要使用经验药水的英雄' };
            }
            const requestedCount = Math.max(1, Number(options.quantity) || 1);
            const actualCount = Math.min(requestedCount, item.count);
            if (actualCount <= 0) {
                return { success: false, message: '经验药水数量不足' };
            }
            const expValue = Math.max(1, Number(item.effect.value) || 1);
            const totalExp = actualCount * expValue;
            const expResult = heroManager.addHeroExp(hero.id, totalExp, { maxLevel: window.game.player.level, source: 'manual_item' });
            if (!expResult.success) {
                return { success: false, message: '英雄无法获得经验' };
            }
            item.removeCount(actualCount);
            if (item.isEmpty()) {
                this.items = this.items.filter(entry => entry !== item);
            }
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

    sellItem(itemId, count = 1) {
        const item = this.getItem(itemId);
        if (!item) {
            return { success: false, message: '道具不存在' };
        }
        if (item.count < count) {
            return { success: false, message: '道具数量不足' };
        }

        const sellPrice = this.calculateSellPrice(itemId, count, item.rarity);
        if (!this.removeItem(itemId, count)) {
            return { success: false, message: '出售失败' };
        }

        shelterManager.addResource('gold', sellPrice);
        eventManager.emit('itemSell', { itemId, count, gold: sellPrice });
        return { success: true, message: `出售成功,获得${sellPrice}金币`, gold: sellPrice };
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
        return { success: true, message: `出售成功,获得${sellPrice}金币`, gold: sellPrice };
    }

    calculateSellPrice(itemId, count = 1, rarity = null, isEquipment = false) {
        const rarityMap = { common: 1, rare: 3, epic: 10, legendary: 30 };
        const itemConfig = ItemConfig.getItemConfig(itemId);
        const finalRarity = rarity || itemConfig?.rarity || 'common';
        const basePrice = isEquipment ? 30 : 10;
        return basePrice * (rarityMap[finalRarity] || 1) * Math.max(1, Number(count) || 1);
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
