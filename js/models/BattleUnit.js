/**
 * 战斗单位模型
 */
class BattleUnit {
    constructor(config, level = 1) {
        this.id = config.id || Utils.generateId();
        this.configId = config.configId || null;
        this.name = config.name || '未知单位';
        this.icon = config.icon || '✦';
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
        this.reactiveEffects = Array.isArray(config.reactiveEffects)
            ? config.reactiveEffects
                .filter(Boolean)
                .map(effect => ({
                    ...effect,
                    statusEffects: Array.isArray(effect?.statusEffects)
                        ? effect.statusEffects.filter(Boolean).map(status => ({ ...status }))
                        : []
                }))
            : [];
        this.basicAttackEffects = Array.isArray(config.basicAttackEffects)
            ? config.basicAttackEffects
                .filter(Boolean)
                .map(effect => ({
                    ...effect,
                    chance: Number(effect?.chance ?? effect?.probability ?? 1) || 0,
                    trigger: effect?.trigger || 'hit',
                    statusEffects: Array.isArray(effect?.statusEffects)
                        ? effect.statusEffects.filter(Boolean).map(status => ({ ...status }))
                        : []
                }))
            : [];
        this.passiveEffects = Array.isArray(config.passiveEffects)
            ? config.passiveEffects
                .filter(Boolean)
                .map(effect => ({
                    ...effect,
                    chance: Number(effect?.chance ?? effect?.probability ?? 1) || 0,
                    statusEffects: Array.isArray(effect?.statusEffects)
                        ? effect.statusEffects.filter(Boolean).map(status => ({ ...status }))
                        : [],
                    allyStatusEffects: Array.isArray(effect?.allyStatusEffects)
                        ? effect.allyStatusEffects.filter(Boolean).map(status => ({ ...status }))
                        : []
                }))
            : [];

        this.position = { x: 0, y: 0 };
        this.progress = 0;
        this.defendBonus = 0;
        this.statusEffects = [];
        this.battleContext = null;
        this.passiveState = {};

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

    setBattleContext(context = null) {
        this.battleContext = context || null;
    }

    normalizeSkillState(skill, index) {
        const cooldownTurns = Math.max(0, Number(skill?.cooldownTurns ?? skill?.cooldown ?? 0) || 0);
        const configuredRange = Number(skill?.range ?? this.attackRange ?? 1);
        const range = Math.max(0, Number.isFinite(configuredRange) ? configuredRange : (this.attackRange || 1));
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
            hpCostBase: skill?.hpCostBase === 'max' ? 'max' : 'current',
            effectType: skill?.effectType || 'damage',
            canCrit: skill?.canCrit !== false,
            defensePenBonus: Math.max(0, Number(skill?.defensePenBonus ?? 0) || 0)
        };
    }

    normalizeStatusEffect(effect = {}, source = null) {
        const stat = effect.stat || (effect.type === 'slow' ? 'speed' : null);
        const value = Number(effect.value ?? effect.percent ?? 0) || 0;
        const durationTurns = Math.max(1, Number(effect.durationTurns ?? effect.duration ?? 1) || 1);
        const effectType = effect.effectType
            || (effect.type === 'bleed' ? 'damage_over_time'
                : effect.type === 'stun' ? 'control'
                    : 'stat_modifier');
        return {
            id: effect.id || Utils.generateId(),
            type: effect.type || 'custom',
            name: effect.name || this.getDefaultStatusName(effect.type),
            stat,
            value,
            effectType,
            modifierType: effect.modifierType || 'percent',
            durationTurns,
            remainingTurns: Math.max(1, Number(effect.remainingTurns) || durationTurns),
            tickTiming: effect.tickTiming || 'turnStart',
            stackMode: effect.stackMode || 'replace',
            skipAction: Boolean(effect.skipAction || effect.type === 'stun'),
            damageValue: Number(effect.damageValue) || 0,
            damageRatioMaxHp: Number(effect.damageRatioMaxHp) || 0,
            damageRatioCurrentHp: Number(effect.damageRatioCurrentHp) || 0,
            damageMultiplier: Number(effect.damageMultiplier) || 0,
            healMissingHpRatio: Math.max(0, Number(effect.healMissingHpRatio) || 0),
            healTakenMultiplier: Utils.clamp(Number(effect.healTakenMultiplier ?? 1) || 1, 0, 10),
            attackPercentBonus: Number(effect.attackPercentBonus) || 0,
            defensePercentBonus: Number(effect.defensePercentBonus) || 0,
            damageReduction: Math.max(0, Number(effect.damageReduction ?? 0) || 0),
            maxStacks: Math.max(1, Number(effect.maxStacks) || 1),
            ignoreDefense: effect.ignoreDefense !== false,
            silenceSkills: Boolean(effect.silenceSkills || effect.type === 'silence'),
            countsAsDebuff: effect.countsAsDebuff !== false,
            refreshAllStacksOnApply: effect.refreshAllStacksOnApply === true,
            damageTakenDebuffBonus: Math.max(0, Number(effect.damageTakenDebuffBonus ?? effect.damageTakenBonus ?? 0) || 0),
            excludedDebuffTypes: Array.isArray(effect.excludedDebuffTypes)
                ? effect.excludedDebuffTypes.filter(Boolean)
                : [],
            sourceOnly: effect.sourceOnly === true,
            sourceUnitId: effect.sourceUnitId || source?.id || null,
            sourceName: effect.sourceName || source?.name || null,
            skipNextTurnEndDecay: effect.skipNextTurnEndDecay === true,
            appliedAt: Date.now()
        };
    }

