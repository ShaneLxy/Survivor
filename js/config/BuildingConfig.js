/**
 * 建筑配置
 */
const BuildingConfig = {
    buildings: [
        {
            id: 'building_shelter',
            name: '避难所',
            icon: '🏠',
            description: '玩家的核心建筑,提升体力上限',
            maxLevel: 10,
            levels: [
                { level: 1, energyBonus: 0, upgradeCost: { gold: 100, wood: 20 } },
                { level: 2, energyBonus: 20, upgradeCost: { gold: 200, wood: 40 } },
                { level: 3, energyBonus: 40, upgradeCost: { gold: 400, wood: 60 } },
                { level: 4, energyBonus: 60, upgradeCost: { gold: 800, wood: 80 } },
                { level: 5, energyBonus: 80, upgradeCost: { gold: 1600, wood: 100 } },
                { level: 6, energyBonus: 100, upgradeCost: { gold: 3200, wood: 150 } },
                { level: 7, energyBonus: 120, upgradeCost: { gold: 6400, wood: 200 } },
                { level: 8, energyBonus: 150, upgradeCost: { gold: 12800, wood: 250 } },
                { level: 9, energyBonus: 180, upgradeCost: { gold: 25600, wood: 300 } },
                { level: 10, energyBonus: 220, upgradeCost: { gold: 51200, wood: 400 } }
            ]
        },
        {
            id: 'building_farm',
            name: '农场',
            icon: '🌾',
            description: '自动产出食物,每小时产出肉类',
            maxLevel: 10,
            levels: [
                { level: 1, production: 1, upgradeCost: { gold: 100, wood: 30, stone: 10 } },
                { level: 2, production: 2, upgradeCost: { gold: 200, wood: 50, stone: 20 } },
                { level: 3, production: 3, upgradeCost: { gold: 400, wood: 80, stone: 30 } },
                { level: 4, production: 4, upgradeCost: { gold: 800, wood: 120, stone: 40 } },
                { level: 5, production: 5, upgradeCost: { gold: 1600, wood: 150, stone: 50 } },
                { level: 6, production: 6, upgradeCost: { gold: 3200, wood: 200, stone: 60 } },
                { level: 7, production: 7, upgradeCost: { gold: 6400, wood: 250, stone: 70 } },
                { level: 8, production: 8, upgradeCost: { gold: 12800, wood: 300, stone: 80 } },
                { level: 9, production: 9, upgradeCost: { gold: 25600, wood: 400, stone: 100 } },
                { level: 10, production: 10, upgradeCost: { gold: 51200, wood: 500, stone: 120 } }
            ]
        },
        {
            id: 'building_mine',
            name: '矿场',
            icon: '⛏️',
            description: '自动产出石材,每小时产出石料',
            maxLevel: 10,
            levels: [
                { level: 1, production: 1, upgradeCost: { gold: 100, wood: 20, stone: 30 } },
                { level: 2, production: 2, upgradeCost: { gold: 200, wood: 30, stone: 50 } },
                { level: 3, production: 3, upgradeCost: { gold: 400, wood: 40, stone: 80 } },
                { level: 4, production: 4, upgradeCost: { gold: 800, wood: 50, stone: 120 } },
                { level: 5, production: 5, upgradeCost: { gold: 1600, wood: 60, stone: 150 } },
                { level: 6, production: 6, upgradeCost: { gold: 3200, wood: 80, stone: 200 } },
                { level: 7, production: 7, upgradeCost: { gold: 6400, wood: 100, stone: 250 } },
                { level: 8, production: 8, upgradeCost: { gold: 12800, wood: 120, stone: 300 } },
                { level: 9, production: 9, upgradeCost: { gold: 25600, wood: 150, stone: 400 } },
                { level: 10, production: 10, upgradeCost: { gold: 51200, wood: 200, stone: 500 } }
            ]
        },
        {
            id: 'building_well',
            name: '水井',
            icon: '💧',
            description: '自动产出水源,每小时产出水源',
            maxLevel: 10,
            levels: [
                { level: 1, production: 1, upgradeCost: { gold: 100, wood: 10, stone: 20 } },
                { level: 2, production: 2, upgradeCost: { gold: 200, wood: 20, stone: 30 } },
                { level: 3, production: 3, upgradeCost: { gold: 400, wood: 30, stone: 40 } },
                { level: 4, production: 4, upgradeCost: { gold: 800, wood: 40, stone: 50 } },
                { level: 5, production: 5, upgradeCost: { gold: 1600, wood: 50, stone: 60 } },
                { level: 6, production: 6, upgradeCost: { gold: 3200, wood: 60, stone: 80 } },
                { level: 7, production: 7, upgradeCost: { gold: 6400, wood: 80, stone: 100 } },
                { level: 8, production: 8, upgradeCost: { gold: 12800, wood: 100, stone: 120 } },
                { level: 9, production: 9, upgradeCost: { gold: 25600, wood: 120, stone: 150 } },
                { level: 10, production: 10, upgradeCost: { gold: 51200, wood: 150, stone: 200 } }
            ]
        },
        {
            id: 'building_training_ground',
            name: '训练场',
            icon: '🏋️',
            description: '提升英雄属性,增加战斗力',
            maxLevel: 10,
            levels: [
                { level: 1, statBonus: 0.05, upgradeCost: { gold: 200, stone: 30 } },
                { level: 2, statBonus: 0.1, upgradeCost: { gold: 400, stone: 50 } },
                { level: 3, statBonus: 0.15, upgradeCost: { gold: 800, stone: 70 } },
                { level: 4, statBonus: 0.2, upgradeCost: { gold: 1600, stone: 90 } },
                { level: 5, statBonus: 0.25, upgradeCost: { gold: 3200, stone: 110 } },
                { level: 6, statBonus: 0.3, upgradeCost: { gold: 6400, stone: 130 } },
                { level: 7, statBonus: 0.35, upgradeCost: { gold: 12800, stone: 160 } },
                { level: 8, statBonus: 0.4, upgradeCost: { gold: 25600, stone: 190 } },
                { level: 9, statBonus: 0.45, upgradeCost: { gold: 51200, stone: 220 } },
                { level: 10, statBonus: 0.5, upgradeCost: { gold: 102400, stone: 250 } }
            ]
        }
    ],

    // 获取建筑配置
    getBuildingConfig(id) {
        return this.buildings.find(building => building.id === id);
    },

    // 获取所有建筑
    getAllBuildings() {
        return this.buildings;
    },

    // 获取建筑等级配置
    getBuildingLevelConfig(buildingId, level) {
        const building = this.getBuildingConfig(buildingId);
        if (!building || !building.levels) return null;
        return building.levels[level - 1];
    },

    // 获取升级费用
    getUpgradeCost(buildingId, level) {
        const levelConfig = this.getBuildingLevelConfig(buildingId, level);
        return levelConfig ? levelConfig.upgradeCost : null;
    }
};

// 暴露到全局
window.BuildingConfig = BuildingConfig;
