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
        this.swipeStartX = 0;
        this.swipeStartY = 0;
        this.swipeStartTime = 0;
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
        this.setupSwipeEvents();
    }

    setupSwipeEvents() {
        if (!this.element) {
            return;
        }
        this.element.addEventListener('touchstart', event => {
            if (event.touches.length !== 1) {
                return;
            }
            const touch = event.touches[0];
            this.swipeStartX = touch.clientX;
            this.swipeStartY = touch.clientY;
            this.swipeStartTime = Date.now();
        }, { passive: true });

        this.element.addEventListener('touchend', event => {
            const touch = event.changedTouches?.[0];
            if (!touch || !this.swipeStartTime) {
                return;
            }
            const diffX = touch.clientX - this.swipeStartX;
            const diffY = touch.clientY - this.swipeStartY;
            const absX = Math.abs(diffX);
            const absY = Math.abs(diffY);
            const elapsed = Date.now() - this.swipeStartTime;
            this.swipeStartTime = 0;

            if (elapsed > 600 || absX < 45 || absX < absY * 1.25) {
                return;
            }
            if (diffX < 0) {
                this.goToPage(this.currentPage + 1);
            } else {
                this.goToPage(this.currentPage - 1);
            }
        }, { passive: true });
    }

    goToPage(page) {
        const totalPages = this.pagination?.config?.totalPages || 1;
        if (page < 1 || page > totalPages) {
            return;
        }
        this.pagination.setPage(page);
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
                        iconSrc: fragment.heroConfig.cardPortrait || fragment.heroConfig.portrait || null,
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
            return this.sortDisplayItems(displayItems);
        }

        if (this.inventoryCategory === 'equipment') {
            return this.sortDisplayItems(itemManager.getAllEquipment());
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

        return this.sortDisplayItems(displayItems);
    }

    getDisplayTypeRank(item) {
        const rankMap = {
            resource: 1,
            item: 2,
            equipment: 3,
            fragment: 4
        };
        return rankMap[item?.type] || 99;
    }

    sortDisplayItems(items) {
        return [...items].sort((left, right) => {
            const typeDiff = this.getDisplayTypeRank(left) - this.getDisplayTypeRank(right);
            if (typeDiff !== 0) {
                return typeDiff;
            }

            const rarityDiff = itemManager.getItemRarityRank(right?.rarity) - itemManager.getItemRarityRank(left?.rarity);
            if (rarityDiff !== 0) {
                return rarityDiff;
            }

            const nameDiff = String(left?.name || '').localeCompare(String(right?.name || ''), 'zh-CN');
            if (nameDiff !== 0) {
                return nameDiff;
            }

            const scoreDiff = (Number(right?.sortScore) || itemManager.getEquipmentSortScore?.(right) || 0)
                - (Number(left?.sortScore) || itemManager.getEquipmentSortScore?.(left) || 0);
            if (scoreDiff !== 0) {
                return scoreDiff;
            }

            const starDiff = (Number(right?.starLevel) || 0) - (Number(left?.starLevel) || 0);
            if (starDiff !== 0) {
                return starDiff;
            }

            const enhanceDiff = (Number(right?.enhanceLevel) || 0) - (Number(left?.enhanceLevel) || 0);
            if (enhanceDiff !== 0) {
                return enhanceDiff;
            }

            const keyDiff = String(left?.templateId || left?.id || '').localeCompare(String(right?.templateId || right?.id || ''), 'en');
            if (keyDiff !== 0) {
                return keyDiff;
            }

            const slotDiff = String(left?.slot || '').localeCompare(String(right?.slot || ''), 'en');
            if (slotDiff !== 0) {
                return slotDiff;
            }

            const groupDiff = (Number(left?.groupIndex) || 0) - (Number(right?.groupIndex) || 0);
            if (groupDiff !== 0) {
                return groupDiff;
            }

            const countDiff = (Number(right?.count) || 0) - (Number(left?.count) || 0);
            if (countDiff !== 0) {
                return countDiff;
            }

            return String(left?.instanceId || '').localeCompare(String(right?.instanceId || ''), 'en');
        });
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

    renderItemIconMarkup(item, imageClass = 'inventory-detail-icon-image') {
        const starBadge = item?.type === 'equipment' && typeof item.getStarBadgeMarkup === 'function'
            ? item.getStarBadgeMarkup()
            : '';
        if (item?.iconSrc) {
            return `<span class="equipment-icon-with-star">${starBadge}<img class="${imageClass}" src="${item.iconSrc}" alt="${item.name || '物品'}"></span>`;
        }
        return `<span class="equipment-icon-with-star equipment-icon-text">${starBadge}${item?.icon || '📦'}</span>`;
    }

    showHeroFragmentDetail(item) {
        const itemConfig = ItemConfig.getItemConfig(item.id);
        const heroConfigId = itemConfig?.fragmentHeroId || item.fragmentHeroId || String(item.id || '').replace(/_fragment$/, '');
        const heroConfig = HeroConfig.getHeroConfig(heroConfigId);
        if (!heroConfig) {
            Toast.error('英雄配置不存在');
            return;
        }

        const totalCount = item.totalCount || item.count || 0;
        const canSynthesize = totalCount >= 50;
        const rarityName = this.getRarityName(heroConfig.rarity);
        const rarityColor = this.getRarityColor(heroConfig.rarity);
        const professionName = HeroConfig.getProfessionName(heroConfig.profession);
        const portraitMarkup = (heroConfig.cardPortrait || heroConfig.portrait)
            ? `<div class="hero-fragment-detail-portrait">${window.game.ui.heroView.getProfessionBadgeMarkup(heroConfig)}${window.game.ui.heroView.getHeroAvatarMarkup(heroConfig)}</div>`
            : `<div class="hero-fragment-detail-icon">${heroConfig.icon || '❓'}</div>`;

        const modal = new Modal({
            title: '英雄碎片',
            className: 'inventory-detail-modal-shell inventory-fragment-modal-shell hero-command-modal-shell',
            content: `
                <div class="hero-fragment-detail inventory-fragment-detail">
                    <div class="inventory-detail-visual-card">
                        ${portraitMarkup}
                    </div>
                    <div class="inventory-detail-info-card">
                        <div class="inventory-detail-kicker">HERO FRAGMENT</div>
                        <div class="hero-fragment-detail-name" style="color:${rarityColor};">${heroConfig.name}</div>
                        <div class="inventory-detail-tags">
                            <span>${professionName}</span>
                            <span>${rarityName}</span>
                        </div>
                        <div class="inventory-detail-desc">收集 50 个同名碎片后，可合成为完整英雄。</div>
                        <div class="inventory-detail-stats">
                            <div class="inventory-detail-stat">
                                <span>持有碎片</span>
                                <strong>${totalCount}</strong>
                            </div>
                            <div class="inventory-detail-stat">
                                <span>合成需求</span>
                                <strong>50</strong>
                            </div>
                        </div>
                        <div class="inventory-detail-progress">
                            <div class="inventory-detail-progress-fill" style="width:${Math.min(100, (totalCount / 50) * 100).toFixed(2)}%;"></div>
                        </div>
                    </div>
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
        if (!item || item.effect?.type !== 'hero_exp') {
            Toast.error('经验药水不存在');
            return;
        }
        Toast.info('请前往英雄管理页面英雄详情中使用');
    }

    showItemDetail(item) {
        const isHeroExpPotion = item.effect?.type === 'hero_exp';
        const modal = new Modal({
            title: item.name,
            content: `
                <div style="text-align:center;">
                    <div class="inventory-detail-icon" style="margin-bottom:15px;">${this.renderItemIconMarkup(item)}</div>
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
                            const finalize = () => {
                                this.refresh();
                                window.game.save();
                                modal.close();
                            };
                            if (Array.isArray(result.rewards) && result.rewards.length > 0) {
                                RewardModal.show({
                                    title: item.name,
                                    rewards: result.rewards,
                                    summaryText: result.message || '使用成功'
                                }).then(() => finalize());
                            } else {
                                Toast.success(result.message);
                                finalize();
                            }
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
        const rarityColor = this.getRarityColor(equipment.rarity);
        const rarityName = EquipmentConfig.getRarityName(equipment.rarity);
        const slotName = EquipmentConfig.getSlotName(equipment.slot);
        const enhanceRate = EquipmentConfig.getEnhanceSuccessRate(equipment.rarity, equipment.enhanceLevel);
        const maxStarLevel = (typeof EquipmentConfig.getStarMaxLevel === 'function')
            ? EquipmentConfig.getStarMaxLevel(equipment.slot)
            : null;
        const enhanceMaxLevel = (typeof EquipmentConfig.getEnhanceMaxLevel === 'function')
            ? EquipmentConfig.getEnhanceMaxLevel(equipment.rarity)
            : null;

        const tags = [
            `<span style="color:${rarityColor};border-color:${rarityColor}66;">${rarityName}</span>`,
            `<span>${slotName}</span>`,
            `<span>${equipment.starLevel}星${maxStarLevel ? ` / ${maxStarLevel}` : ''}</span>`,
            `<span>+${equipment.enhanceLevel}${enhanceMaxLevel ? ` / +${enhanceMaxLevel}` : ''}</span>`
        ];
        if (equipment.locked) {
            tags.push('<span style="color:#f6c96b;border-color:#f6c96b66;">已锁定</span>');
        }

        const starBonus = (typeof equipment.getStarBonusStats === 'function') ? (equipment.getStarBonusStats() || {}) : {};
        const enhanceBonus = (typeof equipment.getEnhanceBonusStats === 'function') ? (equipment.getEnhanceBonusStats() || {}) : {};
        const statsSource = equipment.stats || {};
        const statEntries = Object.entries(statsSource).filter(([, value]) => Number(value) !== 0);

        const statCards = statEntries.map(([key, value]) => {
            const starVal = Number(starBonus[key]) || 0;
            const enhanceVal = Number(enhanceBonus[key]) || 0;
            const bonusBits = [];
            if (starVal > 0) bonusBits.push(`★+${starVal}`);
            if (enhanceVal > 0) bonusBits.push(`强+${enhanceVal}`);
            const bonusLine = bonusBits.length
                ? `<div style="margin-top:2px;font-size:9px;color:rgba(159,179,200,0.78);">${bonusBits.join(' / ')}</div>`
                : '';
            return `
                <div class="inventory-detail-stat">
                    <span>${Equipment.getStatName(key)}</span>
                    <strong>+${value}</strong>
                    ${bonusLine}
                </div>
            `;
        }).join('');

        const statsBlock = statCards
            ? `<div class="inventory-detail-stats">${statCards}</div>`
            : '<div style="font-size:11px;color:rgba(159,179,200,0.78);">当前装备没有数值属性</div>';

        const metaLine = `<div style="margin-top:4px;font-size:11px;color:rgba(159,179,200,0.78);">下次强化成功率：${EquipmentConfig.formatSuccessRate(enhanceRate)}</div>`;

        const modal = new Modal({
            title: equipment.name,
            className: 'inventory-detail-modal-shell hero-command-modal-shell',
            content: `
                <div class="inventory-detail-panel inventory-detail-rarity-${equipment.rarity || 'common'}">
                    <div class="inventory-detail-visual-card">
                        <div class="inventory-detail-icon">${this.renderItemIconMarkup(equipment)}</div>
                    </div>
                    <div class="inventory-detail-info-card">
                        <div class="inventory-detail-kicker">EQUIPMENT</div>
                        <div class="inventory-detail-name" style="color:${rarityColor};">${equipment.name}</div>
                        <div class="inventory-detail-tags">${tags.join('')}</div>
                        <div class="inventory-detail-desc">${equipment.description || '暂无说明'}</div>
                        ${statsBlock}
                        ${metaLine}
                    </div>
                </div>
            `,
            buttons: [
                { text: '强化', className: 'btn-primary', onClick: () => { modal.close(); equipmentEnhanceModal.show(equipment.instanceId); } },
                {
                    text: '升星',
                    className: 'btn-primary',
                    onClick: () => {
                        if (!equipment.canStarUpgrade()) {
                            Toast.info('当前装备不可升星');
                            return;
                        }
                        modal.close();
                        equipmentStarModal.show(equipment.instanceId);
                    }
                },
                {
                    text: '洗炼',
                    className: 'btn-primary',
                    onClick: () => {
                        const armoryRules = shelterManager.getArmoryReforgeRules?.() || { level: 0, unlockedStats: [] };
                        if ((Number(armoryRules.level) || 0) <= 0) {
                            Toast.info('武器库尚未建造，无法洗炼装备');
                            return;
                        }
                        const reforgeCheck = itemManager.getEquipmentReforgeInfo?.(equipment.instanceId);
                        if (!reforgeCheck?.success) {
                            Toast.info(reforgeCheck?.message || '当前装备暂无可洗炼属性');
                            return;
                        }
                        modal.close();
                        window.equipmentReforgeModal?.show?.(equipment.instanceId);
                    }
                },
                {
                    text: '分解',
                    className: 'btn-secondary',
                    onClick: () => {
                        const result = itemManager.dismantleEquipment(equipment.instanceId);
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


