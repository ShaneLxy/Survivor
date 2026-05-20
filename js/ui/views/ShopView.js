/**
 * 商城视图
 */
class ShopView {
    constructor() {
        this.element = document.getElementById('main-display');
        this.visible = false;
        this.shopItems = [];
        this.purchasedCounts = {};
        this.lastResetDate = '';
        this.activeType = 'all';
        this.resetShopItems();
    }

    getTodayKey() {
        return window.serverClock?.todayKey?.() || new Date().toDateString();
    }

    resetShopItems() {
        this.shopItems = ShopConfig.getShopItems();
    }

    resetPurchaseCounts(resetDate = this.getTodayKey()) {
        this.resetShopItems();
        this.purchasedCounts = {};
        this.shopItems.forEach(item => {
            this.purchasedCounts[item.id] = 0;
        });
        this.lastResetDate = resetDate;
    }

    ensureDailyReset(now = null) {
        const todayKey = now?.toDateString?.() || this.getTodayKey();
        if (this.lastResetDate !== todayKey) {
            this.resetPurchaseCounts(todayKey);
            return true;
        }
        this.resetShopItems();
        return false;
    }

    init(saveData) {
        const counts = saveData?.purchasedCounts && typeof saveData.purchasedCounts === 'object'
            ? saveData.purchasedCounts
            : {};
        const lastResetDate = String(saveData?.lastResetDate || '').trim();

        this.resetShopItems();
        this.purchasedCounts = {};
        this.shopItems.forEach(item => {
            this.purchasedCounts[item.id] = Math.max(0, Number(counts[item.id]) || 0);
        });
        this.lastResetDate = lastResetDate || this.getTodayKey();
        this.ensureDailyReset();
    }

    getSaveData() {
        this.ensureDailyReset();
        const purchasedCounts = {};
        Object.entries(this.purchasedCounts || {}).forEach(([itemId, count]) => {
            const normalizedCount = Math.max(0, Number(count) || 0);
            if (normalizedCount > 0) {
                purchasedCounts[itemId] = normalizedCount;
            }
        });
        return {
            lastResetDate: this.lastResetDate || this.getTodayKey(),
            purchasedCounts
        };
    }

    show() {
        this.visible = true;
        this.ensureDailyReset();
        this.render();
    }

    hide() {
        this.visible = false;
        this.element.innerHTML = '';
    }

    render() {
        this.ensureDailyReset();
        this.element.innerHTML = `
            <div class="shop-view">
                <div class="shop-stage-header">
                    <div class="shop-stage-heading-row">
                        <div class="shop-stage-heading-group">
                            <div class="shop-stage-kicker">MARKET TERMINAL</div>
                            <h2 class="shop-title">商城</h2>
                            <div class="shop-stage-subtitle">用金币交换碎片、补给与避难所资源，维持小队的长期作战能力。</div>
                        </div>
                    </div>
                    <div id="shop-stage-stats" class="shop-stage-stats"></div>
                </div>
                <div id="shop-filter-tabs" class="shop-filter-tabs"></div>
                <div class="shop-market-board">
                    <div class="shop-market-board-head">
                        <div>
                            <div class="shop-market-kicker">SUPPLY LIST</div>
                            <strong>交易清单</strong>
                        </div>
                        <span id="shop-market-count"></span>
                    </div>
                    <div id="shop-list" class="shop-list"></div>
                </div>
            </div>
        `;
        this.renderShopSurface();
    }

    getTypeTabs() {
        return [
            { id: 'all', label: '全部', icon: '◆' },
            { id: 'fragment', label: '碎片', icon: '◇' },
            { id: 'consumable', label: '药剂', icon: '+' },
            { id: 'resource', label: '资源', icon: '▣' }
        ];
    }

    getTypeLabel(type) {
        const labels = {
            fragment: '英雄碎片',
            consumable: '消耗品',
            resource: '避难所资源'
        };
        return labels[type] || '补给';
    }

    getRarityMeta(rarity) {
        const rarityMap = {
            common: { label: 'COMMON', className: 'common' },
            rare: { label: 'RARE', className: 'rare' },
            epic: { label: 'EPIC', className: 'epic' },
            random: { label: 'MIXED', className: 'random' }
        };
        return rarityMap[rarity] || rarityMap.common;
    }

    getItemTagline(item) {
        if (item.type === 'fragment') {
            if (item.rarity === 'epic') return '高价值英雄档案碎片';
            if (item.rarity === 'rare') return '稳定补充英雄档案';
            return '随机幸存者档案补给';
        }
        if (item.type === 'consumable') {
            return '行动前线应急物资';
        }
        return '避难所建设与维护补给';
    }

