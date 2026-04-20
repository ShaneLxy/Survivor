/**
 * 背包详情场景视图
 */
class BackpackView {
    constructor() {
        this.element = document.getElementById('main-display');
        this.visible = false;
        this.currentPage = 1;
        this.pageSize = 16;
        this.category = 'item';
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
                <div class="item-grid-toolbar" style="margin-bottom:12px;">
                    <button class="item-grid-tab ${this.category === 'item' ? 'active' : ''}" onclick="window.game.ui.backpackView.setCategory('item')">普通物品</button>
                    <button class="item-grid-tab ${this.category === 'equipment' ? 'active' : ''}" onclick="window.game.ui.backpackView.setCategory('equipment')">装备</button>
                </div>
                <div id="backpack-grid" class="backpack-grid"></div>
                <div id="backpack-pagination" style="display:flex;justify-content:center;align-items:center;gap:15px;margin-top:20px;"></div>
            </div>
        `;
        this.renderItems();
        this.renderPagination();
    }

    setCategory(category) {
        this.category = category;
        this.currentPage = 1;
        this.render();
    }

    getSourceItems() {
        return this.category === 'equipment' ? itemManager.getAllEquipment() : itemManager.getAllItems();
    }

    renderItems() {
        const grid = this.element.querySelector('#backpack-grid');
        const items = this.getSourceItems();
        const start = (this.currentPage - 1) * this.pageSize;
        const end = start + this.pageSize;
        const pageItems = items.slice(start, end);
        grid.innerHTML = '';
        if (pageItems.length === 0) {
            grid.innerHTML = '<div style="text-align:center;color:#a0a0a0;grid-column:1 / -1;">背包为空</div>';
            return;
        }
        pageItems.forEach(item => {
            new ItemCard({ item, onClick: () => this.onItemClick(item), onLongPress: current => this.onItemClick(current) }).render(grid);
        });
    }

    renderPagination() {
        const container = this.element.querySelector('#backpack-pagination');
        const totalPages = Math.max(1, Math.ceil(this.getSourceItems().length / this.pageSize));
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
        const totalPages = Math.max(1, Math.ceil(this.getSourceItems().length / this.pageSize));
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.render();
        }
    }

    onItemClick(item) {
        if (item.type === 'equipment') {
            window.game.ui.itemGrid.showEquipmentDetail(item);
            return;
        }
        window.game.ui.itemGrid.showItemDetail(item);
    }

    refresh() {
        if (this.visible) this.render();
    }
}

const backpackView = new BackpackView();
window.backpackView = backpackView;
