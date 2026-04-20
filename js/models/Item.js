/**
 * 道具模型
 */
class Item {
    constructor(config, count = 1) {
        this.id = config.id;
        this.name = config.name;
        this.icon = config.icon;
        this.type = config.type || 'resource';
        this.rarity = config.rarity || 'common';
        this.description = config.description;
        this.stackLimit = config.stackLimit || 1;
        this.count = count;
        this.stats = config.stats || null;
        this.effect = config.effect || null;
    }

    addCount(amount) {
        const canAdd = this.stackLimit - this.count;
        const actualAdd = Math.min(canAdd, amount);
        this.count += actualAdd;
        return actualAdd;
    }

    removeCount(amount) {
        if (this.count < amount) return false;
        this.count -= amount;
        return true;
    }

    use(target, options = {}) {
        if (this.type !== 'consumable' && this.type !== 'special') {
            return { success: false, message: '该道具无法使用' };
        }
        if (!this.effect) {
            return { success: false, message: '无效效果' };
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
                result.effect = { type: 'energy', value: this.effect.value };
                result.message = `恢复了${this.effect.value}点体力`;
                break;
            case 'hero_exp': {
                const quantity = Math.max(1, Number(options.quantity) || 1);
                result.effect = {
                    type: 'hero_exp',
                    value: (Number(this.effect.value) || 1) * quantity,
                    quantity
                };
                result.message = `提供了 ${result.effect.value} 点英雄经验`;
                break;
            }
            case 'revive': {
                if (target && typeof target.revive === 'function') {
                    const reviveRatio = Math.max(0.05, Number(this.effect.value) || 0.3);
                    const revived = target.revive(reviveRatio);
                    if (revived > 0) {
                        result.effect = { type: 'revive', value: revived, ratio: reviveRatio };
                        result.message = `复活目标并恢复了 ${revived} 点生命`;
                    } else {
                        result.success = false;
                        result.message = '目标无法被复活';
                    }
                } else {
                    result.success = false;
                    result.message = '该道具只能用于复活已阵亡英雄';
                }
                break;
            }
            case 'gacha':
                result.effect = { type: 'gacha', count: this.effect.count };
                result.message = '进行英雄招募';
                break;
            default:
                result.success = false;
                result.message = '未知效果';
        }

        if (result.success) {
            const consumeCount = result.effect?.type === 'hero_exp'
                ? Math.max(1, Number(options.quantity) || 1)
                : 1;
            this.removeCount(consumeCount);
        }

        return result;
    }

    isStackable() {
        return this.stackLimit > 1;
    }

    isEmpty() {
        return this.count <= 0;
    }

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
