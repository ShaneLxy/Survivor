/**
 * 商城商品配置
 */
const ShopConfig = {
    getShopItems() {
        return [
            {
                id: 'shop_001',
                name: '随机英雄碎片x10',
                icon: '🧩',
                type: 'fragment',
                rarity: 'random',
                price: 20,
                currency: 'gold',
                maxBuy: 5,
                giveItem: 'random_fragment',
                giveCount: 10
            },
            {
                id: 'shop_002',
                name: '体力药水',
                icon: '🧪',
                type: 'consumable',
                rarity: 'rare',
                price: 200,
                currency: 'gold',
                maxBuy: 10,
                giveItem: 'energy_potion',
                giveCount: 1
            },
            {
                id: 'shop_003',
                name: '肉类',
                icon: '🍖',
                type: 'resource',
                rarity: 'common',
                price: 50,
                currency: 'gold',
                maxBuy: 10,
                giveItem: 'meat',
                giveCount: 1
            },
            {
                id: 'shop_004',
                name: '经验药水x50',
                icon: '📘',
                type: 'consumable',
                rarity: 'rare',
                price: 70,
                currency: 'gold',
                maxBuy: 10,
                giveItem: 'exp_potion',
                giveCount: 50
            },
            {
                id: 'shop_005',
                name: '稀有英雄碎片x10',
                icon: '🧩',
                type: 'fragment',
                rarity: 'rare',
                price: 50,
                currency: 'gold',
                maxBuy: 5,
                giveItem: 'rare_fragment',
                giveCount: 10
            },
            {
                id: 'shop_006',
                name: '石材',
                icon: '🪨',
                type: 'resource',
                rarity: 'common',
                price: 60,
                currency: 'gold',
                maxBuy: 10,
                giveItem: 'stone',
                giveCount: 1
            },
            {
                id: 'shop_007',
                name: '体力药水x2',
                icon: '🧪',
                type: 'consumable',
                rarity: 'rare',
                price: 350,
                currency: 'gold',
                maxBuy: 5,
                giveItem: 'energy_potion',
                giveCount: 2
            },
            {
                id: 'shop_008',
                name: '随机英雄碎片x50',
                icon: '🧩',
                type: 'fragment',
                rarity: 'random',
                price: 95,
                currency: 'gold',
                maxBuy: 3,
                giveItem: 'random_fragment',
                giveCount: 50
            },
            {
                id: 'shop_009',
                name: '史诗英雄碎片x10',
                icon: '🧩',
                type: 'fragment',
                rarity: 'epic',
                price: 200,
                currency: 'gold',
                maxBuy: 3,
                giveItem: 'epic_fragment',
                giveCount: 10
            },
            {
                id: 'shop_010',
                name: '铁矿石x5',
                icon: '⛓️',
                type: 'resource',
                rarity: 'rare',
                price: 120,
                currency: 'gold',
                maxBuy: 8,
                giveItem: 'iron_ore',
                giveCount: 5
            }
        ];
    },

    getFragmentRarity(giveItem) {
        const fragmentRarityMap = {
            random_fragment: 'random',
            rare_fragment: 'rare',
            epic_fragment: 'epic'
        };
        return fragmentRarityMap[giveItem] || null;
    },

    getRandomHeroByRarity(rarity) {
        try {
            const allHeroConfigs = HeroConfig.getAllHeroes();
            if (!allHeroConfigs || allHeroConfigs.length === 0) {
                console.error('[ShopConfig] No hero configs found');
                return null;
            }

            let filtered = [];
            if (rarity === 'random') {
                filtered = allHeroConfigs;
            } else if (rarity === 'rare') {
                filtered = allHeroConfigs.filter(h => h.rarity === 'rare');
            } else if (rarity === 'epic') {
                filtered = allHeroConfigs.filter(h => h.rarity === 'epic');
            } else if (rarity === 'legendary') {
                filtered = allHeroConfigs.filter(h => h.rarity === 'legendary');
            }

            if (filtered.length === 0) {
                filtered = allHeroConfigs;
            }

            return filtered[Math.floor(Math.random() * filtered.length)] || null;
        } catch (error) {
            console.error('[ShopConfig] getRandomHeroByRarity error:', error);
            return null;
        }
    },

    resolveFragmentRewards(shopItem, quantity = 1) {
        const fragmentRarity = this.getFragmentRarity(shopItem?.giveItem);
        if (!fragmentRarity) {
            return null;
        }

        const totalFragments = Math.max(1, Number(shopItem?.giveCount) || 1) * Math.max(1, Number(quantity) || 1);
        const rewardMap = new Map();

        for (let i = 0; i < totalFragments; i++) {
            const heroConfig = this.getRandomHeroByRarity(fragmentRarity);
            if (!heroConfig) {
                console.error('[ShopConfig] Failed to resolve fragment hero:', shopItem?.giveItem);
                return null;
            }

            const currentReward = rewardMap.get(heroConfig.id) || {
                heroId: heroConfig.id,
                heroName: heroConfig.name,
                heroIcon: heroConfig.icon,
                count: 0
            };
            currentReward.count++;
            rewardMap.set(heroConfig.id, currentReward);
        }

        return Array.from(rewardMap.values()).sort((a, b) => {
            if (b.count !== a.count) {
                return b.count - a.count;
            }
            return a.heroName.localeCompare(b.heroName, 'zh-CN');
        });
    },

    resolveGiveItem(shopItem) {
        const item = { ...shopItem };
        const fragmentRarity = this.getFragmentRarity(item.giveItem);
        item.actualItemId = fragmentRarity ? null : item.giveItem;
        item.actualItemName = item.name;
        item.actualItemIcon = item.icon;
        item.fragmentRarity = fragmentRarity;
        return item;
    }
};

window.ShopConfig = ShopConfig;
