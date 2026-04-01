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
        ShelterManager.instance = this;
    }

    /**
     * 初始化
     */
    init(saveData) {
        // 强制创建初始建筑（忽略旧存档）
        this.createInitialBuildings();
        this.createInitialResources();
        console.log('[ShelterManager] Created', this.buildings.length, 'buildings');
    }

    /**
     * 创建初始建筑
     */
    createInitialBuildings() {
        const initialBuildingIds = ['building_shelter', 'building_farm', 'building_mine', 'building_well'];
        this.buildings = [];
        
        initialBuildingIds.forEach(id => {
            const config = BuildingConfig.getBuildingConfig(id);
            if (config) {
                const building = new Building(config, 1);
                this.buildings.push(building);
                console.log('[ShelterManager] Created building:', id);
            } else {
                console.error('[ShelterManager] Config not found for:', id);
            }
        });
    }

    /**
     * 创建初始资源
     */
    createInitialResources() {
        this.resources = {
            gold: 100,
            wood: 50,
            stone: 30,
            meat: 80,
            water: 60,
            diamond: 0
        };
    }

    /**
     * 获取建筑
     * @param {string} buildingId - 建筑ID
     * @returns {Building|null}
     */
    getBuilding(buildingId) {
        return this.buildings.find(b => b.id === buildingId);
    }

    /**
     * 获取所有建筑
     * @returns {Array<Building>}
     */
    getAllBuildings() {
        return this.buildings;
    }

    /**
     * 升级建筑
     * @param {string} buildingId - 建筑ID
     * @returns {Object}
     */
    upgradeBuilding(buildingId) {
        const building = this.getBuilding(buildingId);
        if (!building) {
            return { success: false, message: '建筑不存在' };
        }

        if (!building.canUpgrade()) {
            return { success: false, message: '建筑已达到最大等级' };
        }

        // 检查资源
        const cost = building.getUpgradeCost();
        for (const [resource, amount] of Object.entries(cost)) {
            if (this.getResource(resource) < amount) {
                return { success: false, message: `资源不足: ${resource}` };
            }
        }

        // 消耗资源
        for (const [resource, amount] of Object.entries(cost)) {
            this.consumeResource(resource, amount);
        }

        // 升级
        building.upgrade();

        return { success: true, message: `${building.name} 升级到 Lv.${building.level}` };
    }

    /**
     * 获取资源
     * @param {string} type - 资源类型
     * @returns {number}
     */
    getResource(type) {
        return this.resources[type] || 0;
    }

    /**
     * 获取所有资源
     * @returns {Object}
     */
    getResources() {
        return this.resources;
    }

    /**
     * 增加资源
     * @param {string} type - 资源类型
     * @param {number} amount - 数量
     */
    addResource(type, amount) {
        if (!this.resources[type]) {
            this.resources[type] = 0;
        }
        this.resources[type] += amount;
        eventManager.emit('resourceUpdate', { type, amount, total: this.resources[type] });
    }

    /**
     * 消耗资源
     * @param {string} type - 资源类型
     * @param {number} amount - 数量
     * @returns {boolean}
     */
    consumeResource(type, amount) {
        if (this.resources[type] >= amount) {
            this.resources[type] -= amount;
            eventManager.emit('resourceUpdate', { type, amount: -amount, total: this.resources[type] });
            return true;
        }
        return false;
    }

    /**
     * 计算离线产出
     * @param {number} seconds - 离线秒数
     * @returns {Object}
     */
    calculateOfflineProduction(seconds) {
        const hours = seconds / 3600;
        const production = {};

        this.buildings.forEach(building => {
            const output = building.calculateProduction(hours);
            if (output) {
                production[output.resourceType] = (production[output.resourceType] || 0) + output.amount;
            }
        });

        return production;
    }

    /**
     * 收集离线产出
     * @param {number} seconds - 离线秒数
     */
    collectOfflineProduction(seconds) {
        const production = this.calculateOfflineProduction(seconds);

        for (const [type, amount] of Object.entries(production)) {
            if (amount > 0) {
                this.addResource(type, amount);
            }
        }
    }

    /**
     * 获取存档数据
     * @returns {Object}
     */
    getSaveData() {
        return {
            buildings: this.buildings.map(b => ({
                id: b.id,
                level: b.level
            })),
            resources: this.resources,
            offlineTime: Date.now()
        };
    }
}

// 导出单例
const shelterManager = new ShelterManager();

// 暴露到全局
window.shelterManager = shelterManager;