/**
 * 英雄配置
 */
const HeroConfig = {
    defaultBaseStats: {
        hp: 100,
        attack: 20,
        attackCoefficient: 1,
        defense: 10,
        speed: 20,
        crit: 5,
        antiCrit: 0,
        defensePen: 0,
        accuracy: 0,
        dodge: 0,
        attackRange: 1,
        moveRange: 3
    },

    professionDefinitions: {
        defender: { id: 'defender', name: '守备者', description: '高生存前排职业，擅长承伤与团队增益。', tags: ['frontline', 'buff', 'durable'] },
        psionic: { id: 'psionic', name: '灵能者', description: '高速脆皮职业，偏向控制与辅助。', tags: ['control', 'buff', 'fast'] },
        raider: { id: 'raider', name: '破袭者', description: '高攻击高暴击输出职业，偏向爆发。', tags: ['damage', 'burst', 'crit'] }
    },

    starMaxLevel: 16,
    starStages: [
        { type: 'star', start: 1, end: 5, icon: '★', unit: '星', color: '#ffd700' },
        { type: 'moon', start: 6, end: 10, icon: '☽', unit: '月', color: '#7dd3fc' },
        { type: 'sun', start: 11, end: 15, icon: '☀', unit: '红日', color: '#f87171' },
        { type: 'crown', start: 16, end: 16, icon: '👑', unit: '皇冠', color: '#f59e0b' }
    ],

    statDefinitions: {
        hp: { name: '生命', description: '决定英雄可承受的伤害上限。' },
        attack: { name: '攻击', description: '决定普通攻击和技能造成的基础伤害。' },
        defense: { name: '防御', description: '减少受到的伤害，防御越高越耐打。' },
        speed: { name: '速度', description: '影响回合进度推进速度，越高越容易更早行动。' },
        crit: { name: '暴击', description: '数值越高，越容易打出暴击，且暴击伤害更高。' },
        antiCrit: { name: '抗暴', description: '降低被暴击的概率和受到的暴击伤害。' },
        defensePen: { name: '破防', description: '攻击时无视敌方一定比例的防御力。' },
        accuracy: { name: '命中率', description: '提升攻击命中的稳定性，降低被闪避的概率。' },
        dodge: { name: '闪避率', description: '提升闪避攻击的概率，降低被命中的机会。' },
        attackRange: { name: '攻击距离', description: '单次行动可攻击到的范围。' },
        moveRange: { name: '移动距离', description: '单次移动可以移动的范围。' }
    },

    displayStats: ['hp', 'attack', 'defense', 'speed', 'crit', 'antiCrit', 'defensePen', 'accuracy', 'dodge', 'attackRange', 'moveRange'],

    rarityGrowthMultipliers: {
        common: { level: 0.025, star: 0.06 },
        rare: { level: 0.032, star: 0.075 },
        epic: { level: 0.04, star: 0.09 },
        legendary: { level: 0.05, star: 0.11 }
    },

    specialTraitTracksByRarity: {
        common: [
            { stage: 1, kind: 'unlock', slot: 1, unlocksSlot: true, label: '解锁特技' },
            { stage: 2, kind: 'boost', label: '第二强化' },
            { stage: 3, kind: 'boost', label: '第三强化' },
            { stage: 6, kind: 'boost', label: '第四强化' },
            { stage: 11, kind: 'boost', label: '第五强化' },
            { stage: 15, kind: 'boost', label: '第六强化' },
            { stage: 16, kind: 'ultimate', label: '终极强化' }
        ],
        rare: [
            { stage: 2, kind: 'unlock', slot: 1, unlocksSlot: true, label: '解锁第一特技' },
            { stage: 4, kind: 'boost', label: '第一强化' },
            { stage: 6, kind: 'boost', label: '第二强化' },
            { stage: 11, kind: 'unlock', slot: 2, unlocksSlot: true, label: '解锁第二特技' },
            { stage: 15, kind: 'boost', label: '第三强化' },
            { stage: 16, kind: 'ultimate', label: '终极强化' }
        ],
        epic: [
            { stage: 3, kind: 'unlock', slot: 1, unlocksSlot: true, label: '解锁第一特技' },
            { stage: 4, kind: 'boost', label: '第一强化' },
            { stage: 6, kind: 'unlock', slot: 2, unlocksSlot: true, label: '解锁第二特技' },
            { stage: 11, kind: 'boost', label: '第三强化' },
            { stage: 15, kind: 'unlock', slot: 3, unlocksSlot: true, label: '解锁第三特技' },
            { stage: 16, kind: 'ultimate', label: '终极强化' }
        ],
        legendary: [
            { stage: 3, kind: 'unlock', slot: 1, unlocksSlot: true, label: '解锁第一特技' },
            { stage: 4, kind: 'boost', label: '第一强化' },
            { stage: 6, kind: 'unlock', slot: 2, unlocksSlot: true, label: '解锁第二特技' },
            { stage: 11, kind: 'boost', label: '第三强化' },
            { stage: 15, kind: 'unlock', slot: 3, unlocksSlot: true, label: '解锁第三特技' },
            { stage: 16, kind: 'ultimate', slot: 4, unlocksSlot: true, label: '解锁第四特技并终极强化' }
        ]
    },

    getUnitCatalog() {
        return window.UnitCatalogLoader?.getData?.() || null;
    },

    getProfessionMap() {
        const catalogMap = this.getUnitCatalog()?.professions || {};
        return {
            ...this.professionDefinitions,
            ...catalogMap
        };
    },

    getHeroList() {
        const catalogHeroes = this.getUnitCatalog()?.heroes;
        const source = Array.isArray(catalogHeroes) && catalogHeroes.length > 0 ? catalogHeroes : this.heroes;
        return source.map(hero => this.normalizeHeroConfig(hero));
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

    getProfessionIconPath(professionId) {
        if (!professionId) {
            return null;
        }
        const rawPath = `assets/media/professions/${professionId}.png`;
        return window.VersionManager?.getVersionedAssetUrl?.(rawPath) || rawPath;
    },

    getCardPortraitPath(portraitPath) {
        if (!portraitPath || typeof portraitPath !== 'string') {
            return null;
        }

        const explicitPath = portraitPath.replace('assets/media/heroes/', 'assets/media/heroesCardPortrait/');
        return window.VersionManager?.getVersionedAssetUrl?.(explicitPath) || explicitPath;
    },

    normalizeHeroConfig(hero = {}) {
        const skills = this.normalizeSkillCollection(hero.skills, hero.skill);
        const portrait = hero.portrait
            ? (window.VersionManager?.getVersionedAssetUrl?.(hero.portrait) || hero.portrait)
            : null;
        const cardPortrait = hero.cardPortrait
            ? (window.VersionManager?.getVersionedAssetUrl?.(hero.cardPortrait) || hero.cardPortrait)
            : this.getCardPortraitPath(hero.portrait);
        return {
            ...hero,
            rarity: this.normalizeRarity(hero.rarity),
            profession: hero.profession || null,
            portrait,
            cardPortrait,
            professionIcon: hero.professionIcon || this.getProfessionIconPath(hero.profession),
            skills,
            skill: skills[0] || null
        };
    },

    heroes: [],


    getHeroConfig(id) {
        return this.getHeroList().find(hero => hero.id === id) || null;
    },

    getHeroesByRarity(rarity) {
        return this.getHeroList().filter(hero => hero.rarity === rarity);
    },

    getAllHeroes() {
        return [...this.getHeroList()];
    },

    getAllHeroConfigs() {
        return this.getAllHeroes();
    },

    getStatDefinition(statKey) {
        return this.statDefinitions[statKey] || { name: statKey, description: '' };
    },

    getDisplayStats() {
        return [...this.displayStats];
    },

    getProfessionConfig(professionId) {
        return this.getProfessionMap()[professionId] || this.professionDefinitions[professionId] || null;
    },

    getProfessionName(professionId) {
        return this.getProfessionConfig(professionId)?.name || '未定职业';
    },

    normalizeSpecialTraitTrackEntry(entry = {}, index = 0) {
        const slot = Number(entry.slot);
        const kind = entry.kind || (slot > 0 ? 'unlock' : 'boost');
        return {
            stage: this.normalizeStarLevel(entry.stage),
            kind,
            slot: Number.isFinite(slot) && slot > 0 ? slot : null,
            unlocksSlot: Boolean(entry.unlocksSlot ?? ((kind === 'unlock' || kind === 'ultimate') && slot > 0)),
            label: entry.label || `阶段${index + 1}`,
            description: entry.description || ''
        };
    },

    getSpecialTraitTrackByRarity(rarity, hero = null) {
        const customTrack = Array.isArray(hero?.specialTraits?.track) ? hero.specialTraits.track : null;
        const source = customTrack?.length ? customTrack : (this.specialTraitTracksByRarity[this.normalizeRarity(rarity)] || this.specialTraitTracksByRarity.common);
        return source.map((entry, index) => this.normalizeSpecialTraitTrackEntry(entry, index));
    },

    getSpecialTraitSlotCount(rarity, hero = null) {
        const configuredCount = Number(hero?.specialTraits?.slotCount);
        if (Number.isFinite(configuredCount) && configuredCount > 0) {
            return Math.max(1, Math.min(4, Math.floor(configuredCount)));
        }

        const customTraitsCount = Array.isArray(hero?.specialTraits?.traits) ? hero.specialTraits.traits.length : 0;
        if (customTraitsCount > 0) {
            return Math.max(1, Math.min(4, customTraitsCount));
        }

        const raritySlots = Number(window.GameConfig?.getRarityConfig?.(this.normalizeRarity(rarity))?.stars) || 1;
        return Math.max(1, Math.min(4, raritySlots));
    },

    getSpecialTraitConfig(heroConfigId) {
        const hero = this.getHeroConfig(heroConfigId) || {};
        const config = hero.specialTraits;
        if (!config || typeof config !== 'object') {
            return null;
        }
        return {
            name: config.name || hero.skill?.name || '专属特技',
            summary: config.summary || '',
            stages: Array.isArray(config.stages) ? config.stages.map(stage => ({ ...stage })) : [],
            traits: Array.isArray(config.traits) ? config.traits.map(trait => ({ ...trait })) : [],
            slotCount: Number(config.slotCount) || null
        };
    },

    normalizeStats(baseStats = {}) {
        return {
            ...this.defaultBaseStats,
            ...baseStats
        };
    },

    normalizeRarity(rarity) {
        return this.rarityGrowthMultipliers[rarity] ? rarity : 'common';
    },

    getGrowthConfigByRarity(rarity) {
        return this.rarityGrowthMultipliers[this.normalizeRarity(rarity)];
    },

    normalizeStarLevel(level) {
        const normalized = Math.max(1, Number(level) || 1);
        return Math.min(this.starMaxLevel, normalized);
    },

    isMaxStarLevel(level) {
        return this.normalizeStarLevel(level) >= this.starMaxLevel;
    },

    getStarStage(level) {
        const normalized = this.normalizeStarLevel(level);
        return this.starStages.find(stage => normalized >= stage.start && normalized <= stage.end) || this.starStages[0];
    },

    getStarDisplayInfo(level) {
        const normalized = this.normalizeStarLevel(level);
        const stage = this.getStarStage(normalized);
        const count = stage.type === 'crown' ? 1 : normalized - stage.start + 1;
        return {
            level: normalized,
            type: stage.type,
            count,
            icon: stage.icon,
            text: stage.type === 'crown' ? stage.icon : stage.icon.repeat(count),
            label: stage.type === 'crown' ? stage.unit : `${count}${stage.unit}`,
            className: `hero-rank-${stage.type}`,
            color: stage.color,
            isMax: normalized >= this.starMaxLevel
        };
    },

    getStarUpgradeCost(currentLevel) {
        const normalized = this.normalizeStarLevel(currentLevel);
        if (normalized >= this.starMaxLevel) {
            return 0;
        }
        return (normalized + 1) * 50;
    },

    getLevelCapByStars(starLevel) {
        const normalized = this.normalizeStarLevel(starLevel);
        return normalized * 30;
    },

    getStarBonusMultiplier(level, rarity = 'common') {
        const progress = Math.max(0, this.normalizeStarLevel(level) - 1);
        const growth = this.getGrowthConfigByRarity(rarity);
        return 1 + progress * growth.star;
    },

    getSpecialTraitDefinitions(heroConfigId) {
        const hero = this.getHeroConfig(heroConfigId) || {};
        const rarity = this.normalizeRarity(hero.rarity);
        const traitConfig = this.getSpecialTraitConfig(heroConfigId) || {};
        const track = this.getSpecialTraitTrackByRarity(rarity, hero);
        const skills = this.normalizeSkillCollection(hero.skills, hero.skill);
        const customTraits = Array.isArray(traitConfig.traits) ? traitConfig.traits : [];
        const slotCount = this.getSpecialTraitSlotCount(rarity, hero);
        const unlockStageMap = new Map();

        track.forEach(entry => {
            if (entry.unlocksSlot && entry.slot) {
                unlockStageMap.set(entry.slot, entry.stage);
            }
        });

        return Array.from({ length: slotCount }, (_, index) => {
            const slot = index + 1;
            const source = customTraits[index] || skills[index] || {};
            const unlockStage = unlockStageMap.get(slot) || track[0]?.stage || 1;
            const unlockInfo = this.getStarDisplayInfo(unlockStage);
            const generatedName = slotCount === 1 ? (source.name || '核心特技') : (source.name || `特技${slot}`);
            return {
                slot,
                name: generatedName,
                description: source.description || `该特技位将在后续为${hero.name || '该英雄'}配置具体效果。`,
                unlockStage,
                unlockLabel: `${unlockInfo.label}解锁`,
                configured: Boolean(source.name || source.description)
            };
        });
    },

    buildSpecialTraitMilestoneDescription(entry, traits, hero, rarityName) {
        const stageLabel = this.getStarDisplayInfo(entry.stage).label;
        const traitName = entry.slot ? (traits[entry.slot - 1]?.name || `特技${entry.slot}`) : '';

        if (entry.description) {
            return entry.description;
        }

        if (entry.kind === 'unlock' && entry.slot) {
            return `达到${stageLabel}后解锁${traitName}，后续可为该特技配置独立效果。`;
        }

        if (entry.kind === 'ultimate') {
            if (entry.unlocksSlot && entry.slot) {
                return `达到${stageLabel}后解锁${traitName}，并进入终极强化节点。`;
            }
            return `达到${stageLabel}后进入终极强化节点，用于承接该英雄的最终特技提升。`;
        }

        return `${rarityName}品质英雄在${stageLabel}进入“${entry.label}”节点，后续可为已解锁特技配置强化效果。`;
    },

    getSpecialTraitFramework(heroConfigId) {
        const hero = this.getHeroConfig(heroConfigId) || {};
        const rarity = this.normalizeRarity(hero.rarity);
        const rarityConfig = window.GameConfig?.getRarityConfig?.(rarity) || { name: rarity };
        const traitConfig = this.getSpecialTraitConfig(heroConfigId) || {};
        const track = this.getSpecialTraitTrackByRarity(rarity, hero);
        const traits = this.getSpecialTraitDefinitions(heroConfigId);
        const defaultName = traits.length > 1 ? '专属特技体系' : (traits[0]?.name || hero.skill?.name || '专属特技');
        const summary = traitConfig.summary || `${rarityConfig.name}品质英雄采用 ${traits.length} 个特技位的成长轨道，关键升星节点会逐步解锁或强化特技。`;

        return {
            name: traitConfig.name || defaultName,
            summary,
            rarity,
            rarityName: rarityConfig.name || rarity,
            slotCount: traits.length,
            traits,
            milestones: track.map((entry, index) => ({
                ...this.getStarDisplayInfo(entry.stage),
                stage: entry.stage,
                sequence: index + 1,
                kind: entry.kind,
                slot: entry.slot,
                unlocksSlot: entry.unlocksSlot,
                label: entry.label,
                description: this.buildSpecialTraitMilestoneDescription(entry, traits, hero, rarityConfig.name || rarity)
            }))
        };
    },

    getTraitBattleGrowth(heroConfigId) {
        const hero = this.getHeroConfig(heroConfigId) || {};
        const growth = hero?.specialTraits?.battleGrowth;
        return growth && typeof growth === 'object' ? growth : null;
    },

    getTraitBattleModifiers(heroConfigId, starLevel) {
        const normalizedStar = this.normalizeStarLevel(starLevel);
        const growth = this.getTraitBattleGrowth(heroConfigId);
        const modifiers = {
            attackRangeBonus: 0,
            statBonuses: {}
        };

        const attackRangeStages = Array.isArray(growth?.attackRangeStages) ? growth.attackRangeStages : [];
        attackRangeStages.forEach(stageConfig => {
            if (normalizedStar >= this.normalizeStarLevel(stageConfig?.stage)) {
                modifiers.attackRangeBonus = Math.max(modifiers.attackRangeBonus, Number(stageConfig?.value) || 0);
            }
        });

        const statStages = Array.isArray(growth?.statStages) ? growth.statStages : [];
        statStages.forEach(stageConfig => {
            if (normalizedStar < this.normalizeStarLevel(stageConfig?.stage)) {
                return;
            }
            Object.entries(stageConfig?.stats || {}).forEach(([key, value]) => {
                modifiers.statBonuses[key] = Number(value) || 0;
            });
        });

        return modifiers;
    },

    getHeroSkillsForStarLevel(heroConfigId, starLevel) {
        const hero = this.getHeroConfig(heroConfigId) || {};
        const baseSkills = this.normalizeSkillCollection(hero.skills, hero.skill);
        const normalizedStar = this.normalizeStarLevel(starLevel);
        const growth = this.getTraitBattleGrowth(heroConfigId);
        const skillGrowthMap = new Map();

        (Array.isArray(growth?.skills) ? growth.skills : []).forEach(skillGrowth => {
            const skillIndex = Math.max(0, Number(skillGrowth?.index) || 0);
            skillGrowthMap.set(skillIndex, Array.isArray(skillGrowth?.stages) ? skillGrowth.stages : []);
        });

        return baseSkills.map((skill, index) => {
            const evolvedSkill = { ...skill };
            const growthStages = skillGrowthMap.get(index) || [];
            growthStages.forEach(stageConfig => {
                if (normalizedStar < this.normalizeStarLevel(stageConfig?.stage)) {
                    return;
                }
                Object.entries(stageConfig || {}).forEach(([key, value]) => {
                    if (key === 'stage') {
                        return;
                    }
                    evolvedSkill[key] = value;
                });
            });
            return evolvedSkill;
        }).filter((skill) => {
            const unlockStage = Math.max(1, Number(skill?.unlockStage) || 1);
            return normalizedStar >= unlockStage;
        });
    },

    getHeroReactiveEffectsForStarLevel(heroConfigId, starLevel) {
        const hero = this.getHeroConfig(heroConfigId) || {};
        const baseEffects = Array.isArray(hero.reactiveEffects)
            ? hero.reactiveEffects.filter(Boolean).map(effect => ({
                ...effect,
                statusEffects: Array.isArray(effect?.statusEffects)
                    ? effect.statusEffects.filter(Boolean).map(status => ({ ...status }))
                    : []
            }))
            : [];
        const normalizedStar = this.normalizeStarLevel(starLevel);
        const growth = this.getTraitBattleGrowth(heroConfigId);
        const reactiveGrowthMap = new Map();

        (Array.isArray(growth?.reactiveEffects) ? growth.reactiveEffects : []).forEach(effectGrowth => {
            const effectIndex = Math.max(0, Number(effectGrowth?.index) || 0);
            reactiveGrowthMap.set(effectIndex, Array.isArray(effectGrowth?.stages) ? effectGrowth.stages : []);
        });

        return baseEffects.map((effect, index) => {
            const evolvedEffect = {
                ...effect,
                statusEffects: Array.isArray(effect?.statusEffects)
                    ? effect.statusEffects.filter(Boolean).map(status => ({ ...status }))
                    : []
            };
            const growthStages = reactiveGrowthMap.get(index) || [];
            growthStages.forEach(stageConfig => {
                if (normalizedStar < this.normalizeStarLevel(stageConfig?.stage)) {
                    return;
                }
                Object.entries(stageConfig || {}).forEach(([key, value]) => {
                    if (key === 'stage') {
                        return;
                    }
                    evolvedEffect[key] = key === 'statusEffects' && Array.isArray(value)
                        ? value.filter(Boolean).map(status => ({ ...status }))
                        : value;
                });
            });
            return evolvedEffect;
        }).filter((effect) => {
            const unlockStage = Math.max(1, Number(effect?.unlockStage) || 1);
            return normalizedStar >= unlockStage;
        });
    },

    getHeroBasicAttackEffectsForStarLevel(heroConfigId, starLevel) {
        const hero = this.getHeroConfig(heroConfigId) || {};
        const baseEffects = Array.isArray(hero.basicAttackEffects)
            ? hero.basicAttackEffects.filter(Boolean).map(effect => ({
                ...effect,
                statusEffects: Array.isArray(effect?.statusEffects)
                    ? effect.statusEffects.filter(Boolean).map(status => ({ ...status }))
                    : []
            }))
            : [];
        const normalizedStar = this.normalizeStarLevel(starLevel);
        const growth = this.getTraitBattleGrowth(heroConfigId);
        const effectGrowthMap = new Map();

        (Array.isArray(growth?.basicAttackEffects) ? growth.basicAttackEffects : []).forEach(effectGrowth => {
            const effectIndex = Math.max(0, Number(effectGrowth?.index) || 0);
            effectGrowthMap.set(effectIndex, Array.isArray(effectGrowth?.stages) ? effectGrowth.stages : []);
        });

        return baseEffects.map((effect, index) => {
            const evolvedEffect = {
                ...effect,
                statusEffects: Array.isArray(effect?.statusEffects)
                    ? effect.statusEffects.filter(Boolean).map(status => ({ ...status }))
                    : []
            };
            const growthStages = effectGrowthMap.get(index) || [];
            growthStages.forEach(stageConfig => {
                if (normalizedStar < this.normalizeStarLevel(stageConfig?.stage)) {
                    return;
                }
                Object.entries(stageConfig || {}).forEach(([key, value]) => {
                    if (key === 'stage') {
                        return;
                    }
                    evolvedEffect[key] = key === 'statusEffects' && Array.isArray(value)
                        ? value.filter(Boolean).map(status => ({ ...status }))
                        : value;
                });
            });
            return evolvedEffect;
        });
    },

    getHeroPassiveEffectsForStarLevel(heroConfigId, starLevel) {
        const hero = this.getHeroConfig(heroConfigId) || {};
        const baseEffects = Array.isArray(hero.passiveEffects)
            ? hero.passiveEffects.filter(Boolean).map(effect => ({
                ...effect,
                statusEffects: Array.isArray(effect?.statusEffects)
                    ? effect.statusEffects.filter(Boolean).map(status => ({ ...status }))
                    : [],
                allyStatusEffects: Array.isArray(effect?.allyStatusEffects)
                    ? effect.allyStatusEffects.filter(Boolean).map(status => ({ ...status }))
                    : []
            }))
            : [];
        const normalizedStar = this.normalizeStarLevel(starLevel);
        const growth = this.getTraitBattleGrowth(heroConfigId);
        const effectGrowthMap = new Map();

        (Array.isArray(growth?.passiveEffects) ? growth.passiveEffects : []).forEach(effectGrowth => {
            const effectIndex = Math.max(0, Number(effectGrowth?.index) || 0);
            effectGrowthMap.set(effectIndex, Array.isArray(effectGrowth?.stages) ? effectGrowth.stages : []);
        });

        return baseEffects.map((effect, index) => {
            const evolvedEffect = {
                ...effect,
                statusEffects: Array.isArray(effect?.statusEffects)
                    ? effect.statusEffects.filter(Boolean).map(status => ({ ...status }))
                    : [],
                allyStatusEffects: Array.isArray(effect?.allyStatusEffects)
                    ? effect.allyStatusEffects.filter(Boolean).map(status => ({ ...status }))
                    : []
            };
            const growthStages = effectGrowthMap.get(index) || [];
            growthStages.forEach(stageConfig => {
                if (normalizedStar < this.normalizeStarLevel(stageConfig?.stage)) {
                    return;
                }
                Object.entries(stageConfig || {}).forEach(([key, value]) => {
                    if (key === 'stage') {
                        return;
                    }
                    evolvedEffect[key] = (key === 'statusEffects' || key === 'allyStatusEffects') && Array.isArray(value)
                        ? value.filter(Boolean).map(status => ({ ...status }))
                        : value;
                });
            });
            return evolvedEffect;
        }).filter((effect) => {
            const unlockStage = Math.max(1, Number(effect?.unlockStage) || 1);
            return normalizedStar >= unlockStage;
        });
    },

    getSpecialTraitStages(heroConfigId) {
        return this.getSpecialTraitFramework(heroConfigId).milestones;

        const hero = this.getHeroConfig(heroConfigId) || {};
        const heroName = hero.name || '该英雄';
        const skillName = hero.skill?.name || '专属特技';
        const descriptions = [
            `${heroName}掌握了基础作战节奏，普通攻击更加稳定。`,
            '熟悉战场步法后，移动与站位显得更加从容。',
            `${skillName} 的释放时机开始变得精准，战斗连贯性进一步提升。`,
            '在交锋中积累经验后，攻防转换更加顺手。',
            '完成五星历练后，已经具备独当一面的实力。',
            '迈入月阶后，对局势的判断变得更加冷静。',
            '能够在混战中保持稳定节奏，持续输出更加可靠。',
            `对 ${skillName} 的掌控进一步加深，细节打磨更加到位。`,
            '形成成熟的作战风格，关键时刻也能稳住局面。',
            '月阶圆满后，拥有了持续压制对手的底气。',
            '踏入红日阶段后，开始释放更强的战斗气场。',
            '即使身处高压环境，也能保持精准判断。',
            '更擅长捕捉敌方破绽，关键打击更加果断。',
            '红日之力持续觉醒，整体作战表现再次跃升。',
            '红日圆满，只差一步便能触及巅峰。',
            `加冕为王后，${skillName} 的潜力被彻底唤醒。`
        ];

        const defaultStages = descriptions.map((description, index) => ({
            stage: index + 1,
            title: null,
            description,
            ...this.getStarDisplayInfo(index + 1)
        }));

        const customStages = this.getSpecialTraitConfig(heroConfigId)?.stages || [];
        if (customStages.length <= 0) {
            return defaultStages;
        }

        const customStageMap = new Map();
        customStages.forEach(stage => {
            const normalizedStage = this.normalizeStarLevel(stage?.stage);
            customStageMap.set(normalizedStage, {
                stage: normalizedStage,
                title: stage?.title || null,
                description: stage?.description || ''
            });
        });

        return defaultStages.map(stage => {
            const custom = customStageMap.get(stage.stage);
            if (!custom) {
                return stage;
            }
            return {
                ...stage,
                title: custom.title || stage.title || null,
                description: custom.description || stage.description
            };
        });
    },

    calculateStats(heroConfig, level) {
        const base = this.normalizeStats(heroConfig?.baseStats || {});
        const growth = this.getGrowthConfigByRarity(heroConfig?.rarity);
        const normalizedLevel = Math.max(1, Number(level) || 1);
        const levelMultiplier = 1 + Math.max(0, normalizedLevel - 1) * growth.level;

        return {
            hp: Math.floor(base.hp * levelMultiplier),
            attack: Math.floor(base.attack * levelMultiplier),
            attackCoefficient: Math.max(0.05, Number(base.attackCoefficient) || 1),
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

window.HeroConfig = HeroConfig;
