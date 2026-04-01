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
        const config = BuildingConfig.getBuildingConfig(this.id);
        const levelConfig = BuildingConfig.getBuildingLevelConfig(this.id, this.level);

        if (!levelConfig) {
            console.error('[Building] levelConfig null for', this.id, 'level', this.level);
            this.upgradeCost = null;
            this.effect = null;
            return;
        }

        // 获取下一级的升级费用（如果可以升级）
        if (this.level < this.maxLevel) {
            const nextLevelConfig = BuildingConfig.getBuildingLevelConfig(this.id, this.level + 1);
            this.upgradeCost = nextLevelConfig ? nextLevelConfig.upgradeCost : null;
        } else {
            this.upgradeCost = null; // 已满级
        }

        if (this.id === 'building_shelter') {
            this.effect = { type: 'energyBonus', value: levelConfig.energyBonus };
        } else if (['building_farm', 'building_mine', 'building_well'].includes(this.id)) {
            this.effect = { type: 'production', value: levelConfig.production, resourceType: this.getResourceType(this.id) };
        } else if (this.id === 'building_training_ground') {
            this.effect = { type: 'statBonus', value: levelConfig.statBonus };
        }
    }

    getResourceType(buildingId) {
        const mapping = { 'building_farm': 'meat', 'building_mine': 'stone', 'building_well': 'water' };
        return mapping[buildingId];
    }

    calculateProduction(hours) {
        if (!this.effect || this.effect.type !== 'production') return null;
        return { resourceType: this.effect.resourceType, amount: Math.floor(this.effect.value * hours) };
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
            id: this.id, name: this.name, icon: this.icon, description: this.description,
            level: this.level, maxLevel: this.maxLevel, canUpgrade: this.canUpgrade(),
            upgradeCost: this.upgradeCost, effect: this.effect
        };
    }
}