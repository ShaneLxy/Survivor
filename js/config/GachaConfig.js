/**
 * 招募/打造配置
 */
const GachaConfig = {
    pools: {
        hero_pool: {
            id: 'hero_pool',
            type: 'mixed',
            name: '英雄招募',
            description: '不再保证直接获得完整英雄，奖励将从招募奖池中随机抽取。',
            icon: '🦸',
            costs: {
                gold: { single: 100, ten: 900 }
            },
            entries: [
                { id: 'hero_gold', type: 'resource', resourceId: 'gold', min: 200, max: 5000, weight: 20, label: '金币 200-5000', rateText: '20%' },
                { id: 'hero_diamond', type: 'resource', resourceId: 'diamond', min: 50, max: 100, weight: 10, label: '钻石 50-100', rateText: '10%' },
                { id: 'hero_fragment_common', type: 'fragment', heroRarity: 'common', min: 10, max: 50, weight: 20, label: '普通英雄碎片 10-50', rateText: '20%' },
                { id: 'hero_fragment_rare', type: 'fragment', heroRarity: 'rare', min: 10, max: 50, weight: 10, label: '稀有英雄碎片 10-50', rateText: '10%' },
                { id: 'hero_fragment_epic', type: 'fragment', heroRarity: 'epic', min: 10, max: 50, weight: 5, label: '史诗英雄碎片 10-50', rateText: '5%' },
                { id: 'hero_fragment_legendary', type: 'fragment', heroRarity: 'legendary', min: 5, max: 25, weight: 2.5, label: '传说英雄碎片 5-25', rateText: '2.5%' },
                { id: 'hero_unit_common', type: 'hero', heroRarity: 'common', weight: 15, label: '随机普通英雄', rateText: '15%' },
                { id: 'hero_unit_rare', type: 'hero', heroRarity: 'rare', weight: 5, label: '随机稀有英雄', rateText: '5%' },
                { id: 'hero_unit_epic', type: 'hero', heroRarity: 'epic', weight: 2, label: '随机史诗英雄', rateText: '2%' },
                { id: 'hero_unit_legendary', type: 'hero', heroRarity: 'legendary', weight: 0.5, label: '随机传说英雄', rateText: '0.5%' },
                { id: 'hero_exp_potion', type: 'item', itemId: 'exp_potion', min: 100, max: 500, weight: 10, label: '经验药水 100-500', rateText: '10%' }
            ]
        },
        equipment_pool: {
            id: 'equipment_pool',
            type: 'mixed',
            name: '装备打造',
            description: '打造并非每次都会直接出装备，可能获得强化与建设材料。',
            icon: '🛠️',
            costs: {
                gold: { single: 120, ten: 1080 }
            },
            entries: [
                { id: 'equip_gold', type: 'resource', resourceId: 'gold', min: 200, max: 3000, weight: 30, label: '金币 200-3000', rateText: '30%' },
                { id: 'equip_iron_ore', type: 'resource', resourceId: 'iron_ore', min: 5, max: 15, weight: 20, label: '铁矿石 5-15', rateText: '20%' },
                { id: 'equip_wood', type: 'resource', resourceId: 'wood', min: 5, max: 15, weight: 15, label: '木材 5-15', rateText: '15%' },
                { id: 'equip_common', type: 'equipment', rarity: 'common', weight: 15, label: '随机普通装备', rateText: '15%' },
                { id: 'equip_rare', type: 'equipment', rarity: 'rare', weight: 10, label: '随机稀有装备', rateText: '10%' },
                { id: 'equip_epic', type: 'equipment', rarity: 'epic', weight: 7.5, label: '随机史诗装备', rateText: '7.5%' },
                { id: 'equip_legendary', type: 'equipment', rarity: 'legendary', weight: 2.5, label: '随机传说装备', rateText: '2.5%' }
            ]
        }
    },

    getPoolConfig(poolId) {
        return this.pools[poolId] || null;
    },

    getAllPools() {
        return Object.values(this.pools);
    },

    getRandomHero(rarity) {
        const heroes = HeroConfig.getHeroesByRarity(rarity);
        if (heroes.length === 0) {
            const rarityOrder = ['legendary', 'epic', 'rare', 'common'];
            const currentIndex = rarityOrder.indexOf(rarity);
            if (currentIndex >= 0 && currentIndex < rarityOrder.length - 1) {
                return this.getRandomHero(rarityOrder[currentIndex + 1]);
            }
            return null;
        }
        return Utils.randomChoice(heroes);
    },

    calculateCost(poolId, count) {
        const pool = this.getPoolConfig(poolId);
        if (!pool) {
            return null;
        }
        const key = count === 10 ? 'ten' : 'single';
        return {
            type: 'gold',
            amount: pool.costs.gold[key] || 0
        };
    },

    getPoolDisplayEntries(poolId) {
        const pool = this.getPoolConfig(poolId);
        return pool ? [...(pool.entries || [])] : [];
    },

    rollPoolEntry(poolId) {
        const pool = this.getPoolConfig(poolId);
        const entries = pool?.entries || [];
        if (entries.length === 0) {
            return null;
        }
        const totalWeight = entries.reduce((sum, entry) => sum + (Number(entry.weight) || 0), 0);
        if (totalWeight <= 0) {
            return null;
        }
        let roll = Math.random() * totalWeight;
        for (const entry of entries) {
            roll -= Number(entry.weight) || 0;
            if (roll <= 0) {
                return entry;
            }
        }
        return entries[entries.length - 1];
    },

    createPullResult(poolId) {
        const entry = this.rollPoolEntry(poolId);
        if (!entry) {
            return null;
        }
        switch (entry.type) {
            case 'resource':
                return {
                    type: 'resource',
                    poolId,
                    entryId: entry.id,
                    resourceId: entry.resourceId,
                    count: Utils.randomInt(entry.min, entry.max),
                    rarity: shelterManager.getResourceInfo(entry.resourceId).rarity || 'common'
                };
            case 'item':
                return {
                    type: 'item',
                    poolId,
                    entryId: entry.id,
                    itemId: entry.itemId,
                    count: Utils.randomInt(entry.min, entry.max),
                    rarity: ItemConfig.getItemConfig(entry.itemId)?.rarity || 'common'
                };
            case 'fragment': {
                const heroConfig = this.getRandomHero(entry.heroRarity);
                if (!heroConfig) {
                    return null;
                }
                return {
                    type: 'fragment',
                    poolId,
                    entryId: entry.id,
                    configId: heroConfig.id,
                    count: Utils.randomInt(entry.min, entry.max),
                    rarity: heroConfig.rarity,
                    heroName: heroConfig.name,
                    icon: heroConfig.icon
                };
            }
            case 'hero': {
                const heroConfig = this.getRandomHero(entry.heroRarity);
                if (!heroConfig) {
                    return null;
                }
                return {
                    type: 'hero',
                    poolId,
                    entryId: entry.id,
                    configId: heroConfig.id,
                    rarity: heroConfig.rarity,
                    name: heroConfig.name,
                    icon: heroConfig.icon
                };
            }
            case 'equipment': {
                const equipment = EquipmentConfig.createRandomEquipment(entry.rarity);
                if (!equipment) {
                    return null;
                }
                return {
                    type: 'equipment',
                    poolId,
                    entryId: entry.id,
                    rarity: entry.rarity,
                    equipment
                };
            }
            default:
                return null;
        }
    }
};

window.GachaConfig = GachaConfig;
