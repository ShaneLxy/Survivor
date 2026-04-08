/**
 * 装备配置
 */
const EquipmentConfig = {
    slotNames: {
        weapon: '武器',
        clothes: '衣服',
        pants: '裤子',
        shoes: '鞋子'
    },

    rarityOrder: ['common', 'rare', 'epic', 'legendary'],
    rarityNames: {
        common: '普通',
        rare: '稀有',
        epic: '史诗',
        legendary: '传说'
    },

    enhanceableStats: ['attack', 'defense', 'hp', 'crit', 'antiCrit'],
    enhanceRates: {
        common: { attack: 0.02, defense: 0.018, hp: 0.012, crit: 0.01, antiCrit: 0.01 },
        rare: { attack: 0.026, defense: 0.023, hp: 0.016, crit: 0.013, antiCrit: 0.013 },
        epic: { attack: 0.032, defense: 0.028, hp: 0.02, crit: 0.016, antiCrit: 0.016 },
        legendary: { attack: 0.04, defense: 0.034, hp: 0.024, crit: 0.02, antiCrit: 0.02 }
    },
    enhanceCostBase: {
        common: { gold: 120, iron_ore: 2 },
        rare: { gold: 180, iron_ore: 3 },
        epic: { gold: 280, iron_ore: 5 },
        legendary: { gold: 420, iron_ore: 8 }
    },
    enhanceSuccessConfig: {
        common: { start: 0.95, step: 0.025, min: 0.35 },
        rare: { start: 0.92, step: 0.028, min: 0.3 },
        epic: { start: 0.88, step: 0.031, min: 0.24 },
        legendary: { start: 0.84, step: 0.034, min: 0.18 }
    },

    templates: [
        {
            id: 'weapon_dagger',
            slot: 'weapon',
            name: '匕首',
            icon: '🗡️',
            description: '短小迅捷，适合近身刺杀。',
            fixedStats: { attackRange: 1 },
            statRules: {
                attack: { common: [8, 14], rare: [14, 22], epic: [22, 32], legendary: [32, 45] },
                crit: { rare: [0, 6], epic: [4, 10], legendary: [8, 16] },
                defensePen: { epic: [0, 8], legendary: [6, 16] },
                accuracy: { epic: [0, 8], legendary: [6, 14] }
            }
        },
        {
            id: 'weapon_club',
            slot: 'weapon',
            name: '棍棒',
            icon: '🪵',
            description: '攻击距离更长，适合压制敌人。',
            fixedStats: { attackRange: 3 },
            statRules: {
                attack: { common: [10, 16], rare: [16, 24], epic: [24, 36], legendary: [34, 48] },
                crit: { rare: [0, 4], epic: [2, 8], legendary: [6, 12] },
                defensePen: { epic: [0, 6], legendary: [4, 12] },
                accuracy: { epic: [0, 7], legendary: [5, 12] }
            }
        },
        {
            id: 'weapon_katana',
            slot: 'weapon',
            name: '武士刀',
            icon: '⚔️',
            description: '锋利迅猛，兼顾距离与暴击。',
            fixedStats: { attackRange: 3 },
            statRules: {
                attack: { common: [11, 18], rare: [18, 28], epic: [28, 40], legendary: [40, 56] },
                crit: { rare: [0, 7], epic: [5, 12], legendary: [10, 18] },
                defensePen: { epic: [0, 8], legendary: [8, 18] },
                accuracy: { epic: [0, 9], legendary: [8, 16] }
            }
        },
        {
            id: 'weapon_axe',
            slot: 'weapon',
            name: '战斧',
            icon: '🪓',
            description: '攻击距离适中，破防能力强。',
            fixedStats: { attackRange: 2 },
            statRules: {
                attack: { common: [12, 20], rare: [20, 30], epic: [30, 44], legendary: [44, 60] },
                crit: { rare: [0, 5], epic: [3, 9], legendary: [6, 14] },
                defensePen: { epic: [0, 10], legendary: [10, 20] },
                accuracy: { epic: [0, 7], legendary: [6, 12] }
            }
        },
        {
            id: 'clothes_leather',
            slot: 'clothes',
            name: '皮甲',
            icon: '🧥',
            description: '提供基础防护与生命值。',
            statRules: {
                defense: { common: [4, 8], rare: [8, 14], epic: [14, 22], legendary: [22, 32] },
                hp: { common: [20, 40], rare: [40, 70], epic: [70, 110], legendary: [110, 160] },
                dodge: { epic: [0, 6], legendary: [4, 10] }
            }
        },
        {
            id: 'clothes_tactical',
            slot: 'clothes',
            name: '战术外套',
            icon: '🥋',
            description: '更均衡的防御与机动加成。',
            statRules: {
                defense: { common: [5, 9], rare: [9, 15], epic: [15, 23], legendary: [23, 34] },
                hp: { common: [18, 36], rare: [36, 66], epic: [66, 100], legendary: [100, 150] },
                dodge: { epic: [0, 7], legendary: [5, 12] }
            }
        },
        {
            id: 'pants_guard',
            slot: 'pants',
            name: '护卫长裤',
            icon: '👖',
            description: '强化抗打击能力与抗暴。',
            statRules: {
                defense: { common: [4, 7], rare: [7, 12], epic: [12, 18], legendary: [18, 26] },
                antiCrit: { common: [2, 5], rare: [5, 9], epic: [9, 14], legendary: [14, 20] },
                dodge: { epic: [0, 5], legendary: [4, 9] }
            }
        },
        {
            id: 'pants_hunter',
            slot: 'pants',
            name: '猎手长裤',
            icon: '🥾',
            description: '更灵活，适合游走战斗。',
            statRules: {
                defense: { common: [3, 6], rare: [6, 10], epic: [10, 16], legendary: [16, 24] },
                antiCrit: { common: [3, 6], rare: [6, 10], epic: [10, 15], legendary: [15, 22] },
                dodge: { epic: [0, 6], legendary: [5, 10] }
            }
        },
        {
            id: 'shoes_boots',
            slot: 'shoes',
            name: '军靴',
            icon: '👢',
            description: '提升速度与移动距离。',
            statRules: {
                defense: { common: [2, 5], rare: [5, 8], epic: [8, 12], legendary: [12, 18] },
                speed: { common: [2, 5], rare: [5, 8], epic: [8, 12], legendary: [12, 18] },
                moveRange: { epic: [0, 1], legendary: [1, 2] }
            }
        },
        {
            id: 'shoes_sneakers',
            slot: 'shoes',
            name: '疾行鞋',
            icon: '👟',
            description: '更偏重机动，适合快速切入。',
            statRules: {
                defense: { common: [1, 4], rare: [4, 7], epic: [7, 10], legendary: [10, 15] },
                speed: { common: [3, 6], rare: [6, 10], epic: [10, 15], legendary: [15, 22] },
                moveRange: { epic: [0, 1], legendary: [1, 2] }
            }
        }
    ],

    getTemplate(templateId) {
        return this.templates.find(template => template.id === templateId) || null;
    },

    getTemplatesBySlot(slot) {
        return this.templates.filter(template => template.slot === slot);
    },

    getAllTemplates() {
        return [...this.templates];
    },

    getSlotName(slot) {
        return this.slotNames[slot] || slot;
    },

    getRarityName(rarity) {
        return this.rarityNames[rarity] || '普通';
    },

    getEnhanceRates(rarity) {
        return this.enhanceRates[rarity] || this.enhanceRates.common;
    },

    getEnhanceableStats() {
        return [...this.enhanceableStats];
    },

    calculateEnhanceBonus(baseStats = {}, rarity = 'common', level = 0) {
        const enhanceLevel = Math.max(0, Number(level) || 0);
        if (enhanceLevel <= 0) {
            return {};
        }

        const rates = this.getEnhanceRates(rarity);
        const bonus = {};
        this.getEnhanceableStats().forEach(statKey => {
            const baseValue = Number(baseStats?.[statKey]) || 0;
            if (baseValue <= 0) {
                return;
            }
            const totalBonus = Math.floor(baseValue * (Number(rates[statKey]) || 0) * enhanceLevel);
            if (totalBonus > 0) {
                bonus[statKey] = totalBonus;
            }
        });
        return bonus;
    },

    getEnhanceCost(rarity = 'common', targetLevel = 1) {
        const level = Math.max(1, Number(targetLevel) || 1);
        const base = this.enhanceCostBase[rarity] || this.enhanceCostBase.common;
        return {
            gold: Math.max(1, Math.ceil(base.gold * Math.pow(level, 1.18))),
            iron_ore: Math.max(1, Math.ceil(base.iron_ore * Math.pow(level, 1.12)))
        };
    },

    getEnhanceSuccessRate(rarity = 'common', currentLevel = 0) {
        const config = this.enhanceSuccessConfig[rarity] || this.enhanceSuccessConfig.common;
        const level = Math.max(0, Number(currentLevel) || 0);
        return Math.max(config.min, config.start - config.step * level);
    },

    formatSuccessRate(rate = 0) {
        return `${(Math.max(0, Math.min(1, Number(rate) || 0)) * 100).toFixed(1)}%`;
    },

    getRandomRarity(rates) {
        const random = Math.random();
        let cumulative = 0;
        for (const rarity of ['legendary', 'epic', 'rare', 'common']) {
            cumulative += Number(rates?.[rarity]) || 0;
            if (random < cumulative) {
                return rarity;
            }
        }
        return 'common';
    },

    rollStat(range) {
        if (!Array.isArray(range) || range.length < 2) {
            return 0;
        }
        return Utils.randomInt(Number(range[0]) || 0, Number(range[1]) || 0);
    },

    createEquipment(templateId, rarity) {
        const template = this.getTemplate(templateId);
        if (!template) {
            return null;
        }

        const mainStats = { ...(template.fixedStats || {}) };
        for (const [statKey, ruleByRarity] of Object.entries(template.statRules || {})) {
            const range = ruleByRarity?.[rarity];
            if (!range) {
                continue;
            }
            mainStats[statKey] = this.rollStat(range);
        }

        return new Equipment(template, {
            rarity,
            baseStats: mainStats
        });
    },

    createRandomEquipment(rarity = null, templateId = null) {
        const finalRarity = rarity || 'common';
        const candidates = templateId
            ? [this.getTemplate(templateId)].filter(Boolean)
            : this.getAllTemplates();

        if (candidates.length === 0) {
            return null;
        }

        const template = Utils.randomChoice(candidates);
        return this.createEquipment(template.id, finalRarity);
    },

    createLegacyEquipment(itemConfig) {
        if (!itemConfig) {
            return null;
        }

        const slotMap = {
            weapon: 'weapon',
            armor: 'clothes'
        };
        const slot = slotMap[itemConfig.type];
        if (!slot) {
            return null;
        }

        const fakeTemplate = {
            id: itemConfig.id,
            slot,
            name: itemConfig.name,
            icon: itemConfig.icon,
            description: itemConfig.description,
            fixedStats: {},
            statRules: {}
        };

        return new Equipment(fakeTemplate, {
            rarity: itemConfig.rarity || 'common',
            baseStats: { ...(itemConfig.stats || {}) },
            legacy: true
        });
    }
};

window.EquipmentConfig = EquipmentConfig;
