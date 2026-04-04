/**
 * 英雄模型
 */
class Hero {
    constructor(config, level = 1) {
        this.id = Utils.generateId();
        this.configId = config.id;

        this.name = config.name || '未知英雄';
        this.icon = config.icon || '🧙';
        this.rarity = config.rarity || 'common';
        this.level = Math.max(1, Number(level) || 1);
        this.exp = 0;
        this.stars = HeroConfig.normalizeStarLevel(1);
        this.skill = config.skill || null;
        this.equipment = {
            weapon: null,
            clothes: null,
            pants: null,
            shoes: null
        };
        this.hp = 0;
        this.maxHp = 0;
        this.refreshStats(true);
    }

    static fromSaveData(heroData) {
        const config = HeroConfig.getHeroConfig(heroData?.configId);
        if (!config) {
            return null;
        }

        const hero = new Hero(config, heroData.level || 1);
        hero.id = heroData.id || hero.id;
        hero.exp = Number(heroData.exp) || 0;
        hero.stars = HeroConfig.normalizeStarLevel(heroData?.stars);
        hero.equipment = {
            weapon: Equipment.fromSaveData(heroData.equipment?.weapon),
            clothes: Equipment.fromSaveData(heroData.equipment?.clothes),
            pants: Equipment.fromSaveData(heroData.equipment?.pants),
            shoes: Equipment.fromSaveData(heroData.equipment?.shoes)
        };
        hero.refreshStats(false);
        hero.hp = Utils.clamp(Number(heroData.hp) || hero.maxHp, 0, hero.maxHp);
        return hero;
    }

    getExpRequired() {
        return GameConfig.getExpRequired(this.level);
    }

    canLevelUp(maxLevel = Infinity) {
        return this.level < maxLevel && this.exp >= this.getExpRequired();
    }

    levelUpOnce(maxLevel = Infinity) {
        if (!this.canLevelUp(maxLevel)) {
            return false;
        }

        this.exp -= this.getExpRequired();
        this.level++;
        this.refreshStats(true);
        return true;
    }

    addExp(exp, maxLevel = Infinity) {
        const gainedExp = Math.max(0, Number(exp) || 0);
        if (gainedExp <= 0) {
            return { gainedExp: 0, leveledUp: false, reachedCap: this.level >= maxLevel };
        }

        this.exp += gainedExp;
        let leveledUp = false;
        while (this.canLevelUp(maxLevel)) {
            this.levelUpOnce(maxLevel);
            leveledUp = true;
        }

        return {
            gainedExp,
            leveledUp,
            reachedCap: this.level >= maxLevel
        };
    }

    getStarDisplayInfo() {
        return HeroConfig.getStarDisplayInfo(this.stars);
    }

    getSpecialTraitStages() {
        return HeroConfig.getSpecialTraitStages(this.configId);
    }

    getBaseStats() {
        const config = HeroConfig.getHeroConfig(this.configId);
        const stats = HeroConfig.calculateStats(config, this.level);
        const starBonus = HeroConfig.getStarBonusMultiplier(this.stars);

        return {
            hp: Math.floor(stats.hp * starBonus),
            attack: Math.floor(stats.attack * starBonus),
            defense: Math.floor(stats.defense * starBonus),
            speed: Math.floor(stats.speed * starBonus),
            crit: Math.floor(stats.crit * starBonus),
            antiCrit: Math.floor(stats.antiCrit * starBonus),
            defensePen: Math.floor(stats.defensePen * starBonus),
            accuracy: Math.floor(stats.accuracy * starBonus),
            dodge: Math.floor(stats.dodge * starBonus),
            attackRange: stats.attackRange,
            moveRange: stats.moveRange
        };
    }

    getEquipmentStats() {
        const total = {
            hp: 0,
            attack: 0,
            defense: 0,
            speed: 0,
            crit: 0,
            antiCrit: 0,
            defensePen: 0,
            accuracy: 0,
            dodge: 0,
            attackRange: 0,
            moveRange: 0
        };

        Object.values(this.equipment).filter(Boolean).forEach(equipment => {
            Object.entries(equipment.stats || {}).forEach(([key, value]) => {
                total[key] = (total[key] || 0) + (Number(value) || 0);
            });
        });

        return total;
    }

