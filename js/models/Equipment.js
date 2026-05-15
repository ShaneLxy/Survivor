/**
 * 装备实例模型
 */
class Equipment {
    constructor(template, options = {}) {
        this.instanceId = options.instanceId || Utils.generateId();
        this.templateId = template.id;
        this.name = template.name || '未知装备';
        this.icon = template.icon || '📦';
        this.iconSrc = template.iconSrc || '';
        this.slot = template.slot || 'weapon';
        this.rarity = options.rarity || template.rarity || 'common';
        this.description = template.description || '';
        this.type = 'equipment';
        this.count = 1;
        this.stackLimit = 1;
        this.legacy = Boolean(options.legacy);
        this.enhanceLevel = Math.max(0, Number(options.enhanceLevel) || 0);
        this.starLevel = Math.max(0, Number(options.starLevel) || 0);
        this.locked = Boolean(options.locked);
        this.baseStats = {
            ...(options.baseStats || options.stats || template.fixedStats || {})
        };
        this.stats = {};
        this.refreshStats();
    }

    isWeapon() {
        return this.slot === 'weapon';
    }

    canStarUpgrade() {
        return EquipmentConfig.getStarMaxLevel(this.slot) > 0;
    }

    getStarScaledBaseStats(starLevel = this.starLevel) {
        return EquipmentConfig.calculateStarScaledStats(this.baseStats, starLevel);
    }

    getStarBonusStats(starLevel = this.starLevel) {
        const scaledStats = this.getStarScaledBaseStats(starLevel);
        const bonus = {};
        Object.keys(scaledStats).forEach(statKey => {
            const current = Number(scaledStats[statKey]) || 0;
            const original = Number(this.baseStats?.[statKey]) || 0;
            const increase = current - original;
            if (increase > 0) {
                bonus[statKey] = increase;
            }
        });
        return bonus;
    }

    getEnhanceBonusStats(level = this.enhanceLevel) {
        return EquipmentConfig.calculateEnhanceBonus(this.baseStats, this.rarity, level);
    }

    getStatsForLevels(options = {}) {
        const starLevel = Math.max(0, Number(options.starLevel ?? this.starLevel) || 0);
        const enhanceLevel = Math.max(0, Number(options.enhanceLevel ?? this.enhanceLevel) || 0);
        const finalStats = { ...this.getStarScaledBaseStats(starLevel) };
        const enhanceBonus = this.getEnhanceBonusStats(enhanceLevel);

        Object.entries(enhanceBonus).forEach(([key, value]) => {
            finalStats[key] = (Number(finalStats[key]) || 0) + (Number(value) || 0);
        });

        return finalStats;
    }

    refreshStats() {
        this.stats = this.getStatsForLevels();
        return this.stats;
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

    getStarUpgradePreview() {
        const currentStats = this.getStatsForLevels({ starLevel: this.starLevel });
        const nextStats = this.getStatsForLevels({ starLevel: this.starLevel + 1 });
        const preview = {};
        const statKeys = new Set([
            ...Object.keys(currentStats || {}),
            ...Object.keys(nextStats || {})
        ]);

        statKeys.forEach(statKey => {
            const current = Number(currentStats?.[statKey]) || 0;
            const next = Number(nextStats?.[statKey]) || 0;
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

    applyStarLevel(level) {
        this.starLevel = Math.max(0, Number(level) || 0);
        this.refreshStats();
        return this.starLevel;
    }

    increaseStarLevel(step = 1) {
        this.starLevel = Math.max(0, this.starLevel + (Number(step) || 0));
        this.refreshStats();
        return this.starLevel;
    }

    setLocked(locked) {
        this.locked = Boolean(locked);
        return this.locked;
    }

    getStarBadgeMarkup(className = 'equipment-star-badge') {
        if ((Number(this.starLevel) || 0) <= 0) {
            return '';
        }
        return `<span class="${className}" title="${this.starLevel}星">★${this.starLevel}</span>`;
    }

    getStatLines() {
        const starBonus = this.getStarBonusStats();
        const enhanceBonus = this.getEnhanceBonusStats();
        return Object.entries(this.stats || {})
            .filter(([, value]) => Number(value) !== 0)
            .map(([key, value]) => {
                const bonusParts = [];
                const starValue = Number(starBonus?.[key]) || 0;
                const enhanceValue = Number(enhanceBonus?.[key]) || 0;
                if (starValue > 0) {
                    bonusParts.push(`升星+${starValue}`);
                }
                if (enhanceValue > 0) {
                    bonusParts.push(`强化+${enhanceValue}`);
                }
                return bonusParts.length > 0
                    ? `${Equipment.getStatName(key)}+${value}（${bonusParts.join(' / ')}）`
                    : `${Equipment.getStatName(key)}+${value}`;
            });
    }

    getInfo() {
        const enhanceRate = EquipmentConfig.getEnhanceSuccessRate(this.rarity, this.enhanceLevel);
        const detailExtra = [
            `部位：${EquipmentConfig.getSlotName(this.slot)}`,
            `品质：${EquipmentConfig.getRarityName(this.rarity)}`,
            `星级：${this.starLevel}星`,
            `强化等级：+${this.enhanceLevel}`,
            `下次强化成功率：${EquipmentConfig.formatSuccessRate(enhanceRate)}`
        ];
        if (this.locked) {
            detailExtra.push('状态：已锁定');
        }
        detailExtra.push(...this.getStatLines());

        return {
            instanceId: this.instanceId,
            id: this.templateId,
            name: this.name,
            icon: this.icon,
            iconSrc: this.iconSrc,
            type: this.type,
            slot: this.slot,
            rarity: this.rarity,
            description: this.description,
            count: 1,
            stackLimit: 1,
            enhanceLevel: this.enhanceLevel,
            starLevel: this.starLevel,
            locked: this.locked,
            baseStats: { ...this.getStarScaledBaseStats() },
            originalBaseStats: { ...(this.baseStats || {}) },
            stats: { ...(this.stats || {}) },
            detailExtra
        };
    }

    getSaveData() {
        return {
            instanceId: this.instanceId,
            templateId: this.templateId,
            rarity: this.rarity,
            baseStats: { ...(this.baseStats || {}) },
            enhanceLevel: this.enhanceLevel,
            starLevel: this.starLevel,
            locked: this.locked,
            legacy: this.legacy,
            iconSrc: this.legacy ? this.iconSrc : undefined
        };
    }

    clone() {
        return Equipment.fromSaveData(this.getSaveData());
    }

    static fromSaveData(data) {
        if (!data) {
            return null;
        }
        const template = EquipmentConfig.getTemplate(data.templateId);
        if (!template && !data.legacy) {
            return null;
        }
        const normalizedRarity = EquipmentConfig.rarityOrder.includes(data.rarity)
            ? data.rarity
            : (Array.isArray(template?.rarities) && template.rarities[0]) || 'common';
        if (template && !EquipmentConfig.templateSupportsRarity(template, normalizedRarity)) {
            return null;
        }

        const fallbackTemplate = template || {
            id: data.templateId,
            slot: data.slot || 'weapon',
            name: data.name || '旧制装备',
            icon: data.icon || '📦',
            iconSrc: data.iconSrc || '',
            description: data.description || ''
        };

        return new Equipment(fallbackTemplate, {
            instanceId: data.instanceId,
            rarity: normalizedRarity,
            baseStats: { ...(data.baseStats || data.stats || {}) },
            enhanceLevel: data.enhanceLevel,
            starLevel: data.starLevel,
            locked: data.locked,
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