    normalizeStatusEffects(effects = [], source = null) {
        if (!Array.isArray(effects)) {
            return [];
        }
        return effects
            .filter(Boolean)
            .map(effect => this.normalizeStatusEffect(effect, source));
    }

    normalizeReactiveEffect(effect = {}) {
        return {
            id: effect.id || Utils.generateId(),
            name: effect.name || '被动',
            trigger: effect.trigger || 'damaged',
            target: effect.target || 'source',
            requiresPositiveDamage: effect.requiresPositiveDamage !== false,
            statusEffects: this.normalizeStatusEffects(effect.statusEffects || []),
            sourceRequired: effect.sourceRequired !== false,
            sourceOpponentOnly: effect.sourceOpponentOnly === true
        };
    }

    getReactiveEffects(trigger = null) {
        const effects = this.reactiveEffects
            .filter(Boolean)
            .map(effect => this.normalizeReactiveEffect(effect));
        if (!trigger) {
            return effects;
        }
        return effects.filter(effect => effect.trigger === trigger);
    }

    getDefaultStatusName(type) {
        switch (type) {
            case 'slow':
                return '减速';
            case 'stun':
                return '眩晕';
            case 'silence':
                return '沉默';
            case 'taunt':
                return '嘲讽';
            case 'bleed':
                return '流血';
            case 'burn':
                return '灼烧';
            case 'haze_mark':
                return '破意标记';
            case 'black_wall':
                return '铜墙铁壁';
            case 'battle_guard':
                return '战术减伤';
            default:
                return '状态';
        }
    }

    getStatusKey(effect = {}) {
        return `${effect.type || 'custom'}:${effect.stat || ''}`;
    }

    getStatusEffects() {
        return this.statusEffects.map(effect => ({ ...effect }));
    }

    hasStatus(type) {
        return this.statusEffects.some(effect => effect.type === type);
    }

    isStatusEffectDebuff(effect = {}, options = {}) {
        const type = effect.type || 'custom';
        const excludedTypes = Array.isArray(options.excludedTypes) ? options.excludedTypes : [];
        if (excludedTypes.includes(type) || effect.countsAsDebuff === false) {
            return false;
        }
        if (effect.isDebuff === true || effect.debuff === true) {
            return true;
        }
        if (['slow', 'stun', 'silence', 'taunt', 'bleed', 'burn'].includes(type)) {
            return true;
        }
        if (effect.effectType === 'damage_over_time' || effect.effectType === 'control') {
            return true;
        }
        if ((effect.modifierType === 'percent' || effect.modifierType === 'flat') && (Number(effect.value) || 0) < 0) {
            return true;
        }
        return false;
    }

    hasDebuff(options = {}) {
        return this.statusEffects.some(effect => this.isStatusEffectDebuff(effect, options));
    }

    countStatusStacks(type) {
        return this.statusEffects.filter(effect => effect.type === type).length;
    }