    refreshStats(resetHp = false) {
        const previousHp = this.hp;
        const previousMaxHp = this.maxHp;
        const baseStats = this.getBaseStats();
        const equipmentStats = this.getEquipmentStats();

        this.maxHp = Math.max(1, baseStats.hp + equipmentStats.hp);
        this.attack = Math.max(1, baseStats.attack + equipmentStats.attack);
        this.defense = Math.max(0, baseStats.defense + equipmentStats.defense);
        this.speed = Math.max(1, baseStats.speed + equipmentStats.speed);
        this.crit = Math.max(0, baseStats.crit + equipmentStats.crit);
        this.antiCrit = Math.max(0, baseStats.antiCrit + equipmentStats.antiCrit);
        this.defensePen = Math.max(0, baseStats.defensePen + equipmentStats.defensePen);
        this.accuracy = Math.max(0, baseStats.accuracy + equipmentStats.accuracy);
        this.dodge = Math.max(0, baseStats.dodge + equipmentStats.dodge);
        this.attackRange = Math.max(1, baseStats.attackRange + equipmentStats.attackRange);
        this.moveRange = Math.max(1, baseStats.moveRange + equipmentStats.moveRange);

        if (resetHp || previousMaxHp <= 0) {
            this.hp = this.maxHp;
        } else {
            const hpRatio = previousHp > 0 && previousMaxHp > 0 ? previousHp / previousMaxHp : 1;
            this.hp = Utils.clamp(Math.round(this.maxHp * hpRatio), 0, this.maxHp);
        }
    }

    equip(equipment) {
        if (!equipment || !equipment.slot) {
            return null;
        }
        const previous = this.equipment[equipment.slot] || null;
        this.equipment[equipment.slot] = equipment;
        this.refreshStats(false);
        return previous;
    }

    unequip(slot) {
        if (!slot || !this.equipment[slot]) {
            return null;
        }
        const removed = this.equipment[slot];
        this.equipment[slot] = null;
        this.refreshStats(false);
        return removed;
    }

    upgradeStars() {
        if (HeroConfig.isMaxStarLevel(this.stars)) {
            return false;
        }
        this.stars = HeroConfig.normalizeStarLevel(this.stars + 1);
        this.refreshStats(true);
        return true;
    }

    canGainBattleExp(playerLevel) {
        return this.level < playerLevel;
    }

    getPower() {
        return Math.floor(
            this.attack * 2 +
            this.defense * 1.5 +
            this.maxHp * 0.5 +
            this.speed * 1.2 +
            this.crit +
            this.antiCrit +
            this.defensePen +
            this.attackRange * 8 +
            this.moveRange * 6
        );
    }

    getEquipmentInfo() {
        const result = {};
        Object.entries(this.equipment).forEach(([slot, equipment]) => {
            result[slot] = equipment ? equipment.getInfo() : null;
        });
        return result;
    }

    getInfo() {
        const stats = {};
        HeroConfig.getDisplayStats().forEach(statKey => {
            stats[statKey] = this[statKey];
        });

        return {
            id: this.id,
            configId: this.configId,
            name: this.name,
            icon: this.icon,
            rarity: this.rarity,
            level: this.level,
            stars: this.stars,
            starInfo: this.getStarDisplayInfo(),
            exp: this.exp,
            power: this.getPower(),
            stats: {
                hp: this.hp,
                maxHp: this.maxHp,
                ...stats
            },
            equipment: this.getEquipmentInfo(),
            skill: this.skill
        };
    }

    getSaveData() {
        return {
            id: this.id,
            configId: this.configId,
            level: this.level,
            exp: this.exp,
            stars: this.stars,
            hp: this.hp,
            equipment: {
                weapon: this.equipment.weapon ? this.equipment.weapon.getSaveData() : null,
                clothes: this.equipment.clothes ? this.equipment.clothes.getSaveData() : null,
                pants: this.equipment.pants ? this.equipment.pants.getSaveData() : null,
                shoes: this.equipment.shoes ? this.equipment.shoes.getSaveData() : null
            }
        };
    }
}

window.Hero = Hero;
