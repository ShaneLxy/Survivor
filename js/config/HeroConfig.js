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

    normalizeHeroConfig(hero = {}) {
        const skills = this.normalizeSkillCollection(hero.skills, hero.skill);
        const portrait = hero.portrait
            ? (window.VersionManager?.getVersionedAssetUrl?.(hero.portrait) || hero.portrait)
            : null;
        return {
            ...hero,
            rarity: this.normalizeRarity(hero.rarity),
            profession: hero.profession || null,
            portrait,
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

    getSpecialTraitConfig(heroConfigId) {
        const hero = this.getHeroConfig(heroConfigId) || {};
        const config = hero.specialTraits;
        if (!config || typeof config !== 'object') {
            return null;
        }
        return {
            name: config.name || hero.skill?.name || '专属特技',
            summary: config.summary || '',
            stages: Array.isArray(config.stages) ? config.stages.map(stage => ({ ...stage })) : []
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

    getSpecialTraitStages(heroConfigId) {
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
