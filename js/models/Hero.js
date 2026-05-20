/**
 * 英雄模型
 */
class Hero {
    constructor(config, level = 1) {
        this.id = Utils.generateId();
        this.configId = config.id;

        this.name = config.name || '未知英雄';
        this.icon = config.icon || '🧙';
        this.portrait = config.portrait || null;
        this.cardPortrait = config.cardPortrait || HeroConfig.getCardPortraitPath?.(config.portrait) || null;
        this.rarity = HeroConfig.normalizeRarity(config.rarity);
        this.profession = config.profession || null;
        this.professionIcon = config.professionIcon || HeroConfig.getProfessionIconPath?.(this.profession) || null;
        this.level = Math.max(1, Number(level) || 1);
        this.exp = 0;
        this.stars = HeroConfig.normalizeStarLevel(1);
        this.skills = HeroConfig.getHeroSkillsForStarLevel(this.configId, this.stars);
        this.reactiveEffects = HeroConfig.getHeroReactiveEffectsForStarLevel(this.configId, this.stars);
        this.basicAttackEffects = HeroConfig.getHeroBasicAttackEffectsForStarLevel(this.configId, this.stars);
        this.passiveEffects = HeroConfig.getHeroPassiveEffectsForStarLevel(this.configId, this.stars);
        this.skill = this.skills[0] || null;
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

    getLevelCap(maxLevel = Infinity) {
        const starLevelCap = HeroConfig.getLevelCapByStars(this.stars);
        const externalCap = Number.isFinite(maxLevel) ? Math.max(1, Number(maxLevel) || 1) : Infinity;
        return Math.max(1, Math.min(starLevelCap, externalCap));
    }

    isAtLevelCap(maxLevel = Infinity) {
        return this.level >= this.getLevelCap(maxLevel);
    }

    canLevelUp(maxLevel = Infinity) {
        return !this.isAtLevelCap(maxLevel) && this.exp >= this.getExpRequired();
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
        const requestedExp = Math.max(0, Number(exp) || 0);
        const levelCap = this.getLevelCap(maxLevel);
        if (requestedExp <= 0) {
            return { gainedExp: 0, leveledUp: false, reachedCap: this.isAtLevelCap(maxLevel), levelCap };
        }

        const previousExp = this.exp;
        this.exp = Math.min(this.getExpRequired(), this.exp + requestedExp);
        const gainedExp = Math.max(0, this.exp - previousExp);
        let leveledUp = false;
        while (this.canLevelUp(maxLevel)) {
            this.levelUpOnce(maxLevel);
            leveledUp = true;
        }

        if (this.isAtLevelCap(maxLevel)) {
            this.exp = Math.min(this.exp, this.getExpRequired());
        }

        return {
            gainedExp,
            leveledUp,
            reachedCap: this.isAtLevelCap(maxLevel),
            levelCap
        };
    }

    getStarDisplayInfo() {
        return HeroConfig.getStarDisplayInfo(this.stars);
    }

    getSpecialTraitStages() {
        return HeroConfig.getSpecialTraitStages(this.configId);
    }

    getSpecialTraitFramework() {
        return HeroConfig.getSpecialTraitFramework(this.configId);
    }

    getBaseStats() {
        const config = HeroConfig.getHeroConfig(this.configId);
        const stats = HeroConfig.calculateStats(config, this.level);
        const starBonus = HeroConfig.getStarBonusMultiplier(this.stars, config?.rarity || this.rarity);
        const trainingBonus = Math.max(0, Number(window.shelterManager?.getTrainingGroundStatBonus?.() || 0));
        const trainingMultiplier = 1 + trainingBonus;
        const traitModifiers = HeroConfig.getTraitBattleModifiers(this.configId, this.stars);
        const statBonuses = traitModifiers.statBonuses || {};

        return {
            hp: Math.floor((stats.hp + (Number(statBonuses.hp) || 0)) * starBonus * trainingMultiplier),
            attack: Math.floor((stats.attack + (Number(statBonuses.attack) || 0)) * starBonus * trainingMultiplier),
            attackCoefficient: Math.max(0.05, Number(stats.attackCoefficient) || 1),
            defense: Math.floor((stats.defense + (Number(statBonuses.defense) || 0)) * starBonus * trainingMultiplier),
            speed: Math.floor((stats.speed + (Number(statBonuses.speed) || 0)) * starBonus * trainingMultiplier),
            crit: Math.floor((stats.crit + (Number(statBonuses.crit) || 0)) * starBonus * trainingMultiplier),
            antiCrit: Math.floor((stats.antiCrit + (Number(statBonuses.antiCrit) || 0)) * starBonus * trainingMultiplier),
            defensePen: Math.floor((stats.defensePen + (Number(statBonuses.defensePen) || 0)) * starBonus * trainingMultiplier),
            accuracy: Math.floor((stats.accuracy + (Number(statBonuses.accuracy) || 0)) * starBonus * trainingMultiplier),
            dodge: Math.floor((stats.dodge + (Number(statBonuses.dodge) || 0)) * starBonus * trainingMultiplier),
            attackRange: Math.max(1, (stats.attackRange || 1) + (traitModifiers.attackRangeBonus || 0)),
            moveRange: Math.max(1, (stats.moveRange || 1) + (Number(statBonuses.moveRange) || 0))
        };
    }

    refreshSkills() {
        this.skills = HeroConfig.getHeroSkillsForStarLevel(this.configId, this.stars);
        this.reactiveEffects = HeroConfig.getHeroReactiveEffectsForStarLevel(this.configId, this.stars);
        this.basicAttackEffects = HeroConfig.getHeroBasicAttackEffectsForStarLevel(this.configId, this.stars);
        this.passiveEffects = HeroConfig.getHeroPassiveEffectsForStarLevel(this.configId, this.stars);
        this.skill = this.skills[0] || null;
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
        this.refreshSkills();
        const baseStats = this.getBaseStats();
        const equipmentStats = this.getEquipmentStats();

        this.maxHp = Math.max(1, baseStats.hp + equipmentStats.hp);
        this.attack = Math.max(1, baseStats.attack + equipmentStats.attack);
        this.attackCoefficient = Math.max(0.05, Number(baseStats.attackCoefficient) || 1);
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
        return !this.isAtLevelCap(playerLevel);
    }

    getPower() {
        return GameConfig.calculateCombatPower({
            attack: this.attack,
            attackCoefficient: this.attackCoefficient,
            defense: this.defense,
            hp: this.maxHp,
            speed: this.speed,
            crit: this.crit,
            antiCrit: this.antiCrit,
            defensePen: this.defensePen,
            accuracy: this.accuracy,
            dodge: this.dodge,
            attackRange: this.attackRange,
            moveRange: this.moveRange
        });
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
            portrait: this.portrait,
            cardPortrait: this.cardPortrait,
            rarity: this.rarity,
            profession: this.profession,
            professionIcon: this.professionIcon,
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
            skills: this.skills.map(skill => ({ ...skill })),
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
