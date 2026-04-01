/**
 * 英雄管理器 - 单例模式
 */
class HeroManager {
    constructor() {
        if (HeroManager.instance) {
            return HeroManager.instance;
        }
        this.heroes = [];
        this.team = []; // 编队
        this.maxTeamSize = 4;
        this.fragments = new Map(); // heroConfigId -> count 英雄碎片
        HeroManager.instance = this;
    }

    /**
     * 初始化
     */
    init(saveData) {
        if (saveData && saveData.heroes) {
            this.heroes = saveData.heroes.map(heroData => {
                const config = HeroConfig.getHeroConfig(heroData.configId);
                const hero = new Hero(config, heroData.level);
                hero.id = heroData.id;
                hero.exp = heroData.exp;
                hero.stars = heroData.stars;
                return hero;
            });
            this.team = saveData.team || [];
        } else {
            // 创建初始英雄
            this.createInitialHero();
        }
        // 初始化碎片数据
        if (saveData && saveData.fragments) {
            this.fragments = new Map(Object.entries(saveData.fragments).map(([k, v]) => [k, Number(v)]));
        }
    }

    /**
     * 创建初始英雄
     */
    createInitialHero() {
        const config = HeroConfig.getHeroConfig('hero_005'); // 牧师
        if (config) {
            const hero = new Hero(config, 1);
            this.addHero(hero);
            this.addToTeam(hero.id);
        }
    }

    /**
     * 添加英雄
     * @param {Hero} hero - 英雄对象
     * @returns {boolean}
     */
    addHero(hero) {
        if (this.heroes.some(h => h.configId === hero.configId)) {
            return true; // 重复英雄也返回true，具体逻辑在GachaManager处理
        }
        this.heroes.push(hero);
        eventManager.emit('heroAdd', hero);
        return true;
    }

    /**
     * 移除英雄
     * @param {string} heroId - 英雄ID
     * @returns {boolean}
     */
    removeHero(heroId) {
        const index = this.heroes.findIndex(h => h.id === heroId);
        if (index === -1) return false;

        const hero = this.heroes[index];
        this.heroes.splice(index, 1);
        this.removeFromTeam(heroId);
        eventManager.emit('heroRemove', hero);
        return true;
    }

    /**
     * 获取英雄
     * @param {string} heroId - 英雄ID
     * @returns {Hero|null}
     */
    getHero(heroId) {
        return this.heroes.find(h => h.id === heroId);
    }

    /**
     * 获取所有英雄
     * @returns {Array<Hero>}
     */
    getAllHeroes() {
        return this.heroes;
    }

    /**
     * 英雄获得经验
     * @param {string} heroId - 英雄ID
     * @param {number} exp - 经验值
     * @returns {boolean}
     */
    addHeroExp(heroId, exp) {
        const hero = this.getHero(heroId);
        if (!hero) return false;

        const leveledUp = hero.addExp(exp);
        if (leveledUp) {
            eventManager.emit('heroLevelUp', hero);
        }
        return true;
    }

    /**
     * 英雄升星
     * @param {string} heroId - 英雄ID
     * @returns {boolean}
     */
    upgradeHeroStars(heroId) {
        const hero = this.getHero(heroId);
        if (!hero) return false;

        const success = hero.upgradeStars();
        if (success) {
            eventManager.emit('heroStarsUp', hero);
        }
        return success;
    }

    /**
     * 添加到编队
     * @param {string} heroId - 英雄ID
     * @returns {boolean}
     */
    addToTeam(heroId) {
        if (this.team.length >= this.maxTeamSize) {
            return false;
        }
        if (this.team.includes(heroId)) {
            return false;
        }
        this.team.push(heroId);
        eventManager.emit('teamUpdate', this.team);
        return true;
    }

    /**
     * 从编队移除
     * @param {string} heroId - 英雄ID
     * @returns {boolean}
     */
    removeFromTeam(heroId) {
        const index = this.team.indexOf(heroId);
        if (index === -1) return false;

        this.team.splice(index, 1);
        eventManager.emit('teamUpdate', this.team);
        return true;
    }

    /**
     * 获取编队
     * @returns {Array<Hero>}
     */
    getTeam() {
        return this.team.map(id => this.getHero(id)).filter(h => h);
    }

    // ================ 碎片系统 ================

