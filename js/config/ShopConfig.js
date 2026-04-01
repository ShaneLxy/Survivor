/**
 * 商城商品配置
 */
const ShopConfig = {
    /**
     * 获取商品列表
     * @returns {Array}
     */
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
                name: '水源',
                icon: '💧',
                type: 'resource',
                rarity: 'common',
                price: 70,
                currency: 'gold',
                maxBuy: 10,
                giveItem: 'water',
                giveCount: 1
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
            }
        ];
    },

    /**
     * 获取随机碎片对应的英雄
     * @param {string} rarity - 稀有度 random/rare/epic
     * @returns {Object|null}
     */
    getRandomHeroByRarity(rarity) {
        const allHeroConfigs = HeroConfig.getAllHeroConfigs();
        let filtered = [];

        if (rarity === 'random') {
            filtered = allHeroConfigs;
        } else if (rarity === 'rare') {
            filtered = allHeroConfigs.filter(h => h.rarity === 'rare');
        } else if (rarity === 'epic') {
            filtered = allHeroConfigs.filter(h => h.rarity === 'epic');
        }

        if (filtered.length === 0) {
            filtered = allHeroConfigs;
        }

        return filtered[Math.floor(Math.random() * filtered.length)];
    },

    /**
     * 解析giveItem获取实际物品
     * @param {Object} shopItem - 商品配置
     * @returns {Object}
     */
    resolveGiveItem(shopItem) {
        const item = { ...shopItem };

        if (item.giveItem === 'random_fragment') {
            const heroConfig = this.getRandomHeroByRarity('random');
            item.actualItemId = heroConfig.id;
            item.actualItemName = `${heroConfig.name}碎片`;
            item.actualItemIcon = heroConfig.icon;
        } else if (item.giveItem === 'rare_fragment') {
            const heroConfig = this.getRandomHeroByRarity('rare');
            item.actualItemId = heroConfig.id;
            item.actualItemName = `${heroConfig.name}碎片`;
            item.actualItemIcon = heroConfig.icon;
        } else if (item.giveItem === 'epic_fragment') {
            const heroConfig = this.getRandomHeroByRarity('epic');
            item.actualItemId = heroConfig.id;
            item.actualItemName = `${heroConfig.name}碎片`;
            item.actualItemIcon = heroConfig.icon;
        } else {
            // 资源或消耗品
            item.actualItemId = item.giveItem;
            item.actualItemName = item.name;
            item.actualItemIcon = item.icon;
        }

        return item;
    }
};

// 暴露到全局
window.ShopConfig = ShopConfig;