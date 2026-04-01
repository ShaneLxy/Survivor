/**
 * 英雄模型
 */
class Hero {
    constructor(config, level = 1) {
        this.id = config.id || Utils.generateId();
        this.configId = config.id; // 保存配置ID
        this.name = config.name || '未知英雄';
        this.icon = config.icon || '🧙';
        this.rarity = config.rarity || 'common';
        this.level = level;
        this.exp = 0;
        this.stars = 1;

        // 属性
        const stats = HeroConfig.calculateStats(config, level);
        this.maxHp = stats.hp;
        this.hp = this.maxHp;
        this.attack = stats.attack;
        this.defense = stats.defense;
        this.speed = stats.speed;

        // 技能
        this.skill = config.skill || null;

        // 装备
        this.equipment = {
            weapon: null,
            armor: null
        };
    }

    /**
     * 升级
     * @param {number} exp - 获得的经验值
     * @returns {boolean} 是否升级
     */
    addExp(exp) {
        this.exp += exp;

        let leveledUp = false;
        while (this.exp >= GameConfig.getExpRequired(this.level)) {
            this.exp -= GameConfig.getExpRequired(this.level);
            this.level++;
            this.updateStats();
            leveledUp = true;
        }

        return leveledUp;
    }

    /**
     * 更新属性
     */
    updateStats() {
        const config = HeroConfig.getHeroConfig(this.configId);
        const stats = HeroConfig.calculateStats(config, this.level);

        this.maxHp = stats.hp;
        this.attack = stats.attack;
        this.defense = stats.defense;
        this.speed = stats.speed;

        // 满血
        this.hp = this.maxHp;
    }

    /**
     * 装备武器
     * @param {Object} weapon - 武器配置
     */
    equipWeapon(weapon) {
        this.equipment.weapon = weapon;
        this.attack += weapon.stats.attack;
    }

    /**
     * 卸下武器
     */
    unequipWeapon() {
        if (this.equipment.weapon) {
            this.attack -= this.equipment.weapon.stats.attack;
            this.equipment.weapon = null;
        }
    }

    /**
     * 装备防具
     * @param {Object} armor - 防具配置
     */
    equipArmor(armor) {
        this.equipment.armor = armor;
        this.defense += armor.stats.defense;
    }

    /**
     * 卸下防具
     */
    unequipArmor() {
        if (this.equipment.armor) {
            this.defense -= this.equipment.armor.stats.defense;
            this.equipment.armor = null;
        }
    }

    /**
     * 升星
     * @returns {boolean}
     */
    upgradeStars() {
        if (this.stars >= 5) return false;

        this.stars++;
        this.updateStats();

        // 升星加成
        const starBonus = 1 + (this.stars - 1) * 0.1;
        this.attack = Math.floor(this.attack * starBonus);
        this.defense = Math.floor(this.defense * starBonus);
        this.maxHp = Math.floor(this.maxHp * starBonus);

        return true;
    }

    /**
     * 获取战力
     * @returns {number}
     */
    getPower() {
        return Math.floor(this.attack + this.defense + this.maxHp * 0.5 + this.speed * 0.5);
    }

    /**
     * 获取信息
     * @returns {Object}
     */
    getInfo() {
        return {
            id: this.id,
            configId: this.configId,
            name: this.name,
            icon: this.icon,
            rarity: this.rarity,
            level: this.level,
            stars: this.stars,
            exp: this.exp,
            power: this.getPower(),
            stats: {
                hp: this.hp,
                maxHp: this.maxHp,
                attack: this.attack,
                defense: this.defense,
                speed: this.speed
            },
            equipment: this.equipment,
            skill: this.skill
        };
    }
}
