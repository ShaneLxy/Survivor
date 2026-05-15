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
            this.ensureDefaultBuildings();
            this.offlineTime = saveData.offlineTime || Date.now();
            return;
        }

        this.createInitialBuildings();
        this.createInitialResources();
        this.offlineTime = Date.now();
    }

    createInitialBuildings() {
        const initialBuildingIds = ['building_shelter', 'building_farm', 'building_mine', 'building_well', 'building_training_ground'];
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
        const getIconSrc = (resourceId) => ResourceVisualConfig.get(resourceId)?.src || '';
        const resourceMap = {
            gold: { name: '金币', icon: 'G', iconSrc: getIconSrc('gold'), rarity: 'common', description: '通用货币，可用于招募、商城购买和建筑发展' },
            wood: { name: '木材', icon: 'W', iconSrc: getIconSrc('wood'), rarity: 'common', description: '升级避难所建筑的基础材料之一' },
            stone: { name: '石材', icon: 'S', iconSrc: getIconSrc('stone'), rarity: 'common', description: '升级避难所建筑的基础材料之一' },
            meat: { name: '肉类', icon: 'M', iconSrc: getIconSrc('meat'), rarity: 'common', description: '重要食物资源，可维持生存' },
            iron_ore: { name: '铁矿石', icon: 'I', iconSrc: getIconSrc('iron_ore'), rarity: 'rare', description: '装备强化的重要材料' },
            diamond: { name: '钻石', icon: 'D', iconSrc: getIconSrc('diamond'), rarity: 'epic', description: '高价值稀有货币' },
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

    ensureDefaultBuildings() {
        const requiredBuildingIds = ['building_shelter', 'building_farm', 'building_mine', 'building_well', 'building_training_ground'];
        const existingIds = new Set(this.buildings.map((building) => building.id));
        requiredBuildingIds.forEach((id) => {
            if (existingIds.has(id)) {
                return;
            }
            const config = BuildingConfig.getBuildingConfig(id);
            if (config) {
                this.buildings.push(new Building(config, 1));
            }
        });
    }

    getAllBuildings() {
        return this.buildings;
    }

    getShelterEnergyBonus() {
        const shelter = this.getBuilding('building_shelter');
        return Math.max(0, Number(shelter?.effect?.type === 'energyBonus' ? shelter.effect.value : 0) || 0);
    }

    getTrainingGroundStatBonus() {
        const trainingGround = this.getBuilding('building_training_ground');
        return Math.max(0, Number(trainingGround?.effect?.type === 'statBonus' ? trainingGround.effect.value : 0) || 0);
    }

    applyBuildingEffects() {
        if (window.game?.recalculatePlayerMaxEnergy) {
            window.game.recalculatePlayerMaxEnergy();
        }
        if (window.heroManager?.refreshAllHeroes) {
            window.heroManager.refreshAllHeroes();
        }
    }

    upgradeBuilding(buildingId) {
        const building = this.getBuilding(buildingId);
        if (!building) {
            return { success: false, message: '建筑不存在' };
        }
        if (!building.canUpgrade()) {
            return { success: false, message: '建筑已达到最高等级' };
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
        this.applyBuildingEffects();
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
        const cappedSeconds = Math.min(Math.max(0, Number(seconds) || 0), ShelterManager.MAX_PRODUCTION_SECONDS);
        const hours = cappedSeconds / 3600;
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

ShelterManager.PRODUCTION_BUILDING_IDS = ['building_farm', 'building_mine', 'building_well'];
ShelterManager.MAX_PRODUCTION_SECONDS = 12 * 3600;

ShelterManager.prototype.getResourceInfo = function(type) {
    const resourceType = this.normalizeResourceType(type);
    const getIconSrc = (resourceId) => ResourceVisualConfig.get(resourceId)?.src || '';
    const resourceMap = {
        gold: {
            name: '金币',
            icon: 'G',
            iconSrc: getIconSrc('gold'),
            rarity: 'common',
            description: '通用货币，可用于招募、商城购买和建筑发展'
        },
        wood: {
            name: '木材',
            icon: 'W',
            iconSrc: getIconSrc('wood'),
            rarity: 'common',
            description: '升级避难所建筑的基础材料之一'
        },
        stone: {
            name: '石材',
            icon: 'S',
            iconSrc: getIconSrc('stone'),
            rarity: 'common',
            description: '升级避难所建筑的基础材料之一'
        },
        meat: { name: '肉类', icon: 'M', iconSrc: getIconSrc('meat'), rarity: 'common', description: '重要食物资源，可维持生存' },
        iron_ore: { name: '铁矿石', icon: 'I', iconSrc: getIconSrc('iron_ore'), rarity: 'rare', description: '装备强化的重要材料' },
        diamond: { name: '钻石', icon: 'D', iconSrc: getIconSrc('diamond'), rarity: 'epic', description: '高价值稀有货币' },
        water: { name: '水源', icon: '💧', rarity: 'common', description: '旧版本资源，仅用于兼容历史存档' }
    };

    return resourceMap[resourceType] || {
        name: resourceType,
        icon: '📦',
        rarity: 'common',
        description: '基础资源'
    };
};

ShelterManager.prototype.ensureProductionTimers = function(seedTimestamp = Date.now()) {
    if (!this.productionTimers) {
        this.productionTimers = {};
    }
    ShelterManager.PRODUCTION_BUILDING_IDS.forEach((buildingId) => {
        const currentValue = Number(this.productionTimers[buildingId]) || 0;
        this.productionTimers[buildingId] = currentValue > 0 ? currentValue : seedTimestamp;
    });
};

ShelterManager.prototype.getProductionBuildings = function() {
    return this.getAllBuildings().filter((building) => ShelterManager.PRODUCTION_BUILDING_IDS.includes(building.id));
};

ShelterManager.prototype.getProductionStartTime = function(buildingId) {
    this.ensureProductionTimers();
    return Number(this.productionTimers[buildingId]) || Date.now();
};

ShelterManager.prototype.getProductionElapsedSeconds = function(buildingId, now = Date.now()) {
    const startTime = this.getProductionStartTime(buildingId);
    const elapsed = Math.max(0, Math.floor((now - startTime) / 1000));
    return Math.min(elapsed, ShelterManager.MAX_PRODUCTION_SECONDS);
};

ShelterManager.prototype.getRoundedProductionHours = function(elapsedSeconds) {
    if (elapsedSeconds < 3600) {
        return 0;
    }
    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
    return Math.round((elapsedMinutes / 60) * 10) / 10;
};

ShelterManager.prototype.calculateBuildingProductionRewards = function(buildingId, elapsedSeconds = null) {
    const building = this.getBuilding(buildingId);
    if (!building) {
        return { hours: 0, rewards: [] };
    }
    const effectiveElapsedSeconds = elapsedSeconds === null ? this.getProductionElapsedSeconds(buildingId) : elapsedSeconds;
    const hours = this.getRoundedProductionHours(effectiveElapsedSeconds);
    if (hours < 1) {
        return { hours: 0, rewards: [] };
    }

    const rewards = (building.effect?.outputs || []).map((output) => {
        const amount = Math.floor((Number(output.amountPerHour) || 0) * hours);
        return amount > 0 ? {
            type: output.type || 'resource',
            id: output.id,
            amount
        } : null;
    }).filter(Boolean);

    return { hours, rewards };
};

ShelterManager.prototype.getProductionStatus = function(buildingId, now = Date.now()) {
    const elapsedSeconds = this.getProductionElapsedSeconds(buildingId, now);
    const { hours, rewards } = this.calculateBuildingProductionRewards(buildingId, elapsedSeconds);
    return {
        elapsedSeconds,
        isCapped: elapsedSeconds >= ShelterManager.MAX_PRODUCTION_SECONDS,
        canCollect: elapsedSeconds >= 3600 && rewards.length > 0,
        roundedHours: hours,
        rewards
    };
};

ShelterManager.prototype.collectProduction = function(buildingId) {
    const building = this.getBuilding(buildingId);
    if (!building) {
        return { success: false, message: '建筑不存在' };
    }
    const status = this.getProductionStatus(buildingId);
    if (status.elapsedSeconds < 3600) {
        return { success: false, message: '资源累计满一小时后才能收获' };
    }
    if (!status.rewards.length) {
        return { success: false, message: '当前暂无可收获资源' };
    }

    const itemRewards = status.rewards
        .filter(reward => reward.type === 'item')
        .map(reward => ({ id: reward.id, count: reward.amount || 1 }));
    const inventoryCheck = itemManager.canAddItemBundle(itemRewards);
    if (!inventoryCheck.success) {
        return { success: false, message: inventoryCheck.message || '背包容量达到上限' };
    }

    status.rewards.forEach((reward) => {
        if (reward.type === 'item') {
            itemManager.addItem(reward.id, reward.amount);
        } else {
            this.addResource(reward.id, reward.amount);
        }
    });

    this.productionTimers[buildingId] = Date.now();
    eventManager.emit('shelterProductionCollect', {
        buildingId,
        hours: status.roundedHours,
        rewards: status.rewards
    });

    return {
        success: true,
        message: `${building.name} 收获完成`,
        hours: status.roundedHours,
        rewards: status.rewards
    };
};

const originalShelterInit = ShelterManager.prototype.init;
ShelterManager.prototype.init = function(saveData) {
    originalShelterInit.call(this, saveData);
    this.productionTimers = {
        ...(saveData?.productionTimers || {})
    };
    this.ensureProductionTimers(Number(saveData?.offlineTime) || Date.now());
    this.applyBuildingEffects();
};

const originalShelterGetSaveData = ShelterManager.prototype.getSaveData;
ShelterManager.prototype.getSaveData = function() {
    const saveData = originalShelterGetSaveData.call(this);
    return {
        ...saveData,
        productionTimers: { ...(this.productionTimers || {}) }
    };
};

shelterManager.ensureProductionTimers();