    /**
     * 增加碎片
     * @param {string} configId - 英雄配置ID
     * @param {number} count - 碎片数量
     */
    addFragments(configId, count) {
        const current = this.fragments.get(configId) || 0;
        this.fragments.set(configId, current + count);
        eventManager.emit('fragmentAdd', { configId, count });
    }

    /**
     * 获取碎片数量
     * @param {string} configId - 英雄配置ID
     * @returns {number}
     */
    getFragments(configId) {
        return this.fragments.get(configId) || 0;
    }

    /**
     * 获取所有有碎片的英雄列表(按稀有度排序)
     * @returns {Array<{configId, count, heroConfig}>}
     */
    getAllFragments() {
        const result = [];
        this.fragments.forEach((count, configId) => {
            if (count > 0) {
                const heroConfig = HeroConfig.getHeroConfig(configId);
                if (heroConfig) {
                    result.push({
                        configId,
                        count,
                        heroConfig
                    });
                }
            }
        });
        // 按稀有度从高到低排序: legendary > epic > rare > common
        const rarityOrder = { legendary: 0, epic: 1, rare: 2, common: 3 };
        result.sort((a, b) => {
            const rarityA = rarityOrder[a.heroConfig.rarity] ?? 4;
            const rarityB = rarityOrder[b.heroConfig.rarity] ?? 4;
            return rarityA - rarityB;
        });
        return result;
    }

    /**
     * 消耗碎片
     * @param {string} configId - 英雄配置ID
     * @param {number} count - 消耗数量
     * @returns {boolean}
     */
    removeFragments(configId, count) {
        const current = this.fragments.get(configId) || 0;
        if (current < count) {
            return false;
        }
        this.fragments.set(configId, current - count);
        eventManager.emit('fragmentRemove', { configId, count });
        return true;
    }

    /**
     * 检查是否可以用碎片升星
     * @param {string} heroId - 英雄ID
     * @returns {{can: boolean, cost: number, message: string}}
     */
    canUpgradeStarsWithFragments(heroId) {
        const hero = this.getHero(heroId);
        if (!hero) {
            return { can: false, cost: 0, message: '英雄不存在' };
        }
        const targetStars = hero.stars + 1;
        const cost = targetStars * 50;
        const currentFragments = this.getFragments(hero.configId);

        if (currentFragments >= cost) {
            return { can: true, cost, message: '' };
        } else {
            return { can: false, cost, message: `需要${cost}个碎片，当前只有${currentFragments}个` };
        }
    }

    /**
     * 合成英雄(消耗50碎片)
     * @param {string} configId - 英雄配置ID
     * @returns {boolean}
     */
    synthesizeHero(configId) {
        if (this.getFragments(configId) < 50) {
            return false;
        }
        // 检查是否已有该英雄
        const hasHero = this.heroes.some(h => h.configId === configId);
        if (hasHero) {
            // 已有英雄则不合成，返回false
            return false;
        }
        // 消耗碎片
        this.removeFragments(configId, 50);
        // 创建新英雄
        const heroConfig = HeroConfig.getHeroConfig(configId);
        if (heroConfig) {
            const hero = new Hero(heroConfig, 1);
            this.addHero(hero);
            eventManager.emit('heroSynthesize', hero);
            return true;
        }
        return false;
    }

    // ================ 战斗单位 ================

    /**
     * 创建战斗单位
     * @returns {Array<BattleUnit>}
     */
    createBattleUnits() {
        const heroes = this.getTeam();
        return heroes.map(hero => {
            return new BattleUnit({
                id: hero.id,
                name: hero.name,
                icon: hero.icon,
                type: 'hero',
                baseStats: {
                    hp: hero.maxHp,
                    attack: hero.attack,
                    defense: hero.defense,
                    speed: hero.speed
                },
                skill: hero.skill
            }, hero.level);
        });
    }

    /**
     * 获取保存数据
     * @returns {Object}
     */
    getSaveData() {
        const fragmentsObj = {};
        this.fragments.forEach((count, configId) => {
            fragmentsObj[configId] = count;
        });
        return {
            heroes: this.heroes.map(h => ({
                id: h.id,
                configId: h.configId,
                level: h.level,
                exp: h.exp,
                stars: h.stars
            })),
            team: this.team,
            fragments: fragmentsObj
        };
    }
}

// 导出单例
const heroManager = new HeroManager();

// 暴露到全局
window.heroManager = heroManager;
