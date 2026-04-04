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
        this.stats = { ...(options.stats || template.fixedStats || {}) };
    }

    getStatLines() {
        return Object.entries(this.stats || {})
            .filter(([, value]) => Number(value) !== 0)
            .map(([key, value]) => `${Equipment.getStatName(key)}+${value}`);
    }

    getInfo() {
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
            stats: { ...(this.stats || {}) },
            detailExtra: [
                `部位：${EquipmentConfig.getSlotName(this.slot)}`,
                `品质：${EquipmentConfig.getRarityName(this.rarity)}`,
                ...this.getStatLines()
            ]
        };
    }

    getSaveData() {
        return {
            instanceId: this.instanceId,
            templateId: this.templateId,
            rarity: this.rarity,
            stats: { ...(this.stats || {}) },
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
            stats: { ...(data.stats || {}) },
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
