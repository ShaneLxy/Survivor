/**
 * 战斗单位模型
 */
class BattleUnit {
    constructor(config, level = 1) {
        this.id = config.id || Utils.generateId();
        this.configId = config.configId || null;
        this.name = config.name || '未知单位';
        this.icon = config.icon || '❓';
        this.portrait = config.portrait || null;
        this.type = config.type || 'enemy';
        this.camp = config.camp || (this.type === 'hero' ? 'hero' : 'enemy');
        this.rank = config.rank || 'normal';
        this.profession = config.profession || null;
        this.description = config.description || '';
        this.skills = Array.isArray(config.skills) && config.skills.length > 0
            ? config.skills.filter(Boolean).map(skill => ({ ...skill }))
            : (config.skill ? [{ ...config.skill }] : []);
        this.skill = this.skills[0] || null;
        this.skillStates = this.skills.map((skill, index) => this.normalizeSkillState(skill, index));

        this.position = { x: 0, y: 0 };
        this.progress = 0;
        this.defendBonus = 0;

        const baseStats = {
            hp: 100,
            attack: 10,
            attackCoefficient: 1,
            defense: 0,
            speed: 10,
            crit: 5,
            antiCrit: 0,
            defensePen: 0,
            accuracy: 0,
            dodge: 0,
            attackRange: 1,
            moveRange: 2,
            ...(config.baseStats || {})
        };

        this.maxHp = Math.max(1, Number(baseStats.hp) || 100);
        this.hp = this.maxHp;
        this._attack = Math.max(1, Number(baseStats.attack) || 10);
        this.attackCoefficient = Math.max(0.05, Number(baseStats.attackCoefficient) || 1);
        this.defense = Math.max(0, Number(baseStats.defense) || 0);
        this.speed = Math.max(1, Number(baseStats.speed) || 10);
        this.crit = Math.max(0, Number(baseStats.crit) || 0);
        this.antiCrit = Math.max(0, Number(baseStats.antiCrit) || 0);
        this.defensePen = Math.max(0, Number(baseStats.defensePen) || 0);
        this.accuracy = Math.max(0, Number(baseStats.accuracy) || 0);
        this.dodge = Math.max(0, Number(baseStats.dodge) || 0);
        this.attackRange = Math.max(1, Number(baseStats.attackRange) || 1);
        this.moveRange = Math.max(1, Number(baseStats.moveRange) || 1);
    }

    setPosition(position) {
        this.position = { x: position.x, y: position.y };
    }

    normalizeSkillState(skill, index) {
        const cooldownTurns = Math.max(0, Number(skill?.cooldownTurns ?? skill?.cooldown ?? 0) || 0);
        const range = Math.max(1, Number(skill?.range ?? this.attackRange ?? 1) || this.attackRange || 1);
        const targetCount = Math.max(1, Number(skill?.targetCount ?? 1) || 1);
        const hpCostPercent = Math.max(0, Number(skill?.hpCostPercent ?? 0) || 0);
        return {
            index,
            cooldownRemaining: 0,
            cooldownTurns,
            range,
            targetType: skill?.targetType || 'enemy',
            targetCount,
            hpCostPercent,
            effectType: skill?.effectType || 'damage'
        };
    }

    resetTurnState() {
        this.defendBonus = 0;
        this.skillStates.forEach(state => {
            if (state.cooldownRemaining > 0) {
                state.cooldownRemaining -= 1;
            }
        });
    }

    defend() {
        this.defendBonus = 0.1;
    }

    distanceTo(target) {
        if (!target?.position) {
            return Infinity;
        }
        return Math.abs(this.position.x - target.position.x) + Math.abs(this.position.y - target.position.y);
    }

    calculateHitChance(target) {
        return Utils.clamp(0.9 + (this.accuracy - target.dodge) / 100, 0.35, 1);
    }

    calculateCritChance(target) {
        return Utils.clamp(0.05 + (this.crit - target.antiCrit) / 100, 0.05, 0.85);
    }

    calculateCritMultiplier(target) {
        return 1.5 + Math.max(0, this.crit - target.antiCrit) / 100;
    }

    takeDamage(rawDamage, attacker = null) {
        const penRatio = Utils.clamp((Number(attacker?.defensePen) || 0) / 100, 0, 0.9);
        const effectiveDefense = Math.floor(this.defense * (1 + this.defendBonus) * (1 - penRatio));
        const actualDamage = Math.max(1, Math.floor(rawDamage - effectiveDefense * 0.45));
        this.hp = Math.max(0, this.hp - actualDamage);
        return actualDamage;
    }

