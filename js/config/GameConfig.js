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

    combatPower: {
        weights: {
            attack: 20,
            defense: 12,
            hp: 3,
            speed: 10,
            crit: 8,
            antiCrit: 6,
            defensePen: 8,
            accuracy: 6,
            dodge: 6,
            attackRange: 40,
            moveRange: 30
        }
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

GameConfig.calculateCombatPower = function(stats = {}) {
    const weights = this.combatPower?.weights || {};
    const attack = Math.max(0, Number(stats.attack) || 0);
    const attackCoefficient = Math.max(0.05, Number(stats.attackCoefficient) || 1);
    const defense = Math.max(0, Number(stats.defense) || 0);
    const hp = Math.max(0, Number(stats.hp ?? stats.maxHp) || 0);
    const speed = Math.max(0, Number(stats.speed) || 0);
    const crit = Math.max(0, Number(stats.crit) || 0);
    const antiCrit = Math.max(0, Number(stats.antiCrit) || 0);
    const defensePen = Math.max(0, Number(stats.defensePen) || 0);
    const accuracy = Math.max(0, Number(stats.accuracy) || 0);
    const dodge = Math.max(0, Number(stats.dodge) || 0);
    const attackRange = Math.max(0, Number(stats.attackRange) || 0);
    const moveRange = Math.max(0, Number(stats.moveRange) || 0);

    return Math.floor(
        attack * attackCoefficient * (weights.attack || 0) +
        defense * (weights.defense || 0) +
        hp * (weights.hp || 0) +
        speed * (weights.speed || 0) +
        crit * (weights.crit || 0) +
        antiCrit * (weights.antiCrit || 0) +
        defensePen * (weights.defensePen || 0) +
        accuracy * (weights.accuracy || 0) +
        dodge * (weights.dodge || 0) +
        attackRange * (weights.attackRange || 0) +
        moveRange * (weights.moveRange || 0)
    );
};

GameConfig.formatCombatPower = function(value) {
    return Math.max(0, Math.floor(Number(value) || 0)).toLocaleString('zh-CN');
};

window.GameConfig = GameConfig;
