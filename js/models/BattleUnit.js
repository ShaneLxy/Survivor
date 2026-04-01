/**
 * 战斗单位模型
 */
class BattleUnit {
    constructor(config, level = 1) {
        this.id = config.id || Utils.generateId();
        this.name = config.name || '未知单位';
        this.icon = config.icon || '❓';
        this.type = config.type || 'enemy'; // 'hero' or 'enemy'

        // 属性 (使用 _ 前缀避免和方法名冲突)
        const baseStats = config.baseStats || {};
        this.maxHp = baseStats.hp || 100;
        this.hp = this.maxHp;
        this._attack = baseStats.attack || 10;  // 改为 _attack
        this.defense = baseStats.defense || 0;
        this.speed = baseStats.speed || 10;

        // 技能
        this.skill = config.skill || null;
    }

    /**
     * 受到伤害
     * @param {number} damage - 伤害值
     * @returns {number} 实际伤害
     */
    takeDamage(damage) {
        const actualDamage = Math.max(1, damage - Math.floor(this.defense * 0.5));
        this.hp = Math.max(0, this.hp - actualDamage);
        return actualDamage;
    }

    /**
     * 治疗
     * @param {number} healAmount - 治疗量
     * @returns {number} 实际治疗量
     */
    heal(healAmount) {
        const actualHeal = Math.min(healAmount, this.maxHp - this.hp);
        this.hp += actualHeal;
        return actualHeal;
    }

    /**
     * 攻击目标
     * @param {BattleUnit} target - 目标
     * @param {boolean} useSkill - 是否使用技能
     * @returns {Object} 攻击结果
     */
    attack(target, useSkill = false) {
        let damage = this._attack;  // 使用 _attack 而不是 attack

        if (useSkill && this.skill) {
            const multiplier = this.skill.multiplier || 1.0;
            damage = Math.floor(damage * multiplier);
        }

        // 随机浮动
        damage = Math.floor(damage * Utils.randomFloat(0.9, 1.1));

        const actualDamage = target.takeDamage(damage);

        return {
            attacker: this.name,
            target: target.name,
            damage: actualDamage,
            useSkill: useSkill,
            isCritical: Math.random() < 0.1, // 10%暴击
            skillName: useSkill ? this.skill?.name : null
        };
    }

    /**
     * 是否存活
     * @returns {boolean}
     */
    isAlive() {
        return this.hp > 0;
    }

    /**
     * 重置状态
     */
    reset() {
        this.hp = this.maxHp;
    }

    /**
     * 获取属性信息
     * @returns {Object}
     */
    getStats() {
        return {
            hp: this.hp,
            maxHp: this.maxHp,
            attack: this.attack,
            defense: this.defense,
            speed: this.speed,
            hpPercent: (this.hp / this.maxHp * 100).toFixed(1)
        };
    }
}