    heal(healAmount) {
        const actualHeal = Math.min(Math.max(0, Number(healAmount) || 0), this.maxHp - this.hp);
        this.hp += actualHeal;
        return actualHeal;
    }

    revive(reviveRatio = 0.3) {
        if (this.isAlive()) {
            return 0;
        }
        const ratio = Utils.clamp(Number(reviveRatio) || 0.3, 0.05, 1);
        const restoredHp = Math.max(1, Math.floor(this.maxHp * ratio));
        this.hp = Math.min(this.maxHp, restoredHp);
        this.progress = 0;
        this.defendBonus = 0;
        return this.hp;
    }

    getSkillState(index = 0) {
        return this.skillStates[index] || null;
    }

    getSkill(index = 0) {
        return this.skills[index] || null;
    }

    getSkillRange(index = 0) {
        return this.getSkillState(index)?.range || this.attackRange;
    }

    getSkillTargetType(index = 0) {
        return this.getSkillState(index)?.targetType || 'enemy';
    }

    getSkillTargetCount(index = 0) {
        return this.getSkillState(index)?.targetCount || 1;
    }

    getSkillHpCost(index = 0) {
        const hpCostPercent = this.getSkillState(index)?.hpCostPercent || 0;
        if (hpCostPercent <= 0) {
            return 0;
        }
        return Math.max(1, Math.floor(this.maxHp * hpCostPercent / 100));
    }

    canUseSkill(index = 0) {
        const skill = this.getSkill(index);
        const state = this.getSkillState(index);
        if (!skill || !state) {
            return false;
        }
        if (state.cooldownRemaining > 0) {
            return false;
        }
        const hpCost = this.getSkillHpCost(index);
        return this.hp - hpCost >= 1;
    }

    consumeSkillCost(index = 0) {
        const hpCost = this.getSkillHpCost(index);
        if (hpCost > 0) {
            this.hp = Math.max(1, this.hp - hpCost);
        }
        const state = this.getSkillState(index);
        if (state) {
            state.cooldownRemaining = state.cooldownTurns;
        }
        return hpCost;
    }

    buildSkillResultBase(target, skillIndex = 0) {
        const skill = this.getSkill(skillIndex);
        return {
            attacker: this.name,
            target: target?.name || '',
            useSkill: true,
            skillIndex,
            skillName: skill?.name || null,
            isCritical: false
        };
    }

    attackTarget(target, useSkill = false, skillIndex = 0) {
        const activeSkill = useSkill ? this.getSkill(skillIndex) : (this.skill || this.skills[0] || null);
        const hitChance = this.calculateHitChance(target);
        const hit = Math.random() <= hitChance;
        if (!hit) {
            return {
                attacker: this.name,
                target: target.name,
                damage: 0,
                hit: false,
                useSkill,
                isCritical: false,
                skillIndex: useSkill ? skillIndex : null,
                skillName: useSkill ? activeSkill?.name : null
            };
        }

        let damage = Math.floor(this._attack * this.attackCoefficient);
        if (useSkill && activeSkill) {
            damage = Math.floor(damage * (activeSkill.multiplier || 1));
        }
        damage = Math.floor(damage * Utils.randomFloat(0.92, 1.08));

        const isCritical = Math.random() <= this.calculateCritChance(target);
        if (isCritical) {
            damage = Math.floor(damage * this.calculateCritMultiplier(target));
        }

        const actualDamage = target.takeDamage(damage, this);
        return {
            attacker: this.name,
            target: target.name,
            damage: actualDamage,
            hit: true,
            useSkill,
            isCritical,
            skillIndex: useSkill ? skillIndex : null,
            skillName: useSkill ? activeSkill?.name : null
        };
    }

    getPower() {
        return Math.floor(
            this._attack * this.attackCoefficient * 2 +
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

    isAlive() {
        return this.hp > 0;
    }


    reset() {
        this.hp = this.maxHp;
        this.progress = 0;
        this.defendBonus = 0;
        this.skillStates.forEach(state => {
            state.cooldownRemaining = 0;
        });
    }

    getStats() {
        return {
            hp: this.hp,
            maxHp: this.maxHp,
            attack: this._attack,
            defense: this.defense,
            speed: this.speed,
            crit: this.crit,
            antiCrit: this.antiCrit,
            defensePen: this.defensePen,
            accuracy: this.accuracy,
            dodge: this.dodge,
            attackRange: this.attackRange,
            moveRange: this.moveRange,
            hpPercent: (this.hp / this.maxHp * 100).toFixed(1)
        };
    }
}

window.BattleUnit = BattleUnit;
