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
        if (normalized.items.length > 0 || normalized.equipment.length > 0) {
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

    normalizeSaveData(saveData) {
        if (!saveData) {
            return { items: [], equipment: [] };
        }

        if (Array.isArray(saveData)) {
            const items = [];
            const equipment = [];
            saveData.forEach(entry => {
                const config = ItemConfig.getItemConfig(entry.id);
                if (!config) {
                    return;
                }
                if (this.isLegacyEquipmentConfig(config)) {
                    const count = Math.max(1, Number(entry.count) || 1);
                    for (let index = 0; index < count; index++) {
                        const legacyEquipment = EquipmentConfig.createLegacyEquipment(config);
                        if (legacyEquipment) {
                            equipment.push(legacyEquipment.getSaveData());
                        }
                    }
                    return;
                }
                items.push({ id: entry.id, count: Number(entry.count) || 0 });
            });
            return { items, equipment };
        }

        return {
            items: Array.isArray(saveData.items) ? saveData.items : [],
            equipment: Array.isArray(saveData.equipment) ? saveData.equipment : []
        };
    }

    isLegacyEquipmentConfig(config) {
        return config && ['weapon', 'armor'].includes(config.type);
    }

    addInitialItems() {
        [
            { id: 'meat', count: 10 },
            { id: 'water', count: 10 },
            { id: 'medicine', count: 3 }
        ].forEach(item => this.addItem(item.id, item.count));
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

    useItem(itemId, target) {
        const item = this.getItem(itemId);
        if (!item) {
            return { success: false, message: '道具不存在' };
        }
        if (item.count <= 0) {
            return { success: false, message: '道具数量不足' };
        }

        const result = item.use(target);
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
