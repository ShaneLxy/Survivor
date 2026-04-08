/**
 * 装备实例模型
 */
class Equipment {
    constructor(template, options = {}) {
        this.instanceId = options.instanceId || Utils.generateId();
        this.templateId = template.id;
        this.name = template.name || '未知装备';
        this.icon = template.icon || '📦';
        this.slot = template.slot || 'weapon';
        this.rarity = options.rarity || template.rarity || 'common';
        this.description = template.description || '';
        this.type = 'equipment';
        this.count = 1;
        this.stackLimit = 1;
        this.legacy = Boolean(options.legacy);
        this.enhanceLevel = Math.max(0, Number(options.enhanceLevel) || 0);
        this.baseStats = {
            ...(options.baseStats || options.stats || template.fixedStats || {})
        };
        this.stats = {};
        this.refreshStats();
    }

    refreshStats() {
        const bonusStats = this.getEnhanceBonusStats();
        const finalStats = { ...(this.baseStats || {}) };
        Object.entries(bonusStats).forEach(([key, value]) => {
            finalStats[key] = (Number(finalStats[key]) || 0) + (Number(value) || 0);
        });
        this.stats = finalStats;
        return this.stats;
    }

    getEnhanceBonusStats(level = this.enhanceLevel) {
        return EquipmentConfig.calculateEnhanceBonus(this.baseStats, this.rarity, level);
    }

    getNextEnhanceBonusStats() {
        return this.getEnhanceBonusStats(this.enhanceLevel + 1);
    }

    getNextEnhancePreview() {
        const currentBonus = this.getEnhanceBonusStats(this.enhanceLevel);
        const nextBonus = this.getEnhanceBonusStats(this.enhanceLevel + 1);
        const preview = {};
        EquipmentConfig.getEnhanceableStats().forEach(statKey => {
            const current = Number(currentBonus?.[statKey]) || 0;
            const next = Number(nextBonus?.[statKey]) || 0;
            if (next > current) {
                preview[statKey] = {
                    current,
                    next,
                    increase: next - current
                };
            }
        });
        return preview;
    }

    applyEnhanceLevel(level) {
        this.enhanceLevel = Math.max(0, Number(level) || 0);
        this.refreshStats();
        return this.enhanceLevel;
    }

    increaseEnhanceLevel(step = 1) {
        this.enhanceLevel = Math.max(0, this.enhanceLevel + (Number(step) || 0));
        this.refreshStats();
        return this.enhanceLevel;
    }

    getStatLines() {
        const enhanceBonus = this.getEnhanceBonusStats();
        return Object.entries(this.stats || {})
            .filter(([, value]) => Number(value) !== 0)
            .map(([key, value]) => {
                const bonus = Number(enhanceBonus?.[key]) || 0;
                return bonus > 0
                    ? `${Equipment.getStatName(key)}+${value}（强化+${bonus}）`
                    : `${Equipment.getStatName(key)}+${value}`;
            });
    }

    getInfo() {
        const enhanceRate = EquipmentConfig.getEnhanceSuccessRate(this.rarity, this.enhanceLevel);
        return {
            instanceId: this.instanceId,
            id: this.templateId,
            name: this.name,
            icon: this.icon,
            type: this.type,
            slot: this.slot,
            rarity: this.rarity,
            description: this.description,
            count: 1,
            stackLimit: 1,
            enhanceLevel: this.enhanceLevel,
            baseStats: { ...(this.baseStats || {}) },
            stats: { ...(this.stats || {}) },
            detailExtra: [
                `部位：${EquipmentConfig.getSlotName(this.slot)}`,
                `品质：${EquipmentConfig.getRarityName(this.rarity)}`,
                `强化等级：+${this.enhanceLevel}`,
                `下次强化成功率：${EquipmentConfig.formatSuccessRate(enhanceRate)}`,
                ...this.getStatLines()
            ]
        };
    }

    getSaveData() {
        return {
            instanceId: this.instanceId,
            templateId: this.templateId,
            rarity: this.rarity,
            baseStats: { ...(this.baseStats || {}) },
            enhanceLevel: this.enhanceLevel,
            legacy: this.legacy
        };
    }

    clone() {
        return Equipment.fromSaveData(this.getSaveData());
    }

    static fromSaveData(data) {
        if (!data) {
            return null;
        }
        const template = EquipmentConfig.getTemplate(data.templateId) || {
            id: data.templateId,
            slot: data.slot || 'weapon',
            name: data.name || '未知装备',
            icon: data.icon || '📦',
            description: data.description || ''
        };

        return new Equipment(template, {
            instanceId: data.instanceId,
            rarity: data.rarity,
            baseStats: { ...(data.baseStats || data.stats || {}) },
            enhanceLevel: data.enhanceLevel,
            legacy: data.legacy
        });
    }

    static getStatName(statKey) {
        const names = {
            hp: '生命',
            attack: '攻击',
            defense: '防御',
            speed: '速度',
            crit: '暴击',
            antiCrit: '抗暴',
            defensePen: '破防',
            accuracy: '命中率',
            dodge: '闪避率',
            attackRange: '攻击距离',
            moveRange: '移动距离'
        };
        return names[statKey] || statKey;
    }
}

window.Equipment = Equipment;
