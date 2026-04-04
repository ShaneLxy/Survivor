/**
 * 英雄管理器 - 单例模式
 */
class HeroManager {
    constructor() {
        if (HeroManager.instance) {
            return HeroManager.instance;
        }
        this.heroes = [];
        this.team = [];
        this.maxTeamSize = 4;
        this.fragments = new Map();
        HeroManager.instance = this;
    }

    init(saveData) {
        if (saveData && Array.isArray(saveData.heroes) && saveData.heroes.length > 0) {
            this.heroes = saveData.heroes.map(heroData => Hero.fromSaveData(heroData)).filter(Boolean);
            this.team = Array.isArray(saveData.team) ? saveData.team.filter(id => this.heroes.some(hero => hero.id === id)) : [];
        } else {
            this.heroes = [];
            this.team = [];
            this.createInitialHero();
        }

        this.fragments = new Map();
        if (saveData && saveData.fragments) {
            Object.entries(saveData.fragments).forEach(([configId, count]) => {
                this.fragments.set(configId, Number(count) || 0);
            });
        }
    }

    createInitialHero() {
        const config = HeroConfig.getHeroConfig('hero_005');
        if (!config) {
            return;
        }
        const hero = new Hero(config, 1);
        this.addHero(hero);
        this.addToTeam(hero.id);
    }

    addHero(hero) {
        if (this.heroes.some(h => h.configId === hero.configId)) {
            return true;
        }
        this.heroes.push(hero);
        eventManager.emit('heroAdd', hero);
        return true;
    }

    removeHero(heroId) {
        const index = this.heroes.findIndex(hero => hero.id === heroId);
        if (index === -1) {
            return false;
        }
        const hero = this.heroes[index];
        this.heroes.splice(index, 1);
        this.removeFromTeam(heroId);
        eventManager.emit('heroRemove', hero);
        return true;
    }

    getHero(heroId) {
        return this.heroes.find(hero => hero.id === heroId) || null;
    }

    getAllHeroes() {
        return [...this.heroes].sort((a, b) => {
            const inTeamDiff = Number(this.isHeroInTeam(b.id)) - Number(this.isHeroInTeam(a.id));
            if (inTeamDiff !== 0) return inTeamDiff;
            const rarityDiff = this.getHeroRarityWeight(b.rarity) - this.getHeroRarityWeight(a.rarity);
            if (rarityDiff !== 0) return rarityDiff;
            const powerDiff = b.getPower() - a.getPower();
            if (powerDiff !== 0) return powerDiff;
            return b.level - a.level;
        });
    }

    isHeroInTeam(heroId) {
        return this.team.includes(heroId);
    }

    getHeroRarityWeight(rarity) {
        const rarityOrder = { legendary: 4, epic: 3, rare: 2, common: 1 };
        return rarityOrder[rarity] || 0;
    }

    addHeroExp(heroId, exp, options = {}) {
        const hero = this.getHero(heroId);
        if (!hero) {
            return { success: false, reason: 'missing_hero' };
        }

        const maxLevel = Number.isFinite(options.maxLevel) ? options.maxLevel : Infinity;
        const source = options.source || 'manual';
        if (source === 'battle' && !hero.canGainBattleExp(maxLevel)) {
            return { success: false, reason: 'level_cap', hero };
        }

        const result = hero.addExp(exp, maxLevel);
        if (result.leveledUp) {
            eventManager.emit('heroLevelUp', hero);
        }

        eventManager.emit('heroUpdate', hero);
        return { success: true, hero, ...result };
    }

    distributeBattleExp(heroIds, expPerHero, playerLevel) {
        const summary = {
            expPerHero: Math.max(0, Number(expPerHero) || 0),
            totalExp: 0,
            awarded: [],
            blocked: []
        };

        if (!Array.isArray(heroIds) || summary.expPerHero <= 0) {
            return summary;
        }

        heroIds.forEach(heroId => {
            const result = this.addHeroExp(heroId, summary.expPerHero, {
                maxLevel: playerLevel,
                source: 'battle'
            });

            if (result.success) {
                summary.awarded.push({
                    heroId,
                    name: result.hero.name,
                    level: result.hero.level,
                    exp: summary.expPerHero
                });
                summary.totalExp += summary.expPerHero;
            } else if (result.hero) {
                summary.blocked.push({
                    heroId,
                    name: result.hero.name,
                    reason: result.reason
                });
            }
        });

        return summary;
    }

    levelUpHero(heroId) {
        const hero = this.getHero(heroId);
        if (!hero) {
            return false;
        }
        const leveledUp = hero.levelUpOnce();
        if (!leveledUp) {
            return false;
        }
        eventManager.emit('heroLevelUp', hero);
        eventManager.emit('heroUpdate', hero);
        return true;
    }

    upgradeHeroStars(heroId) {
        const hero = this.getHero(heroId);
        if (!hero) {
            return false;
        }
        const success = hero.upgradeStars();
        if (success) {
            eventManager.emit('heroStarsUp', hero);
            eventManager.emit('heroUpdate', hero);
        }
        return success;
    }

    addToTeam(heroId) {
        if (this.team.length >= this.maxTeamSize || this.team.includes(heroId) || !this.getHero(heroId)) {
            return false;
        }
        this.team.push(heroId);
        eventManager.emit('teamUpdate', this.team);
        return true;
    }

