/**
 * 商城视图
 */
class ShopView {
    constructor() {
        this.element = document.getElementById('main-display');
        this.visible = false;
        this.shopItems = [];
        this.purchasedCounts = {};
        this.activeType = 'all';
    }

    show() {
        this.visible = true;
        this.resetPurchaseCounts();
        this.render();
    }

    hide() {
        this.visible = false;
        this.element.innerHTML = '';
    }

    resetPurchaseCounts() {
        this.shopItems = ShopConfig.getShopItems();
        this.shopItems.forEach(item => {
            this.purchasedCounts[item.id] = 0;
        });
    }

    render() {
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
        return Math.max(0, item.maxBuy - (this.purchasedCounts[item.id] || 0));
    }

    getGoldIconSrc() {
        return ResourceVisualConfig.get('gold')?.src || 'assets/icons/resource-gold.svg';
    }

    getGoldBalance() {
        return shelterManager.getResource('gold') || 0;
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
            balance: this.getGoldBalance(),
            catalogCount: this.shopItems.length,
            remainingTotal,
            soldOutCount
        };
    }

    getItemAvailability(item) {
        const remaining = this.getRemaining(item);
        const balance = this.getGoldBalance();
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
                label: '金币不足',
                actionText: '缺金币'
            };
        }
        return {
            canBuy: true,
            className: 'is-available',
            label: '可交易',
            actionText: '购买'
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
                <span>金币余额</span>
                <strong><img class="shop-price-icon" src="${this.getGoldIconSrc()}" alt="金币">${summary.balance}</strong>
            </div>
            <div class="shop-stage-stat">
                <span>商品</span>
                <strong>${summary.catalogCount}</strong>
            </div>
            <div class="shop-stage-stat">
                <span>余量</span>
                <strong>${summary.remainingTotal}</strong>
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
        const goldIconSrc = this.getGoldIconSrc();

        if (countEl) {
            countEl.textContent = `${filteredItems.length} 件补给`;
        }

        if (filteredItems.length === 0) {
            listEl.innerHTML = '<div class="shop-empty">当前分类暂无商品</div>';
            return;
        }

        filteredItems.forEach(item => {
            const remaining = this.getRemaining(item);
            const availability = this.getItemAvailability(item);
            const rarityMeta = this.getRarityMeta(item.rarity);

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
                        <span>类型</span>
                        <strong>${this.getTypeLabel(item.type)}</strong>
                    </div>
                    <div class="shop-item-meta-block">
                        <span>限购</span>
                        <strong>${remaining}/${item.maxBuy}</strong>
                    </div>
                </div>
                <div class="shop-item-footer">
                    <div class="shop-col-price"><img class="shop-price-icon" src="${goldIconSrc}" alt="金币">${item.price}</div>
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
        const canBuy = remaining > 0 && shelterManager.getResource('gold') >= item.price;

        if (!canBuy) {
            Toast.error('购买条件不足');
            return;
        }

        const resolvedItem = ShopConfig.resolveGiveItem(item);
        if (!resolvedItem) {
            Toast.error('商品数据异常，请稍后重试');
            return;
        }

        const needInput = remaining > 1;
        const rarityMeta = this.getRarityMeta(item.rarity);
        const goldIconSrc = this.getGoldIconSrc();
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
                        <strong><img class="shop-price-icon shop-price-icon-inline" src="${goldIconSrc}" alt="金币">${item.price}</strong>
                    </div>
                    <div>
                        <span>剩余可购</span>
                        <strong>${remaining}/${item.maxBuy}</strong>
                    </div>
                    <div>
                        <span>当前金币</span>
                        <strong><img class="shop-price-icon shop-price-icon-inline" src="${goldIconSrc}" alt="金币">${this.getGoldBalance()}</strong>
                    </div>
                </div>
                ${needInput ? `
                    <label class="shop-quantity-field">
                        <span>购买数量</span>
                        <input type="number" id="buy-quantity"
                               min="1" max="${remaining}"
                               value="1"
                               oninput="window.game.ui.shopView.updateBuySubtotal(${item.price})">
                    </label>
                ` : ''}
                <div class="shop-confirm-total">
                    <span>预计消耗</span>
                    <strong><img class="shop-price-icon shop-price-icon-inline" src="${goldIconSrc}" alt="金币"><span id="shop-buy-subtotal">${item.price}</span></strong>
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
                                Toast.error('购买数量无效');
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
            const resolvedItem = ShopConfig.resolveGiveItem(item);
            if (!resolvedItem) {
                Toast.error('商品数据异常，请稍后重试');
                return false;
            }

            const remaining = item.maxBuy - (this.purchasedCounts[item.id] || 0);
            if (quantity < 1 || quantity > remaining) {
                Toast.error('购买数量无效');
                return false;
            }

            const totalPrice = item.price * quantity;
            if (shelterManager.getResource('gold') < totalPrice) {
                Toast.error('金币不足');
                return false;
            }

            let rewardEntries = [];
            let fragmentRewards = null;
            if (item.type === 'fragment') {
                fragmentRewards = ShopConfig.resolveFragmentRewards(item, quantity);
                if (!fragmentRewards || fragmentRewards.length === 0) {
                    Toast.error('商品数据异常，请稍后重试');
                    return false;
                }
            }

            if (item.type === 'consumable') {
                const totalCount = quantity * (resolvedItem.giveCount || 1);
                const inventoryCheck = itemManager.canAddItem(item.giveItem, totalCount);
                if (!inventoryCheck.success) {
                    Toast.error(inventoryCheck.message || '背包容量达到上限');
                    return false;
                }
            }

            if (!shelterManager.consumeResource('gold', totalPrice)) {
                Toast.error('金币不足');
                return false;
            }

            this.purchasedCounts[item.id] = (this.purchasedCounts[item.id] || 0) + quantity;

            if (item.type === 'fragment') {
                fragmentRewards.forEach(reward => {
                    heroManager.addFragments(reward.heroId, reward.count);
                    rewardEntries.push(RewardModal.createFragmentReward(reward.heroId, reward.count));
                });
            } else if (item.type === 'resource') {
                const totalCount = quantity * (resolvedItem.giveCount || 1);
                shelterManager.addResource(item.giveItem, totalCount);
                rewardEntries.push(RewardModal.createResourceReward(item.giveItem, totalCount));
            } else if (item.type === 'consumable') {
                const totalCount = quantity * (resolvedItem.giveCount || 1);
                itemManager.addItem(item.giveItem, totalCount);
                rewardEntries.push(RewardModal.createItemReward(item.giveItem, totalCount));
            } else {
                Toast.error('未知商品类型');
                return false;
            }

            this.renderShopSurface();
            await RewardModal.show({
                title: '购买成功',
                rewards: rewardEntries,
                summaryText: `已消耗 ${totalPrice} 金币`
            });
            window.game.save();
            return true;
        } catch (error) {
            console.error('购买商品出错:', error);
            Toast.error('购买失败，请重试');
            return false;
        }
    }

    refresh() {
        if (this.visible) this.render();
    }
}

const shopView = new ShopView();
window.shopView = shopView;
