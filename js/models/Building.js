/**
 * 建筑模型
 */
class Building {
    constructor(config, level = 1) {
        this.id = config.id;
        this.name = config.name;
        this.icon = config.icon;
        this.description = config.description;
        this.maxLevel = config.maxLevel;
        this.level = level;
        this.type = config.type || 'production';

        try {
            this.updateLevelEffect();
        } catch (e) {
            console.error('[Building] Error:', e);
            this.upgradeCost = null;
            this.effect = null;
        }
    }

    updateLevelEffect() {
        const levelConfig = BuildingConfig.getBuildingLevelConfig(this.id, this.level);

        if (!levelConfig) {
            console.error('[Building] levelConfig null for', this.id, 'level', this.level);
            this.upgradeCost = null;
            this.effect = null;
            return;
        }

        if (this.level < this.maxLevel) {
            const nextLevelConfig = BuildingConfig.getBuildingLevelConfig(this.id, this.level + 1);
            this.upgradeCost = nextLevelConfig ? nextLevelConfig.upgradeCost : null;
        } else {
            this.upgradeCost = null;
        }

        if (this.id === 'building_shelter') {
            this.effect = { type: 'energyBonus', value: levelConfig.energyBonus };
            return;
        }
        if (['building_farm', 'building_mine', 'building_well'].includes(this.id)) {
            const outputs = Array.isArray(levelConfig.outputs)
                ? levelConfig.outputs.map(output => ({
                    type: output.type || 'resource',
                    id: output.id,
                    amountPerHour: Number(output.amountPerHour) || 0
                }))
                : [];
            this.effect = { type: 'production', outputs };
            return;
        }
        if (this.id === 'building_training_ground') {
            this.effect = { type: 'statBonus', value: levelConfig.statBonus };
            return;
        }
        this.effect = null;
    }

    calculateProduction(hours) {
        if (!this.effect || this.effect.type !== 'production') return [];
        return (this.effect.outputs || []).map(output => ({
            type: output.type || 'resource',
            id: output.id,
            amount: Math.floor((Number(output.amountPerHour) || 0) * hours)
        })).filter(entry => entry.amount > 0);
    }

    canUpgrade() { return this.level < this.maxLevel; }

    upgrade() {
        if (this.level >= this.maxLevel) return false;
        this.level++;
        this.updateLevelEffect();
        return true;
    }

    getUpgradeCost() { return this.upgradeCost; }

    getInfo() {
        return {
            id: this.id,
            name: this.name,
            icon: this.icon,
            description: this.description,
            level: this.level,
            maxLevel: this.maxLevel,
            canUpgrade: this.canUpgrade(),
            upgradeCost: this.upgradeCost,
            effect: this.effect
        };
    }
}
