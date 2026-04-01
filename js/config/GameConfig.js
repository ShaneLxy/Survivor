/**
 * 游戏全局配置
 */
const GameConfig = {
    // 版本
    version: '1.0.0',

    // 玩家初始值
    player: {
        initialLevel: 1,
        initialExp: 0,
        initialEnergy: 100,
        maxEnergy: 100,
        initialGold: 100
    },

    // 等级配置
    levels: Array.from({ length: 100 }, (_, i) => ({
        level: i + 1,
        expRequired: Math.floor(100 * Math.pow(1.5, i))
    })),

    // 体力恢复
    energy: {
        recoveryInterval: 300000, // 5分钟恢复1点体力
        recoveryAmount: 1
    },

    // 离线产出
    offline: {
        maxOfflineHours: 24, // 最多计算24小时
        resourceMultiplier: 0.1 // 每小时产出倍率
    },

    // UI配置
    ui: {
        itemGrid: {
            rows: 2,
            cols: 4,
            itemsPerPage: 8
        },
        animations: {
            battleDelay: 1000, // 战斗每回合延迟(ms)
            gachaDelay: 500, // 抽卡动画延迟(ms)
            toastDuration: 2000 // Toast显示时长(ms)
        }
    },

    // 战斗配置
    battle: {
        speedModeDelay: 500, // 速攻模式延迟
        normalModeDelay: 1000 // 普通模式延迟
    },

    // 抽卡配置
    gacha: {
        rates: {
            legendary: 0.005, // 0.5%
            epic: 0.04, // 4%
            rare: 0.255, // 25.5%
            common: 0.7 // 70%
        },
        costs: {
            single: 100,
            ten: 900
        }
    },

    // 稀有度配置
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

// 获取等级配置
GameConfig.getLevelConfig = function(level) {
    return this.levels[level - 1] || this.levels[this.levels.length - 1];
};

// 获取升级所需经验
GameConfig.getExpRequired = function(level) {
    return this.getLevelConfig(level).expRequired;
};

// 获取稀有度配置
GameConfig.getRarityConfig = function(rarity) {
    return this.rarity[rarity] || this.rarity.common;
};

// 暴露到全局
window.GameConfig = GameConfig;
