/**
 * 资源道具网格
 */
class ItemGrid {
    constructor() {
        this.element = document.getElementById('item-grid');
        this.paginationElement = document.getElementById('pagination');
        this.currentPage = 1;
        this.pageSize = 8;
        this.items = [];
        this.currentTab = 'shelter'; // 当前Tab
        this.fragments = heroManager.getAllFragments(); // 缓存碎片数据

        this.init();
    }

    /**
     * 初始化
     */
    init() {
        this.setupEvents();
        this.pagination = new Pagination({
            currentPage: this.currentPage,
            totalPages: 1,
            onPageChange: (page) => this.loadPage(page)
        });
        this.pagination.render(this.paginationElement);
    }

    /**
     * 设置事件
     */
    setupEvents() {
        eventManager.on('itemAdd', (data) => this.refresh());
        eventManager.on('itemRemove', (data) => this.refresh());
        eventManager.on('resourceUpdate', (data) => this.refresh());
        eventManager.on('fragmentAdd', (data) => this.refresh());
        eventManager.on('fragmentRemove', (data) => this.refresh());
        eventManager.on('viewChange', (data) => this.onViewChange(data));
    }

    /**
     * 视图切换事件
     * @param {Object} data - 视图数据
     */
    onViewChange(data) {
        this.currentTab = data.view || 'shelter';
        this.refresh();
    }

    /**
     * 加载页面
     * @param {number} page - 页码
     */
    loadPage(page) {
        this.currentPage = page;
        this.render();
    }

    /**
     * 刷新道具列表
     */
    refresh() {
        this.items = this.getAllDisplayItems();
        this.currentPage = 1;
        this.pagination.setPage(1);
        this.updatePagination();
        this.render();
    }

    /**
     * 获取所有显示的道具
     * @returns {Array}
     */
    getAllDisplayItems() {
        const displayItems = [];

        // 英雄Tab显示碎片
        if (this.currentTab === 'hero') {
            this.fragments = heroManager.getAllFragments();
            this.fragments.forEach(fragment => {
                // 按9999分组
                const groups = this.splitIntoGroups(fragment.count, 9999);
                groups.forEach((count, index) => {
                    displayItems.push({
                        id: fragment.configId,
                        name: `${fragment.heroConfig.name}碎片`,
                        icon: fragment.heroConfig.icon,
                        count: count,
                        type: 'fragment',
                        rarity: fragment.heroConfig.rarity,
                        stackLimit: 9999,
                        isFragment: true,
                        groupIndex: index, // 用于区分同一类型的多个组
                        totalCount: fragment.count // 原始总数
                    });
                });
            });
            return displayItems;
        }

        // 其他Tab显示资源和背包道具
        // 资源（按9999分组）
        const resources = [
            { id: 'gold', name: '金币', icon: '💰', count: shelterManager.getResource('gold'), type: 'resource', rarity: 'common' },
            { id: 'wood', name: '木材', icon: '🪵', count: shelterManager.getResource('wood'), type: 'resource', rarity: 'common' },
            { id: 'stone', name: '石材', icon: '🪨', count: shelterManager.getResource('stone'), type: 'resource', rarity: 'common' },
            { id: 'meat', name: '肉类', icon: '🍖', count: shelterManager.getResource('meat'), type: 'resource', rarity: 'common' },
            { id: 'water', name: '水源', icon: '💧', count: shelterManager.getResource('water'), type: 'resource', rarity: 'common' }
        ];

        resources.forEach(resource => {
            const groups = this.splitIntoGroups(resource.count, 9999);
            groups.forEach((count, index) => {
                displayItems.push({
                    ...resource,
                    count: count,
                    stackLimit: 9999,
                    groupIndex: index,
                    totalCount: resource.count
                });
            });
        });

        // 背包道具
        const bagItems = itemManager.getAllItems();
        bagItems.forEach(item => {
            // 道具也按9999分组
            const groups = this.splitIntoGroups(item.count || 1, 9999);
            groups.forEach((count, index) => {
                displayItems.push({
                    ...item,
                    count: count,
                    stackLimit: 9999,
                    groupIndex: index,
                    totalCount: item.count
                });
            });
        });

        return displayItems;
    }

    /**
     * 将数量拆分成多组（每组最多maxPerGroup个）
     * @param {number} total - 总数量
     * @param {number} maxPerGroup - 每组最大数量
     * @returns {Array<number>}
     */
    splitIntoGroups(total, maxPerGroup) {
        if (total <= maxPerGroup) {
            return [total];
        }
        const groups = [];
        const groupCount = Math.ceil(total / maxPerGroup);
        for (let i = 0; i < groupCount; i++) {
            const remaining = total - i * maxPerGroup;
            groups.push(Math.min(remaining, maxPerGroup));
        }
        return groups;
    }

    /**
     * 更新分页
     */
    updatePagination() {
        const totalPages = Math.max(1, Math.ceil(this.items.length / this.pageSize));
        this.pagination.setTotalPages(totalPages);
    }

    /**
     * 渲染
     */
    render() {
        this.element.innerHTML = '';

        const start = (this.currentPage - 1) * this.pageSize;
        const end = start + this.pageSize;
        const pageItems = this.items.slice(start, end);

        pageItems.forEach(item => {
            const card = new ItemCard({
                item: item,
                onClick: () => this.onItemClick(item),
                onLongPress: (item) => this.onItemLongPress(item)
            });
            card.render(this.element);
        });

        // 填充空白格子
        const emptySlots = this.pageSize - pageItems.length;
        for (let i = 0; i < emptySlots; i++) {
            const emptyCard = new ItemCard({ item: null });
            emptyCard.render(this.element);
        }
    }

