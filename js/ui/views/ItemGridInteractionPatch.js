(function() {
    if (typeof ItemGrid === 'undefined' || !window.itemGrid) {
        return;
    }

    ItemGrid.prototype.onItemClick = function(item) {
        if (item.type === 'fragment') {
            if (typeof this.showHeroFragmentDetail === 'function') {
                this.showHeroFragmentDetail(item);
            }
            return;
        }

        if (item.type === 'resource') {
            this.showResourceDetail(item);
            return;
        }

        if (item.type === 'equipment') {
            this.showEquipmentDetail(item);
            return;
        }

        this.showItemDetail(item);
    };

    ItemGrid.prototype.getItemDetailVisual = function(item) {
        const starBadge = item?.type === 'equipment' && typeof item.getStarBadgeMarkup === 'function'
            ? item.getStarBadgeMarkup()
            : '';
        if (item.iconSrc) {
            return `<span class="equipment-icon-with-star">${starBadge}<img class="resource-icon-image item-icon-image" src="${item.iconSrc}" alt="${item.name}"></span>`;
        }
        return `<span class="equipment-icon-with-star equipment-icon-text">${starBadge}${item.icon || '📦'}</span>`;
    };

    ItemGrid.prototype.showResourceDetail = function(item) {
        const totalCount = item.totalCount || item.count || 0;
        const canUseMeat = item.id === 'meat' && totalCount > 0 && window.game.player.energy < window.game.player.maxEnergy;

        const modal = new Modal({
            title: item.name,
            content: `
                <div style="text-align:center;display:flex;flex-direction:column;gap:10px;">
                    <div style="font-size:52px;">${this.getItemDetailVisual(item)}</div>
                    <div style="color:${this.getRarityColor(item.rarity)};font-weight:bold;">${item.name}</div>
                    <div>${item.description || ''}</div>
                    <div>数量: ${totalCount}</div>
                    ${item.id === 'meat' ? '<div style="font-size:12px;color:#cbd5e1;">使用效果：1 个肉类恢复 1 点体力</div>' : ''}
                </div>
            `,
            buttons: [
                ...(item.id === 'meat' ? [{
                    text: '使用',
                    className: 'btn-primary',
                    disabled: !canUseMeat,
                    onClick: () => {
                        const result = this.useMeatResource(1);
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

    ItemGrid.prototype.useMeatResource = function(count = 1) {
        const quantity = Math.max(1, Number(count) || 1);
        const owned = shelterManager.getResource('meat');
        if (owned < quantity) {
            return { success: false, message: '肉类数量不足' };
        }
        if (window.game.player.energy >= window.game.player.maxEnergy) {
            return { success: false, message: '体力已满' };
        }

        const recovered = Math.min(quantity, window.game.player.maxEnergy - window.game.player.energy);
        if (!shelterManager.consumeResource('meat', recovered)) {
            return { success: false, message: '肉类数量不足' };
        }

        window.game.player.energy = Math.min(window.game.player.maxEnergy, window.game.player.energy + recovered);
        eventManager.emit('playerUpdate', {
            energy: window.game.player.energy,
            maxEnergy: window.game.player.maxEnergy
        });

        return { success: true, message: `恢复 ${recovered} 点体力` };
    };

    ItemGrid.prototype.showItemDetail = function(item) {
        const isHeroExpPotion = item.effect?.type === 'hero_exp';
        const canUse = Boolean(item.effect);
        const modal = new Modal({
            title: item.name,
            content: `
                <div style="text-align:center;display:flex;flex-direction:column;gap:10px;">
                    <div style="font-size:52px;">${this.getItemDetailVisual(item)}</div>
                    <div style="color:${this.getRarityColor(item.rarity)};font-weight:bold;">${item.name}</div>
                    <div>${item.description || ''}</div>
                    <div>数量: ${item.count}</div>
                    ${item.stats ? `<div style="font-size:12px;color:#cbd5e1;">属性: ${this.formatStats(item.stats)}</div>` : ''}
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
                }] : []),
                { text: '关闭', className: 'btn-secondary', onClick: () => modal.close() }
            ]
        });
        modal.show();
    };
})();