    removeStatusEffectsByType(type) {
        if (!type) {
            return [];
        }

        const removedEffects = [];
        this.statusEffects = this.statusEffects.filter((effect) => {
            if (effect.type !== type) {
                return true;
            }
            removedEffects.push({ ...effect });
            return false;
        });
        return removedEffects;
    }

    removeStatusEffectsWhere(predicate) {
        if (typeof predicate !== 'function') {
            return [];
        }

        const removedEffects = [];
        this.statusEffects = this.statusEffects.filter((effect) => {
            if (!predicate(effect)) {
                return true;
            }
            removedEffects.push({ ...effect });
            return false;
        });
        return removedEffects;
    }

    resolveStatusReplacement(current, incoming) {
        if (!current) {
            return incoming;
        }
        if ((incoming.stackMode || 'replace') === 'stack') {
            return incoming;
        }
        if (incoming.type === 'slow') {
            return incoming;
        }
        if (incoming.type === 'taunt') {
            return incoming;
        }
        const currentMagnitude = Math.abs(Number(current.value) || 0);
        const incomingMagnitude = Math.abs(Number(incoming.value) || 0);
        if (incomingMagnitude > currentMagnitude) {
            return incoming;
        }
        if (incomingMagnitude === currentMagnitude && incoming.remainingTurns >= current.remainingTurns) {
            return incoming;
        }
        return {
            ...current,
            remainingTurns: Math.max(current.remainingTurns, incoming.remainingTurns),
            durationTurns: Math.max(current.durationTurns, incoming.durationTurns)
        };
    }

    applyStatusEffects(effects = [], source = null) {
        const normalizedEffects = this.normalizeStatusEffects(effects, source);
        const appliedEffects = [];

        normalizedEffects.forEach((effect) => {
            const key = this.getStatusKey(effect);
            const existingIndex = this.statusEffects.findIndex(entry => this.getStatusKey(entry) === key);

            if (effect.stackMode === 'stack') {
                let matchingEntries = this.statusEffects
                    .map((entry, index) => ({ entry, index }))
                    .filter(({ entry }) => this.getStatusKey(entry) === key);
                const maxStacks = Math.max(1, Number(effect.maxStacks) || 1);

                if (matchingEntries.length < maxStacks) {
                    this.statusEffects.push(effect);
                    appliedEffects.push({ ...effect });
                    if (effect.refreshAllStacksOnApply) {
                        matchingEntries = this.statusEffects
                            .map((entry, index) => ({ entry, index }))
                            .filter(({ entry }) => this.getStatusKey(entry) === key);
                        matchingEntries.forEach(({ index }) => {
                            this.statusEffects[index] = {
                                ...this.statusEffects[index],
                                remainingTurns: effect.remainingTurns,
                                durationTurns: effect.durationTurns,
                                sourceUnitId: effect.sourceUnitId,
                                sourceName: effect.sourceName,
                                skipNextTurnEndDecay: effect.skipNextTurnEndDecay === true,
                                appliedAt: effect.appliedAt
                            };
                        });
                    }
                    return;
                }

                const refreshTarget = matchingEntries.sort((a, b) => {
                    const aTurns = Number(a.entry.remainingTurns) || 0;
                    const bTurns = Number(b.entry.remainingTurns) || 0;
                    return aTurns - bTurns;
                })[0];

                const refreshedEffect = {
                    ...this.statusEffects[refreshTarget.index],
                    remainingTurns: effect.remainingTurns,
                    durationTurns: effect.durationTurns,
                    sourceUnitId: effect.sourceUnitId,
                    sourceName: effect.sourceName,
                    skipNextTurnEndDecay: effect.skipNextTurnEndDecay === true,
                    appliedAt: effect.appliedAt
                };
                this.statusEffects[refreshTarget.index] = refreshedEffect;
                if (effect.refreshAllStacksOnApply) {
                    matchingEntries.forEach(({ index }) => {
                        this.statusEffects[index] = {
                            ...this.statusEffects[index],
                            remainingTurns: effect.remainingTurns,
                            durationTurns: effect.durationTurns,
                            sourceUnitId: effect.sourceUnitId,
                            sourceName: effect.sourceName,
                            skipNextTurnEndDecay: effect.skipNextTurnEndDecay === true,
                            appliedAt: effect.appliedAt
                        };
                    });
                }
                appliedEffects.push({ ...refreshedEffect, refreshed: true });
                return;
            }

            if (existingIndex === -1) {
                this.statusEffects.push(effect);
                appliedEffects.push({ ...effect });
                return;
            }

            const resolved = this.resolveStatusReplacement(this.statusEffects[existingIndex], effect);
            this.statusEffects[existingIndex] = resolved;
            appliedEffects.push({ ...resolved });
        });

        return appliedEffects;
    }