    /**
     * 道具点击事件
     * @param {Object} item - 道具
     */
    onItemClick(item) {
        // 英雄碎片点击显示气泡菜单
        if (item.type === 'fragment') {
            // 找到对应的DOM元素
            const cards = this.element.querySelectorAll('.item-card');
            let targetCard = null;
            cards.forEach(card => {
                const countEl = card.querySelector('.item-count');
                if (countEl && countEl.textContent == item.count) {
                    targetCard = card;
                }
            });

            window.floatingMenu.show(targetCard, [
                {
                    text: '合成英雄',
                    className: 'btn-primary btn-small',
                    onClick: () => {
                        if (item.totalCount >= 50) {
                            const result = heroManager.synthesizeHero(item.id);
                            if (result) {
                                Toast.success(`成功合成${item.name.replace('碎片', '')}！`);
                                this.refresh();
                            } else {
                                Toast.error('已有该英雄，无法重复合成');
                            }
                        } else {
                            Toast.error(`需要50个碎片，当前只有${item.totalCount}个`);
                        }
                    }
                }
            ]);
            return;
        }

        if (item.type === 'resource') {
            Toast.info(`${item.name}: ${item.totalCount || item.count}`);
        } else {
            // 道具详情弹窗
            this.showItemDetail(item);
        }
    }

    /**
     * 道具长按事件
     * @param {Object} item - 道具
     */
    onItemLongPress(item) {
        if (item.type === 'resource') return;

        const modal = new Modal({
            title: item.name,
            content: `
                <div style="text-align:center;">
                    <div style="font-size:48px;margin-bottom:15px;">${item.icon}</div>
                    <p style="margin-bottom:10px;">${item.description}</p>
                    <p style="color:${this.getRarityColor(item.rarity)}">${this.getRarityName(item.rarity)}</p>
                    <p>数量: ${item.count}</p>
                </div>
            `,
            buttons: [
                {
                    text: '使用',
                    className: 'btn-primary',
                    onClick: () => {
                        const result = itemManager.useItem(item.id);
                        if (result.success) {
                            Toast.success(result.message);
                            this.refresh();
                            modal.close();
                        } else {
                            Toast.error(result.message);
                        }
                    }
                },
                {
                    text: '出售',
                    className: 'btn-secondary',
                    onClick: () => {
                        const result = itemManager.sellItem(item.id, 1);
                        if (result.success) {
                            Toast.success(result.message);
                            this.refresh();
                            modal.close();
                        } else {
                            Toast.error(result.message);
                        }
                    }
                },
                {
                    text: '关闭',
                    className: 'btn-secondary',
                    onClick: () => modal.close()
                }
            ]
        });

        modal.show();
    }

    /**
     * 显示道具详情
     * @param {Object} item - 道具
     */
    showItemDetail(item) {
        const modal = new Modal({
            title: item.name,
            content: `
                <div style="text-align:center;">
                    <div style="font-size:48px;margin-bottom:15px;">${item.icon}</div>
                    <p style="margin-bottom:10px;">${item.description}</p>
                    <p style="color:${this.getRarityColor(item.rarity)}">${this.getRarityName(item.rarity)}</p>
                    <p>数量: ${item.count}</p>
                    ${item.stats ? `<p>属性: ${this.formatStats(item.stats)}</p>` : ''}
                </div>
            `,
            buttons: [
                {
                    text: '使用',
                    className: 'btn-primary',
                    onClick: () => {
                        const result = itemManager.useItem(item.id);
                        if (result.success) {
                            Toast.success(result.message);
                            this.refresh();
                            modal.close();
                        } else {
                            Toast.error(result.message);
                        }
                    }
                },
                {
                    text: '出售',
                    className: 'btn-secondary',
                    onClick: () => {
                        const result = itemManager.sellItem(item.id, 1);
                        if (result.success) {
                            Toast.success(result.message);
                            this.refresh();
                            modal.close();
                        } else {
                            Toast.error(result.message);
                        }
                    }
                },
                {
                    text: '关闭',
                    className: 'btn-secondary',
                    onClick: () => modal.close()
                }
            ]
        });

        modal.show();
    }

    /**
     * 获取稀有度颜色
     * @param {string} rarity - 稀有度
     * @returns {string}
     */
    getRarityColor(rarity) {
        const colors = {
            common: '#a0a0a0',
            rare: '#a335ee',
            epic: '#ff8000',
            legendary: '#ffcc00'
        };
        return colors[rarity] || colors.common;
    }

    /**
     * 获取稀有度名称
     * @param {string} rarity - 稀有度
     * @returns {string}
     */
    getRarityName(rarity) {
        const names = {
            common: '普通',
            rare: '稀有',
            epic: '史诗',
            legendary: '传说'
        };
        return names[rarity] || '普通';
    }

    /**
     * 格式化属性
     * @param {Object} stats - 属性
     * @returns {string}
     */
    formatStats(stats) {
        const parts = [];
        if (stats.attack) parts.push(`攻击+${stats.attack}`);
        if (stats.defense) parts.push(`防御+${stats.defense}`);
        return parts.join(', ');
    }
}

// 导出单例
const itemGrid = new ItemGrid();

// 暴露到全局
window.itemGrid = itemGrid;
