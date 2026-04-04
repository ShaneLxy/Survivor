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
            sceneId: 'standard_9x9',
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
            description: '一处被废弃的工厂，里面游荡着丧尸和老鼠。'
        },
        {
            id: 'dungeon_002',
            name: '黑暗森林',
            icon: '🌲',
            level: 3,
            energyCost: 8,
            sceneId: 'standard_9x9',
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
            description: '阴森的森林深处，藏着危险的野兽。'
        },
        {
            id: 'dungeon_003',
            name: '地下墓穴',
            icon: '⚰️',
            level: 5,
            energyCost: 10,
            sceneId: 'standard_9x9',
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
            description: '古老的地下墓穴，骷髅和亡灵在此徘徊。'
        },
        {
            id: 'dungeon_004',
            name: '废弃医院',
            icon: '🏥',
            level: 8,
            energyCost: 12,
            sceneId: 'standard_9x9',
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
            description: '被病毒感染的医院，变异生物在此繁殖。'
        }
    ],

    enemies: {
        enemy_zombie: {
            name: '丧尸',
            icon: '🧟',
            rank: 'normal',
            baseStats: { hp: 50, attack: 10, defense: 5, speed: 8, crit: 3, antiCrit: 0, defensePen: 0, accuracy: 0, dodge: 0, attackRange: 1, moveRange: 2 }
        },
        enemy_rat: {
            name: '老鼠',
            icon: '🐀',
            rank: 'normal',
            baseStats: { hp: 20, attack: 5, defense: 2, speed: 15, crit: 5, antiCrit: 0, defensePen: 0, accuracy: 4, dodge: 6, attackRange: 1, moveRange: 3 }
        },
        enemy_wolf: {
            name: '狼',
            icon: '🐺',
            rank: 'normal',
            baseStats: { hp: 60, attack: 15, defense: 5, speed: 20, crit: 6, antiCrit: 2, defensePen: 2, accuracy: 4, dodge: 4, attackRange: 1, moveRange: 3 }
        },
        enemy_bear: {
            name: '熊',
            icon: '🐻',
            rank: 'elite',
            baseStats: { hp: 150, attack: 25, defense: 15, speed: 10, crit: 8, antiCrit: 5, defensePen: 4, accuracy: 2, dodge: 1, attackRange: 1, moveRange: 2 }
        },
        enemy_skeleton: {
            name: '骷髅',
            icon: '💀',
            rank: 'normal',
            baseStats: { hp: 70, attack: 18, defense: 8, speed: 12, crit: 4, antiCrit: 2, defensePen: 1, accuracy: 3, dodge: 2, attackRange: 1, moveRange: 2 }
        },
        enemy_ghost: {
            name: '幽灵',
            icon: '👻',
            rank: 'elite',
            baseStats: { hp: 80, attack: 22, defense: 3, speed: 18, crit: 8, antiCrit: 3, defensePen: 5, accuracy: 6, dodge: 8, attackRange: 2, moveRange: 3 }
        },
        enemy_zombie_nurse: {
            name: '丧尸护士',
            icon: '🧟‍♀️',
            rank: 'normal',
            baseStats: { hp: 90, attack: 20, defense: 6, speed: 10, crit: 4, antiCrit: 2, defensePen: 0, accuracy: 3, dodge: 0, attackRange: 1, moveRange: 2 }
        },
        enemy_mutant: {
            name: '变异体',
            icon: '👾',
            rank: 'boss',
            baseStats: { hp: 200, attack: 35, defense: 12, speed: 8, crit: 10, antiCrit: 6, defensePen: 8, accuracy: 6, dodge: 2, attackRange: 2, moveRange: 2 }
        }
    },

    getDungeonConfig(id) {
        return this.dungeons.find(dungeon => dungeon.id === id) || null;
    },

    getDungeonsByLevel(playerLevel) {
        return this.dungeons.filter(dungeon => dungeon.level <= playerLevel);
    },

    getAllDungeons() {
        return [...this.dungeons];
    },

    getEnemyConfig(id) {
        return this.enemies[id] || null;
    },

    calculateEnemyStats(enemyId, playerLevel) {
        const enemyConfig = this.getEnemyConfig(enemyId);
        const base = enemyConfig?.baseStats;
        if (!base) {
            return null;
        }
        const levelMultiplier = 0.8 + playerLevel / 10;
        return {
            hp: Math.floor(base.hp * levelMultiplier),
            attack: Math.floor(base.attack * levelMultiplier),
            defense: Math.floor(base.defense * levelMultiplier),
            speed: Math.floor(base.speed * levelMultiplier),
            crit: base.crit,
            antiCrit: base.antiCrit,
            defensePen: base.defensePen,
            accuracy: base.accuracy,
            dodge: base.dodge,
            attackRange: base.attackRange,
            moveRange: base.moveRange
        };
    }
};

window.DungeonConfig = DungeonConfig;
