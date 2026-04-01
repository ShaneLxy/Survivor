/**
 * 道具管理器 - 单例模式
 */
class ItemManager {
    constructor() {
        if (ItemManager.instance) {
            return ItemManager.instance;
        }
        this.items = []; // 道具列表
        this.maxSlots = 100; // 背包格子上限
        ItemManager.instance = this;
    }

    /**
     * 初始化
     */
    init(saveData) {
        if (saveData && saveData.items) {
            this.items = saveData.items.map(itemData => {
                const config = ItemConfig.getItemConfig(itemData.id);
                if (config) {
                    const item = new Item(config, itemData.count);
                    return item;
                }
                return null;
            }).filter(i => i);
        } else {
            // 初始道具
            this.addInitialItems();
        }
    }

    /**
     * 添加初始道具
     */
    addInitialItems() {
        const initialItems = [
            { id: 'meat', count: 10 },
            { id: 'water', count: 10 },
            { id: 'medicine', count: 3 }
        ];

        initialItems.forEach(item => {
            this.addItem(item.id, item.count);
        });
    }

    /**
     * 添加道具
     * @param {string} itemId - 道具ID
     * @param {number} count - 数量
     * @returns {boolean}
     */
    addItem(itemId, count = 1) {
        const config = ItemConfig.getItemConfig(itemId);
        if (!config) return false;

        // 检查是否可堆叠
        if (config.stackLimit > 1) {
            // 尝试堆叠到已有道具
            const existingItem = this.items.find(i => i.id === itemId);
            if (existingItem) {
                const added = existingItem.addCount(count);
                eventManager.emit('itemAdd', { item: existingItem, count: added });
                return added > 0;
            }
        }

        // 创建新道具
        if (this.items.length >= this.maxSlots) {
            return false; // 背包已满
        }

        const item = new Item(config, count);
        this.items.push(item);
        eventManager.emit('itemAdd', { item, count });
        return true;
    }

    /**
     * 移除道具
     * @param {string} itemId - 道具ID
     * @param {number} count - 数量
     * @returns {boolean}
     */
    removeItem(itemId, count = 1) {
        const item = this.getItem(itemId);
        if (!item) return false;

        if (item.removeCount(count)) {
            if (item.isEmpty()) {
                const index = this.items.indexOf(item);
                this.items.splice(index, 1);
            }
            eventManager.emit('itemRemove', { itemId, count });
            return true;
        }

        return false;
    }

    /**
     * 获取道具
     * @param {string} itemId - 道具ID
     * @returns {Item|null}
     */
    getItem(itemId) {
        return this.items.find(i => i.id === itemId);
    }

    /**
     * 获取所有道具
     * @returns {Array<Item>}
     */
    getAllItems() {
        return this.items;
    }

    /**
     * 根据类型获取道具
     * @param {string} type - 类型
     * @returns {Array<Item>}
     */
    getItemsByType(type) {
        return this.items.filter(i => i.type === type);
    }

    /**
     * 使用道具
     * @param {string} itemId - 道具ID
     * @param {Object} target - 目标
     * @returns {Object}
     */
    useItem(itemId, target) {
        const item = this.getItem(itemId);
        if (!item) {
            return { success: false, message: '道具不存在' };
        }

        if (item.count <= 0) {
            return { success: false, message: '道具数量不足' };
        }

        const result = item.use(target);

        if (result.success) {
            if (item.isEmpty()) {
                const index = this.items.indexOf(item);
                this.items.splice(index, 1);
            }
            eventManager.emit('itemUse', { item, target, result });
        }

        return result;
    }

    /**
     * 出售道具
     * @param {string} itemId - 道具ID
     * @param {number} count - 数量
     * @returns {Object}
     */
    sellItem(itemId, count = 1) {
        const item = this.getItem(itemId);
        if (!item) {
            return { success: false, message: '道具不存在' };
        }

        if (item.count < count) {
            return { success: false, message: '道具数量不足' };
        }

        // 计算售价
        const sellPrice = this.calculateSellPrice(itemId, count);

        if (!this.removeItem(itemId, count)) {
            return { success: false, message: '出售失败' };
        }

        shelterManager.addResource('gold', sellPrice);
        eventManager.emit('itemSell', { itemId, count, gold: sellPrice });

        return { success: true, message: `出售成功,获得${sellPrice}金币`, gold: sellPrice };
    }

    /**
     * 计算售价
     * @param {string} itemId - 道具ID
     * @param {number} count - 数量
     * @returns {number}
     */
    calculateSellPrice(itemId, count) {
        const config = ItemConfig.getItemConfig(itemId);
        if (!config) return 0;

        const rarityMultiplier = {
            common: 1,
            rare: 3,
            epic: 10,
            legendary: 30
        };

        const price = 10 * (rarityMultiplier[config.rarity] || 1);
        return price * count;
    }

    /**
     * 分页获取道具
     * @param {number} page - 页码
     * @param {number} pageSize - 每页数量
     * @returns {Object}
     */
    getItemsByPage(page, pageSize) {
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const items = this.items.slice(start, end);

        return {
            items,
            page,
            pageSize,
            total: this.items.length,
            totalPages: Math.ceil(this.items.length / pageSize)
        };
    }

    /**
     * 获取保存数据
     * @returns {Array}
     */
    getSaveData() {
        return this.items.map(item => ({
            id: item.id,
            count: item.count
        }));
    }
}

// 导出单例
const itemManager = new ItemManager();

// 暴露到全局
window.itemManager = itemManager;