    resolveReactiveTarget(effect = {}, context = {}) {
        switch (effect.target) {
            case 'self':
                return this;
            case 'source':
            default:
                return context.sourceUnit || null;
        }
    }

    triggerReactiveEffects(trigger, context = {}) {
        const effects = this.getReactiveEffects(trigger);
        if (!effects.length) {
            return [];
        }

        const reactions = [];
        effects.forEach((effect) => {
            const damage = Number(context.damage) || 0;
            if (effect.requiresPositiveDamage && damage <= 0) {
                return;
            }
            const targetUnit = this.resolveReactiveTarget(effect, context);
            if (!targetUnit || typeof targetUnit.isAlive !== 'function' || !targetUnit.isAlive()) {
                return;
            }
            if (effect.sourceRequired && effect.target === 'source' && !context.sourceUnit) {
                return;
            }
            if (effect.sourceOpponentOnly && (!context.sourceUnit || context.sourceUnit.camp === this.camp)) {
                return;
            }

            const appliedEffects = targetUnit.applyStatusEffects(effect.statusEffects, this);
            if (!appliedEffects.length) {
                return;
            }

            reactions.push({
                effect,
                targetUnit,
                appliedEffects
            });
        });

        return reactions;
    }

    removeExpiredStatuses() {
        this.statusEffects = this.statusEffects.filter(effect => (Number(effect.remainingTurns) || 0) > 0);
    }

    getEffectiveStat(statKey) {
        const baseValue = Number(this[statKey]) || 0;
        let percentMultiplier = 1;
        let flatBonus = 0;

        this.statusEffects.forEach((effect) => {
            if (effect.effectType !== 'stat_modifier' || effect.stat !== statKey) {
                return;
            }
            if (effect.modifierType === 'flat') {
                flatBonus += Number(effect.value) || 0;
            } else {
                percentMultiplier += Number(effect.value) || 0;
            }
        });

        if (this.battleContext && typeof this.battleContext.getUnitStatPercentBonus === 'function') {
            percentMultiplier += Number(this.battleContext.getUnitStatPercentBonus(this, statKey)) || 0;
        }

        return Math.max(0, Math.floor((baseValue + flatBonus) * Math.max(0, percentMultiplier)));
    }

    getEffectiveSpeed() {
        return Math.max(1, this.getEffectiveStat('speed') || this.speed || 1);
    }

    getBattleModifiers() {
        const modifiers = {
            attackPercentBonus: 0,
            defensePercentBonus: 0,
            damageReduction: 0
        };

        if (this.battleContext && typeof this.battleContext.getUnitBattleModifiers === 'function') {
            const contextModifiers = this.battleContext.getUnitBattleModifiers(this) || {};
            modifiers.attackPercentBonus += Number(contextModifiers.attackPercentBonus) || 0;
            modifiers.defensePercentBonus += Number(contextModifiers.defensePercentBonus) || 0;
            modifiers.damageReduction += Number(contextModifiers.damageReduction) || 0;
        }

        this.statusEffects.forEach((effect) => {
            modifiers.attackPercentBonus += Number(effect.attackPercentBonus) || 0;
            modifiers.defensePercentBonus += Number(effect.defensePercentBonus) || 0;
            modifiers.damageReduction += Number(effect.damageReduction) || 0;
        });

        modifiers.damageReduction = Utils.clamp(modifiers.damageReduction, 0, 0.95);
        return modifiers;
    }

    getEffectiveAttack() {
        const modifiers = this.getBattleModifiers();
        const attackPercentBonus = Number(modifiers.attackPercentBonus) || 0;
        return Math.max(1, Math.floor(this._attack * Math.max(0, 1 + attackPercentBonus)));
    }

    getEffectiveDefense() {
        const modifiers = this.getBattleModifiers();
        const defensePercentBonus = Number(modifiers.defensePercentBonus) || 0;
        const baseDefense = this.getEffectiveStat('defense') || this.defense || 0;
        return Math.max(0, Math.floor(baseDefense * Math.max(0, 1 + defensePercentBonus)));
    }

