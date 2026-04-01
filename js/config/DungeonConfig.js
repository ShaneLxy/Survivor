/**
 * 地牢配置
 */
const DungeonConfig = {
    dungeons: [
        {
            id: 'dungeon_001',
            name: '废弃工厂',
            icon: '🏭',
            level: 1,
            energyCost: 5,
            enemies: [
                { id: 'enemy_zombie', count: 1 },
                { id: 'enemy_rat', count: 2 }
            ],
            rewards: {
                gold: { min: 50, max: 100 },
                exp: { min: 20, max: 40 },
                items: [
                    { id: 'wood', chance: 0.3 },
                    { id: 'stone', chance: 0.2 }
                ]
            },
            description: '一处被废弃的工厂,里面游荡着丧尸和老鼠'
        },
        {
            id: 'dungeon_002',
            name: '黑暗森林',
            icon: '🌲',
            level: 3,
            energyCost: 8,
            enemies: [
                { id: 'enemy_wolf', count: 2 },
                { id: 'enemy_bear', count: 1 }
            ],
            rewards: {
                gold: { min: 80, max: 150 },
                exp: { min: 40, max: 60 },
                items: [
                    { id: 'wood', chance: 0.4 },
                    { id: 'meat', chance: 0.3 }
                ]
            },
            description: '阴森的森林深处,藏着危险的野兽'
        },
        {
            id: 'dungeon_003',
            name: '地下墓穴',
            icon: '⚰️',
            level: 5,
            energyCost: 10,
            enemies: [
                { id: 'enemy_skeleton', count: 2 },
                { id: 'enemy_ghost', count: 1 }
            ],
            rewards: {
                gold: { min: 120, max: 200 },
                exp: { min: 60, max: 80 },
                items: [
                    { id: 'stone', chance: 0.3 },
                    { id: 'gold_ore', chance: 0.1 }
                ]
            },
            description: '古老的地下墓穴,骷髅和亡灵在此徘徊'
        },
        {
            id: 'dungeon_004',
            name: '废弃医院',
            icon: '🏥',
            level: 8,
            energyCost: 12,
            enemies: [
                { id: 'enemy_zombie_nurse', count: 2 },
                { id: 'enemy_mutant', count: 1 }
            ],
            rewards: {
                gold: { min: 150, max: 250 },
                exp: { min: 80, max: 100 },
                items: [
                    { id: 'water', chance: 0.4 },
                    { id: 'medicine', chance: 0.2 }
                ]
            },
            description: '被病毒感染的医院,变异生物在此繁殖'
        }
    ],

    // 敌人配置
    enemies: {
        enemy_zombie: {
            name: '丧尸',
            icon: '🧟',
            baseStats: { hp: 50, attack: 10, defense: 5, speed: 8 }
        },
        enemy_rat: {
            name: '老鼠',
            icon: '🐀',
            baseStats: { hp: 20, attack: 5, defense: 2, speed: 15 }
        },
        enemy_wolf: {
            name: '狼',
            icon: '🐺',
            baseStats: { hp: 60, attack: 15, defense: 5, speed: 20 }
        },
        enemy_bear: {
            name: '熊',
            icon: '🐻',
            baseStats: { hp: 150, attack: 25, defense: 15, speed: 10 }
        },
        enemy_skeleton: {
            name: '骷髅',
            icon: '💀',
            baseStats: { hp: 70, attack: 18, defense: 8, speed: 12 }
        },
        enemy_ghost: {
            name: '幽灵',
            icon: '👻',
            baseStats: { hp: 80, attack: 22, defense: 3, speed: 18 }
        },
        enemy_zombie_nurse: {
            name: '丧尸护士',
            icon: '🧟‍♀️',
            baseStats: { hp: 90, attack: 20, defense: 6, speed: 10 }
        },
        enemy_mutant: {
            name: '变异体',
            icon: '👾',
            baseStats: { hp: 200, attack: 35, defense: 12, speed: 8 }
        }
    },

    // 获取地牢配置
    getDungeonConfig(id) {
        return this.dungeons.find(dungeon => dungeon.id === id);
    },

    // 根据等级获取可进入的地牢
    getDungeonsByLevel(playerLevel) {
        return this.dungeons.filter(dungeon => dungeon.level <= playerLevel);
    },

    // 获取所有地牢
    getAllDungeons() {
        return this.dungeons;
    },

    // 获取敌人配置
    getEnemyConfig(id) {
        return this.enemies[id];
    },

    // 计算敌人属性
    calculateEnemyStats(enemyId, playerLevel) {
        const enemyConfig = this.getEnemyConfig(enemyId);
        const base = enemyConfig.baseStats;
        const levelMultiplier = 0.8 + (playerLevel / 10);

        return {
            hp: Math.floor(base.hp * levelMultiplier),
            attack: Math.floor(base.attack * levelMultiplier),
            defense: Math.floor(base.defense * levelMultiplier),
            speed: Math.floor(base.speed * levelMultiplier)
        };
    }
};

// 暴露到全局
window.DungeonConfig = DungeonConfig;