    getRemaining(item) {
        this.ensureDailyReset();
        return Math.max(0, item.maxBuy - (this.purchasedCounts[item.id] || 0));
    }

    getGoldIconSrc() {
        return ResourceVisualConfig.get('gold')?.src || 'assets/icons/resource-gold.svg';
    }

    getGoldBalance() {
        return shelterManager.getResource('gold') || 0;
    }

    getCurrencyType(item) {
        return String(item?.currency || 'gold').trim() || 'gold';
    }

    getCurrencyIconSrc(currencyType) {
        return ResourceVisualConfig.get(currencyType)?.src || this.getGoldIconSrc();
    }

    getCurrencyBalance(currencyType) {
        return shelterManager.getResource(currencyType) || 0;
    }

    getCurrencyLabel(currencyType) {
        const config = shelterManager.getResourceConfig?.(currencyType);
        return config?.name || currencyType || '资源';
    }

    renderIconMarkup(item, imageClass = 'shop-icon-image') {
        const src = item?.iconSrc || item?.actualItemIconSrc || '';
        if (src) {
            const alt = item?.name || item?.actualItemName || '商品';
            return `<img class="${imageClass}" src="${src}" alt="${alt}">`;
        }
        return item?.actualItemIcon || item?.icon || '◆';
    }

    getFilteredShopItems() {
        if (this.activeType === 'all') {
            return this.shopItems;
        }
        return this.shopItems.filter(item => item.type === this.activeType);
    }

    getShopSummary() {
        const remainingTotal = this.shopItems.reduce((sum, item) => sum + this.getRemaining(item), 0);
        const soldOutCount = this.shopItems.filter(item => this.getRemaining(item) <= 0).length;
        return {
            goldBalance: this.getCurrencyBalance('gold'),
            diamondBalance: this.getCurrencyBalance('diamond'),
            catalogCount: this.shopItems.length,
            remainingTotal,
            soldOutCount
        };
    }

    getItemAvailability(item) {
        const remaining = this.getRemaining(item);
        const currencyType = this.getCurrencyType(item);
        const balance = this.getCurrencyBalance(currencyType);
        const currencyLabel = this.getCurrencyLabel(currencyType);
        if (remaining <= 0) {
            return {
                canBuy: false,
                className: 'is-sold-out',
                label: '已售罄',
                actionText: '售罄'
            };
        }
        if (balance < item.price) {
            return {
                canBuy: false,
                className: 'is-unaffordable',
                label: `${currencyLabel}不足`,
                actionText: `缺${currencyLabel}`
            };
        }
        return {
            canBuy: true,
            className: 'is-available',
            label: '已售罄',
            actionText: '售罄'
        };
    }
    renderShopSurface() {
        this.renderShopStats();
        this.renderTypeTabs();
        this.renderShopList();
    }

    renderShopStats() {
        const statsEl = this.element.querySelector('#shop-stage-stats');
        if (!statsEl) return;

        const summary = this.getShopSummary();
        statsEl.innerHTML = `
            <div class="shop-stage-stat shop-stage-stat-gold">
                <span>剩余可购</span>
                <strong><img class="shop-price-icon" src="${this.getCurrencyIconSrc('gold')}" alt="??">${summary.goldBalance}</strong>
            </div>
            <div class="shop-stage-stat">
                <span>剩余可购</span>
                <strong><img class="shop-price-icon" src="${this.getCurrencyIconSrc('diamond')}" alt="??">${summary.diamondBalance}</strong>
            </div>
            <div class="shop-stage-stat">
                <span>\u5546\u54c1\/\u4f59\u91cf</span>
                <strong>${summary.catalogCount}/${summary.remainingTotal}</strong>
            </div>
        `;
    }

    renderTypeTabs() {
        const tabsEl = this.element.querySelector('#shop-filter-tabs');
        if (!tabsEl) return;

        tabsEl.innerHTML = this.getTypeTabs().map(tab => {
            const count = tab.id === 'all'
                ? this.shopItems.length
                : this.shopItems.filter(item => item.type === tab.id).length;
            return `
                <button
                    type="button"
                    class="shop-filter-tab ${this.activeType === tab.id ? 'is-active' : ''}"
                    onclick="window.game.ui.shopView.setActiveType('${tab.id}')"
                >
                    <span class="shop-filter-tab-icon" aria-hidden="true">${tab.icon}</span>
                    <span class="shop-filter-tab-label">${tab.label}</span>
                    <strong>${count}</strong>
                </button>
            `;
        }).join('');
    }

