const BuildingConfig = {
    buildings: [
        {
            id: 'building_shelter',
            name: '避难所',
            icon: '🏚️',
            description: '玩家的核心建筑，负责基础资源产出与外围防线调度',
            maxLevel: 10,
            levels: [
                { level: 1, outputs: [{ type: 'resource', id: 'meat', amountPerHour: 5 }, { type: 'resource', id: 'stone', amountPerHour: 4 }, { type: 'resource', id: 'iron_ore', amountPerHour: 2 }, { type: 'resource', id: 'wood', amountPerHour: 3 }], td: { weaponDamageMultiplier: 1, weaponAttackSpeedMultiplier: 0.5, enemySpawnMultiplier: 1 }, upgradeCost: { gold: 100, wood: 20 } },
                { level: 2, outputs: [{ type: 'resource', id: 'meat', amountPerHour: 8 }, { type: 'resource', id: 'stone', amountPerHour: 8 }, { type: 'resource', id: 'iron_ore', amountPerHour: 4 }, { type: 'resource', id: 'wood', amountPerHour: 6 }], td: { weaponDamageMultiplier: 1.08, weaponAttackSpeedMultiplier: 0.56, enemySpawnMultiplier: 1.04 }, upgradeCost: { gold: 200, wood: 40 } },
                { level: 3, outputs: [{ type: 'resource', id: 'meat', amountPerHour: 12 }, { type: 'resource', id: 'stone', amountPerHour: 12 }, { type: 'resource', id: 'iron_ore', amountPerHour: 6 }, { type: 'resource', id: 'wood', amountPerHour: 9 }], td: { weaponDamageMultiplier: 1.16, weaponAttackSpeedMultiplier: 0.62, enemySpawnMultiplier: 1.08 }, upgradeCost: { gold: 400, wood: 60 } },
                { level: 4, outputs: [{ type: 'resource', id: 'meat', amountPerHour: 16 }, { type: 'resource', id: 'stone', amountPerHour: 18 }, { type: 'resource', id: 'iron_ore', amountPerHour: 9 }, { type: 'resource', id: 'wood', amountPerHour: 13 }], td: { weaponDamageMultiplier: 1.25, weaponAttackSpeedMultiplier: 0.68, enemySpawnMultiplier: 1.12 }, upgradeCost: { gold: 800, wood: 80 } },
                { level: 5, outputs: [{ type: 'resource', id: 'meat', amountPerHour: 22 }, { type: 'resource', id: 'stone', amountPerHour: 24 }, { type: 'resource', id: 'iron_ore', amountPerHour: 12 }, { type: 'resource', id: 'wood', amountPerHour: 18 }], td: { weaponDamageMultiplier: 1.35, weaponAttackSpeedMultiplier: 0.74, enemySpawnMultiplier: 1.16 }, upgradeCost: { gold: 1600, wood: 100 } },
                { level: 6, outputs: [{ type: 'resource', id: 'meat', amountPerHour: 28 }, { type: 'resource', id: 'stone', amountPerHour: 32 }, { type: 'resource', id: 'iron_ore', amountPerHour: 16 }, { type: 'resource', id: 'wood', amountPerHour: 24 }], td: { weaponDamageMultiplier: 1.46, weaponAttackSpeedMultiplier: 0.82, enemySpawnMultiplier: 1.2 }, upgradeCost: { gold: 3200, wood: 150 } },
                { level: 7, outputs: [{ type: 'resource', id: 'meat', amountPerHour: 36 }, { type: 'resource', id: 'stone', amountPerHour: 40 }, { type: 'resource', id: 'iron_ore', amountPerHour: 21 }, { type: 'resource', id: 'wood', amountPerHour: 31 }], td: { weaponDamageMultiplier: 1.58, weaponAttackSpeedMultiplier: 0.9, enemySpawnMultiplier: 1.24 }, upgradeCost: { gold: 6400, wood: 200 } },
                { level: 8, outputs: [{ type: 'resource', id: 'meat', amountPerHour: 45 }, { type: 'resource', id: 'stone', amountPerHour: 50 }, { type: 'resource', id: 'iron_ore', amountPerHour: 27 }, { type: 'resource', id: 'wood', amountPerHour: 39 }], td: { weaponDamageMultiplier: 1.72, weaponAttackSpeedMultiplier: 1, enemySpawnMultiplier: 1.28 }, upgradeCost: { gold: 12800, wood: 250 } },
                { level: 9, outputs: [{ type: 'resource', id: 'meat', amountPerHour: 56 }, { type: 'resource', id: 'stone', amountPerHour: 62 }, { type: 'resource', id: 'iron_ore', amountPerHour: 34 }, { type: 'resource', id: 'wood', amountPerHour: 48 }], td: { weaponDamageMultiplier: 1.88, weaponAttackSpeedMultiplier: 1.1, enemySpawnMultiplier: 1.32 }, upgradeCost: { gold: 25600, wood: 300 } },
                { level: 10, outputs: [{ type: 'resource', id: 'meat', amountPerHour: 68 }, { type: 'resource', id: 'stone', amountPerHour: 76 }, { type: 'resource', id: 'iron_ore', amountPerHour: 42 }, { type: 'resource', id: 'wood', amountPerHour: 58 }], td: { weaponDamageMultiplier: 2.05, weaponAttackSpeedMultiplier: 1.22, enemySpawnMultiplier: 1.36 }, upgradeCost: { gold: 51200, wood: 400 } }
            ]
        },        {
            id: 'building_farm',
            name: '农场',
            icon: '🌾',
            description: '自动产出肉类，提供稳定食物补给',
            maxLevel: 10,
            levels: [
                { level: 1, outputs: [{ type: 'resource', id: 'meat', amountPerHour: 5 }], upgradeCost: { gold: 100, wood: 30, stone: 10 } },
                { level: 2, outputs: [{ type: 'resource', id: 'meat', amountPerHour: 8 }], upgradeCost: { gold: 200, wood: 50, stone: 20 } },
                { level: 3, outputs: [{ type: 'resource', id: 'meat', amountPerHour: 12 }], upgradeCost: { gold: 400, wood: 80, stone: 30 } },
                { level: 4, outputs: [{ type: 'resource', id: 'meat', amountPerHour: 16 }], upgradeCost: { gold: 800, wood: 120, stone: 40 } },
                { level: 5, outputs: [{ type: 'resource', id: 'meat', amountPerHour: 22 }], upgradeCost: { gold: 1600, wood: 150, stone: 50 } },
                { level: 6, outputs: [{ type: 'resource', id: 'meat', amountPerHour: 28 }], upgradeCost: { gold: 3200, wood: 200, stone: 60 } },
                { level: 7, outputs: [{ type: 'resource', id: 'meat', amountPerHour: 36 }], upgradeCost: { gold: 6400, wood: 250, stone: 70 } },
                { level: 8, outputs: [{ type: 'resource', id: 'meat', amountPerHour: 45 }], upgradeCost: { gold: 12800, wood: 300, stone: 80 } },
                { level: 9, outputs: [{ type: 'resource', id: 'meat', amountPerHour: 56 }], upgradeCost: { gold: 25600, wood: 400, stone: 100 } },
                { level: 10, outputs: [{ type: 'resource', id: 'meat', amountPerHour: 68 }], upgradeCost: { gold: 51200, wood: 500, stone: 120 } }
            ]
        },
        {
            id: 'building_mine',
            name: '林矿',
            icon: '🌲',
            description: '同时产出石材、铁矿石与木材',
            maxLevel: 10,
            levels: [
                { level: 1, outputs: [{ type: 'resource', id: 'stone', amountPerHour: 4 }, { type: 'resource', id: 'iron_ore', amountPerHour: 2 }, { type: 'resource', id: 'wood', amountPerHour: 3 }], upgradeCost: { gold: 100, wood: 20, stone: 30 } },
                { level: 2, outputs: [{ type: 'resource', id: 'stone', amountPerHour: 8 }, { type: 'resource', id: 'iron_ore', amountPerHour: 4 }, { type: 'resource', id: 'wood', amountPerHour: 6 }], upgradeCost: { gold: 200, wood: 30, stone: 50 } },
                { level: 3, outputs: [{ type: 'resource', id: 'stone', amountPerHour: 12 }, { type: 'resource', id: 'iron_ore', amountPerHour: 6 }, { type: 'resource', id: 'wood', amountPerHour: 9 }], upgradeCost: { gold: 400, wood: 40, stone: 80 } },
                { level: 4, outputs: [{ type: 'resource', id: 'stone', amountPerHour: 18 }, { type: 'resource', id: 'iron_ore', amountPerHour: 9 }, { type: 'resource', id: 'wood', amountPerHour: 13 }], upgradeCost: { gold: 800, wood: 50, stone: 120 } },
                { level: 5, outputs: [{ type: 'resource', id: 'stone', amountPerHour: 24 }, { type: 'resource', id: 'iron_ore', amountPerHour: 12 }, { type: 'resource', id: 'wood', amountPerHour: 18 }], upgradeCost: { gold: 1600, wood: 60, stone: 150 } },
                { level: 6, outputs: [{ type: 'resource', id: 'stone', amountPerHour: 32 }, { type: 'resource', id: 'iron_ore', amountPerHour: 16 }, { type: 'resource', id: 'wood', amountPerHour: 24 }], upgradeCost: { gold: 3200, wood: 80, stone: 200 } },
                { level: 7, outputs: [{ type: 'resource', id: 'stone', amountPerHour: 40 }, { type: 'resource', id: 'iron_ore', amountPerHour: 21 }, { type: 'resource', id: 'wood', amountPerHour: 31 }], upgradeCost: { gold: 6400, wood: 100, stone: 250 } },
                { level: 8, outputs: [{ type: 'resource', id: 'stone', amountPerHour: 50 }, { type: 'resource', id: 'iron_ore', amountPerHour: 27 }, { type: 'resource', id: 'wood', amountPerHour: 39 }], upgradeCost: { gold: 12800, wood: 120, stone: 300 } },
                { level: 9, outputs: [{ type: 'resource', id: 'stone', amountPerHour: 62 }, { type: 'resource', id: 'iron_ore', amountPerHour: 34 }, { type: 'resource', id: 'wood', amountPerHour: 48 }], upgradeCost: { gold: 25600, wood: 150, stone: 400 } },
                { level: 10, outputs: [{ type: 'resource', id: 'stone', amountPerHour: 76 }, { type: 'resource', id: 'iron_ore', amountPerHour: 42 }, { type: 'resource', id: 'wood', amountPerHour: 58 }], upgradeCost: { gold: 51200, wood: 200, stone: 500 } }
            ]
        },
        {
            id: 'building_armory',
            name: '武器库',
            icon: '🛠️',
            description: '用于洗炼装备属性，等级越高可解锁更多可洗炼属性，并提高洗炼结果',
            maxLevel: 10,
            levels: [
                { level: 1, reforgeUnlockStats: ['defense'], reforgeBonus: 0, upgradeCost: { gold: 100, wood: 10, stone: 20 } },
                { level: 2, reforgeUnlockStats: ['hp'], reforgeBonus: 0, upgradeCost: { gold: 200, wood: 20, stone: 30 } },
                { level: 3, reforgeUnlockStats: ['attack'], reforgeBonus: 0, upgradeCost: { gold: 400, wood: 30, stone: 40 } },
                { level: 4, reforgeUnlockStats: ['crit'], reforgeBonus: 0, upgradeCost: { gold: 800, wood: 40, stone: 50 } },
                { level: 5, reforgeUnlockStats: ['antiCrit'], reforgeBonus: 0, upgradeCost: { gold: 1600, wood: 50, stone: 60 } },
                { level: 6, reforgeUnlockStats: [], reforgeBonus: 1, upgradeCost: { gold: 3200, wood: 60, stone: 80 } },
                { level: 7, reforgeUnlockStats: [], reforgeBonus: 2, upgradeCost: { gold: 6400, wood: 80, stone: 100 } },
                { level: 8, reforgeUnlockStats: [], reforgeBonus: 3, upgradeCost: { gold: 12800, wood: 100, stone: 120 } },
                { level: 9, reforgeUnlockStats: [], reforgeBonus: 4, upgradeCost: { gold: 25600, wood: 120, stone: 150 } },
                { level: 10, reforgeUnlockStats: [], reforgeBonus: 5, upgradeCost: { gold: 51200, wood: 150, stone: 200 } }
            ]
        },
        {
            id: 'building_training_ground',
            name: '训练场',
            icon: '🏘️',
            description: '提升英雄属性，增加战斗力',
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

    getBuildingConfig(id) {
        return this.buildings.find(building => building.id === id);
    },

    getAllBuildings() {
        return this.buildings;
    },

    getBuildingLevelConfig(buildingId, level) {
        const building = this.getBuildingConfig(buildingId);
        if (!building || !building.levels) return null;
        return building.levels[level - 1];
    },

    getUpgradeCost(buildingId, level) {
        const levelConfig = this.getBuildingLevelConfig(buildingId, level);
        return levelConfig ? levelConfig.upgradeCost : null;
    }
};

window.BuildingConfig = BuildingConfig;
