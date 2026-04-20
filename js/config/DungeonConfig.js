/**
 * 地牢配置
 */
const DungeonConfig = {
    defaultBossSpawnRound: 12,

    rankLabels: {
        normal: '普通',
        elite: '精英',
        boss: '领主'
    },

    dungeons: [
        {
            id: 'dungeon_001',
            name: '废弃工厂',
            icon: '🏭',
            level: 1,
            energyCost: 5,
            sceneId: 'standard_9x9',
            battlefield: {
                cols: 7,
                rows: 10,
                obstacles: [[3, 3], [3, 5], [5, 4]]
            },
            initialEnemies: [
                { id: 'enemy_zombie', count: 2 },
                { id: 'enemy_rat', count: 2 },
                { id: 'enemy_factory_guard', count: 1 }
            ],
            bossWaves: [
                {
                    id: 'dungeon_001_boss_wave_1',
                    spawnRound: 12,
                    spawnOnClearBeforeRound: true,
                    bosses: [
                        { id: 'enemy_factory_overseer', count: 1 }
                    ]
                }
            ],
            rewards: {
                gold: { min: 50, max: 100 },
                exp: { min: 20, max: 40 },
                items: [
                    { id: 'wood', chance: 0.3 },
                    { id: 'stone', chance: 0.2 }
                ]
            },
            description: '一处被废弃的工厂，低阶感染者与失控机械混杂其中。'
        },
        {
            id: 'dungeon_002',
            name: '黑暗森林',
            icon: '🌲',
            level: 3,
            energyCost: 8,
            sceneId: 'standard_9x9',
            battlefield: {
                cols: 8,
                rows: 10,
                obstacles: [[2, 4], [4, 2], [4, 7], [6, 5]]
            },
            initialEnemies: [
                { id: 'enemy_wolf', count: 2 },
                { id: 'enemy_bear', count: 1 },
                { id: 'enemy_forest_spider', count: 1 }
            ],
            bossWaves: [
                {
                    id: 'dungeon_002_boss_wave_1',
                    spawnRound: 12,
                    spawnOnClearBeforeRound: true,
                    bosses: [
                        { id: 'enemy_forest_alpha', count: 1 }
                    ]
                }
            ],
            rewards: {
                gold: { min: 80, max: 150 },
                exp: { min: 40, max: 60 },
                items: [
                    { id: 'wood', chance: 0.4 },
                    { id: 'meat', chance: 0.3 }
                ]
            },
            description: '阴森森林深处潜伏着野兽与异化蛛群。'
        },
        {
            id: 'dungeon_003',
            name: '地下墓穴',
            icon: '⚰️',
            level: 5,
            energyCost: 10,
            sceneId: 'standard_9x9',
            battlefield: {
                cols: 7,
                rows: 11,
                obstacles: [[3, 2], [3, 6], [5, 4], [7, 3], [7, 5]]
            },
            initialEnemies: [
                { id: 'enemy_skeleton', count: 2 },
                { id: 'enemy_ghost', count: 1 },
                { id: 'enemy_grave_keeper', count: 1 }
            ],
            bossWaves: [
                {
                    id: 'dungeon_003_boss_wave_1',
                    spawnRound: 12,
                    spawnOnClearBeforeRound: true,
                    bosses: [
                        { id: 'enemy_crypt_lord', count: 1 }
                    ]
                }
            ],
            rewards: {
                gold: { min: 120, max: 200 },
                exp: { min: 60, max: 80 },
                items: [
                    { id: 'stone', chance: 0.3 },
                    { id: 'iron_ore', chance: 0.1 }
                ]
            },
            description: '古老墓穴中充斥着亡灵与守墓怨魂。'
        },
        {
            id: 'dungeon_004',
            name: '废弃医院',
            icon: '🏥',
            level: 8,
            energyCost: 12,
            sceneId: 'standard_9x9',
            battlefield: {
                cols: 8,
                rows: 11,
                obstacles: [[2, 3], [2, 6], [4, 4], [4, 5], [7, 2], [7, 7]]
            },
            initialEnemies: [
                { id: 'enemy_zombie_nurse', count: 2 },
                { id: 'enemy_plague_brute', count: 1 }
            ],
            bossWaves: [
                {
                    id: 'dungeon_004_boss_wave_1',
                    spawnRound: 12,
                    spawnOnClearBeforeRound: true,
                    bosses: [
                        { id: 'enemy_mutant', count: 1 },
                        { id: 'enemy_plague_doctor', count: 1 }
                    ]
                }
            ],
            rewards: {
                gold: { min: 150, max: 250 },
                exp: { min: 80, max: 100 },
                items: [
                    { id: 'exp_potion', chance: 0.4 },
                    { id: 'medicine', chance: 0.2 }
                ]
            },
            description: '病毒肆虐后的医院深处，仍有危险领主盘踞。'
        }
    ],

    enemies: {
        enemy_zombie: {
            name: '丧尸',
            icon: '🧟',
            rank: 'normal',
            description: '行动迟缓的感染者，擅长用数量压制闯入者。',
            skill: null,
            baseStats: { hp: 56, attack: 12, defense: 5, speed: 8, crit: 3, antiCrit: 0, defensePen: 0, accuracy: 1, dodge: 0, attackRange: 1, moveRange: 2 }
        },
        enemy_rat: {
            name: '变异鼠',
            icon: '🐀',
            rank: 'normal',
            description: '速度极快的小型怪物，喜欢绕后袭扰。',
            skill: null,
            baseStats: { hp: 24, attack: 7, defense: 2, speed: 16, crit: 6, antiCrit: 0, defensePen: 0, accuracy: 4, dodge: 6, attackRange: 1, moveRange: 3 }
        },
        enemy_factory_guard: {
            name: '重装看守',
            icon: '🦾',
            rank: 'elite',
            description: '被改造成战斗兵器的工厂看守，正面承伤能力很强。',
            skill: {
                name: '重锤粉碎',
                multiplier: 1.6,
                description: '蓄力重击前方目标，造成 160% 攻击伤害。'
            },
            baseStats: { hp: 128, attack: 20, defense: 13, speed: 10, crit: 6, antiCrit: 4, defensePen: 3, accuracy: 2, dodge: 1, attackRange: 1, moveRange: 2 }
        },
        enemy_factory_overseer: {
            name: '工厂监工',
            icon: '🤖',
            rank: 'boss',
            description: '废弃工厂真正的支配者，会在杂兵倒下后亲自清场。',
            skill: {
                name: '过载轰击',
                multiplier: 2.05,
                description: '启动过载核心，对目标造成 205% 攻击伤害。'
            },
            baseStats: { hp: 220, attack: 34, defense: 16, speed: 11, crit: 10, antiCrit: 6, defensePen: 6, accuracy: 5, dodge: 2, attackRange: 2, moveRange: 2 }
        },
        enemy_wolf: {
            name: '狼',
            icon: '🐺',
            rank: 'normal',
            description: '敏捷的捕食者，善于快速逼近脆弱目标。',
            skill: null,
            baseStats: { hp: 64, attack: 16, defense: 5, speed: 20, crit: 6, antiCrit: 2, defensePen: 2, accuracy: 4, dodge: 4, attackRange: 1, moveRange: 3 }
        },
        enemy_bear: {
            name: '狂暴巨熊',
            icon: '🐻',
            rank: 'elite',
            description: '凶悍的森林霸主，拍击能直接撕裂前排防线。',
            skill: {
                name: '裂地猛击',
                multiplier: 1.65,
                description: '挥动巨掌砸向目标，造成 165% 攻击伤害。'
            },
            baseStats: { hp: 158, attack: 27, defense: 15, speed: 10, crit: 8, antiCrit: 5, defensePen: 4, accuracy: 2, dodge: 1, attackRange: 1, moveRange: 2 }
        },
        enemy_forest_spider: {
            name: '毒纹巨蛛',
            icon: '🕷️',
            rank: 'normal',
            description: '从阴影中扑出的剧毒蜘蛛，命中与闪避都不低。',
            skill: null,
            baseStats: { hp: 52, attack: 14, defense: 4, speed: 17, crit: 5, antiCrit: 2, defensePen: 2, accuracy: 6, dodge: 5, attackRange: 1, moveRange: 3 }
        },
        enemy_forest_alpha: {
            name: '森嚎狼王',
            icon: '🐺',
            rank: 'boss',
            description: '统御整片森林的狼王，会在猎场最混乱时现身。',
            skill: {
                name: '王者撕咬',
                multiplier: 2.1,
                description: '发起残暴扑杀，造成 210% 攻击伤害。'
            },
            baseStats: { hp: 238, attack: 38, defense: 12, speed: 17, crit: 12, antiCrit: 6, defensePen: 7, accuracy: 7, dodge: 4, attackRange: 1, moveRange: 3 }
        },
        enemy_skeleton: {
            name: '骷髅兵',
            icon: '💀',
            rank: 'normal',
            description: '被死气驱动的残破骸骨，数量众多但并不坚固。',
            skill: null,
            baseStats: { hp: 74, attack: 18, defense: 8, speed: 12, crit: 4, antiCrit: 2, defensePen: 1, accuracy: 3, dodge: 2, attackRange: 1, moveRange: 2 }
        },
        enemy_ghost: {
            name: '幽灵',
            icon: '👻',
            rank: 'elite',
            description: '游离于实体与虚无之间的亡灵，极难被准确命中。',
            skill: {
                name: '幽冥撕扯',
                multiplier: 1.7,
                description: '释放阴寒利爪，造成 170% 攻击伤害。'
            },
            baseStats: { hp: 86, attack: 23, defense: 3, speed: 18, crit: 8, antiCrit: 3, defensePen: 5, accuracy: 6, dodge: 8, attackRange: 2, moveRange: 3 }
        },
        enemy_grave_keeper: {
            name: '守墓武士',
            icon: '⚔️',
            rank: 'elite',
            description: '常年守卫墓穴的亡者战士，能精准斩开护甲。',
            skill: {
                name: '墓卫斩',
                multiplier: 1.75,
                description: '以墓穴怨气附着武器，造成 175% 攻击伤害。'
            },
            baseStats: { hp: 122, attack: 29, defense: 10, speed: 14, crit: 7, antiCrit: 4, defensePen: 7, accuracy: 5, dodge: 2, attackRange: 1, moveRange: 2 }
        },
        enemy_crypt_lord: {
            name: '墓穴领主',
            icon: '🧛',
            rank: 'boss',
            description: '统御整片地下墓穴的领主，擅长以死亡之力压迫敌人。',
            skill: {
                name: '冥府宣告',
                multiplier: 2.2,
                description: '汇聚死气爆发一击，造成 220% 攻击伤害。'
            },
            baseStats: { hp: 248, attack: 40, defense: 15, speed: 13, crit: 11, antiCrit: 7, defensePen: 8, accuracy: 7, dodge: 3, attackRange: 2, moveRange: 2 }
        },
        enemy_zombie_nurse: {
            name: '丧尸护士',
            icon: '🧟‍♀️',
            rank: 'normal',
            description: '医院内被感染的护理人员，攻击稳定且难以摆脱。',
            skill: null,
            baseStats: { hp: 96, attack: 21, defense: 6, speed: 10, crit: 4, antiCrit: 2, defensePen: 0, accuracy: 3, dodge: 0, attackRange: 1, moveRange: 2 }
        },
        enemy_plague_brute: {
            name: '疫病屠夫',
            icon: '🔪',
            rank: 'elite',
            description: '身躯畸变的医院执行者，近身爆发极强。',
            skill: {
                name: '病灶切开',
                multiplier: 1.8,
                description: '挥动手术巨刃，造成 180% 攻击伤害。'
            },
            baseStats: { hp: 168, attack: 30, defense: 12, speed: 11, crit: 8, antiCrit: 5, defensePen: 5, accuracy: 4, dodge: 1, attackRange: 1, moveRange: 2 }
        },
        enemy_mutant: {
            name: '变异体',
            icon: '👾',
            rank: 'boss',
            description: '由病毒彻底扭曲的怪物，拥有极高的生命力与破坏力。',
            skill: {
                name: '畸变撕裂',
                multiplier: 2.18,
                description: '撕裂血肉的一击，造成 218% 攻击伤害。'
            },
            baseStats: { hp: 280, attack: 42, defense: 14, speed: 9, crit: 10, antiCrit: 6, defensePen: 8, accuracy: 6, dodge: 2, attackRange: 2, moveRange: 2 }
        },
        enemy_plague_doctor: {
            name: '疫病主宰',
            icon: '🩺',
            rank: 'boss',
            description: '医院深处的领主之一，会与变异体一同镇守禁区。',
            skill: {
                name: '绝症审判',
                multiplier: 2.12,
                description: '释放高浓度病原冲击，造成 212% 攻击伤害。'
            },
            baseStats: { hp: 232, attack: 39, defense: 12, speed: 15, crit: 12, antiCrit: 7, defensePen: 7, accuracy: 8, dodge: 4, attackRange: 2, moveRange: 2 }
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

    getUnitCatalog() {
        return window.UnitCatalogLoader?.getData?.() || null;
    },

    getEnemyCatalog() {
        const source = this.getUnitCatalog()?.enemies || this.enemies;
        return Object.fromEntries(
            Object.entries(source).map(([id, config]) => [id, this.normalizeEnemyConfig(config)])
        );
    },

    normalizeSkillCollection(skills, skill = null) {
        if (Array.isArray(skills) && skills.length > 0) {
            return skills.filter(Boolean).map(item => ({ ...item }));
        }
        if (skill) {
            return [{ ...skill }];
        }
        return [];
    },

    normalizeEnemyConfig(config = {}) {
        const skills = this.normalizeSkillCollection(config.skills, config.skill);
        return {
            ...config,
            skills,
            skill: skills[0] || null
        };
    },

    getEnemyConfig(id) {
        return this.getEnemyCatalog()[id] || null;
    },

    getAllEnemyConfigs() {
        return Object.entries(this.getEnemyCatalog()).map(([id, config]) => ({ id, ...config }));
    },

    getEnemyRankLabel(rank) {
        return this.rankLabels[rank] || this.rankLabels.normal;
    },

    getDungeonEnemyPool(dungeonId) {
        const dungeon = this.getDungeonConfig(dungeonId);
        if (!dungeon) {
            return [];
        }
        const initialEnemies = (dungeon.initialEnemies || dungeon.enemies || []).map(entry => ({
            ...entry,
            sourceType: 'initial'
        }));
        const bossEntries = (dungeon.bossWaves || []).flatMap((wave, waveIndex) =>
            (wave.bosses || []).map(entry => ({
                ...entry,
                sourceType: 'boss',
                waveId: wave.id || `${dungeon.id}_boss_wave_${waveIndex + 1}`,
                spawnRound: Number(wave.spawnRound) || this.defaultBossSpawnRound,
                spawnOnClearBeforeRound: wave.spawnOnClearBeforeRound !== false
            }))
        );
        return [...initialEnemies, ...bossEntries];
    },

    calculateEnemyStats(enemyId, stageLevel = 1, multiplier = 1) {
        const enemyConfig = this.getEnemyConfig(enemyId);
        const base = enemyConfig?.baseStats;
        if (!base) {
            return null;
        }
        const normalizedStageLevel = Math.max(1, Number(stageLevel) || 1);
        const extraMultiplier = Math.max(0.1, Number(multiplier) || 1);
        const levelMultiplier = (0.95 + normalizedStageLevel * 0.08) * extraMultiplier;
        return {
            hp: Math.floor(base.hp * levelMultiplier),
            attack: Math.floor(base.attack * levelMultiplier),
            attackCoefficient: Math.max(0.05, Number(base.attackCoefficient) || 1),
            defense: Math.floor(base.defense * levelMultiplier),
            speed: Math.max(1, Math.floor(base.speed * (0.97 + normalizedStageLevel * 0.035) * Math.max(0.9, Math.min(extraMultiplier, 1.4)))),
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
