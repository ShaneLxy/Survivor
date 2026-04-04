/**
 * 英雄配置
 */
const HeroConfig = {
    defaultBaseStats: {
        hp: 100,
        attack: 20,
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

    heroes: [
        {
            id: 'hero_001',
            name: '剑圣',
            icon: '⚔️',
            rarity: 'legendary',
            baseStats: { hp: 150, attack: 32, defense: 11, speed: 25, crit: 10, antiCrit: 4, defensePen: 6, accuracy: 8, dodge: 4, attackRange: 1, moveRange: 3 },
            skill: { name: '剑气斩', description: '对敌人造成150%攻击力的伤害', multiplier: 1.5 }
        },
        {
            id: 'hero_002',
            name: '法师',
            icon: '🧙',
            rarity: 'epic',
            baseStats: { hp: 90, attack: 42, defense: 6, speed: 21, crit: 8, antiCrit: 4, defensePen: 4, accuracy: 6, dodge: 3, attackRange: 3, moveRange: 3 },
            skill: { name: '火球术', description: '对敌人造成120%攻击力的伤害', multiplier: 1.2 }
        },
        {
            id: 'hero_003',
            name: '战士',
            icon: '🛡️',
            rarity: 'rare',
            baseStats: { hp: 210, attack: 22, defense: 18, speed: 16, crit: 6, antiCrit: 8, defensePen: 2, accuracy: 6, dodge: 2, attackRange: 1, moveRange: 2 },
            skill: { name: '盾击', description: '对敌人造成更高的打击伤害', multiplier: 1.35 }
        },
        {
            id: 'hero_004',
            name: '弓手',
            icon: '🏹',
            rarity: 'rare',
            baseStats: { hp: 100, attack: 35, defense: 8, speed: 30, crit: 12, antiCrit: 4, defensePen: 5, accuracy: 10, dodge: 8, attackRange: 3, moveRange: 3 },
            skill: { name: '穿透箭', description: '对敌人造成110%攻击力的伤害', multiplier: 1.1 }
        },
        {
            id: 'hero_005',
            name: '牧师',
            icon: '💚',
            rarity: 'common',
            baseStats: { hp: 80, attack: 17, defense: 7, speed: 18, crit: 6, antiCrit: 8, defensePen: 1, accuracy: 6, dodge: 4, attackRange: 2, moveRange: 3 },
            skill: { name: '治愈术', description: '以圣光打击敌人并保护自己', multiplier: 1.0 }
        },
        {
            id: 'hero_006',
            name: '刺客',
            icon: '🗡️',
            rarity: 'epic',
            baseStats: { hp: 95, attack: 46, defense: 7, speed: 35, crit: 15, antiCrit: 5, defensePen: 8, accuracy: 12, dodge: 10, attackRange: 1, moveRange: 4 },
            skill: { name: '背刺', description: '对敌人造成180%攻击力的伤害', multiplier: 1.8 }
        }
    ],

    getHeroConfig(id) {
        return this.heroes.find(hero => hero.id === id) || null;
    },

    getHeroesByRarity(rarity) {
        return this.heroes.filter(hero => hero.rarity === rarity);
    },

    getAllHeroes() {
        return [...this.heroes];
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

    normalizeStats(baseStats = {}) {
        return {
            ...this.defaultBaseStats,
            ...baseStats
        };
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

    getStarBonusMultiplier(level) {
        const progress = Math.max(0, this.normalizeStarLevel(level) - 1);
        const earlyBonus = Math.min(progress, 4) * 0.05;
        const middleBonus = Math.min(Math.max(progress - 4, 0), 5) * 0.03;
        const lateBonus = Math.min(Math.max(progress - 9, 0), 5) * 0.02;
        const crownBonus = Math.max(progress - 14, 0) * 0.02;
        return 1 + earlyBonus + middleBonus + lateBonus + crownBonus;
    },

    getSpecialTraitStages(heroConfigId) {
        const hero = this.getHeroConfig(heroConfigId) || {};
        const heroName = hero.name || '该英雄';
        const skillName = hero.skill?.name || '专属特技';
        const descriptions = [
            `${heroName}掌握了基础战斗节奏，普通攻击更加稳定。`,
            '熟悉战场步法后，移动与站位显得更加从容。',
            `开始理解 ${skillName} 的释放时机，战斗连贯性进一步提升。`,
            '在交锋中积累经验，攻防转换更加顺手。',
            '完成五星历练后，已经具备独当一面的实力。',
            '迈入月阶后，对局势的判断变得更加冷静。',
            '能在混战中保持稳定节奏，持续输出更可靠。',
            `对 ${skillName} 的掌控进一步加深，细节打磨更加到位。`,
            '形成成熟的作战风格，关键时刻也能稳住局面。',
            '月阶圆满，拥有了持续压制对手的底气。',
            '踏入红日阶段后，开始释放更强的战斗气场。',
            '即使身处高压环境，也能保持精准判断。',
            '更擅长捕捉敌方破绽，关键打击更加果断。',
            '红日之力持续觉醒，整体作战表现再次跃升。',
            '红日圆满，只差一步便能触及巅峰。',
            `加冕为王后，${skillName} 的潜力被彻底唤醒。`
        ];

        return descriptions.map((description, index) => ({
            stage: index + 1,
            description,
            ...this.getStarDisplayInfo(index + 1)
        }));
    },

    calculateStats(heroConfig, level) {
        const base = this.normalizeStats(heroConfig?.baseStats || {});
        const levelMultiplier = 1 + Math.max(0, level - 1) * 0.1;

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

window.HeroConfig = HeroConfig;