    processTurnStartEffects() {
        const events = [];

        this.statusEffects.forEach((effect) => {
            const tickTiming = effect.tickTiming || 'turnStart';
            if (effect.effectType === 'heal_over_time' && tickTiming === 'turnStart') {
                const missingHp = Math.max(0, this.maxHp - this.hp);
                const healAmount = Math.max(0, Math.floor(missingHp * (Number(effect.healMissingHpRatio) || 0)));
                if (healAmount > 0) {
                    const actualHeal = this.heal(Math.max(1, healAmount));
                    if (actualHeal > 0) {
                        events.push({
                            type: 'status_heal',
                            statusType: effect.type,
                            statusName: effect.name,
                            heal: actualHeal,
                            sourceUnitId: effect.sourceUnitId,
                            sourceName: effect.sourceName
                        });
                    }
                }
            }

            if (effect.effectType === 'damage_over_time' && tickTiming === 'turnStart') {
                const damage = this.calculateStatusDamage(effect);
                if (damage > 0) {
                    const actualDamage = this.takeStatusDamage(damage, effect.ignoreDefense !== false);
                    events.push({
                        type: 'status_damage',
                        statusType: effect.type,
                        statusName: effect.name,
                        damage: actualDamage,
                        sourceUnitId: effect.sourceUnitId,
                        sourceName: effect.sourceName
                    });
                }
            }

            if (effect.skipAction) {
                events.push({
                    type: 'skip_action',
                    statusType: effect.type,
                    statusName: effect.name
                });
            }
        });

        return {
            events,
            preventedAction: events.some(event => event.type === 'skip_action')
        };
    }

    processTurnEndEffects() {
        const expired = [];
        this.statusEffects.forEach((effect) => {
            if (effect.skipNextTurnEndDecay) {
                effect.skipNextTurnEndDecay = false;
                return;
            }
            effect.remainingTurns = Math.max(0, (Number(effect.remainingTurns) || 0) - 1);
            if (effect.remainingTurns <= 0) {
                expired.push({ ...effect });
            }
        });
        this.removeExpiredStatuses();
        return expired;
    }

    calculateStatusDamage(effect = {}) {
        if ((Number(effect.damageValue) || 0) > 0) {
            return Math.max(1, Math.floor(Number(effect.damageValue) || 0));
        }
        if ((Number(effect.damageRatioMaxHp) || 0) > 0) {
            return Math.max(1, Math.floor(this.maxHp * Number(effect.damageRatioMaxHp)));
        }
        if ((Number(effect.damageRatioCurrentHp) || 0) > 0) {
            return Math.max(1, Math.floor(this.hp * Number(effect.damageRatioCurrentHp)));
        }
        if ((Number(effect.damageMultiplier) || 0) > 0) {
            return Math.max(1, Math.floor(this._attack * this.attackCoefficient * Number(effect.damageMultiplier)));
        }
        return 0;
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
        const effectiveDefense = Math.floor(this.getEffectiveDefense() * (1 + this.defendBonus) * (1 - penRatio));
        const reducedDamage = Math.max(1, Math.floor(rawDamage - effectiveDefense * 0.45));
        const damageReduction = Utils.clamp(Number(this.getBattleModifiers().damageReduction) || 0, 0, 0.95);
        const damageTakenBonus = this.getIncomingDamageTakenBonus(attacker);
        const actualDamage = Math.max(1, Math.floor(reducedDamage * (1 - damageReduction) * (1 + damageTakenBonus)));
        this.hp = Math.max(0, this.hp - actualDamage);
        return actualDamage;
    }

    getIncomingDamageTakenBonus(attacker = null) {
        let bonus = 0;
        this.statusEffects.forEach((effect) => {
            const effectBonus = Math.max(0, Number(effect.damageTakenDebuffBonus) || 0);
            if (effectBonus <= 0) {
                return;
            }
            if (effect.sourceOnly === true && effect.sourceUnitId && attacker?.sourceUnitId && effect.sourceUnitId !== attacker.sourceUnitId) {
                return;
            }
            const excludedDebuffTypes = Array.isArray(effect.excludedDebuffTypes) && effect.excludedDebuffTypes.length > 0
                ? effect.excludedDebuffTypes
                : [effect.type];
            if (!this.hasDebuff({ excludedTypes: excludedDebuffTypes })) {
                return;
            }
            bonus += effectBonus;
        });
        return Utils.clamp(bonus, 0, 3);
    }