    setActiveType(type) {
        const validTypes = this.getTypeTabs().map(tab => tab.id);
        this.activeType = validTypes.includes(type) ? type : 'all';
        this.renderShopSurface();
    }

    renderShopList() {
        const listEl = this.element.querySelector('#shop-list');
        const countEl = this.element.querySelector('#shop-market-count');
        if (!listEl) return;

        listEl.innerHTML = '';
        const filteredItems = this.getFilteredShopItems();

        if (countEl) {
            countEl.textContent = `\${filteredItems.length} \u4ef6\u8865\u7ed9`;
        }

        if (filteredItems.length === 0) {
            listEl.innerHTML = '<div class="shop-empty">\u5f53\u524d\u5206\u7c7b\u6682\u65e0\u5546\u54c1</div>';
            return;
        }

        filteredItems.forEach(item => {
            const remaining = this.getRemaining(item);
            const availability = this.getItemAvailability(item);
            const rarityMeta = this.getRarityMeta(item.rarity);
            const currencyType = this.getCurrencyType(item);
            const currencyIconSrc = this.getCurrencyIconSrc(currencyType);
            const currencyLabel = this.getCurrencyLabel(currencyType);

            const itemEl = document.createElement('div');
            itemEl.className = `shop-item shop-item-${item.type} shop-rarity-${rarityMeta.className} ${availability.className}`;
            itemEl.innerHTML = `
                <div class="shop-item-topline">
                    <span class="shop-rarity-badge">${rarityMeta.label}</span>
                    <span class="shop-availability-badge">${availability.label}</span>
                </div>
                <div class="shop-item-main">
                    <div class="shop-icon-frame">
                        <span class="shop-icon">${this.renderIconMarkup(item)}</span>
                    </div>
                    <div class="shop-item-copy">
                        <div class="shop-name">${item.name}</div>
                        <div class="shop-tagline">${this.getItemTagline(item)}</div>
                    </div>
                </div>
                <div class="shop-item-meta">
                    <div class="shop-item-meta-block">
                        <span>单价</span>
                        <strong>${this.getTypeLabel(item.type)}</strong>
                    </div>
                    <div class="shop-item-meta-block">
                        <span>单价</span>
                        <strong>${remaining}/${item.maxBuy}</strong>
                    </div>
                </div>
                <div class="shop-item-footer">
                    <div class="shop-col-price"><img class="shop-price-icon" src="${currencyIconSrc}" alt="${currencyLabel}">${item.price}</div>
                    <button class="btn btn-small shop-buy-button ${availability.canBuy ? 'btn-primary' : 'btn-secondary'}"
                            onclick="window.game.ui.shopView.showBuyConfirm('${item.id}')"
                            ${!availability.canBuy ? 'disabled' : ''}>
                        ${availability.actionText}
                    </button>
                </div>
            `;
            listEl.appendChild(itemEl);
        });
    }

