/**
 * 游戏全局配置
 */
const GameConfig = {
    version: '1.0.0',

    player: {
        initialLevel: 1,
        initialExp: 0,
        initialEnergy: 100,
        maxEnergy: 100,
        initialGold: 100
    },

    levels: Array.from({ length: 100 }, (_, i) => ({
        level: i + 1,
        expRequired: Math.floor(100 * Math.pow(1.5, i))
    })),

    energy: {
        recoveryInterval: 300000,
        recoveryAmount: 1
    },

    offline: {
        maxOfflineHours: 24,
        resourceMultiplier: 0.1
    },

    ui: {
        itemGrid: {
            rows: 2,
            cols: 4,
            itemsPerPage: 8
        },
        animations: {
            battleDelay: 1000,
            gachaDelay: 500,
            toastDuration: 2000
        }
    },

    battle: {
        speedModeDelay: 500,
        normalModeDelay: 1000
    },

    gacha: {
        rates: {
            legendary: 0.005,
            epic: 0.04,
            rare: 0.255,
            common: 0.7
        },
        costs: {
            single: 100,
            ten: 900
        }
    },

    rarity: {
        common: {
            name: '普通',
            color: '#a0a0a0',
            stars: 1
        },
        rare: {
            name: '稀有',
            color: '#a335ee',
            stars: 2
        },
        epic: {
            name: '史诗',
            color: '#ff8000',
            stars: 3
        },
        legendary: {
            name: '传说',
            color: '#ffcc00',
            stars: 4
        }
    }
};

GameConfig.getLevelConfig = function(level) {
    return this.levels[level - 1] || this.levels[this.levels.length - 1];
};

GameConfig.getExpRequired = function(level) {
    return this.getLevelConfig(level).expRequired;
};

GameConfig.getRarityConfig = function(rarity) {
    return this.rarity[rarity] || this.rarity.common;
};

window.GameConfig = GameConfig;
