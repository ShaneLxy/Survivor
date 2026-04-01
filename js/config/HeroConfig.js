/**
 * 英雄配置
 */
const HeroConfig = {
    heroes: [
        {
            id: 'hero_001',
            name: '剑圣',
            icon: '⚔️',
            rarity: 'legendary',
            baseStats: {
                hp: 150,
                attack: 30,
                defense: 10,
                speed: 25
            },
            skill: {
                name: '剑气斩',
                description: '对敌人造成150%攻击力的伤害',
                multiplier: 1.5
            }
        },
        {
            id: 'hero_002',
            name: '法师',
            icon: '🧙',
            rarity: 'epic',
            baseStats: {
                hp: 80,
                attack: 40,
                defense: 5,
                speed: 20
            },
            skill: {
                name: '火球术',
                description: '对敌人造成120%攻击力的伤害',
                multiplier: 1.2
            }
        },
        {
            id: 'hero_003',
            name: '战士',
            icon: '🛡️',
            rarity: 'rare',
            baseStats: {
                hp: 200,
                attack: 20,
                defense: 15,
                speed: 15
            },
            skill: {
                name: '盾击',
                description: '对敌人造成80%攻击力+100%防御力的伤害',
                multiplier: 1.0
            }
        },
        {
            id: 'hero_004',
            name: '弓手',
            icon: '🏹',
            rarity: 'rare',
            baseStats: {
                hp: 90,
                attack: 35,
                defense: 8,
                speed: 30
            },
            skill: {
                name: '穿透箭',
                description: '对敌人造成110%攻击力的伤害',
                multiplier: 1.1
            }
        },
        {
            id: 'hero_005',
            name: '牧师',
            icon: '💚',
            rarity: 'common',
            baseStats: {
                hp: 70,
                attack: 15,
                defense: 5,
                speed: 18
            },
            skill: {
                name: '治愈术',
                description: '恢复自身50%攻击力的生命值',
                multiplier: 0.5
            }
        },
        {
            id: 'hero_006',
            name: '刺客',
            icon: '🗡️',
            rarity: 'epic',
            baseStats: {
                hp: 85,
                attack: 45,
                defense: 6,
                speed: 35
            },
            skill: {
                name: '背刺',
                description: '对敌人造成180%攻击力的伤害',
                multiplier: 1.8
            }
        }
    ],

    // 获取英雄配置
    getHeroConfig(id) {
        return this.heroes.find(hero => hero.id === id);
    },

    // 根据稀有度获取英雄列表
    getHeroesByRarity(rarity) {
        return this.heroes.filter(hero => hero.rarity === rarity);
    },

    // 获取所有英雄
    getAllHeroes() {
        return this.heroes;
    },

    // 计算英雄属性
    calculateStats(heroConfig, level) {
        const base = heroConfig.baseStats;
        const levelMultiplier = 1 + (level - 1) * 0.1;

        return {
            hp: Math.floor(base.hp * levelMultiplier),
            attack: Math.floor(base.attack * levelMultiplier),
            defense: Math.floor(base.defense * levelMultiplier),
            speed: Math.floor(base.speed * levelMultiplier)
        };
    }
};

// 暴露到全局
window.HeroConfig = HeroConfig;
