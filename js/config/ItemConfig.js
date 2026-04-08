/**
 * 道具配置
 */
const ItemConfig = {
    items: {
        medicine: {
            id: 'medicine',
            name: '药物',
            icon: '💊',
            type: 'consumable',
            rarity: 'rare',
            description: '恢复100点生命值',
            effect: { type: 'heal', value: 100 },
            stackLimit: 99
        },
        energy_potion: {
            id: 'energy_potion',
            name: '体力药水',
            icon: '🧪',
            type: 'consumable',
            rarity: 'rare',
            description: '恢复20点体力',
            effect: { type: 'energy', value: 20 },
            stackLimit: 99
        },
        exp_potion: {
            id: 'exp_potion',
            name: '经验药水',
            icon: '📘',
            type: 'consumable',
            rarity: 'rare',
            description: '可批量给英雄使用，每瓶提供1点英雄经验',
            effect: { type: 'hero_exp', value: 1 },
            stackLimit: 9999
        },
        sword: {
            id: 'sword',
            name: '铁剑',
            icon: '⚔️',
            type: 'weapon',
            rarity: 'common',
            description: '攻击力+10',
            stats: { attack: 10 },
            stackLimit: 1
        },
        steel_sword: {
            id: 'steel_sword',
            name: '钢剑',
            icon: '🗡️',
            type: 'weapon',
            rarity: 'rare',
            description: '攻击力+25',
            stats: { attack: 25 },
            stackLimit: 1
        },
        legendary_sword: {
            id: 'legendary_sword',
            name: '传说之剑',
            icon: '⚔️',
            type: 'weapon',
            rarity: 'legendary',
            description: '攻击力+60',
            stats: { attack: 60 },
            stackLimit: 1
        },
        shield: {
            id: 'shield',
            name: '木盾',
            icon: '🛡️',
            type: 'armor',
            rarity: 'common',
            description: '防御力+5',
            stats: { defense: 5 },
            stackLimit: 1
        },
        iron_shield: {
            id: 'iron_shield',
            name: '铁盾',
            icon: '🛡️',
            type: 'armor',
            rarity: 'rare',
            description: '防御力+15',
            stats: { defense: 15 },
            stackLimit: 1
        },
        hero_summon: {
            id: 'hero_summon',
            name: '英雄召唤券',
            icon: '🎫',
            type: 'special',
            rarity: 'epic',
            description: '使用可进行1次英雄抽卡',
            effect: { type: 'gacha', count: 1 },
            stackLimit: 99
        }
    },

    getItemConfig(id) {
        return this.items[id];
    },

    getAllItems() {
        return Object.values(this.items);
    },

    getItemsByType(type) {
        return this.getAllItems().filter(item => item.type === type);
    },

    getItemsByRarity(rarity) {
        return this.getAllItems().filter(item => item.rarity === rarity);
    },

    isStackable(itemId) {
        const item = this.getItemConfig(itemId);
        return item && item.stackLimit > 1;
    },

    getStackLimit(itemId) {
        const item = this.getItemConfig(itemId);
        return item ? item.stackLimit : 1;
    }
};

window.ItemConfig = ItemConfig;