    removeFromTeam(heroId) {
        const index = this.team.indexOf(heroId);
        if (index === -1) {
            return false;
        }
        this.team.splice(index, 1);
        eventManager.emit('teamUpdate', this.team);
        return true;
    }

    getTeam() {
        return this.team.map(id => this.getHero(id)).filter(Boolean);
    }

    getTeamIds() {
        return this.getTeam().map(hero => hero.id);
    }

    equipToHero(heroId, equipmentInstanceId) {
        const hero = this.getHero(heroId);
        const equipment = itemManager.getEquipment(equipmentInstanceId);
        if (!hero || !equipment) {
            return { success: false, message: '装备或英雄不存在' };
        }

        const removedFromBag = itemManager.removeEquipment(equipmentInstanceId);
        if (!removedFromBag) {
            return { success: false, message: '装备不存在于背包中' };
        }

        const previous = hero.equip(removedFromBag);
        if (previous) {
            itemManager.addEquipment(previous);
        }

        eventManager.emit('heroEquipmentChange', { heroId, slot: equipment.slot, equipment: removedFromBag });
        eventManager.emit('heroUpdate', hero);
        return { success: true, hero, equipment: removedFromBag, previous };
    }

    unequipFromHero(heroId, slot) {
        const hero = this.getHero(heroId);
        if (!hero) {
            return { success: false, message: '英雄不存在' };
        }

        const removed = hero.unequip(slot);
        if (!removed) {
            return { success: false, message: '该部位没有装备' };
        }

        itemManager.addEquipment(removed);
        eventManager.emit('heroEquipmentChange', { heroId, slot, equipment: null });
        eventManager.emit('heroUpdate', hero);
        return { success: true, hero, equipment: removed };
    }

    addFragments(configId, count) {
        const current = this.fragments.get(configId) || 0;
        this.fragments.set(configId, current + (Number(count) || 0));
        eventManager.emit('fragmentAdd', { configId, count });
    }

    getFragments(configId) {
        return this.fragments.get(configId) || 0;
    }

    getAllFragments() {
        const result = [];
        this.fragments.forEach((count, configId) => {
            if (count <= 0) {
                return;
            }
            const heroConfig = HeroConfig.getHeroConfig(configId);
            if (heroConfig) {
                result.push({ configId, count, heroConfig });
            }
        });

        const rarityOrder = { legendary: 0, epic: 1, rare: 2, common: 3 };
        result.sort((a, b) => (rarityOrder[a.heroConfig.rarity] ?? 4) - (rarityOrder[b.heroConfig.rarity] ?? 4));
        return result;
    }

    removeFragments(configId, count) {
        const current = this.fragments.get(configId) || 0;
        if (current < count) {
            return false;
        }
        this.fragments.set(configId, current - count);
        eventManager.emit('fragmentRemove', { configId, count });
        return true;
    }

    canUpgradeStarsWithFragments(heroId) {
        const hero = this.getHero(heroId);
        if (!hero) {
            return { can: false, cost: 0, isMax: false, message: '英雄不存在' };
        }
        const cost = HeroConfig.getStarUpgradeCost(hero.stars);
        const currentFragments = this.getFragments(hero.configId);
        if (cost <= 0) {
            return { can: false, cost: 0, isMax: true, currentFragments, message: '当前已升满' };
        }
        if (currentFragments >= cost) {
            return { can: true, cost, isMax: false, currentFragments, message: '' };
        }
        return { can: false, cost, isMax: false, currentFragments, message: `需要${cost}个碎片，当前只有${currentFragments}个` };
    }

    synthesizeHero(configId) {
        if (this.getFragments(configId) < 50) {
            return false;
        }
        if (this.heroes.some(hero => hero.configId === configId)) {
            return false;
        }
        this.removeFragments(configId, 50);
        const heroConfig = HeroConfig.getHeroConfig(configId);
        if (!heroConfig) {
            return false;
        }
        const hero = new Hero(heroConfig, 1);
        this.addHero(hero);
        eventManager.emit('heroSynthesize', hero);
        return true;
    }

    createBattleUnits() {
        return this.getTeam().map(hero => new BattleUnit({
            id: hero.id,
            name: hero.name,
            icon: hero.icon,
            type: 'hero',
            camp: 'hero',
            baseStats: {
                hp: hero.maxHp,
                attack: hero.attack,
                defense: hero.defense,
                speed: hero.speed,
                crit: hero.crit,
                antiCrit: hero.antiCrit,
                defensePen: hero.defensePen,
                accuracy: hero.accuracy,
                dodge: hero.dodge,
                attackRange: hero.attackRange,
                moveRange: hero.moveRange
            },
            skill: hero.skill,
            portrait: hero.icon,
            rank: 'player'
        }));
    }

    getSaveData() {
        const fragmentsObj = {};
        this.fragments.forEach((count, configId) => {
            fragmentsObj[configId] = count;
        });

        return {
            heroes: this.heroes.map(hero => hero.getSaveData()),
            team: [...this.team],
            fragments: fragmentsObj
        };
    }
}

const heroManager = new HeroManager();
window.heroManager = heroManager;
