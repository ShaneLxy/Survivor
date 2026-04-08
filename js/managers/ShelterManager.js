/**
 * 避难所管理器 - 单例模式
 */
class ShelterManager {
    constructor() {
        if (ShelterManager.instance) {
            return ShelterManager.instance;
        }
        this.buildings = [];
        this.resources = {};
        this.offlineTime = 0;
        this.legacyWaterToConvert = 0;
        ShelterManager.instance = this;
    }

    init(saveData) {
        this.legacyWaterToConvert = 0;
        if (saveData?.buildings?.length) {
            this.buildings = saveData.buildings.map(buildingData => {
                const config = BuildingConfig.getBuildingConfig(buildingData.id);
                return config ? new Building(config, buildingData.level || 1) : null;
            }).filter(Boolean);

            const rawResources = { ...(saveData.resources || {}) };
            this.legacyWaterToConvert = Math.max(0, Number(rawResources.water) || 0);
            delete rawResources.water;
            if (rawResources.gold_ore !== undefined) {
                rawResources.iron_ore = (Number(rawResources.iron_ore) || 0) + (Number(rawResources.gold_ore) || 0);
                delete rawResources.gold_ore;
            }

            this.resources = {
                gold: 1000,
                wood: 50,
                stone: 30,
                meat: 80,
                iron_ore: 20,
                diamond: 0,
                ...rawResources
            };
            this.offlineTime = saveData.offlineTime || Date.now();
            return;
        }

        this.createInitialBuildings();
        this.createInitialResources();
        this.offlineTime = Date.now();
    }

    createInitialBuildings() {
        const initialBuildingIds = ['building_shelter', 'building_farm', 'building_mine', 'building_well'];
        this.buildings = [];
        initialBuildingIds.forEach(id => {
            const config = BuildingConfig.getBuildingConfig(id);
            if (config) {
                this.buildings.push(new Building(config, 1));
            }
        });
    }

    createInitialResources() {
        this.resources = {
            gold: 1000,
            wood: 50,
            stone: 30,
            meat: 80,
            iron_ore: 20,
            diamond: 0
        };
    }

    normalizeResourceType(type) {
        if (type === 'gold_ore') {
            return 'iron_ore';
        }
        return type;
    }

    isResourceType(type) {
        return ['gold', 'wood', 'stone', 'meat', 'iron_ore', 'diamond'].includes(this.normalizeResourceType(type));
    }

    getPrimaryResourceTypes() {
        return ['gold', 'wood', 'stone', 'meat', 'iron_ore', 'diamond'];
    }

    getDisplayResourceEntries() {
        return this.getPrimaryResourceTypes().map(type => ({
            id: type,
            count: this.getResource(type),
            ...this.getResourceInfo(type)
        }));
    }

    getResourceInfo(type) {
        const resourceType = this.normalizeResourceType(type);
        const resourceMap = {
            gold: { name: '金币', icon: '💰', rarity: 'common', description: '通用货币，可用于抽卡、商城购买和建筑发展' },
            wood: { name: '木材', icon: '🪵', rarity: 'common', description: '升级避难所建筑的基础材料之一' },
            stone: { name: '石材', icon: '🪨', rarity: 'common', description: '升级避难所建筑的基础材料之一' },
            meat: { name: '肉类', icon: '🍖', rarity: 'common', description: '重要食物资源，可维持生存' },
            iron_ore: { name: '铁矿石', icon: '⛓️', rarity: 'rare', description: '装备强化的重要材料' },
            diamond: { name: '钻石', icon: '💎', rarity: 'epic', description: '高价值稀有货币' },
            water: { name: '水源', icon: '💧', rarity: 'common', description: '旧版本资源，仅用于兼容历史存档' }
        };

        return resourceMap[resourceType] || {
            name: resourceType,
            icon: '📦',
            rarity: 'common',
            description: '基础资源'
        };
    }

    getResourceDisplayName(type) {
        return this.getResourceInfo(type).name;
    }

    getBuilding(buildingId) {
        return this.buildings.find(b => b.id === buildingId);
    }

    getAllBuildings() {
        return this.buildings;
    }

    upgradeBuilding(buildingId) {
        const building = this.getBuilding(buildingId);
        if (!building) {
            return { success: false, message: '建筑不存在' };
        }
        if (!building.canUpgrade()) {
            return { success: false, message: '建筑已达到最大等级' };
        }

        const cost = building.getUpgradeCost();
        for (const [resource, amount] of Object.entries(cost)) {
            if (this.getResource(resource) < amount) {
                return { success: false, message: `资源不足: ${this.getResourceDisplayName(resource)}` };
            }
        }

        for (const [resource, amount] of Object.entries(cost)) {
            this.consumeResource(resource, amount);
        }

        building.upgrade();
        eventManager.emit('buildingUpgrade', { buildingId, level: building.level });
        return { success: true, message: `${building.name} 升级到 Lv.${building.level}` };
    }

    getResource(type) {
        return this.resources[this.normalizeResourceType(type)] || 0;
    }

    getResources() {
        return { ...this.resources };
    }

    addResource(type, amount) {
        const resourceType = this.normalizeResourceType(type);
        if (!this.resources[resourceType]) {
            this.resources[resourceType] = 0;
        }
        this.resources[resourceType] += Number(amount) || 0;
        eventManager.emit('resourceUpdate', { type: resourceType, amount, total: this.resources[resourceType] });
    }

    consumeResource(type, amount) {
        const resourceType = this.normalizeResourceType(type);
        if (this.resources[resourceType] >= amount) {
            this.resources[resourceType] -= amount;
            eventManager.emit('resourceUpdate', { type: resourceType, amount: -amount, total: this.resources[resourceType] });
            return true;
        }
        return false;
    }

    calculateOfflineProduction(seconds) {
        const hours = seconds / 3600;
        const result = {
            resources: {},
            items: {}
        };

        this.buildings.forEach(building => {
            const outputs = building.calculateProduction(hours);
            outputs.forEach(output => {
                if (output.type === 'item') {
                    result.items[output.id] = (result.items[output.id] || 0) + output.amount;
                } else {
                    const resourceType = this.normalizeResourceType(output.id);
                    result.resources[resourceType] = (result.resources[resourceType] || 0) + output.amount;
                }
            });
        });

        return result;
    }

    collectOfflineProduction(seconds) {
        const production = this.calculateOfflineProduction(seconds);
        Object.entries(production.resources || {}).forEach(([type, amount]) => {
            if (amount > 0) {
                this.addResource(type, amount);
            }
        });
        Object.entries(production.items || {}).forEach(([itemId, amount]) => {
            if (amount > 0) {
                itemManager.addItem(itemId, amount);
            }
        });
    }

    consumeLegacyWaterMigration() {
        const value = Math.max(0, Number(this.legacyWaterToConvert) || 0);
        this.legacyWaterToConvert = 0;
        return value;
    }

    getSaveData() {
        return {
            buildings: this.buildings.map(b => ({
                id: b.id,
                level: b.level
            })),
            resources: { ...this.resources },
            offlineTime: Date.now()
        };
    }
}

const shelterManager = new ShelterManager();
window.shelterManager = shelterManager;
