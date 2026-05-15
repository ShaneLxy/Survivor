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
                heroSpawn: {
                    positions: [[10, 3], [10, 4], [10, 5], [9, 2], [9, 6]]
                },
                enemySpawn: {
                    positions: [[1, 3], [1, 4], [1, 5], [2, 2], [2, 6]]
                },
                obstacles: [[3, 3], [3, 5], [5, 4]]
            },
            initialEnemies: [
                { id: 'enemy_wanderer', count: 2, rank: 'normal', stats: { hp: 56, attack: 12, defense: 5, speed: 8, crit: 3, antiCrit: 0, defensePen: 0, accuracy: 1, dodge: 0, attackRange: 1, moveRange: 2 } },
                { id: 'enemy_refugee', count: 2, rank: 'normal', stats: { hp: 48, attack: 10, defense: 4, speed: 12, crit: 4, antiCrit: 0, defensePen: 1, accuracy: 2, dodge: 3, attackRange: 1, moveRange: 3 } },
                { id: 'enemy_raider', count: 1, rank: 'elite', stats: { hp: 128, attack: 20, defense: 13, speed: 10, crit: 6, antiCrit: 4, defensePen: 3, accuracy: 2, dodge: 1, attackRange: 1, moveRange: 2 } }
            ],
            bossWaves: [
                {
                    id: 'dungeon_001_boss_wave_1',
                    spawnRound: 12,
                    spawnOnClearBeforeRound: true,
                    bosses: [
                        { id: 'enemy_slaughterer', count: 1, rank: 'boss', stats: { hp: 220, attack: 34, defense: 16, speed: 11, crit: 10, antiCrit: 6, defensePen: 6, accuracy: 5, dodge: 2, attackRange: 2, moveRange: 2 } }
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
                heroSpawn: {
                    positions: [[10, 3], [10, 4], [10, 5], [10, 6], [9, 4], [9, 5]]
                },
                enemySpawn: {
                    positions: [[1, 2], [1, 4], [1, 6], [1, 7], [2, 3], [2, 6]]
                },
                obstacles: [[2, 4], [4, 2], [4, 7], [6, 5]]
            },
            initialEnemies: [
                { id: 'enemy_wolf', count: 2, rank: 'normal', stats: { hp: 64, attack: 16, defense: 5, speed: 20, crit: 6, antiCrit: 2, defensePen: 2, accuracy: 4, dodge: 4, attackRange: 1, moveRange: 3 } },
                { id: 'enemy_blood_wolf', count: 1, rank: 'elite', stats: { hp: 118, attack: 24, defense: 8, speed: 18, crit: 8, antiCrit: 3, defensePen: 4, accuracy: 5, dodge: 5, attackRange: 1, moveRange: 3 } },
                { id: 'enemy_hunter', count: 1, rank: 'normal', stats: { hp: 82, attack: 18, defense: 6, speed: 15, crit: 5, antiCrit: 2, defensePen: 2, accuracy: 6, dodge: 4, attackRange: 2, moveRange: 3 } }
            ],
            bossWaves: [
                {
                    id: 'dungeon_002_boss_wave_1',
                    spawnRound: 12,
                    spawnOnClearBeforeRound: true,
                    bosses: [
                        { id: 'enemy_aberrant_wolf', count: 1, rank: 'boss', stats: { hp: 238, attack: 38, defense: 12, speed: 17, crit: 12, antiCrit: 6, defensePen: 7, accuracy: 7, dodge: 4, attackRange: 1, moveRange: 3 } }
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
                heroSpawn: {
                    positions: [[11, 2], [11, 4], [11, 6], [10, 3], [10, 5]]
                },
                enemySpawn: {
                    positions: [[1, 2], [1, 4], [1, 6], [2, 3], [2, 5]]
                },
                obstacles: [[3, 2], [3, 6], [5, 4], [7, 3], [7, 5]]
            },
            initialEnemies: [
                { id: 'enemy_shelterer', count: 2, rank: 'normal', stats: { hp: 96, attack: 18, defense: 10, speed: 11, crit: 4, antiCrit: 2, defensePen: 1, accuracy: 3, dodge: 2, attackRange: 1, moveRange: 2 } },
                { id: 'enemy_raider', count: 1, rank: 'elite', stats: { hp: 132, attack: 27, defense: 11, speed: 15, crit: 8, antiCrit: 3, defensePen: 5, accuracy: 6, dodge: 3, attackRange: 1, moveRange: 3 } },
                { id: 'enemy_hunter', count: 1, rank: 'elite', stats: { hp: 122, attack: 29, defense: 10, speed: 14, crit: 7, antiCrit: 4, defensePen: 7, accuracy: 5, dodge: 2, attackRange: 2, moveRange: 2 } }
            ],
            bossWaves: [
                {
                    id: 'dungeon_003_boss_wave_1',
                    spawnRound: 12,
                    spawnOnClearBeforeRound: true,
                    bosses: [
                        { id: 'enemy_infected_hunter', count: 1, rank: 'boss', stats: { hp: 248, attack: 40, defense: 15, speed: 13, crit: 11, antiCrit: 7, defensePen: 8, accuracy: 7, dodge: 3, attackRange: 2, moveRange: 2 } }
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
                heroSpawn: {
                    positions: [[11, 3], [11, 4], [11, 5], [11, 6], [10, 2], [10, 7]]
                },
                enemySpawn: {
                    positions: [[1, 3], [1, 4], [1, 5], [1, 6], [2, 2], [2, 7]]
                },
                obstacles: [[2, 3], [2, 6], [4, 4], [4, 5], [7, 2], [7, 7]]
            },
            initialEnemies: [
                { id: 'enemy_refugee', count: 2, rank: 'normal', stats: { hp: 112, attack: 22, defense: 7, speed: 12, crit: 5, antiCrit: 2, defensePen: 1, accuracy: 4, dodge: 2, attackRange: 1, moveRange: 2 } },
                { id: 'enemy_slaughterer', count: 1, rank: 'elite', stats: { hp: 168, attack: 30, defense: 12, speed: 11, crit: 8, antiCrit: 5, defensePen: 5, accuracy: 4, dodge: 1, attackRange: 1, moveRange: 2 } }
            ],
            bossWaves: [
                {
                    id: 'dungeon_004_boss_wave_1',
                    spawnRound: 12,
                    spawnOnClearBeforeRound: true,
                    bosses: [
                        { id: 'enemy_mutant', count: 1, rank: 'boss', stats: { hp: 280, attack: 42, defense: 14, speed: 9, crit: 10, antiCrit: 6, defensePen: 8, accuracy: 6, dodge: 2, attackRange: 2, moveRange: 2 } },
                        { id: 'enemy_infected_hunter', count: 1, rank: 'boss', stats: { hp: 232, attack: 39, defense: 12, speed: 15, crit: 12, antiCrit: 7, defensePen: 7, accuracy: 8, dodge: 4, attackRange: 2, moveRange: 2 } }
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

    enemyTemplates: {
        enemy_raider: {
            name: '掠夺者',
            icon: '掠',
            portrait: 'assets/media/enemys/bingtuanA.png',
            description: '兵团体系中的前线突击单位，擅长快速压迫与近身缠斗。',
            skills: []
        },
        enemy_slaughterer: {
            name: '屠戮者',
            icon: '屠',
            portrait: 'assets/media/enemys/bingtuanB.png',
            description: '重型兵团单位，拥有更强的正面压制和斩杀威胁。',
            skills: []
        },
        enemy_hunter: {
            name: '狩猎者',
            icon: '猎',
            portrait: 'assets/media/enemys/bingtuanC.png',
            description: '擅长追踪与集火的战斗单位，会优先寻找薄弱目标。',
            skills: []
        },
        enemy_wolf: {
            name: '饿狼',
            icon: '狼',
            portrait: 'assets/media/enemys/langA.png',
            description: '荒野中成群游荡的捕食者，速度快，容易形成包围。',
            skills: []
        },
        enemy_blood_wolf: {
            name: '嗜狼',
            icon: '嗜',
            portrait: 'assets/media/enemys/langB.png',
            description: '更加凶残的狼类变种，攻击欲望与爆发力都更强。',
            skills: []
        },
        enemy_aberrant_wolf: {
            name: '异狼',
            icon: '异',
            portrait: 'assets/media/enemys/langC.png',
            description: '被异常力量扭曲的狼类，行动模式更难预测。',
            skills: []
        },
        enemy_wanderer: {
            name: '流浪者',
            icon: '流',
            portrait: 'assets/media/enemys/ganranA.png',
            description: '长期暴露在污染区的失序者，仍保留部分战斗本能。',
            skills: []
        },
        enemy_refugee: {
            name: '逃难者',
            icon: '逃',
            portrait: 'assets/media/enemys/ganranB.png',
            description: '在灾变中失控的逃难人群，行动混乱但数量危险。',
            skills: []
        },
        enemy_shelterer: {
            name: '避难者',
            icon: '避',
            portrait: 'assets/media/enemys/ganranC.png',
            description: '被污染吞噬的避难者，防御姿态更加顽固。',
            skills: []
        },
        enemy_infected_hunter: {
            name: '被感染的狩猎者',
            icon: '染',
            portrait: 'assets/media/enemys/ganranD.png',
            description: '感染后的狩猎者，仍保留追击技巧，并变得更加危险。',
            skills: []
        },
        enemy_mutant: {
            name: '异变者',
            icon: '变',
            portrait: 'assets/media/enemys/ganranE.png',
            description: '污染深处诞生的异变体，可根据关卡配置承担不同威胁定位。',
            skills: []
        }
    },

    enemySkillTemplates: {
        enemy_skill_rending_strike: {
            name: '撕裂打击',
            description: '对单个敌方单位造成120%攻击伤害，并附加2回合流血。',
            multiplier: 1.2,
            cooldownTurns: 2,
            range: 1,
            targetType: 'enemy',
            targetCount: 1,
            effectType: 'damage',
            canCrit: true,
            statusEffects: [
                { type: 'bleed', name: '流血', durationTurns: 2, damageMultiplier: 0.2, stackMode: 'stack', maxStacks: 3 }
            ]
        },
        enemy_skill_heavy_cleave: {
            name: '重劈',
            description: '对单个敌方单位造成170%攻击伤害，冷却较长。',
            multiplier: 1.7,
            cooldownTurns: 3,
            range: 1,
            targetType: 'enemy',
            targetCount: 1,
            effectType: 'damage',
            canCrit: true
        },
        enemy_skill_pack_pounce: {
            name: '扑袭',
            description: '对单个敌方单位造成110%攻击伤害，并降低目标速度。',
            multiplier: 1.1,
            cooldownTurns: 2,
            range: 2,
            targetType: 'enemy',
            targetCount: 1,
            effectType: 'damage',
            canCrit: true,
            statusEffects: [
                { type: 'slow', name: '迟缓', stat: 'speed', value: -0.15, durationTurns: 2, modifierType: 'percent', stackMode: 'replace' }
            ]
        },
        enemy_skill_corrosive_bite: {
            name: '腐蚀啃咬',
            description: '对单个敌方单位造成100%攻击伤害，并降低防御。',
            multiplier: 1,
            cooldownTurns: 2,
            range: 1,
            targetType: 'enemy',
            targetCount: 1,
            effectType: 'damage',
            canCrit: true,
            statusEffects: [
                { type: 'defense_down', name: '破甲', stat: 'defense', value: -0.2, durationTurns: 2, modifierType: 'percent', stackMode: 'replace' }
            ]
        },
        enemy_skill_frenzy: {
            name: '狂暴',
            description: '强化自身攻击力，持续2回合。',
            multiplier: 1,
            cooldownTurns: 4,
            range: 0,
            targetType: 'self',
            targetCount: 1,
            effectType: 'utility',
            statusEffects: [
                { type: 'attack_up', name: '狂暴', stat: 'attack', value: 0.25, durationTurns: 2, modifierType: 'percent', stackMode: 'replace' }
            ]
        },
        enemy_skill_toxic_spit: {
            name: '毒性喷吐',
            description: '远程攻击单个敌方单位，造成90%攻击伤害并附加中毒。',
            multiplier: 0.9,
            cooldownTurns: 2,
            range: 3,
            targetType: 'enemy',
            targetCount: 1,
            effectType: 'damage',
            canCrit: false,
            statusEffects: [
                { type: 'poison', name: '中毒', durationTurns: 2, damageMultiplier: 0.18, stackMode: 'stack', maxStacks: 3 }
            ]
        },
        enemy_skill_intimidating_roar: {
            name: '威吓咆哮',
            description: '压制多个敌方单位，降低攻击力。',
            multiplier: 1,
            cooldownTurns: 4,
            range: 3,
            targetType: 'enemy',
            targetCount: 2,
            effectType: 'utility',
            statusEffects: [
                { type: 'attack_down', name: '威吓', stat: 'attack', value: -0.18, durationTurns: 2, modifierType: 'percent', stackMode: 'replace' }
            ]
        },
        enemy_skill_mutant_regen: {
            name: '异变再生',
            description: '恢复自身生命。',
            multiplier: 1.2,
            cooldownTurns: 4,
            range: 0,
            targetType: 'self',
            targetCount: 1,
            effectType: 'heal'
        }
    },

    enemies: {},

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
        const source = this.getUnitCatalog()?.enemies || this.enemyTemplates || this.enemies;
        return Object.fromEntries(
            Object.entries(source).map(([id, config]) => [id, this.normalizeEnemyConfig(config)])
        );
    },

    getEnemySkillCatalog() {
        const source = this.getUnitCatalog()?.enemySkills || this.enemySkillTemplates || {};
        return Object.fromEntries(
            Object.entries(source).map(([id, skill]) => [id, { id, ...skill }])
        );
    },

    getEnemySkillConfig(id) {
        return this.getEnemySkillCatalog()[id] || null;
    },

    getAllEnemySkillConfigs() {
        return Object.entries(this.getEnemySkillCatalog()).map(([id, skill]) => ({ id, ...skill }));
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

    normalizeSkillReferenceCollection(skillRefs, skillIds) {
        const refs = [];
        if (Array.isArray(skillRefs)) {
            refs.push(...skillRefs);
        }
        if (Array.isArray(skillIds)) {
            refs.push(...skillIds);
        }
        return refs.filter(Boolean);
    },

    resolveSkillReferences(skillRefs, skillIds) {
        return this.normalizeSkillReferenceCollection(skillRefs, skillIds)
            .map((ref) => {
                const skillId = typeof ref === 'string'
                    ? ref
                    : (ref.skillId || ref.id || ref.refId || '');
                if (!skillId) {
                    return null;
                }
                const baseSkill = this.getEnemySkillConfig(skillId);
                if (!baseSkill) {
                    return null;
                }
                const overrides = typeof ref === 'object'
                    ? { ...ref.overrides, ...ref }
                    : {};
                delete overrides.id;
                delete overrides.skillId;
                delete overrides.refId;
                delete overrides.overrides;
                return {
                    ...baseSkill,
                    ...overrides,
                    id: skillId,
                    skillId
                };
            })
            .filter(Boolean);
    },

    normalizeStats(stats = {}) {
        return {
            hp: Math.max(1, Math.floor(Number(stats.hp) || 1)),
            attack: Math.max(1, Math.floor(Number(stats.attack) || 1)),
            attackCoefficient: Math.max(0.05, Number(stats.attackCoefficient) || 1),
            defense: Math.max(0, Math.floor(Number(stats.defense) || 0)),
            speed: Math.max(1, Math.floor(Number(stats.speed) || 1)),
            crit: Math.max(0, Number(stats.crit) || 0),
            antiCrit: Math.max(0, Number(stats.antiCrit) || 0),
            defensePen: Math.max(0, Number(stats.defensePen) || 0),
            accuracy: Math.max(0, Number(stats.accuracy) || 0),
            dodge: Math.max(0, Number(stats.dodge) || 0),
            attackRange: Math.max(1, Math.floor(Number(stats.attackRange) || 1)),
            moveRange: Math.max(1, Math.floor(Number(stats.moveRange) || 1))
        };
    },

    normalizeEnemyConfig(config = {}) {
        const directSkills = this.normalizeSkillCollection(config.skills, config.skill);
        const refSkills = this.resolveSkillReferences(config.skillRefs, config.skillIds);
        const skills = directSkills.length > 0 ? directSkills : refSkills;
        return {
            ...config,
            skills,
            skill: skills[0] || null
        };
    },

    getEnemyEntryRank(entry = {}, config = {}) {
        if (entry.rank) {
            return entry.rank;
        }
        if (entry.sourceType === 'boss' || entry.isBoss === true) {
            return 'boss';
        }
        return config.rank || 'normal';
    },

    resolveEnemyEntrySkills(entry = {}, config = {}) {
        const skills = this.normalizeSkillCollection(entry.skills, entry.skill);
        if (skills.length > 0) {
            return skills;
        }
        const entryRefSkills = this.resolveSkillReferences(entry.skillRefs, entry.skillIds);
        if (entryRefSkills.length > 0) {
            return entryRefSkills;
        }
        return config.skills ? config.skills.map(skill => ({ ...skill })) : [];
    },

    resolveEnemyEntryStats(entry = {}, stageLevel = 1) {
        const configuredStats = entry.stats || entry.baseStats || null;
        const calculatedStats = configuredStats
            ? this.normalizeStats(configuredStats)
            : this.calculateEnemyStats(entry.id, stageLevel, entry.multiplier);
        if (!calculatedStats) {
            return null;
        }
        return entry.overrideStats
            ? this.normalizeStats({ ...calculatedStats, ...entry.overrideStats })
            : calculatedStats;
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
        const base = enemyConfig?.baseStats || enemyConfig?.defaultStats;
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
