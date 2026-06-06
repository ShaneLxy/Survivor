/**
 * 地牢配置
 * 注：副本（dungeons）、章节（DungeonChapterConfig）、敌人模板（enemyTemplates）均由 GM 工具同步注入，
 * 见 js/config/GmCatalogSyncPatch.js 的 applyDungeons / applyDungeonChapters / applyEnemies。
 * 此文件只保留通用的技能模板和工具方法。
 */
const DungeonConfig = {
    defaultBossSpawnRound: 12,

    rankLabels: {
        normal: '普通',
        elite: '精英',
        boss: '领主'
    },

    dungeons: [],

    // 章节 1-3 副本中使用的怪物模板（GM 副本配置仍引用这些 ID，
    // 但 GM 怪物图鉴节点未单独维护，故在此保留作为兜底；
    // 章节 4-6 的新怪物由 GM 同步注入，见 GmCatalogSyncPatch.applyEnemies）。
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
        },
        enemy_skill_charge_quake: {
            name: '\u84c4\u529b\u9707\u8361',
            description: '\u84c4\u529b2\u6b21\u81ea\u8eab\u884c\u52a8\u540e\uff0c\u5bf9\u81ea\u8eab\u5468\u56f41\u683c\u9020\u6210115%\u653b\u51fb\u4f24\u5bb3\u3002',
            multiplier: 1,
            cooldownTurns: 4,
            range: 4,
            targetType: 'enemy',
            targetCount: 1,
            effectType: 'warning_area_damage',
            customEffect: { type: 'warning_area_damage', shape: 'around_self', radius: 1, delayTurns: 2, multiplier: 1.15 }
        },
        enemy_skill_line_crack: {
            name: '\u76f4\u7ebf\u88c2\u51fb',
            description: '\u84c4\u529b1\u6b21\u81ea\u8eab\u884c\u52a8\u540e\uff0c\u6cbf\u76ee\u6807\u65b9\u5411\u76f4\u7ebf\u9020\u6210130%\u653b\u51fb\u4f24\u5bb3\u3002',
            multiplier: 1,
            cooldownTurns: 3,
            range: 5,
            targetType: 'enemy',
            targetCount: 1,
            effectType: 'warning_area_damage',
            customEffect: { type: 'warning_area_damage', shape: 'line_to_target', length: 8, delayTurns: 1, multiplier: 1.3 }
        },
        enemy_skill_random_fall: {
            name: '\u968f\u673a\u5760\u51fb',
            description: '\u84c4\u529b2\u6b21\u81ea\u8eab\u884c\u52a8\u540e\uff0c\u968f\u673a4\u4e2a\u683c\u5b50\u9020\u621090%-130%\u653b\u51fb\u4f24\u5bb3\u3002',
            multiplier: 1,
            cooldownTurns: 4,
            range: 6,
            targetType: 'enemy',
            targetCount: 1,
            effectType: 'warning_area_damage',
            customEffect: { type: 'warning_area_damage', shape: 'random_cells', count: 4, delayTurns: 2, multiplier: 1.1, randomDamageRatio: 0.2 }
        },
        enemy_skill_hook_drag: {
            name: '\u94a9\u722a\u62d6\u62fd',
            description: '\u5bf93\u683c\u5185\u7684\u654c\u65b9\u5355\u4f4d\u9020\u621090%\u653b\u51fb\u4f24\u5bb3\uff0c\u5e76\u5c06\u5176\u671d\u81ea\u8eab\u65b9\u5411\u6700\u591a\u62c9\u8fd12\u683c\u3002',
            multiplier: 0.9,
            cooldownTurns: 3,
            range: 3,
            targetType: 'enemy',
            targetCount: 1,
            effectType: 'damage',
            canCrit: false,
            customEffect: { type: 'displace', mode: 'pull', distance: 2 }
        },
        enemy_skill_quake_blow: {
            name: '\u9707\u9000\u51b2\u62f3',
            description: '\u5bf9\u76f8\u90bb\u654c\u65b9\u5355\u4f4d\u9020\u6210130%\u653b\u51fb\u4f24\u5bb3\uff0c\u5e76\u5c06\u5176\u5411\u8fdc\u79bb\u81ea\u8eab\u65b9\u5411\u51fb\u90003\u683c\u3002',
            multiplier: 1.3,
            cooldownTurns: 3,
            range: 1,
            targetType: 'enemy',
            targetCount: 1,
            effectType: 'damage',
            canCrit: true,
            customEffect: { type: 'displace', mode: 'push', distance: 3 }
        },
        enemy_skill_gust_repel: {
            name: '\u6c14\u6d6a\u51b2\u51fb',
            description: '\u5bf92\u683c\u5185\u7684\u654c\u65b9\u5355\u4f4d\u9020\u621060%\u653b\u51fb\u4f24\u5bb3\uff0c\u5e76\u5c06\u5176\u51fb\u90002\u683c\u3002',
            multiplier: 0.6,
            cooldownTurns: 2,
            range: 2,
            targetType: 'enemy',
            targetCount: 1,
            effectType: 'damage',
            canCrit: false,
            customEffect: { type: 'displace', mode: 'push', distance: 2 }
        },
        enemy_skill_pack_howl: {
            name: '\u517d\u7fa4\u568e\u53eb',
            description: '\u53ec\u5524\u540c\u4f34\u56de\u5e94\uff0c\u4e3a\u81ea\u8eab2\u683c\u5185\u6700\u591a3\u4e2a\u53cb\u519b\u6062\u590d110%\u653b\u51fb\u529b\u7684\u751f\u547d\u3002',
            multiplier: 1.1,
            cooldownTurns: 4,
            range: 2,
            targetType: 'ally',
            targetCount: 3,
            effectType: 'heal',
            canCrit: false
        },
        enemy_skill_chant_mend: {
            name: '\u5492\u6587\u533b\u6108',
            description: '\u5bf93\u683c\u5185\u7684\u4e00\u4e2a\u53cb\u519b\u6062\u590d200%\u653b\u51fb\u529b\u7684\u751f\u547d\uff0c\u4f18\u5148\u6cbb\u7597\u6700\u6b8b\u7684\u540c\u4f34\u3002',
            multiplier: 2,
            cooldownTurns: 3,
            range: 3,
            targetType: 'ally',
            targetCount: 1,
            effectType: 'heal',
            canCrit: false
        },
        enemy_skill_blood_drain: {
            name: '\u5438\u8840\u5543\u54ac',
            description: '\u5bf9\u76f8\u90bb\u654c\u65b9\u9020\u6210120%\u653b\u51fb\u4f24\u5bb3\uff0c\u5e76\u5c06\u9020\u6210\u4f24\u5bb3\u768450%\u8f6c\u5316\u4e3a\u81ea\u8eab\u751f\u547d\u3002',
            multiplier: 1.2,
            cooldownTurns: 3,
            range: 1,
            targetType: 'enemy',
            targetCount: 1,
            effectType: 'damage',
            canCrit: true,
            customEffect: { type: 'lifesteal', ratio: 0.5 }
        },
        enemy_skill_concussive_strike: {
            name: '\u9707\u8361\u91cd\u51fb',
            description: '\u5bf9\u5355\u4e2a\u654c\u65b9\u5355\u4f4d\u9020\u6210160%\u653b\u51fb\u4f24\u5bb3,\u5e76\u4f7f\u5176\u7729\u66551\u56de\u5408\u65e0\u6cd5\u884c\u52a8\u3002',
            multiplier: 1.6,
            cooldownTurns: 3,
            range: 1,
            targetType: 'enemy',
            targetCount: 1,
            effectType: 'damage',
            canCrit: true,
            statusEffects: [
                { type: 'stun', name: '\u7729\u6655', durationTurns: 1, stackMode: 'replace' }
            ]
        },
        enemy_skill_flash_blast: {
            name: '\u70ab\u5149\u7206',
            description: '\u8fdc\u7a0b\u5f15\u7206\u70ab\u5149,\u5bf9\u81f3\u591a2\u540d\u654c\u65b9\u5355\u4f4d\u9020\u621085%\u653b\u51fb\u4f24\u5bb3,\u5e76\u4f7f\u5176\u7729\u66551\u56de\u5408\u3002',
            multiplier: 0.85,
            cooldownTurns: 4,
            range: 3,
            targetType: 'enemy',
            targetCount: 2,
            effectType: 'damage',
            canCrit: false,
            statusEffects: [
                { type: 'stun', name: '\u7729\u6655', durationTurns: 1, stackMode: 'replace' }
            ]
        },
        enemy_skill_alluring_gaze: {
            name: '\u86ca\u60d1\u51dd\u89c6',
            description: '\u51dd\u89c61\u4e2a\u654c\u65b9\u5355\u4f4d,\u4f7f\u5176\u9677\u5165\u9b45\u60d12\u56de\u5408,\u671f\u95f4\u88ab\u8feb\u671d\u65bd\u6cd5\u8005\u79fb\u52a8\u4e14\u4e0d\u80fd\u884c\u52a8\u3002',
            multiplier: 0,
            cooldownTurns: 4,
            range: 4,
            targetType: 'enemy',
            targetCount: 1,
            effectType: 'utility',
            canCrit: false,
            statusEffects: [
                { type: 'charm', name: '\u9b45\u60d1', durationTurns: 2, stackMode: 'replace' }
            ]
        },
        enemy_skill_siren_song: {
            name: '\u585e\u58ec\u4e4b\u6b4c',
            description: '\u541f\u5531\u8ff7\u9b42\u4e4b\u6b4c,\u5bf9\u6700\u591a2\u540d\u654c\u65b9\u5355\u4f4d\u65bd\u52a0\u9b45\u60d12\u56de\u5408,\u88ab\u9b45\u60d1\u8005\u5c06\u671d\u65bd\u6cd5\u8005\u79fb\u52a8\u4e14\u4e0d\u80fd\u884c\u52a8\u3002',
            multiplier: 0,
            cooldownTurns: 5,
            range: 3,
            targetType: 'enemy',
            targetCount: 2,
            effectType: 'utility',
            canCrit: false,
            statusEffects: [
                { type: 'charm', name: '\u9b45\u60d1', durationTurns: 2, stackMode: 'replace' }
            ]
        },
        enemy_skill_vine_bind: {
            name: '\u85e4\u8513\u7f20\u7ed5',
            description: '\u5bf93\u683c\u5185\u7684\u5355\u4e2a\u654c\u65b9\u5355\u4f4d\u9020\u621075%\u653b\u51fb\u4f24\u5bb3\uff0c\u5e76\u4ee4\u5176\u88ab\u7f20\u7ed51\u56de\u5408\u65e0\u6cd5\u884c\u52a8\u3002',
            multiplier: 0.75,
            cooldownTurns: 3,
            range: 3,
            targetType: 'enemy',
            targetCount: 1,
            effectType: 'damage',
            canCrit: false,
            statusEffects: [
                { type: 'stun', name: '\u7f20\u7ed5', durationTurns: 1, stackMode: 'replace' }
            ]
        },
        enemy_skill_spore_cloud: {
            name: '\u5b62\u7c89\u96fe\u7206',
            description: '\u5411\u6700\u591a2\u540d\u654c\u65b9\u5355\u4f4d\u6d12\u6492\u8150\u8680\u5b62\u7c89\uff0c\u9020\u621070%\u653b\u51fb\u4f24\u5bb3\uff0c\u5e76\u9644\u52a02\u56de\u5408\u4e2d\u6bd2\u3002',
            multiplier: 0.7,
            cooldownTurns: 3,
            range: 3,
            targetType: 'enemy',
            targetCount: 2,
            effectType: 'damage',
            canCrit: false,
            statusEffects: [
                { type: 'poison', name: '\u5b62\u6bd2', durationTurns: 2, damageMultiplier: 0.16, stackMode: 'stack', maxStacks: 2 }
            ]
        },
        enemy_skill_suppressive_fire: {
            name: '\u538b\u5236\u9f50\u5c04',
            description: '\u5bf9\u6700\u591a2\u540d\u654c\u65b9\u5355\u4f4d\u9020\u621080%\u653b\u51fb\u4f24\u5bb3\uff0c\u5e76\u4ee5\u5bc6\u96c6\u706b\u529b\u538b\u5236\u5176\u8fdb\u653b\u8282\u594f\u3002',
            multiplier: 0.8,
            cooldownTurns: 3,
            range: 4,
            targetType: 'enemy',
            targetCount: 2,
            effectType: 'damage',
            canCrit: false,
            statusEffects: [
                { type: 'attack_down', name: '\u538b\u5236', stat: 'attack', value: -0.15, durationTurns: 2, modifierType: 'percent', stackMode: 'replace' }
            ]
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
        const unitEnemies = this.getUnitCatalog()?.enemies || {};
        const source = {};
        [this.enemies || {}, this.enemyTemplates || {}, unitEnemies].forEach((catalog) => {
            Object.entries(catalog).forEach(([id, config]) => {
                source[id] = { ...(source[id] || {}), ...(config || {}) };
            });
        });
        return Object.fromEntries(
            Object.entries(source).map(([id, config]) => [id, this.normalizeEnemyConfig(config)])
        );
    },

    getEnemySkillCatalog() {
        const source = {
            ...(this.enemySkillTemplates || {}),
            ...(this.getUnitCatalog()?.enemySkills || {})
        };
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
