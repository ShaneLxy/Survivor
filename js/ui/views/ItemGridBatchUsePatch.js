(function() {
    if (typeof ItemGrid === 'undefined' || !window.itemGrid) {
        return;
    }

    ItemGrid.prototype.getItemDetailVisual = function(item) {
        const starBadge = item?.type === 'equipment' && typeof item.getStarBadgeMarkup === 'function'
            ? item.getStarBadgeMarkup()
            : '';
        if (item.iconSrc) {
            return `<span class="equipment-icon-with-star">${starBadge}<img class="resource-icon-image item-icon-image" src="${item.iconSrc}" alt="${item.name}"></span>`;
        }
        return `<span class="equipment-icon-with-star equipment-icon-text">${starBadge}${item.icon || '📦'}</span>`;
    };

    ItemGrid.prototype.getBatchFieldHtml = function(inputId, maxValue, label, tip) {
        if (maxValue <= 1) {
            return '';
        }

        return `
            <div class="inventory-detail-batch-field">
                <label for="${inputId}">${label}</label>
                <input id="${inputId}" type="number" min="1" max="${maxValue}" value="1">
                <div>${tip}</div>
            </div>
        `;
    };

    ItemGrid.prototype.readBatchCount = function(inputId, maxValue) {
        const input = document.getElementById(inputId);
        const rawValue = input ? Number(input.value) : 1;
        if (!Number.isFinite(rawValue) || rawValue < 1) {
            return 1;
        }
        return Math.min(maxValue, Math.floor(rawValue));
    };

    ItemGrid.prototype.useInventoryItemBatch = function(item, quantity) {
        const requested = Math.max(1, Number(quantity) || 1);
        let usedCount = 0;
        let lastMessage = '';

        for (let index = 0; index < requested; index++) {
            const current = itemManager.getItem(item.id);
            if (!current || current.count <= 0) {
                break;
            }

            const result = itemManager.useItem(item.id);
            if (!result.success) {
                if (usedCount === 0) {
                    return result;
                }
                break;
            }

            usedCount += 1;
            lastMessage = result.message;

            if (result.effect?.type === 'energy' && window.game.player.energy >= window.game.player.maxEnergy) {
                break;
            }
        }

        if (usedCount === 0) {
            return { success: false, message: lastMessage || '未能使用该物品' };
        }

        if (usedCount === 1) {
            return { success: true, message: lastMessage || `已使用 ${item.name}` };
        }

        return {
            success: true,
            message: `已批量使用 ${usedCount} 个${item.name}`
        };
    };

    ItemGrid.prototype.useMeatResource = function(count) {
        const requested = Math.max(1, Number(count) || 1);
        const owned = shelterManager.getResource('meat');
        if (owned <= 0) {
            return { success: false, message: '肉类数量不足' };
        }

        const missingEnergy = Math.max(0, window.game.player.maxEnergy - window.game.player.energy);
        if (missingEnergy <= 0) {
            return { success: false, message: '体力已满' };
        }

        const actualCount = Math.min(requested, owned, missingEnergy);
        if (!shelterManager.consumeResource('meat', actualCount)) {
            return { success: false, message: '肉类数量不足' };
        }

        window.game.player.energy = Math.min(window.game.player.maxEnergy, window.game.player.energy + actualCount);
        eventManager.emit('playerUpdate', {
            energy: window.game.player.energy,
            maxEnergy: window.game.player.maxEnergy
        });

        return {
            success: true,
            message: `恢复 ${actualCount} 点体力`
        };
    };

    ItemGrid.prototype.showResourceDetail = function(item) {
        const totalCount = item.totalCount || item.count || 0;
        const missingEnergy = Math.max(0, window.game.player.maxEnergy - window.game.player.energy);
        const maxUseCount = item.id === 'meat' ? Math.min(totalCount, missingEnergy) : 0;
        const quantityInputId = `item-batch-count-${item.id}`;
        const canUse = item.id === 'meat' && maxUseCount > 0;

        const modal = new Modal({
            title: item.name,
            className: 'inventory-detail-modal-shell hero-command-modal-shell',
            content: `
                <div class="inventory-detail-panel inventory-detail-rarity-${item.rarity || 'common'}">
                    <div class="inventory-detail-visual-card">
                        <div class="inventory-detail-icon">${this.getItemDetailVisual(item)}</div>
                    </div>
                    <div class="inventory-detail-info-card">
                        <div class="inventory-detail-kicker">SUPPLY ITEM</div>
                        <div class="inventory-detail-name" style="color:${this.getRarityColor(item.rarity)};">${item.name}</div>
                        <div class="inventory-detail-tags">
                            <span>${this.getRarityName(item.rarity)}</span>
                            <span>资源</span>
                        </div>
                        <div class="inventory-detail-desc">${item.description || '暂无说明'}</div>
                        <div class="inventory-detail-stats">
                            <div class="inventory-detail-stat">
                                <span>库存</span>
                                <strong>${totalCount}</strong>
                            </div>
                            ${item.id === 'meat' ? '<div class="inventory-detail-stat inventory-detail-stat-accent"><span>使用效果</span><strong>体力 +1</strong></div>' : ''}
                        </div>
                    </div>
                    ${canUse ? this.getBatchFieldHtml(quantityInputId, maxUseCount, '使用数量', `最多可用 ${maxUseCount} 个`) : ''}
                </div>
            `,
            buttons: [
                ...(canUse ? [{
                    text: '使用',
                    className: 'btn-primary',
                    onClick: () => {
                        const count = this.readBatchCount(quantityInputId, maxUseCount);
                        const result = this.useMeatResource(count);
                        if (result.success) {
                            Toast.success(result.message);
                            this.refresh();
                            window.game.save();
                            modal.close();
                        } else {
                            Toast.error(result.message);
                        }
                    }
                }] : []),
                { text: '关闭', className: 'btn-secondary', onClick: () => modal.close() }
            ]
        });
        modal.show();
    };

    ItemGrid.prototype.showItemDetail = function(item) {
        const isHeroExpPotion = item.effect?.type === 'hero_exp';
        const isEnergyItem = item.effect?.type === 'energy';
        const isGachaTicket = item.effect?.type === 'gacha';
        const canUse = Boolean(item.effect);
        const missingEnergy = Math.max(0, window.game.player.maxEnergy - window.game.player.energy);
        const energyValue = Math.max(1, Number(item.effect?.value) || 1);
        const maxUseCount = isEnergyItem
            ? Math.min(item.count, Math.max(1, Math.ceil(missingEnergy / energyValue)))
            : item.count;
        const quantityInputId = `item-batch-count-${item.id}`;

        const modal = new Modal({
            title: item.name,
            className: 'inventory-detail-modal-shell hero-command-modal-shell',
            content: `
                <div class="inventory-detail-panel inventory-detail-rarity-${item.rarity || 'common'}">
                    <div class="inventory-detail-visual-card">
                        <div class="inventory-detail-icon">${this.getItemDetailVisual(item)}</div>
                    </div>
                    <div class="inventory-detail-info-card">
                        <div class="inventory-detail-kicker">INVENTORY ITEM</div>
                        <div class="inventory-detail-name" style="color:${this.getRarityColor(item.rarity)};">${item.name}</div>
                        <div class="inventory-detail-tags">
                            <span>${this.getRarityName(item.rarity)}</span>
                            <span>${canUse ? '可使用' : '收藏品'}</span>
                        </div>
                        <div class="inventory-detail-desc">${item.description || '暂无说明'}</div>
                        <div class="inventory-detail-stats">
                            <div class="inventory-detail-stat">
                                <span>库存</span>
                                <strong>${item.count}</strong>
                            </div>
                            ${item.stats ? `<div class="inventory-detail-stat"><span>属性</span><strong>${this.formatStats(item.stats)}</strong></div>` : ''}
                            ${isEnergyItem ? `<div class="inventory-detail-stat inventory-detail-stat-accent"><span>使用效果</span><strong>体力 +${energyValue}</strong></div>` : ''}
                        </div>
                    </div>
                    ${canUse && !isHeroExpPotion && !isGachaTicket ? this.getBatchFieldHtml(quantityInputId, maxUseCount, '使用数量', `最多可用 ${maxUseCount} 个`) : ''}
                </div>
            `,
            buttons: [
                ...(canUse ? [{
                    text: isGachaTicket ? '前往招募' : '使用',
                    className: 'btn-primary',
                    onClick: () => {
                        if (isGachaTicket) {
                            modal.close();
                            eventManager.emit('viewChange', { view: 'recruit' });
                            return;
                        }

                        if (isHeroExpPotion) {
                            modal.close();
                            this.showHeroExpUseModal(item.id);
                            return;
                        }

                        const batchCount = this.readBatchCount(quantityInputId, Math.max(1, maxUseCount));
                        const result = this.useInventoryItemBatch(item, batchCount);
                        if (result.success) {
                            Toast.success(result.message);
                            this.refresh();
                            window.game.save();
                            modal.close();
                        } else {
                            Toast.error(result.message);
                        }
                    }
                }] : []),
                { text: '关闭', className: 'btn-secondary', onClick: () => modal.close() }
            ]
        });
        modal.show();
    };
})();
