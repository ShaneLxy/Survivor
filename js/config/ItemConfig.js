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
            icon: '📌',
            type: 'consumable',
            rarity: 'rare',
            description: '可批量给英雄使用，每瓶提供1点英雄经验',
            effect: { type: 'hero_exp', value: 1 },
            stackLimit: 9999
        },
        stimulant: {
            id: 'stimulant',
            name: '强心剂',
            icon: '💉',
            type: 'consumable',
            rarity: 'epic',
            description: '战斗中可复活一名已阵亡英雄，并恢复其30%生命',
            effect: { type: 'revive', value: 0.3 },
            stackLimit: 99
        },
        power_potion_small: {
            id: 'power_potion_small',
            name: '力量药水-小',
            icon: '🧪',
            type: 'consumable',
            rarity: 'rare',
            description: '战斗中使用：自身攻击力提升10%，持续2回合',
            effect: {
                type: 'battle_status',
                target: 'self',
                statusEffect: {
                    type: 'power_potion',
                    name: '力量药水-小',
                    stat: 'attack',
                    value: 0.1,
                    attackPercentBonus: 0.1,
                    durationTurns: 2,
                    stackMode: 'stack',
                    maxStacks: 9,
                    skipNextTurnEndDecay: true
                }
            },
            stackLimit: 99
        },
        power_potion_medium: {
            id: 'power_potion_medium',
            name: '力量药水-中',
            icon: '🧪',
            type: 'consumable',
            rarity: 'epic',
            description: '战斗中使用：自身攻击力提升20%，持续2回合',
            effect: {
                type: 'battle_status',
                target: 'self',
                statusEffect: {
                    type: 'power_potion',
                    name: '力量药水-中',
                    stat: 'attack',
                    value: 0.2,
                    attackPercentBonus: 0.2,
                    durationTurns: 2,
                    stackMode: 'stack',
                    maxStacks: 9,
                    skipNextTurnEndDecay: true
                }
            },
            stackLimit: 99
        },
        power_potion_large: {
            id: 'power_potion_large',
            name: '力量药水-大',
            icon: '🧪',
            type: 'consumable',
            rarity: 'legendary',
            description: '战斗中使用：自身攻击力提升50%，持续2回合',
            effect: {
                type: 'battle_status',
                target: 'self',
                statusEffect: {
                    type: 'power_potion',
                    name: '力量药水-大',
                    stat: 'attack',
                    value: 0.5,
                    attackPercentBonus: 0.5,
                    durationTurns: 2,
                    stackMode: 'stack',
                    maxStacks: 9,
                    skipNextTurnEndDecay: true
                }
            },
            stackLimit: 99
        },
        defense_potion_small: {
            id: 'defense_potion_small',
            name: '防御药水-小',
            icon: '🛡️',
            type: 'consumable',
            rarity: 'rare',
            description: '战斗中使用：自身防御力提升10%，持续2回合',
            effect: {
                type: 'battle_status',
                target: 'self',
                statusEffect: {
                    type: 'defense_potion',
                    name: '防御药水-小',
                    stat: 'defense',
                    value: 0.1,
                    durationTurns: 2,
                    stackMode: 'stack',
                    maxStacks: 9,
                    skipNextTurnEndDecay: true
                }
            },
            stackLimit: 99
        },
        defense_potion_medium: {
            id: 'defense_potion_medium',
            name: '防御药水-中',
            icon: '🛡️',
            type: 'consumable',
            rarity: 'epic',
            description: '战斗中使用：自身防御力提升20%，持续2回合',
            effect: {
                type: 'battle_status',
                target: 'self',
                statusEffect: {
                    type: 'defense_potion',
                    name: '防御药水-中',
                    stat: 'defense',
                    value: 0.2,
                    durationTurns: 2,
                    stackMode: 'stack',
                    maxStacks: 9,
                    skipNextTurnEndDecay: true
                }
            },
            stackLimit: 99
        },
        defense_potion_large: {
            id: 'defense_potion_large',
            name: '防御药水-大',
            icon: '🛡️',
            type: 'consumable',
            rarity: 'legendary',
            description: '战斗中使用：自身防御力提升50%，持续2回合',
            effect: {
                type: 'battle_status',
                target: 'self',
                statusEffect: {
                    type: 'defense_potion',
                    name: '防御药水-大',
                    stat: 'defense',
                    value: 0.5,
                    durationTurns: 2,
                    stackMode: 'stack',
                    maxStacks: 9,
                    skipNextTurnEndDecay: true
                }
            },
            stackLimit: 99
        },
        health_potion_small: {
            id: 'health_potion_small',
            name: '生命药水-小',
            icon: '❤️',
            type: 'consumable',
            rarity: 'rare',
            description: '战斗中使用：自身最大生命值提升20%',
            effect: { type: 'max_hp', target: 'self', value: 0.2 },
            stackLimit: 99
        },
        health_potion_medium: {
            id: 'health_potion_medium',
            name: '生命药水-中',
            icon: '❤️',
            type: 'consumable',
            rarity: 'epic',
            description: '战斗中使用：自身最大生命值提升50%',
            effect: { type: 'max_hp', target: 'self', value: 0.5 },
            stackLimit: 99
        },
        health_potion_large: {
            id: 'health_potion_large',
            name: '生命药水-大',
            icon: '❤️',
            type: 'consumable',
            rarity: 'legendary',
            description: '战斗中使用：自身最大生命值提升80%',
            effect: { type: 'max_hp', target: 'self', value: 0.8 },
            stackLimit: 99
        },
        agility_potion_small: {
            id: 'agility_potion_small',
            name: '敏捷药水-小',
            icon: '💨',
            type: 'consumable',
            rarity: 'rare',
            description: '战斗中使用：自身速度提升5%，持续2回合',
            effect: {
                type: 'battle_status',
                target: 'self',
                statusEffect: {
                    type: 'agility_potion',
                    name: '敏捷药水-小',
                    stat: 'speed',
                    value: 0.05,
                    durationTurns: 2,
                    stackMode: 'stack',
                    maxStacks: 9,
                    skipNextTurnEndDecay: true
                }
            },
            stackLimit: 99
        },
        agility_potion_medium: {
            id: 'agility_potion_medium',
            name: '敏捷药水-中',
            icon: '💨',
            type: 'consumable',
            rarity: 'epic',
            description: '战斗中使用：自身速度提升10%，持续2回合',
            effect: {
                type: 'battle_status',
                target: 'self',
                statusEffect: {
                    type: 'agility_potion',
                    name: '敏捷药水-中',
                    stat: 'speed',
                    value: 0.1,
                    durationTurns: 2,
                    stackMode: 'stack',
                    maxStacks: 9,
                    skipNextTurnEndDecay: true
                }
            },
            stackLimit: 99
        },
        agility_potion_large: {
            id: 'agility_potion_large',
            name: '敏捷药水-大',
            icon: '💨',
            type: 'consumable',
            rarity: 'legendary',
            description: '战斗中使用：自身速度提升20%，持续2回合',
            effect: {
                type: 'battle_status',
                target: 'self',
                statusEffect: {
                    type: 'agility_potion',
                    name: '敏捷药水-大',
                    stat: 'speed',
                    value: 0.2,
                    durationTurns: 2,
                    stackMode: 'stack',
                    maxStacks: 9,
                    skipNextTurnEndDecay: true
                }
            },
            stackLimit: 99
        },
        sword: {
            id: 'sword',
            name: '铁剑',
            icon: '🗡️',
            type: 'weapon',
            rarity: 'common',
            description: '攻击力 +10',
            stats: { attack: 10 },
            stackLimit: 1
        },
        steel_sword: {
            id: 'steel_sword',
            name: '钢剑',
            icon: '🗡️',
            type: 'weapon',
            rarity: 'rare',
            description: '攻击力 +25',
            stats: { attack: 25 },
            stackLimit: 1
        },
        legendary_sword: {
            id: 'legendary_sword',
            name: '传说之剑',
            icon: '🗡️',
            type: 'weapon',
            rarity: 'legendary',
            description: '攻击力 +60',
            stats: { attack: 60 },
            stackLimit: 1
        },
        shield: {
            id: 'shield',
            name: '木盾',
            icon: '🛡️',
            type: 'armor',
            rarity: 'common',
            description: '防御力 +5',
            stats: { defense: 5 },
            stackLimit: 1
        },
        iron_shield: {
            id: 'iron_shield',
            name: '铁盾',
            icon: '🛡️',
            type: 'armor',
            rarity: 'rare',
            description: '防御力 +15',
            stats: { defense: 15 },
            stackLimit: 1
        },
        ad_skip_card: {
            id: 'ad_skip_card',
            name: '免广告卡',
            icon: 'AD',
            type: 'special',
            rarity: 'epic',
            description: '领取激励视频奖励时自动消耗1张，可免看一次广告并直接获得奖励。',
            effect: { type: 'skip_reward_ad' },
            stackLimit: 9999
        },
        hero_summon: {
            id: 'hero_summon',
            name: '英雄招募券',
            icon: '🎿',
            type: 'special',
            rarity: 'epic',
            description: '使用后可进行1次英雄招募',
            effect: { type: 'gacha', poolId: 'hero_pool', count: 1 },
            stackLimit: 9999
        },
        hero_recruit_ten_ticket: {
            id: 'hero_recruit_ten_ticket',
            name: '英雄招募10连券',
            icon: '🎟️',
            type: 'special',
            rarity: 'legendary',
            description: '可在招募中心进行1次英雄10连招募',
            effect: { type: 'gacha', poolId: 'hero_pool', count: 10 },
            stackLimit: 9999
        },
        weapon_forge_ticket: {
            id: 'weapon_forge_ticket',
            name: '武器打造券',
            icon: '🎟️',
            type: 'special',
            rarity: 'epic',
            description: '可在招募中心进行1次装备打造',
            effect: { type: 'gacha', poolId: 'equipment_pool', count: 1 },
            stackLimit: 9999
        },
        weapon_forge_ten_ticket: {
            id: 'weapon_forge_ten_ticket',
            name: '武器打造10连券',
            icon: '🎟️',
            type: 'special',
            rarity: 'legendary',
            description: '可在招募中心进行1次装备10连打造',
            effect: { type: 'gacha', poolId: 'equipment_pool', count: 10 },
            stackLimit: 9999
        }
    },

    iconSources: {
        medicine: 'assets/images/items/medicine.png',
        energy_potion: 'assets/images/items/energy-potion.png',
        exp_potion: 'assets/images/items/exp-potion.png',
        power_potion_small: 'assets/images/items/power-potion.png',
        power_potion_medium: 'assets/images/items/power-potion.png',
        power_potion_large: 'assets/images/items/power-potion.png',
        defense_potion_small: 'assets/images/items/defense-potion.png',
        defense_potion_medium: 'assets/images/items/defense-potion.png',
        defense_potion_large: 'assets/images/items/defense-potion.png',
        health_potion_small: 'assets/images/items/health-potion.png',
        health_potion_medium: 'assets/images/items/health-potion.png',
        health_potion_large: 'assets/images/items/health-potion.png',
        agility_potion_small: 'assets/images/items/agility-potion.png',
        agility_potion_medium: 'assets/images/items/agility-potion.png',
        agility_potion_large: 'assets/images/items/agility-potion.png',
        stimulant: 'assets/images/items/stimulant.png',
        sword: 'assets/images/items/item-sword.png',
        steel_sword: 'assets/images/items/item-steel-sword.png',
        legendary_sword: 'assets/images/items/item-legendary-sword.png',
        shield: 'assets/images/items/item-shield.png',
        iron_shield: 'assets/images/items/item-iron-shield.png',
        ad_skip_card: 'assets/images/items/ad-skip-card.png',
        hero_summon: 'assets/images/items/hero-summon.png',
        hero_recruit_ten_ticket: 'assets/images/items/hero-summon.png',
        weapon_forge_ticket: 'assets/images/items/hero-summon.png',
        weapon_forge_ten_ticket: 'assets/images/items/hero-summon.png'
    },

    getItemIconSrc(id) {
        const src = this.iconSources[id] || '';
        return src ? (window.VersionManager?.getVersionedAssetUrl?.(src) || src) : '';
    },

    getItemConfig(id) {
        const item = this.items[id];
        if (!item) {
            return item;
        }
        return {
            ...item,
            iconSrc: this.getItemIconSrc(id)
        };
    },

    getAllItems() {
        return Object.keys(this.items).map(id => this.getItemConfig(id)).filter(Boolean);
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