    takeStatusDamage(rawDamage, ignoreDefense = true) {
        if (!ignoreDefense) {
            return this.takeDamage(rawDamage, null);
        }
        const actualDamage = Math.max(1, Math.floor(Number(rawDamage) || 0));
        this.hp = Math.max(0, this.hp - actualDamage);
        return actualDamage;
    }

    heal(healAmount) {
        const healTakenMultiplier = this.statusEffects.reduce((multiplier, effect) => {
            if (!Number.isFinite(Number(effect.healTakenMultiplier))) {
                return multiplier;
            }
            return Math.min(multiplier, Utils.clamp(Number(effect.healTakenMultiplier) || 1, 0, 10));
        }, 1);
        const actualHeal = Math.min(
            Math.floor(Math.max(0, Number(healAmount) || 0) * healTakenMultiplier),
            this.maxHp - this.hp
        );
        this.hp += actualHeal;
        return actualHeal;
    }

    increaseMaxHpByRatio(ratio = 0) {
        const safeRatio = Utils.clamp(Number(ratio) || 0, 0, 5);
        const increased = Math.max(0, Math.floor(this.maxHp * safeRatio));
        if (increased <= 0) {
            return 0;
        }
        this.maxHp += increased;
        this.hp = Math.min(this.maxHp, this.hp + increased);
        return increased;
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
        this.statusEffects = [];
        this.passiveState = {};
        return this.hp;
    }

    getSkillState(index = 0) {
        return this.skillStates[index] || null;
    }

    getSkill(index = 0) {
        return this.skills[index] || null;
    }

    getSkillRange(index = 0) {
        const configuredRange = this.getSkillState(index)?.range;
        return Number.isFinite(Number(configuredRange)) ? Number(configuredRange) : this.attackRange;
    }

    getSkillTargetType(index = 0) {
        return this.getSkillState(index)?.targetType || 'enemy';
    }

    getSkillTargetCount(index = 0) {
        return this.getSkillState(index)?.targetCount || 1;
    }

    canSkillCrit(index = 0) {
        return this.getSkillState(index)?.canCrit !== false;
    }

    getSkillDefensePenBonus(index = 0) {
        return Math.max(0, Number(this.getSkillState(index)?.defensePenBonus ?? this.getSkill(index)?.defensePenBonus ?? 0) || 0);
    }

    getSkillStatusEffects(index = 0) {
        return this.normalizeStatusEffects(this.getSkill(index)?.statusEffects || []);
    }

    getSkillExtraStatusEffects(index = 0) {
        return this.normalizeStatusEffects(this.getSkill(index)?.extraStatusEffects || []);
    }

    getBasicAttackEffects(trigger = 'hit') {
        return this.basicAttackEffects.filter((effect) => (effect.trigger || 'hit') === trigger);
    }

    getPassiveEffects(trigger = null) {
        const effects = this.passiveEffects.filter(Boolean);
        if (!trigger) {
            return effects;
        }
        return effects.filter((effect) => (effect.trigger || 'custom') === trigger);
    }

    getSkillHpCost(index = 0) {
        const state = this.getSkillState(index);
        const hpCostPercent = state?.hpCostPercent || 0;
        if (hpCostPercent <= 0) {
            return 0;
        }
        const baseHp = state?.hpCostBase === 'max' ? this.maxHp : this.hp;
        return Math.max(1, Math.floor(baseHp * hpCostPercent / 100));
    }

