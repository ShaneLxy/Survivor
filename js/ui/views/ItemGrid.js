/**
 * 资源道具网格
 */
class ItemGrid {
    constructor() {
        this.sectionElement = document.getElementById('item-section');
        this.element = document.getElementById('item-grid');
        this.paginationElement = document.getElementById('pagination');
        this.currentPage = 1;
        this.pageSize = 18;
        this.items = [];

        this.currentTab = 'shelter';
        this.inventoryCategory = 'item';
        this.fragments = heroManager.getAllFragments();
        this.toolbarElement = null;
        this.init();
    }

    init() {
        this.ensureToolbar();
        this.setupEvents();
        this.pagination = new Pagination({
            currentPage: this.currentPage,
            totalPages: 1,
            onPageChange: page => this.loadPage(page)
        });
        this.pagination.render(this.paginationElement);
    }

    ensureToolbar() {
        let toolbar = document.getElementById('item-grid-toolbar');
        if (!toolbar) {
            toolbar = document.createElement('div');
            toolbar.id = 'item-grid-toolbar';
            toolbar.className = 'item-grid-toolbar';
            this.sectionElement.insertBefore(toolbar, this.element);
        }
        this.toolbarElement = toolbar;
        this.renderToolbar();
    }

    setupEvents() {
        ['itemAdd', 'itemRemove', 'equipmentAdd', 'equipmentRemove', 'resourceUpdate', 'fragmentAdd', 'fragmentRemove', 'heroEquipmentChange'].forEach(eventName => {
            eventManager.on(eventName, () => this.refresh());
        });
        eventManager.on('viewChange', data => this.onViewChange(data));
    }

    onViewChange(data) {
        this.currentTab = data.view || 'shelter';
        this.refresh();
    }

    setInventoryCategory(category) {
        this.inventoryCategory = category;
        this.refresh();
    }

    loadPage(page) {
        this.currentPage = page;
        this.render();
    }

    refresh() {
        this.renderToolbar();
        this.items = this.getAllDisplayItems();
        this.currentPage = 1;
        this.pagination.setPage(1);
        this.updatePagination();
        this.render();
    }

    renderToolbar() {
        if (!this.toolbarElement) {
            return;
        }
        const showInventoryTabs = this.currentTab !== 'hero';
        this.toolbarElement.style.display = showInventoryTabs ? 'flex' : 'none';
        if (!showInventoryTabs) {
            this.toolbarElement.innerHTML = '';
            return;
        }
        this.toolbarElement.innerHTML = `
            <button class="item-grid-tab ${this.inventoryCategory === 'item' ? 'active' : ''}" onclick="window.game.ui.itemGrid.setInventoryCategory('item')">普通物品</button>
            <button class="item-grid-tab ${this.inventoryCategory === 'equipment' ? 'active' : ''}" onclick="window.game.ui.itemGrid.setInventoryCategory('equipment')">装备</button>
        `;
    }

