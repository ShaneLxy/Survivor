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
                const normalizedBuildingId = buildingData.id === 'building_well' ? 'building_armory' : buildingData.id;
                if (normalizedBuildingId === 'building_farm' || normalizedBuildingId === 'building_mine') {
                    return null;
                }
                const config = BuildingConfig.getBuildingConfig(normalizedBuildingId);
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
        const initialBuildingIds = ['building_shelter', 'building_armory', 'building_training_ground'];
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
        const requiredBuildingIds = ['building_shelter', 'building_armory', 'building_training_ground'];
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
        return 0;
    }

    getTrainingGroundStatBonus() {
        const trainingGround = this.getBuilding('building_training_ground');
        return Math.max(0, Number(trainingGround?.effect?.type === 'statBonus' ? trainingGround.effect.value : 0) || 0);
    }

    getArmoryReforgeRules() {
        const armory = this.getBuilding('building_armory');
        if (!armory) {
            return { level: 0, unlockedStats: [], bonus: 0 };
        }
        const config = BuildingConfig.getBuildingConfig('building_armory');
        const levels = Array.isArray(config?.levels) ? config.levels : [];
        const unlockedStats = new Set();
        let bonus = 0;

        levels
            .filter(level => Number(level.level || 0) <= Number(armory.level || 0))
            .forEach(level => {
                (Array.isArray(level.reforgeUnlockStats) ? level.reforgeUnlockStats : []).forEach(statKey => {
                    if (statKey) {
                        unlockedStats.add(String(statKey));
                    }
                });
                bonus = Math.max(bonus, Math.max(0, Number(level.reforgeBonus) || 0));
            });

        return {
            level: Number(armory.level) || 0,
            unlockedStats: [...unlockedStats],
            bonus
        };
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

ShelterManager.PRODUCTION_BUILDING_IDS = ['building_shelter'];
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

ShelterManager.prototype.ensureTdIdleState = function(seedTimestamp = Date.now()) {
    if (!this.tdIdleState) {
        this.tdIdleState = {};
    }
    const todayKey = this.getTdIdleDateKey(seedTimestamp);
    this.tdIdleState.lastCollectAt = Number(this.tdIdleState.lastCollectAt) || seedTimestamp;
    this.tdIdleState.chestReadyAt = Number(this.tdIdleState.chestReadyAt) || seedTimestamp;
    this.tdIdleState.chestStored = Math.max(0, Math.min(2, Number(this.tdIdleState.chestStored) || 0));
    this.tdIdleState.tapDate = this.tdIdleState.tapDate || todayKey;
    this.tdIdleState.tapCount = Math.max(0, Math.min(200, Number(this.tdIdleState.tapCount) || 0));
    this.tdIdleState.lastTapAt = Number(this.tdIdleState.lastTapAt) || 0;
    if (this.tdIdleState.tapDate !== todayKey) {
        this.tdIdleState.tapDate = todayKey;
        this.tdIdleState.tapCount = 0;
        this.tdIdleState.lastTapAt = 0;
    }
};

ShelterManager.prototype.getTdIdleDateKey = function(timestamp = Date.now()) {
    const date = new Date(Number(timestamp) || Date.now());
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

ShelterManager.prototype.getTdTapBonusMultiplier = function(now = Date.now()) {
    this.ensureTdIdleState(now);
    return 1 + Math.floor((Number(this.tdIdleState.tapCount) || 0) / 20) * 0.01;
};

ShelterManager.prototype.recordTdTap = function(now = Date.now()) {
    this.ensureTdIdleState(now);
    if (this.tdIdleState.tapDate !== this.getTdIdleDateKey(now)) {
        this.tdIdleState.tapDate = this.getTdIdleDateKey(now);
        this.tdIdleState.tapCount = 0;
        this.tdIdleState.lastTapAt = 0;
    }
    const lastTapAt = Number(this.tdIdleState.lastTapAt) || 0;
    if (lastTapAt > 0 && now - lastTapAt < 1000) {
        return {
            success: false,
            reason: 'cooldown',
            tapCount: this.tdIdleState.tapCount,
            bonusPercent: Math.floor(this.tdIdleState.tapCount / 20)
        };
    }
    if ((Number(this.tdIdleState.tapCount) || 0) >= 200) {
        return {
            success: false,
            reason: 'limit',
            tapCount: this.tdIdleState.tapCount,
            bonusPercent: Math.floor(this.tdIdleState.tapCount / 20)
        };
    }
    this.tdIdleState.tapCount += 1;
    this.tdIdleState.lastTapAt = now;
    return {
        success: true,
        reason: 'counted',
        tapCount: this.tdIdleState.tapCount,
        bonusPercent: Math.floor(this.tdIdleState.tapCount / 20)
    };
};

ShelterManager.prototype.getTdIdleProgressMultiplier = function() {
    const unlocked = Math.max(1, Number(window.dungeonManager?.getUnlockedDungeonCount?.()) || 1);
    return 1 + Math.max(0, unlocked - 1) * 0.05;
};

ShelterManager.prototype.calculateTdIdleRewards = function(seconds, now = Date.now()) {
    this.ensureTdIdleState(now);
    const cappedSeconds = Math.min(Math.max(0, Number(seconds) || 0), ShelterManager.MAX_PRODUCTION_SECONDS);
    const hours = cappedSeconds / 3600;
    const building = this.getBuilding('building_shelter');
    const outputs = Array.isArray(building?.effect?.outputs) ? building.effect.outputs : [];
    const progressMultiplier = this.getTdIdleProgressMultiplier();
    const tapMultiplier = this.getTdTapBonusMultiplier(now);
    const rewards = outputs.map((output) => {
        const amount = Math.floor((Number(output.amountPerHour) || 0) * hours * progressMultiplier * tapMultiplier);
        if (amount <= 0) return null;
        return {
            type: output.type || 'resource',
            id: output.id,
            amount
        };
    }).filter(Boolean);
    return {
        seconds: cappedSeconds,
        hours: Math.round(hours * 10) / 10,
        progressMultiplier,
        tapMultiplier,
        rewards
    };
};

ShelterManager.prototype.getTdChestStatus = function(now = Date.now()) {
    this.ensureTdIdleState(now);
    let chestReadyAt = Number(this.tdIdleState.chestReadyAt) || now;
    let chestStored = Math.max(0, Math.min(2, Number(this.tdIdleState.chestStored) || 0));
    while (chestStored < 2 && now - chestReadyAt >= 3600000) {
        chestStored += 1;
        chestReadyAt += 3600000;
    }
    this.tdIdleState.chestStored = chestStored;
    this.tdIdleState.chestReadyAt = chestReadyAt;
    const nextSeconds = chestStored >= 2 ? 0 : Math.max(0, Math.ceil((chestReadyAt + 3600000 - now) / 1000));
    return {
        stored: chestStored,
        capacity: 2,
        nextSeconds,
        ready: chestStored > 0
    };
};

ShelterManager.prototype.rollTdChestReward = function() {
    // 优先使用 GM 下发的补给箱奖池配置，兜底回硬编码
    const shelterConfig = BuildingConfig.getBuildingConfig('building_shelter');
    const gmPool = shelterConfig?.chestRewardPool;
    const pool = (Array.isArray(gmPool) && gmPool.length ? gmPool : null) || [
        { kind: 'resource', id: 'diamond', min: 18, max: 36, weight: 34 },
        { kind: 'item', id: 'ad_skip_card', min: 1, max: 2, weight: 24 },
        { kind: 'item', id: 'hero_summon', min: 1, max: 1, weight: 16 },
        { kind: 'item', id: 'weapon_forge_ticket', min: 1, max: 1, weight: 16 },
        { kind: 'fragment', heroRarity: 'common', min: 8, max: 16, weight: 10 }
    ];
    const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * total;
    let selected = pool[0];
    for (const entry of pool) {
        roll -= entry.weight;
        if (roll <= 0) {
            selected = entry;
            break;
        }
    }
    const amount = selected.min >= selected.max
        ? selected.min
        : (selected.min + Math.floor(Math.random() * (selected.max - selected.min + 1)));
    if (selected.kind === 'fragment') {
        const heroes = HeroConfig.getAllHeroes()
            .filter((hero) => (hero?.rarity || 'common') === selected.heroRarity);
        const hero = heroes[Math.floor(Math.random() * heroes.length)] || heroes[0];
        return {
            type: 'fragment',
            id: hero?.id || 'hero_common',
            amount,
            heroId: hero?.id || 'hero_common'
        };
    }
    return {
        type: selected.kind,
        id: selected.id,
        amount
    };
};

ShelterManager.prototype.collectTdIdleRewards = function(now = Date.now()) {
    this.ensureTdIdleState(now);
    const elapsedSeconds = Math.min(
        ShelterManager.MAX_PRODUCTION_SECONDS,
        Math.max(0, Math.floor((now - (Number(this.tdIdleState.lastCollectAt) || now)) / 1000))
    );
    if (elapsedSeconds < 3600) {
        return { success: false, message: '资源累计满一小时后才能收取', elapsedSeconds };
    }

    const normal = this.calculateTdIdleRewards(elapsedSeconds, now);
    if (!normal.rewards.length) {
        return { success: false, message: '当前暂无可收取收益', elapsedSeconds };
    }

    const chestStatus = this.getTdChestStatus(now);
    const chestCount = Math.max(0, Number(chestStatus.stored) || 0);
    const chestRewards = Array.from({ length: chestCount }, () => this.rollTdChestReward()).filter(Boolean);
    const chestReward = chestRewards[0] || null;

    const itemRewards = [
        ...normal.rewards.filter((reward) => reward.type === 'item').map((reward) => ({ id: reward.id, count: reward.amount || 1 })),
        ...chestRewards.filter((reward) => reward.type === 'item').map((reward) => ({ id: reward.id, count: reward.amount || 1 }))
    ];
    const inventoryCheck = itemManager.canAddItemBundle(itemRewards);
    if (!inventoryCheck.success) {
        return { success: false, message: inventoryCheck.message || '背包容量达到上限', elapsedSeconds };
    }

    normal.rewards.forEach((reward) => {
        if (reward.type === 'item') itemManager.addItem(reward.id, reward.amount);
        else this.addResource(reward.id, reward.amount);
    });
    if (chestRewards.length > 0) {
        chestRewards.forEach((reward) => {
            if (reward.type === 'item') itemManager.addItem(reward.id, reward.amount);
            else if (reward.type === 'resource') this.addResource(reward.id, reward.amount);
            else if (reward.type === 'fragment') heroManager.addFragments(reward.heroId, reward.amount);
        });
        this.tdIdleState.chestStored = Math.max(0, (Number(this.tdIdleState.chestStored) || 0) - chestRewards.length);
    }

    this.tdIdleState.lastCollectAt = now;
    this.productionTimers = this.productionTimers || {};
    ShelterManager.PRODUCTION_BUILDING_IDS.forEach((buildingId) => {
        this.productionTimers[buildingId] = now;
    });

    eventManager.emit('shelterProductionCollect', {
        buildingId: 'monitor',
        hours: normal.hours,
        rewards: normal.rewards,
        chestReward,
        chestRewards
    });

    return {
        success: true,
        elapsedSeconds,
        hours: normal.hours,
        rewards: normal.rewards,
        chestReward,
        chestRewards,
        tapBonusPercent: Math.floor(((normal.tapMultiplier || 1) - 1) * 100)
    };
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
    // Fallback: use tdIdleState.lastCollectAt or the original offlineTime
    const fallbackSeed = Number(saveData?.tdIdleState?.lastCollectAt) || Number(saveData?.offlineTime) || Date.now();
    this.ensureProductionTimers(fallbackSeed);
    this.tdIdleState = {
        ...(saveData?.tdIdleState || {})
    };
    this.ensureTdIdleState(Number(saveData?.offlineTime) || Date.now());
    this.applyBuildingEffects();
};

const originalShelterGetSaveData = ShelterManager.prototype.getSaveData;
ShelterManager.prototype.getSaveData = function() {
    const saveData = originalShelterGetSaveData.call(this);
    return {
        ...saveData,
        productionTimers: { ...(this.productionTimers || {}) },
        tdIdleState: { ...(this.tdIdleState || {}) }
    };
};
