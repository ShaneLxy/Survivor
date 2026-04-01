/**
 * 背包详情场景视图
 */
class BackpackView {
    constructor() {
        this.element = document.getElementById('main-display');
        this.visible = false;
        this.currentPage = 1;
        this.pageSize = 16;
    }

    show() {
        this.visible = true;
        this.render();
    }

    hide() {
        this.visible = false;
        this.element.innerHTML = '';
    }

    render() {
        this.element.innerHTML = `
            <div class="backpack-view">
                <h2 class="backpack-title">背包</h2>
                <div id="backpack-grid" class="backpack-grid"></div>
                <div id="backpack-pagination" style="display:flex;justify-content:center;align-items:center;gap:15px;margin-top:20px;"></div>
            </div>
        `;
        this.renderItems();
        this.renderPagination();
    }

    renderItems() {
        const grid = this.element.querySelector('#backpack-grid');
        const items = itemManager.getAllItems();
        const start = (this.currentPage - 1) * this.pageSize;
        const end = start + this.pageSize;
        const pageItems = items.slice(start, end);
        grid.innerHTML = '';
        if (pageItems.length === 0) {
            grid.innerHTML = '<div style="text-align:center;color:#a0a0a0;">背包为空</div>';
            return;
        }
        pageItems.forEach(item => {
            const card = new ItemCard({
                item: item,
                onClick: () => this.onItemClick(item),
                onLongPress: (item) => this.onItemLongPress(item)
            });
            card.render(grid);
        });
    }

    renderPagination() {
        const container = this.element.querySelector('#backpack-pagination');
        const items = itemManager.getAllItems();
        const totalPages = Math.max(1, Math.ceil(items.length / this.pageSize));
        container.innerHTML = `
            <button class="pagination-btn" ${this.currentPage <= 1 ? 'disabled' : ''} onclick="window.game.ui.backpackView.prevPage()">◀</button>
            <span class="pagination-info">${this.currentPage}/${totalPages}</span>
            <button class="pagination-btn" ${this.currentPage >= totalPages ? 'disabled' : ''} onclick="window.game.ui.backpackView.nextPage()">▶</button>
        `;
    }

    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.render();
        }
    }

    nextPage() {
        const items = itemManager.getAllItems();
        const totalPages = Math.ceil(items.length / this.pageSize);
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.render();
        }
    }

    onItemClick(item) {
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
                            this.render();
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
                            this.render();
                            modal.close();
                        } else {
                            Toast.error(result.message);
                        }
                    }
                },
                {
                    text: '全部出售',
                    className: 'btn-danger',
                    onClick: () => {
                        const result = itemManager.sellItem(item.id, item.count);
                        if (result.success) {
                            Toast.success(result.message);
                            this.render();
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

    onItemLongPress(item) {
        this.onItemClick(item);
    }

    getRarityColor(rarity) {
        const colors = { common: '#a0a0a0', rare: '#a335ee', epic: '#ff8000', legendary: '#ffcc00' };
        return colors[rarity] || colors.common;
    }

    getRarityName(rarity) {
        const names = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传说' };
        return names[rarity] || '普通';
    }

    formatStats(stats) {
        const parts = [];
        if (stats.attack) parts.push(`攻击+${stats.attack}`);
        if (stats.defense) parts.push(`防御+${stats.defense}`);
        return parts.join(', ');
    }

    refresh() {
        if (this.visible) this.render();
    }
}

const backpackView = new BackpackView();

// 暴露到全局
window.backpackView = backpackView;
