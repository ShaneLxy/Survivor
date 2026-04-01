/**
 * 道具配置
 */
const ItemConfig = {
    items: {
        // 资源类
        wood: {
            id: 'wood',
            name: '木材',
            icon: '🪵',
            type: 'resource',
            rarity: 'common',
            description: '建筑的基本材料',
            stackLimit: 9999
        },
        stone: {
            id: 'stone',
            name: '石材',
            icon: '🪨',
            type: 'resource',
            rarity: 'common',
            description: '坚固的建筑材料',
            stackLimit: 9999
        },
        meat: {
            id: 'meat',
            name: '肉类',
            icon: '🍖',
            type: 'resource',
            rarity: 'common',
            description: '可以食用的食物',
            stackLimit: 9999
        },
        water: {
            id: 'water',
            name: '水源',
            icon: '💧',
            type: 'resource',
            rarity: 'common',
            description: '生存必需的水源',
            stackLimit: 9999
        },
        gold_ore: {
            id: 'gold_ore',
            name: '金矿石',
            icon: '🔶',
            type: 'resource',
            rarity: 'rare',
            description: '珍贵的金矿石',
            stackLimit: 9999
        },
        // 消耗品
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
        // 武器
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
        // 防具
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
        // 抽卡道具
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

    // 获取道具配置
    getItemConfig(id) {
        return this.items[id];
    },

    // 获取所有道具
    getAllItems() {
        return Object.values(this.items);
    },

    // 根据类型获取道具
    getItemsByType(type) {
        return this.getAllItems().filter(item => item.type === type);
    },

    // 根据稀有度获取道具
    getItemsByRarity(rarity) {
        return this.getAllItems().filter(item => item.rarity === rarity);
    },

    // 是否可堆叠
    isStackable(itemId) {
        const item = this.getItemConfig(itemId);
        return item && item.stackLimit > 1;
    },

    // 获取堆叠上限
    getStackLimit(itemId) {
        const item = this.getItemConfig(itemId);
        return item ? item.stackLimit : 1;
    }
};

// 暴露到全局
window.ItemConfig = ItemConfig;
