/**
 * 招募 / 打造配置
 */
const GachaConfig = {
    pools: {
        hero_pool: {
            id: 'hero_pool',
            type: 'mixed',
            name: '英雄招募',
            description: '奖励将从招募奖池中随机抽取，重复英雄会自动转化为碎片。',
            icon: '🎯',
            costs: {
                diamond: { single: 100, ten: 950 }
            },
            entries: [
                { id: 'hero_gold', type: 'resource', resourceId: 'gold', min: 100, max: 500, weight: 20, label: '金币 100-500', rateText: '20%' },
                { id: 'hero_diamond', type: 'resource', resourceId: 'diamond', min: 10, max: 50, weight: 10, label: '钻石 10-50', rateText: '10%' },
                { id: 'hero_fragment_common', type: 'fragment', heroRarity: 'common', min: 10, max: 50, weight: 21.5, label: '普通英雄碎片 10-50', rateText: '21.5%' },
                { id: 'hero_fragment_rare', type: 'fragment', heroRarity: 'rare', min: 10, max: 50, weight: 10, label: '稀有英雄碎片 10-50', rateText: '10%' },
                { id: 'hero_fragment_epic', type: 'fragment', heroRarity: 'epic', min: 10, max: 50, weight: 5, label: '史诗英雄碎片 10-50', rateText: '5%' },
                { id: 'hero_unit_common', type: 'hero', heroRarity: 'common', weight: 16.5, label: '随机普通英雄', rateText: '16.5%' },
                { id: 'hero_unit_rare', type: 'hero', heroRarity: 'rare', weight: 5, label: '随机稀有英雄', rateText: '5%' },
                { id: 'hero_unit_epic', type: 'hero', heroRarity: 'epic', weight: 2, label: '随机史诗英雄', rateText: '2%' },
                { id: 'hero_exp_potion', type: 'item', itemId: 'exp_potion', min: 100, max: 500, weight: 10, label: '经验药水 100-500', rateText: '10%' }
            ]
        },
        equipment_pool: {
            id: 'equipment_pool',
            type: 'mixed',
            name: '装备打造',
            description: '打造并不一定直接获得装备，也可能获得建设和强化材料。',
            icon: '⚒️',
            costs: {
                diamond: { single: 120, ten: 1100 }
            },
            entries: [
                { id: 'equip_gold', type: 'resource', resourceId: 'gold', min: 150, max: 650, weight: 29, label: '金币 150-650', rateText: '29%' },
                { id: 'equip_iron_ore', type: 'resource', resourceId: 'iron_ore', min: 5, max: 15, weight: 20, label: '铁矿石 5-15', rateText: '20%' },
                { id: 'equip_wood', type: 'resource', resourceId: 'wood', min: 5, max: 15, weight: 15, label: '木材 5-15', rateText: '15%' },
                { id: 'equip_common', type: 'equipment', rarity: 'common', weight: 15, label: '随机普通装备', rateText: '15%' },
                { id: 'equip_rare', type: 'equipment', rarity: 'rare', weight: 10, label: '随机稀有装备', rateText: '10%' },
                { id: 'equip_epic', type: 'equipment', rarity: 'epic', weight: 7, label: '随机史诗装备', rateText: '7%' },
                { id: 'equip_legendary', type: 'equipment', rarity: 'legendary', weight: 1.5, label: '随机传说装备', rateText: '1.5%' },
                { id: 'equip_diamond', type: 'resource', resourceId: 'diamond', min: 20, max: 60, weight: 2.5, label: '钻石 20-60', rateText: '2.5%' }
            ]
        }
    },

    getPoolConfig(poolId) {
        return this.pools[poolId] || null;
    },

    getAllPools() {
        return Object.values(this.pools);
    },

    validatePools() {
        const heroRarityOrder = ['common', 'rare', 'epic', 'legendary'];
        const availableHeroRarities = this.getAvailableHeroRarities();
        const issues = [];

        this.getAllPools().forEach((pool) => {
            const entries = Array.isArray(pool?.entries) ? pool.entries : [];
            const totalWeight = entries.reduce((sum, entry) => sum + (Number(entry?.weight) || 0), 0);

            if (totalWeight <= 0) {
                issues.push({
                    level: 'error',
                    poolId: pool?.id || 'unknown_pool',
                    message: '奖池总权重无效，当前奖池将无法正常抽取。'
                });
            }

            entries.forEach((entry) => {
                if (!entry || !entry.heroRarity) {
                    return;
                }

                const normalizedRarity = heroRarityOrder.includes(entry.heroRarity)
                    ? entry.heroRarity
                    : 'common';
                const resolvedRarity = this.resolveFallbackHeroRarity(normalizedRarity);

                if (!resolvedRarity) {
                    issues.push({
                        level: 'error',
                        poolId: pool?.id || 'unknown_pool',
                        entryId: entry.id || 'unknown_entry',
                        message: `条目 ${entry.id || 'unknown_entry'} 需要 ${normalizedRarity} 英雄，但当前英雄库没有任何可用品质，结果可能为空。`
                    });
                    return;
                }

                if (resolvedRarity !== normalizedRarity) {
                    issues.push({
                        level: 'warn',
                        poolId: pool?.id || 'unknown_pool',
                        entryId: entry.id || 'unknown_entry',
                        message: `条目 ${entry.id || 'unknown_entry'} 配置为 ${normalizedRarity} 英雄，但当前英雄库不存在该品质，运行时将自动回退为 ${resolvedRarity}。`
                    });
                }
            });
        });

        if (issues.length > 0) {
            console.groupCollapsed('[GachaConfig] 奖池配置校验');
            console.info('当前可用英雄品质:', availableHeroRarities.join(', ') || 'none');
            issues.forEach((issue) => {
                const prefix = `[${issue.level.toUpperCase()}] ${issue.poolId}${issue.entryId ? `/${issue.entryId}` : ''}`;
                if (issue.level === 'error') {
                    console.error(prefix, issue.message);
                } else {
                    console.warn(prefix, issue.message);
                }
            });
            console.groupEnd();
        }

        return {
            ok: !issues.some((issue) => issue.level === 'error'),
            availableHeroRarities,
            issues
        };
    },

    getAvailableHeroRarities() {
        const rarityOrder = ['common', 'rare', 'epic', 'legendary'];
        return rarityOrder.filter((rarity) => HeroConfig.getHeroesByRarity(rarity).length > 0);
    },

    resolveFallbackHeroRarity(rarity) {
        const rarityOrder = ['common', 'rare', 'epic', 'legendary'];
        const availableRarities = this.getAvailableHeroRarities();
        if (availableRarities.length === 0) {
            return null;
        }

        const normalizedRarity = rarityOrder.includes(rarity) ? rarity : 'common';
        if (availableRarities.includes(normalizedRarity)) {
            return normalizedRarity;
        }

        const targetIndex = rarityOrder.indexOf(normalizedRarity);
        for (let distance = 1; distance < rarityOrder.length; distance++) {
            const higher = rarityOrder[targetIndex + distance];
            if (higher && availableRarities.includes(higher)) {
                return higher;
            }
            const lower = rarityOrder[targetIndex - distance];
            if (lower && availableRarities.includes(lower)) {
                return lower;
            }
        }

        return availableRarities[0];
    },

    getRandomHero(rarity) {
        const resolvedRarity = this.resolveFallbackHeroRarity(rarity);
        if (!resolvedRarity) {
            return null;
        }
        const heroes = HeroConfig.getHeroesByRarity(resolvedRarity);
        if (heroes.length === 0) {
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
        const costType = Object.keys(pool.costs || {})[0] || 'gold';
        return {
            type: costType,
            amount: pool.costs?.[costType]?.[key] || 0
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