    showBuyConfirm(itemId) {
        const item = this.shopItems.find(i => i.id === itemId);
        if (!item) return;

        const remaining = item.maxBuy - (this.purchasedCounts[item.id] || 0);
        const currencyType = this.getCurrencyType(item);
        const currencyIconSrc = this.getCurrencyIconSrc(currencyType);
        const currencyLabel = this.getCurrencyLabel(currencyType);
        const canBuy = remaining > 0 && this.getCurrencyBalance(currencyType) >= item.price;

        if (!canBuy) {
            Toast.error('\u8d2d\u4e70\u6570\u91cf\u65e0\u6548');
            return;
        }

        const resolvedItem = ShopConfig.resolveGiveItem(item);
        if (!resolvedItem) {
            Toast.error('发放道具配置无效');
            return;
        }

        const needInput = remaining > 1;
        const rarityMeta = this.getRarityMeta(item.rarity);
        const content = `
            <div class="shop-confirm-card shop-rarity-${rarityMeta.className}">
                <div class="shop-confirm-hero">
                    <div class="shop-confirm-icon">${this.renderIconMarkup(resolvedItem, 'shop-confirm-icon-image')}</div>
                    <div class="shop-confirm-copy">
                        <div class="shop-stage-kicker">TRADE CONFIRM</div>
                        <h3>${resolvedItem.actualItemName}</h3>
                        <p>${this.getItemTagline(item)}</p>
                    </div>
                </div>
                <div class="shop-confirm-grid">
                    <div>
                        <span>单价</span>
                        <strong><img class="shop-price-icon shop-price-icon-inline" src="${currencyIconSrc}" alt="${currencyLabel}">${item.price}</strong>
                    </div>
                    <div>
                        <span>剩余可购</span>
                        <strong>${remaining}/${item.maxBuy}</strong>
                    </div>
                    <div>
                        <span>当前${currencyLabel}</span>
                        <strong><img class="shop-price-icon shop-price-icon-inline" src="${currencyIconSrc}" alt="${currencyLabel}">${this.getCurrencyBalance(currencyType)}</strong>
                    </div>
                </div>
                ${needInput ? `
                    <label class="shop-quantity-field">
                        <span>剩余可购</span>
                        <input type="number" id="buy-quantity"
                               min="1" max="${remaining}"
                               value="1"
                               oninput="window.game.ui.shopView.updateBuySubtotal(${item.price})">
                    </label>
                ` : ''}
                <div class="shop-confirm-total">
                    <span>剩余可购</span>
                    <strong><img class="shop-price-icon shop-price-icon-inline" src="${currencyIconSrc}" alt="${currencyLabel}"><span id="shop-buy-subtotal">${item.price}</span></strong>
                </div>
            </div>
        `;

        const modal = new Modal({
            title: '确认购买',
            content,
            className: 'shop-trade-modal-shell',
            buttons: [
                {
                    text: '确认购买',
                    className: 'btn-primary',
                    onClick: async () => {
                        let quantity = 1;
                        if (needInput) {
                            const input = document.getElementById('buy-quantity');
                            quantity = parseInt(input.value, 10) || 1;
                            if (quantity < 1 || quantity > remaining) {
                                Toast.error('\u8d2d\u4e70\u6570\u91cf\u65e0\u6548');
                                return;
                            }
                        }
                        const success = await this.buyItem(item, quantity);
                        if (success) {
                            modal.close();
                        }
                    }
                },
                {
                    text: '取消',
                    className: 'btn-secondary',
                    onClick: () => modal.close()
                }
            ]
        });
        modal.show();
    }

    updateBuySubtotal(unitPrice) {
        const input = document.getElementById('buy-quantity');
        const subtotalEl = document.getElementById('shop-buy-subtotal');
        if (!input || !subtotalEl) return;

        const max = parseInt(input.max, 10) || 1;
        const rawQuantity = parseInt(input.value, 10) || 1;
        const quantity = Math.max(1, Math.min(max, rawQuantity));
        if (String(quantity) !== input.value) {
            input.value = quantity;
        }
        subtotalEl.textContent = unitPrice * quantity;
    }

    async buyItem(item, quantity) {
        try {
            this.ensureDailyReset();
            const remaining = item.maxBuy - (this.purchasedCounts[item.id] || 0);
            if (quantity < 1 || quantity > remaining) {
                Toast.error('\u8d2d\u4e70\u6570\u91cf\u65e0\u6548');
                return false;
            }

            const totalPrice = item.price * quantity;
            const currencyType = this.getCurrencyType(item);
            if (this.getCurrencyBalance(currencyType) < totalPrice) {
                Toast.error(`\${this.getCurrencyLabel(currencyType)}\u4e0d\u8db3`);
                return false;
            }

            if (!authService.isLoggedIn()) {
                Toast.error('\u8bf7\u5148\u767b\u5f55');
                return false;
            }

            const result = await SaveApi.purchaseShopItem(item.id, quantity);
            const saveData = result?.saveData || null;
            if (!saveData?.data) {
                Toast.error(result?.message || '\u8d2d\u4e70\u5931\u8d25');
                return false;
            }

            saveSyncService.applyAuthoritativeSave(saveData);
            const rewardEntries = (Array.isArray(result?.rewards) ? result.rewards : []).map((reward) => {
                const count = Number(reward?.amount ?? reward?.count ?? 0) || 0;
                if (reward?.type === 'resource') {
                    return RewardModal.createResourceReward(reward.id, count);
                }
                if (String(reward?.id || '').endsWith('_fragment')) {
                    return RewardModal.createFragmentReward(String(reward.id).replace(/_fragment$/, ''), count);
                }
                return RewardModal.createItemReward(reward.id, count);
            }).filter(Boolean);

            await RewardModal.show({
                title: '确认购买',
                rewards: rewardEntries,
                summaryText: `\u6d88\u8017 \${totalPrice} \${this.getCurrencyLabel(currencyType)}`
            });
            return true;
        } catch (error) {
            console.error('shop purchase failed:', error);
            Toast.error(error?.message || '\u8d2d\u4e70\u5931\u8d25');
            return false;
        }
    }

    refresh() {
        this.ensureDailyReset();
        if (this.visible) this.render();
    }
}

const shopView = new ShopView();
window.shopView = shopView;
