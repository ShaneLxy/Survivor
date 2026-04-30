/**
 * 资源道具网格
 */
class ItemGrid {
    constructor() {
        this.sectionElement = document.getElementById('item-section');
        this.element = document.getElementById('item-grid');
        this.paginationElement = document.getElementById('pagination');
        this.currentPage = 1;
        this.defaultPageSize = 12;
        this.heroPageSize = 12;
        this.pageSize = this.defaultPageSize;
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
        ['itemAdd', 'itemRemove', 'equipmentAdd', 'equipmentRemove', 'resourceUpdate', 'fragmentAdd', 'fragmentRemove', 'heroEquipmentChange', 'equipmentUpdate'].forEach(eventName => {
            eventManager.on(eventName, () => this.refresh());
        });
        eventManager.on('viewChange', data => this.onViewChange(data));
    }

    onViewChange(data) {
        this.currentTab = data.view || 'shelter';
        this.refresh();
    }

    getPageSize() {
        return this.currentTab === 'hero' ? this.heroPageSize : this.defaultPageSize;
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
        this.pageSize = this.getPageSize();
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
            <button type="button" class="item-grid-tab ${this.inventoryCategory === 'item' ? 'active' : ''}" onclick="window.game.ui.itemGrid.setInventoryCategory('item')">
                <span class="item-grid-tab-text">普通物品</span>
            </button>
            <button type="button" class="item-grid-tab ${this.inventoryCategory === 'equipment' ? 'active' : ''}" onclick="window.game.ui.itemGrid.setInventoryCategory('equipment')">
                <span class="item-grid-tab-text">装备</span>
            </button>
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
                        iconSrc: fragment.heroConfig.portrait || null,
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

        shelterManager.getDisplayResourceEntries().forEach(resource => {
            if ((resource.id === 'gold' || resource.id === 'diamond') && resource.count > 9999) {
                displayItems.push({
                    ...resource,
                    type: 'resource',
                    count: 9999,
                    displayCount: '9999+',
                    stackLimit: 9999,
                    groupIndex: 0,
                    totalCount: resource.count
                });
                return;
            }

            const groups = this.splitIntoGroups(resource.count, 9999);
            groups.forEach((count, index) => {
                displayItems.push({ ...resource, type: 'resource', count, stackLimit: 9999, groupIndex: index, totalCount: resource.count });
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
        this.pageSize = this.getPageSize();
        const totalPages = Math.max(1, Math.ceil(this.items.length / this.pageSize));
        this.pagination.setTotalPages(totalPages);
    }

    render() {
        this.element.innerHTML = '';
        const pageSize = this.getPageSize();
        this.pageSize = pageSize;
        const start = (this.currentPage - 1) * pageSize;
        const end = start + pageSize;
        const pageItems = this.items.slice(start, end);
        pageItems.forEach(item => {
            new ItemCard({ item, onClick: () => this.onItemClick(item), onLongPress: current => this.onItemLongPress(current) }).render(this.element);
        });
        for (let index = 0; index < pageSize - pageItems.length; index++) {
            new ItemCard({ item: null }).render(this.element);
        }
    }
    onItemClick(item) {
        if (item.type === 'fragment') {
            this.showHeroFragmentDetail(item);
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

    showHeroFragmentDetail(item) {
        const heroConfig = HeroConfig.getHeroConfig(item.id);
        if (!heroConfig) {
            Toast.error('英雄配置不存在');
            return;
        }

        const totalCount = item.totalCount || item.count || 0;
        const canSynthesize = totalCount >= 50;
        const rarityName = this.getRarityName(heroConfig.rarity);
        const rarityColor = this.getRarityColor(heroConfig.rarity);
        const professionName = HeroConfig.getProfessionName(heroConfig.profession);
        const portraitMarkup = heroConfig.portrait
            ? `<div class="hero-fragment-detail-portrait">${window.game.ui.heroView.getProfessionBadgeMarkup(heroConfig)}${window.game.ui.heroView.getHeroAvatarMarkup(heroConfig)}</div>`
            : `<div class="hero-fragment-detail-icon">${heroConfig.icon || '❓'}</div>`;

        const modal = new Modal({
            title: '英雄碎片',
            content: `
                <div class="hero-fragment-detail">
                    ${portraitMarkup}
                    <div class="hero-fragment-detail-name" style="color:${rarityColor};">${heroConfig.name}</div>
                    <div class="hero-fragment-detail-meta">${professionName} · ${rarityName}</div>
                    <div class="hero-fragment-detail-count">碎片数量：${totalCount}</div>
                </div>
            `,
            buttons: [
                { text: '关闭', className: 'btn-secondary', onClick: () => modal.close() },
                {
                    text: '立即合成',
                    className: 'btn-primary',
                    disabled: !canSynthesize,
                    onClick: async () => {
                        const result = heroManager.synthesizeHero(item.id);
                        if (result) {
                            modal.close();
                            await RewardModal.show({
                                title: '英雄合成成功',
                                summaryText: `已成功合成 ${heroConfig.name}`,
                                rewards: [RewardModal.createHeroReward(item.id)],
                                confirmText: '确认'
                            });
                            Toast.success(`成功合成${heroConfig.name}`);
                            this.refresh();
                            window.game.ui.heroView.refresh();
                            window.game.save();
                        } else {
                            Toast.error('碎片不足或英雄已拥有');
                        }
                    }
                }
            ]
        });
        modal.show();
    }

    showHeroExpUseModal(itemId) {
        const item = itemManager.getItem(itemId);
        const totalCount = itemManager.getItemCount(itemId);
        if (!item || totalCount <= 0) {
            Toast.error('经验药水不存在');
            return;
        }
        const heroes = heroManager.getAllHeroes();
        if (heroes.length === 0) {
            Toast.error('当前没有可培养的英雄');
            return;
        }

        const content = `
            <div class="hero-exp-use-panel">
                <div class="hero-exp-use-tip">经验药水可批量使用，每瓶提供 1 点英雄经验。</div>
                <label class="hero-exp-use-field">
                    <span>选择英雄</span>
                    <select id="exp-potion-hero-select" class="hero-exp-use-select">
                        ${heroes.map(hero => `<option value="${hero.id}">${hero.name} · Lv.${hero.level}</option>`).join('')}
                    </select>
                </label>
                <label class="hero-exp-use-field">
                    <span>使用数量（当前 ${totalCount}）</span>
                    <input id="exp-potion-count-input" class="hero-exp-use-input" type="number" min="1" max="${totalCount}" value="1">
                </label>
            </div>
        `;

        const modal = new Modal({
            title: '使用经验药水',
            content,
            buttons: [
                {
                    text: '确认使用',
                    className: 'btn-primary',
                    onClick: () => {
                        const heroId = document.getElementById('exp-potion-hero-select')?.value;
                        const quantity = Number(document.getElementById('exp-potion-count-input')?.value) || 1;
                        const result = itemManager.useItem(itemId, heroId, { quantity });
                        if (result.success) {
                            Toast.success(result.message);
                            this.refresh();
                            window.game.ui.heroView.refresh();
                            window.game.save();
                            modal.close();
                        } else {
                            Toast.error(result.message);
                        }
                    }
                },
                { text: '取消', className: 'btn-secondary', onClick: () => modal.close() }
            ]
        });
        modal.show();
    }

    showItemDetail(item) {
        const isHeroExpPotion = item.effect?.type === 'hero_exp';
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
                        if (isHeroExpPotion) {
                            modal.close();
                            this.showHeroExpUseModal(item.id);
                            return;
                        }
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
                { text: '强化', className: 'btn-primary', onClick: () => { modal.close(); equipmentEnhanceModal.show(equipment.instanceId); } },
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


