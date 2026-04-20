(function() {
    if (typeof ItemGrid === 'undefined' || !window.itemGrid) {
        return;
    }

    ItemGrid.prototype.getItemDetailVisual = function(item) {
        if (item.iconSrc) {
            return `<img class="resource-icon-image item-icon-image" src="${item.iconSrc}" alt="${item.name}">`;
        }
        return item.icon || '📦';
    };

    ItemGrid.prototype.getBatchFieldHtml = function(inputId, maxValue, label, tip) {
        if (maxValue <= 1) {
            return '';
        }

        return `
            <div style="display:flex;flex-direction:column;gap:6px;padding:10px 12px;border-radius:10px;background:rgba(15,23,42,0.55);text-align:left;">
                <label for="${inputId}" style="font-size:12px;color:#cbd5e1;">${label}</label>
                <input id="${inputId}" type="number" min="1" max="${maxValue}" value="1"
                    style="width:100%;height:36px;border-radius:8px;border:1px solid rgba(148,163,184,0.3);background:rgba(15,23,42,0.9);color:#f8fafc;padding:0 10px;box-sizing:border-box;">
                <div style="font-size:11px;color:#94a3b8;">${tip}</div>
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
            content: `
                <div style="text-align:center;display:flex;flex-direction:column;gap:10px;">
                    <div style="font-size:52px;">${this.getItemDetailVisual(item)}</div>
                    <div style="color:${this.getRarityColor(item.rarity)};font-weight:bold;">${item.name}</div>
                    <div style="font-size:13px;line-height:1.6;color:#e2e8f0;">${item.description || '暂无说明'}</div>
                    <div style="font-size:12px;color:#cbd5e1;">数量: ${totalCount}</div>
                    ${item.id === 'meat' ? '<div style="font-size:12px;color:#fbbf24;">使用效果: 1 个肉类恢复 1 点体力</div>' : ''}
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
        const canUse = Boolean(item.effect);
        const missingEnergy = Math.max(0, window.game.player.maxEnergy - window.game.player.energy);
        const energyValue = Math.max(1, Number(item.effect?.value) || 1);
        const maxUseCount = isEnergyItem
            ? Math.min(item.count, Math.max(1, Math.ceil(missingEnergy / energyValue)))
            : item.count;
        const quantityInputId = `item-batch-count-${item.id}`;

        const modal = new Modal({
            title: item.name,
            content: `
                <div style="text-align:center;display:flex;flex-direction:column;gap:10px;">
                    <div style="font-size:52px;">${this.getItemDetailVisual(item)}</div>
                    <div style="color:${this.getRarityColor(item.rarity)};font-weight:bold;">${item.name}</div>
                    <div style="font-size:13px;line-height:1.6;color:#e2e8f0;">${item.description || '暂无说明'}</div>
                    <div style="font-size:12px;color:#cbd5e1;">数量: ${item.count}</div>
                    ${item.stats ? `<div style="font-size:12px;color:#cbd5e1;">属性: ${this.formatStats(item.stats)}</div>` : ''}
                    ${isEnergyItem ? `<div style="font-size:12px;color:#fbbf24;">使用效果: 每个恢复 ${energyValue} 点体力</div>` : ''}
                    ${canUse && !isHeroExpPotion ? this.getBatchFieldHtml(quantityInputId, maxUseCount, '使用数量', `最多可用 ${maxUseCount} 个`) : ''}
                </div>
            `,
            buttons: [
                ...(canUse ? [{
                    text: '使用',
                    className: 'btn-primary',
                    onClick: () => {
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
