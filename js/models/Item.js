/**
 * 道具模型
 */
class Item {
    constructor(config, count = 1) {
        this.id = config.id;
        this.name = config.name;
        this.icon = config.icon;
        this.type = config.type || 'resource'; // resource, consumable, weapon, armor, special
        this.rarity = config.rarity || 'common';
        this.description = config.description;
        this.stackLimit = config.stackLimit || 1;
        this.count = count;
        this.stats = config.stats || null;
        this.effect = config.effect || null;
    }

    /**
     * 增加数量
     * @param {number} amount - 数量
     * @returns {number} 实际增加数量
     */
    addCount(amount) {
        const canAdd = this.stackLimit - this.count;
        const actualAdd = Math.min(canAdd, amount);
        this.count += actualAdd;
        return actualAdd;
    }

    /**
     * 减少数量
     * @param {number} amount - 数量
     * @returns {boolean} 是否成功
     */
    removeCount(amount) {
        if (this.count < amount) return false;
        this.count -= amount;
        return true;
    }

    /**
     * 使用道具
     * @param {Object} target - 目标(英雄等)
     * @returns {Object} 使用结果
     */
    use(target) {
        if (this.type !== 'consumable' && this.type !== 'special') {
            return { success: false, message: '该道具无法使用' };
        }

        if (!this.effect) {
            return { success: false, message: '无效果' };
        }

        const result = { success: true, message: '' };

        switch (this.effect.type) {
            case 'heal':
                if (target && typeof target.heal === 'function') {
                    const healed = target.heal(this.effect.value);
                    result.message = `恢复了${healed}点生命值`;
                } else {
                    result.success = false;
                    result.message = '该道具需要在战斗中选择目标后使用';
                }
                break;

            case 'energy':
                // 体力恢复逻辑由外部处理
                result.effect = { type: 'energy', value: this.effect.value };
                result.message = `恢复了${this.effect.value}点体力`;
                break;
            case 'gacha':
                result.effect = { type: 'gacha', count: this.effect.count };
                result.message = '进行英雄抽卡';
                break;
            default:
                result.success = false;
                result.message = '未知效果';
        }

        if (result.success) {
            this.removeCount(1);
        }

        return result;
    }

    /**
     * 是否可以堆叠
     * @returns {boolean}
     */
    isStackable() {
        return this.stackLimit > 1;
    }

    /**
     * 是否为空
     * @returns {boolean}
     */
    isEmpty() {
        return this.count <= 0;
    }

    /**
     * 克隆
     * @returns {Item}
     */
    clone() {
        return new Item({
            id: this.id,
            name: this.name,
            icon: this.icon,
            type: this.type,
            rarity: this.rarity,
            description: this.description,
            stackLimit: this.stackLimit,
            stats: this.stats,
            effect: this.effect
        }, this.count);
    }

    /**
     * 获取信息
     * @returns {Object}
     */
    getInfo() {
        return {
            id: this.id,
            name: this.name,
            icon: this.icon,
            type: this.type,
            rarity: this.rarity,
            description: this.description,
            count: this.count,
            stackLimit: this.stackLimit,
            stats: this.stats,
            effect: this.effect
        };
    }
}