    getAllDisplayItems() {
        const displayItems = [];
        if (this.currentTab === 'hero') {
            this.fragments = heroManager.getAllFragments();
            this.fragments.forEach(fragment => {
                const groups = this.splitIntoGroups(fragment.count, 9999);
                groups.forEach((count, index) => {
                    displayItems.push({
                        id: fragment.configId,
                        name: `${fragment.heroConfig.name}碎片`,
                        icon: fragment.heroConfig.icon,
                        count,
                        type: 'fragment',
                        rarity: fragment.heroConfig.rarity,
                        stackLimit: 9999,
                        isFragment: true,
                        groupIndex: index,
                        totalCount: fragment.count
                    });
                });
            });
            return displayItems;
        }

        if (this.inventoryCategory === 'equipment') {
            return itemManager.getAllEquipment();
        }

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
                displayItems.push({ ...resource, count, stackLimit: 9999, groupIndex: index, totalCount: resource.count });
            });
        });

        itemManager.getAllItems().forEach(item => {
            const groups = this.splitIntoGroups(item.count || 1, 9999);
            groups.forEach((count, index) => {
                displayItems.push({ ...item, count, stackLimit: 9999, groupIndex: index, totalCount: item.count });
            });
        });

        return displayItems;
    }

    splitIntoGroups(total, maxPerGroup) {
        if (total <= maxPerGroup) return [total];
        const groups = [];
        const groupCount = Math.ceil(total / maxPerGroup);
        for (let index = 0; index < groupCount; index++) {
            const remaining = total - index * maxPerGroup;
            groups.push(Math.min(remaining, maxPerGroup));
        }
        return groups;
    }

    updatePagination() {
        const totalPages = Math.max(1, Math.ceil(this.items.length / this.pageSize));
        this.pagination.setTotalPages(totalPages);
    }

    render() {
        this.element.innerHTML = '';
        const start = (this.currentPage - 1) * this.pageSize;
        const end = start + this.pageSize;
        const pageItems = this.items.slice(start, end);
        pageItems.forEach(item => {
            new ItemCard({ item, onClick: () => this.onItemClick(item), onLongPress: current => this.onItemLongPress(current) }).render(this.element);
        });
        for (let index = 0; index < this.pageSize - pageItems.length; index++) {
            new ItemCard({ item: null }).render(this.element);
        }
    }

    onItemClick(item) {
        if (item.type === 'fragment') {
            const cards = this.element.querySelectorAll('.item-card');
            let targetCard = null;
            cards.forEach(card => {
                const countEl = card.querySelector('.item-count');
                if (countEl && countEl.textContent == item.count) {
                    targetCard = card;
                }
            });
            window.floatingMenu.show(targetCard, [{
                text: '合成英雄',
                className: 'btn-primary btn-small',
                onClick: () => {
                    if (item.totalCount < 50) {
                        Toast.error(`需要50个碎片，当前只有${item.totalCount}个`);
                        return;
                    }
                    const result = heroManager.synthesizeHero(item.id);
                    if (result) {
                        Toast.success(`成功合成${item.name.replace('碎片', '')}！`);
                        this.refresh();
                        window.game.save();
                    } else {
                        Toast.error('已有该英雄，无法重复合成');
                    }
                }
            }]);
            return;
        }

        if (item.type === 'resource') {
            Toast.info(`${item.name}: ${item.totalCount || item.count}`);
            return;
        }

        if (item.type === 'equipment') {
            this.showEquipmentDetail(item);
            return;
        }

        this.showItemDetail(item);
    }

    onItemLongPress(item) {
        if (!item || item.type === 'resource' || item.type === 'fragment') {
            return;
        }
        this.onItemClick(item);
    }

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
                            window.game.save();
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
                            window.game.save();
                            modal.close();
                        } else {
                            Toast.error(result.message);
                        }
                    }
                },
                { text: '关闭', className: 'btn-secondary', onClick: () => modal.close() }
            ]
        });
        modal.show();
    }

    showEquipmentDetail(equipment) {
        const info = equipment.getInfo();
        const modal = new Modal({
            title: equipment.name,
            content: `
                <div style="text-align:center;display:flex;flex-direction:column;gap:10px;">
                    <div style="font-size:52px;">${equipment.icon}</div>
                    <div style="color:${this.getRarityColor(equipment.rarity)};font-weight:bold;">${equipment.name}</div>
                    <div>${equipment.description}</div>
                    <div>部位：${EquipmentConfig.getSlotName(equipment.slot)}</div>
                    <div style="font-size:12px;color:#a0a0a0;line-height:1.8;">${info.detailExtra.join('<br>')}</div>
                </div>
            `,
            buttons: [
                { text: '前往英雄页', className: 'btn-primary', onClick: () => { modal.close(); eventManager.emit('viewChange', { view: 'hero' }); } },
                {
                    text: '出售',
                    className: 'btn-secondary',
                    onClick: () => {
                        const result = itemManager.sellEquipment(equipment.instanceId);
                        if (result.success) {
                            Toast.success(result.message);
                            this.refresh();
                            window.game.save();
                            modal.close();
                        } else {
                            Toast.error(result.message);
                        }
                    }
                },
                { text: '关闭', className: 'btn-secondary', onClick: () => modal.close() }
            ]
        });
        modal.show();
    }

    getRarityColor(rarity) {
        return GameConfig.getRarityConfig(rarity || 'common').color;
    }

    getRarityName(rarity) {
        return GameConfig.getRarityConfig(rarity || 'common').name;
    }

    formatStats(stats) {
        return Object.entries(stats || {})
            .filter(([, value]) => Number(value) !== 0)
            .map(([key, value]) => `${Equipment.getStatName(key)}+${value}`)
            .join('，');
    }
}

const itemGrid = new ItemGrid();
window.itemGrid = itemGrid;
