/**
 * 商城视图
 */
class ShopView {
    constructor() {
        this.element = document.getElementById('main-display');
        this.visible = false;
        this.shopItems = [];
        this.purchasedCounts = {};
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
                <h2 class="shop-title">商城</h2>
                <div class="shop-table">
                    <div class="shop-header">
                        <div class="shop-col-name">商品</div>
                        <div class="shop-col-price">单价</div>
                        <div class="shop-col-limit">剩余</div>
                        <div class="shop-col-action">操作</div>
                    </div>
                    <div id="shop-list" class="shop-list"></div>
                </div>
            </div>
        `;
        this.renderShopList();
    }

    renderShopList() {
        const listEl = this.element.querySelector('#shop-list');
        listEl.innerHTML = '';
        const goldIconSrc = ResourceVisualConfig.get('gold')?.src || 'assets/icons/resource-gold.svg';

        this.shopItems.forEach(item => {
            const remaining = item.maxBuy - (this.purchasedCounts[item.id] || 0);
            const canBuy = remaining > 0 && shelterManager.getResource('gold') >= item.price;

            const itemEl = document.createElement('div');
            itemEl.className = 'shop-item';
            itemEl.innerHTML = `
                <div class="shop-col-name">
                    <span class="shop-icon">${item.icon}</span>
                    <span class="shop-name">${item.name}</span>
                </div>
                <div class="shop-col-price"><img class="shop-price-icon" src="${goldIconSrc}" alt="金币">${item.price}</div>
                <div class="shop-col-limit">${remaining}/${item.maxBuy}</div>
                <div class="shop-col-action">
                    <button class="btn btn-small ${canBuy ? 'btn-primary' : 'btn-secondary'}"
                            onclick="window.game.ui.shopView.showBuyConfirm('${item.id}')"
                            ${!canBuy ? 'disabled' : ''}>
                        购买
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
        const content = `
            <div style="text-align:center;">
                <div style="font-size:48px;margin-bottom:15px;">${resolvedItem.actualItemIcon}</div>
                <p>购买：${resolvedItem.actualItemName}</p>
                <p>单价：<img class="shop-price-icon shop-price-icon-inline" src="${ResourceVisualConfig.get('gold')?.src || 'assets/icons/resource-gold.svg'}" alt="金币">${item.price}</p>
                <p>剩余可购：${remaining}/${item.maxBuy}</p>
                ${needInput ? `
                    <div style="margin-top:15px;">
                        <label>购买数量：</label>
                        <input type="number" id="buy-quantity"
                               min="1" max="${remaining}"
                               value="1"
                               style="width:60px;padding:5px;border-radius:5px;border:1px solid #4a4a4a;background:#2a2a2a;color:#e0e0e0;">
                    </div>
                ` : ''}
            </div>
        `;

        const modal = new Modal({
            title: '确认购买',
            content,
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

            this.renderShopList();
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