    canUseSkill(index = 0) {
        const skill = this.getSkill(index);
        const state = this.getSkillState(index);
        if (!skill || !state) {
            return false;
        }
        if (this.hasStatus('silence') || this.statusEffects.some(effect => effect.silenceSkills)) {
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

    performConfiguredAttack(target, config = {}) {
        const multiplier = Number.isFinite(Number(config?.multiplier)) ? Number(config.multiplier) : 1;
        const hitChance = this.calculateHitChance(target);
        const hit = Math.random() <= hitChance;
        if (!hit) {
            return {
                attacker: this.name,
                target: target.name,
                damage: 0,
                hit: false,
                useSkill: Boolean(config?.useSkill),
                isCritical: false,
                defensePenBonus: Math.max(0, Number(config?.defensePenBonus ?? 0) || 0),
                skillIndex: Number.isFinite(Number(config?.skillIndex)) ? Number(config.skillIndex) : null,
                skillName: config?.skillName || null,
                triggerName: config?.triggerName || null
            };
        }

        let damage = Math.floor(this.getEffectiveAttack() * this.attackCoefficient);
        damage = Math.floor(damage * multiplier);
        damage = Math.floor(damage * Utils.randomFloat(0.92, 1.08));

        const canCrit = config?.canCrit !== false;
        const isCritical = canCrit && Math.random() <= this.calculateCritChance(target);
        if (isCritical) {
            damage = Math.floor(damage * this.calculateCritMultiplier(target));
        }
        const outgoingDamageBonus = this.getOutgoingDamageBonusAgainstTarget(target, config);
        if (outgoingDamageBonus !== 0) {
            damage = Math.max(1, Math.floor(damage * (1 + outgoingDamageBonus)));
        }

        const attackerContext = {
            defensePen: this.defensePen + Math.max(0, Number(config?.defensePenBonus ?? 0) || 0),
            sourceUnitId: this.id
        };
        const actualDamage = target.takeDamage(damage, attackerContext);
        return {
            attacker: this.name,
            target: target.name,
            damage: actualDamage,
            hit: true,
            useSkill: Boolean(config?.useSkill),
            isCritical,
            outgoingDamageBonus,
            defensePenBonus: attackerContext.defensePen - this.defensePen,
            skillIndex: Number.isFinite(Number(config?.skillIndex)) ? Number(config.skillIndex) : null,
            skillName: config?.skillName || null,
            triggerName: config?.triggerName || null
        };
    }

    attackTarget(target, useSkill = false, skillIndex = 0) {
        const activeSkill = useSkill ? this.getSkill(skillIndex) : (this.skill || this.skills[0] || null);
        return this.performConfiguredAttack(target, {
            multiplier: useSkill && activeSkill ? activeSkill.multiplier || 1 : 1,
            canCrit: !useSkill || this.canSkillCrit(skillIndex),
            defensePenBonus: useSkill ? this.getSkillDefensePenBonus(skillIndex) : 0,
            useSkill,
            skillIndex: useSkill ? skillIndex : null,
            skillName: useSkill ? activeSkill?.name : null
        });
    }

    getOutgoingDamageBonusAgainstTarget(target, config = {}) {
        let bonus = Number(config?.damageBonus ?? config?.damagePercentBonus ?? 0) || 0;
        this.getPassiveEffects('damage_outgoing').forEach((effect) => {
            const requiresTargetDebuff = effect.requiresTargetDebuff !== false;
            if (requiresTargetDebuff && !target?.hasDebuff?.({ excludedTypes: effect.excludedDebuffTypes || [] })) {
                return;
            }
            bonus += Number(effect.damageBonus ?? effect.damagePercentBonus ?? 0) || 0;
        });
        return Utils.clamp(bonus, -0.95, 3);
    }

    getPower() {
        return GameConfig.calculateCombatPower({
            attack: this._attack,
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

    isAlive() {
        return this.hp > 0;
    }

    reset() {
        this.hp = this.maxHp;
        this.progress = 0;
        this.defendBonus = 0;
        this.statusEffects = [];
        this.passiveState = {};
        this.skillStates.forEach(state => {
            state.cooldownRemaining = 0;
        });
    }

    getStats() {
        return {
            hp: this.hp,
            maxHp: this.maxHp,
            attack: this.getEffectiveAttack(),
            defense: this.getEffectiveDefense(),
            speed: this.speed,
            effectiveSpeed: this.getEffectiveSpeed(),
            crit: this.crit,
            antiCrit: this.antiCrit,
            defensePen: this.defensePen,
            accuracy: this.accuracy,
            dodge: this.dodge,
            attackRange: this.attackRange,
            moveRange: Math.max(1, Math.floor(this.getEffectiveStat('moveRange') || this.moveRange || 1)),
            statuses: this.getStatusEffects(),
            hpPercent: (this.hp / this.maxHp * 100).toFixed(1)
        };
    }
}

window.BattleUnit = BattleUnit;
