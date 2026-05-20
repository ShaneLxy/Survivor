/**
 * 统一奖励弹窗组件
 *
 * 说明：
 * 1. 所有“获得奖励”的业务入口，都应该尽量先把奖励整理成统一结构后再交给本组件展示。
 * 2. 本组件负责：5x8 分页展示、顺序出场动画、点击任意位置跳过动画、点击奖励查看详情、确认后关闭。
 * 3. 底层 addItem/addResource/addFragments 这类方法只负责入账，不应在底层自动弹奖励框。
 *    后续新增玩法时，推荐在业务入口层调用 RewardModal.show(...)。
 */
class RewardModal {
    constructor(config) {
        this.config = {
            title: '获得奖励',
            rewards: [],
            summaryText: '',
            confirmText: '确认',
            secondaryActionText: '',
            pageSize: 40,
            revealDelay: Math.max(80, Math.min(180, Number(GameConfig?.ui?.animations?.gachaDelay) || 120)),
            onConfirm: null,
            onSecondaryAction: null,

            ...config
        };

        this.rewards = Array.isArray(this.config.rewards) ? this.config.rewards.filter(Boolean) : [];
        this.currentPage = 1;
        this.revealedCount = 0;
        this.lastAnimatedIndex = -1;
        this.animating = false;
        this.skipRequested = false;
        this.pendingWait = null;
        this.pagination = null;
        this.modal = null;
        this.root = null;
        this.gridElement = null;
        this.summaryElement = null;
        this.statusElement = null;
        this.hintElement = null;
        this.confirmButton = null;
        this.secondaryButton = null;

        this.resolvePromise = null;
        this.boundSkipListener = null;
    }

    static async show(config) {
        if (!config?.skipRareReveal && window.RareRewardReveal) {
            await window.RareRewardReveal.playSequence(config?.rewards || []);
        }
        const modal = new RewardModal(config);
        return modal.show();
    }

    async show() {
        return new Promise((resolve) => {
            this.resolvePromise = resolve;
            this.create();
            RewardModal.activeInstances.add(this);
            this.modal.show();
            this.renderPage();
            this.startRevealAnimation();
        });
    }

    static closeActive(result = 'confirm') {
        [...RewardModal.activeInstances].forEach((instance) => {
            instance.forceClose?.(result);
        });
    }

    create() {
        this.root = document.createElement('div');
        this.root.className = 'reward-modal';

        const headerMeta = document.createElement('div');
        headerMeta.className = 'reward-modal-meta';

        if (this.config.summaryText) {
            this.summaryElement = document.createElement('div');
            this.summaryElement.className = 'reward-modal-summary';
            this.summaryElement.textContent = this.config.summaryText;
            headerMeta.appendChild(this.summaryElement);
        }

        this.statusElement = document.createElement('div');
        this.statusElement.className = 'reward-modal-status';
        headerMeta.appendChild(this.statusElement);
        this.root.appendChild(headerMeta);

        this.hintElement = document.createElement('div');
        this.hintElement.className = 'reward-modal-hint';
        this.root.appendChild(this.hintElement);


        this.gridElement = document.createElement('div');
        this.gridElement.className = 'reward-modal-grid';
        this.root.appendChild(this.gridElement);

        const paginationContainer = document.createElement('div');
        paginationContainer.className = 'reward-modal-pagination';
        this.root.appendChild(paginationContainer);

        const totalPages = this.getTotalPages();
        if (totalPages > 1) {
            this.pagination = new Pagination({
                currentPage: this.currentPage,
                totalPages,
                onPageChange: (page) => {
                    this.currentPage = page;
                    this.renderPage();
                    this.updateStatus();
                }

            });
            this.pagination.render(paginationContainer);
        } else {
            paginationContainer.innerHTML = '<span class="pagination-info">1/1</span>';
        }

        const footer = document.createElement('div');
        footer.className = 'reward-modal-actions';

        this.confirmButton = document.createElement('button');
        this.confirmButton.className = 'btn btn-primary reward-modal-confirm';
        this.confirmButton.textContent = this.config.confirmText;
        this.confirmButton.disabled = true;
        this.confirmButton.addEventListener('click', () => this.handleConfirm());
        footer.appendChild(this.confirmButton);

        if (this.config.secondaryActionText) {
            this.secondaryButton = document.createElement('button');
            this.secondaryButton.className = 'btn btn-secondary reward-modal-secondary-action';
            this.secondaryButton.textContent = this.config.secondaryActionText;
            this.secondaryButton.disabled = true;
            this.secondaryButton.addEventListener('click', () => this.handleSecondaryAction());
            footer.appendChild(this.secondaryButton);
        }

        this.root.appendChild(footer);

        this.modal = new Modal({
            title: this.config.title,
            content: this.root,
            showClose: false,
            onClose: () => this.cleanup()
        });

        this.modal.create();
        if (this.modal.element) {
            this.modal.element.classList.add('reward-modal-shell');
        }

        this.bindSkipHandlers();
        this.updateStatus();
        this.updateHint();

    }

    bindSkipHandlers() {
        this.boundSkipListener = (event) => {
            if (!this.animating) {
                return;
            }

            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }

            this.skipAnimation();
        };

        if (this.modal.overlay) {
            this.modal.overlay.addEventListener('click', this.boundSkipListener, true);
            this.modal.overlay.addEventListener('touchstart', this.boundSkipListener, true);
        }
    }

    getTotalPages() {
        return Math.max(1, Math.ceil(this.rewards.length / this.config.pageSize));
    }

    getCurrentPageRewards() {
        const start = (this.currentPage - 1) * this.config.pageSize;
        return this.rewards.slice(start, start + this.config.pageSize);
    }

    getPageForIndex(index) {
        return Math.max(1, Math.floor(index / this.config.pageSize) + 1);
    }

    syncPaginationUI() {
        if (!this.pagination) {
            return;
        }

        this.pagination.config.currentPage = this.currentPage;
        this.pagination.updateUI();
    }

    updateStatus() {
        if (!this.statusElement) {
            return;
        }

        const totalPages = this.getTotalPages();
        const start = (this.currentPage - 1) * this.config.pageSize;
        const pageRewards = this.getCurrentPageRewards();
        const end = pageRewards.length > 0 ? start + pageRewards.length : start;
        const revealed = Math.min(this.revealedCount, this.rewards.length);

        this.statusElement.textContent = `第${this.currentPage}/${totalPages}页 · 已揭晓${revealed}/${this.rewards.length} · 当前页${pageRewards.length > 0 ? `${start + 1}-${end}` : '0'}`;
    }

    renderPage() {

        if (!this.gridElement) {
            return;
        }

        this.gridElement.innerHTML = '';
        const startIndex = (this.currentPage - 1) * this.config.pageSize;
        const pageRewards = this.getCurrentPageRewards();
        const columnCount = Math.max(1, Math.min(pageRewards.length, 8));
        this.gridElement.style.setProperty('--reward-grid-columns', String(columnCount));

        if (pageRewards.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'reward-modal-empty';
            empty.textContent = '本次没有可展示的奖励';
            this.gridElement.appendChild(empty);
            this.updateStatus();
            return;
        }

        pageRewards.forEach((reward, index) => {
            const globalIndex = startIndex + index;
            const itemElement = this.createRewardElement(reward, globalIndex);
            this.gridElement.appendChild(itemElement);
        });

        this.updateStatus();
    }


    createRewardElement(reward, index) {
        const rarityColor = RewardModal.getRarityColor(reward.rarity);
        const isVisible = index < this.revealedCount;
        const shouldAnimate = isVisible && !this.skipRequested && index === this.lastAnimatedIndex;

        const cell = document.createElement('div');
        cell.className = 'reward-item-slot card';
        if (isVisible) {
            cell.classList.add('is-visible');
        }
        if (shouldAnimate) {
            cell.classList.add('revealed');
        }
        cell.style.setProperty('--reward-rarity-color', rarityColor);
        cell.style.borderColor = rarityColor;
        cell.dataset.index = String(index);
        cell.title = `${reward.name || '未知奖励'} x${reward.count || 1}`;


        const icon = document.createElement('div');
        icon.className = 'reward-item-icon';
        icon.innerHTML = RewardModal.renderIconMarkup(reward, {
            fallbackText: reward.icon || '馃摝',
            imageClass: 'reward-item-icon-image'
        });
        if (!reward.iconSrc) {
            icon.style.color = rarityColor;
        }
        cell.appendChild(icon);

        const name = document.createElement('div');
        name.className = 'reward-item-name';
        name.textContent = reward.name || '未知奖励';
        name.style.color = rarityColor;
        cell.appendChild(name);

        const count = document.createElement('div');
        count.className = 'reward-item-count';
        count.textContent = `x${reward.count || 1}`;
        cell.appendChild(count);

        cell.addEventListener('click', (event) => {
            event.stopPropagation();
            if (this.animating) {
                this.skipAnimation();
                return;
            }
            this.showRewardDetail(reward);
        });

        return cell;
    }

    async startRevealAnimation() {
        if (this.rewards.length === 0) {
            this.finishAnimation();
            return;
        }

        this.animating = true;
        this.skipRequested = false;
        this.confirmButton.disabled = true;
        if (this.secondaryButton) {
            this.secondaryButton.disabled = true;
        }
        this.updateHint();

        for (let i = this.revealedCount; i < this.rewards.length; i++) {
            if (this.skipRequested) {
                break;
            }

            this.revealedCount = i + 1;
            this.lastAnimatedIndex = i;
            const targetPage = this.getPageForIndex(i);
            if (targetPage !== this.currentPage) {
                this.currentPage = targetPage;
                this.syncPaginationUI();
            }
            this.renderPage();

            if (i < this.rewards.length - 1) {
                await this.waitForNextReveal();
            }
        }

        if (this.skipRequested) {
            this.revealedCount = this.rewards.length;
            this.lastAnimatedIndex = -1;
            this.renderPage();
        }

        this.finishAnimation();
    }


    waitForNextReveal() {
        return new Promise((resolve) => {
            const timeoutId = window.setTimeout(() => {
                this.pendingWait = null;
                resolve();
            }, this.config.revealDelay);

            this.pendingWait = {
                timeoutId,
                resolve
            };
        });
    }

    skipAnimation() {
        if (!this.animating) {
            return;
        }

        this.skipRequested = true;
        this.updateHint();
        if (this.pendingWait) {
            clearTimeout(this.pendingWait.timeoutId);
            const resolver = this.pendingWait.resolve;
            this.pendingWait = null;
            resolver();
        }
    }

    finishAnimation() {
        this.animating = false;
        this.skipRequested = false;
        this.lastAnimatedIndex = -1;
        this.confirmButton.disabled = false;
        if (this.secondaryButton) {
            this.secondaryButton.disabled = false;
        }
        this.updateStatus();
        this.updateHint();
    }

    updateHint() {
        if (!this.hintElement) {
            return;
        }

        if (this.confirmButton) {
            this.confirmButton.textContent = this.animating
                ? (this.skipRequested ? '快速展开中...' : '展示中...')
                : this.config.confirmText;
        }

        if (this.skipRequested) {
            this.hintElement.textContent = '正在快速展开全部奖励，请稍候';
        } else if (this.animating) {
            this.hintElement.textContent = '奖励展示中，点击任意位置可立即展开全部奖励';
        } else if (this.secondaryButton) {
            this.hintElement.textContent = '点击奖励图标可查看简介，确认或继续进行同一次操作';
        } else {
            this.hintElement.textContent = '点击奖励图标可查看简介，翻页浏览后点击下方确认关闭';
        }
    }

    closeWithResult(result) {
        if (this.modal) {
            this.modal.close();
        }

        if (this.resolvePromise) {
            this.resolvePromise(result);
            this.resolvePromise = null;
        }
    }

    forceClose(result = 'confirm') {
        this.skipRequested = true;
        this.animating = false;
        if (this.pendingWait) {
            clearTimeout(this.pendingWait.timeoutId);
            const resolver = this.pendingWait.resolve;
            this.pendingWait = null;
            resolver?.();
        }
        this.closeWithResult(result);
    }

    async handleConfirm() {
        if (this.animating) {
            this.skipAnimation();
            return;
        }

        if (typeof this.config.onConfirm === 'function') {
            try {
                await this.config.onConfirm();
            } catch (error) {
                console.error('[RewardModal] onConfirm error:', error);
            }
        }

        this.closeWithResult('confirm');
    }

    async handleSecondaryAction() {
        if (this.animating) {
            this.skipAnimation();
            return;
        }

        if (this.confirmButton) {
            this.confirmButton.disabled = true;
        }
        if (this.secondaryButton) {
            this.secondaryButton.disabled = true;
        }

        if (typeof this.config.onSecondaryAction === 'function') {
            try {
                await this.config.onSecondaryAction();
            } catch (error) {
                console.error('[RewardModal] onSecondaryAction error:', error);
            }
        }

        this.closeWithResult('secondary');
    }

    showRewardDetail(reward) {
        const rarityColor = RewardModal.getRarityColor(reward.rarity);
        const content = document.createElement('div');
        content.className = 'reward-detail';
        content.style.setProperty('--reward-rarity-color', rarityColor);

        const icon = document.createElement('div');
        icon.className = 'reward-detail-icon';
        icon.innerHTML = RewardModal.renderIconMarkup(reward, {
            fallbackText: reward.icon || '馃摝',
            imageClass: 'reward-detail-icon-image'
        });
        if (!reward.iconSrc) {
            icon.style.color = rarityColor;
        }
        content.appendChild(icon);

        const badges = document.createElement('div');
        badges.className = 'reward-detail-badges';

        const rarityBadge = document.createElement('span');
        rarityBadge.className = 'reward-detail-badge';
        rarityBadge.style.borderColor = rarityColor;
        rarityBadge.style.color = rarityColor;
        rarityBadge.textContent = RewardModal.getRarityName(reward.rarity);
        badges.appendChild(rarityBadge);

        const typeBadge = document.createElement('span');
        typeBadge.className = 'reward-detail-badge reward-detail-badge-muted';
        typeBadge.textContent = reward.detailTypeLabel || '奖励';
        badges.appendChild(typeBadge);

        content.appendChild(badges);

        const count = document.createElement('div');
        count.className = 'reward-detail-count';
        count.textContent = `数量 x${reward.count || 1}`;
        content.appendChild(count);

        const description = document.createElement('p');
        description.className = 'reward-detail-description';
        description.textContent = reward.description || '暂无说明';
        content.appendChild(description);

        const modal = new Modal({
            title: reward.name || '奖励详情',
            content,
            className: 'reward-detail-modal-shell',
            buttons: [{
                text: '关闭',
                className: 'btn-secondary',
                onClick: () => modal.close()
            }]
        });
        modal.show();
        modal.element?.style.setProperty('--reward-rarity-color', rarityColor);

        const titleElement = modal.element?.querySelector('.modal-title');
        if (titleElement) {
            titleElement.style.color = rarityColor;
        }
    }


    cleanup() {
        RewardModal.activeInstances.delete(this);
        if (this.pendingWait) {
            clearTimeout(this.pendingWait.timeoutId);
            this.pendingWait = null;
        }

        if (this.modal && this.modal.overlay && this.boundSkipListener) {
            this.modal.overlay.removeEventListener('click', this.boundSkipListener, true);
            this.modal.overlay.removeEventListener('touchstart', this.boundSkipListener, true);
        }

        if (this.pagination) {
            this.pagination.destroy();
            this.pagination = null;
        }

        this.boundSkipListener = null;
    }

    static createResourceReward(resourceId, count, extra = {}) {
        const resourceInfo = (typeof shelterManager !== 'undefined' && shelterManager && typeof shelterManager.getResourceInfo === 'function')
            ? shelterManager.getResourceInfo(resourceId)
            : RewardModal.getFallbackResourceInfo(resourceId);


        return {
            type: 'resource',
            id: resourceId,
            name: resourceInfo.name,
            icon: resourceInfo.icon,
            iconSrc: resourceInfo.iconSrc || null,
            count: Math.max(0, Number(count) || 0),
            rarity: resourceInfo.rarity || 'common',
            description: resourceInfo.description || '基础资源',
            detailTypeLabel: '资源',
            detailExtra: resourceInfo.detailExtra || [],
            ...extra
        };
    }

    static createItemReward(itemId, count, extra = {}) {
        const itemConfig = ItemConfig.getItemConfig(itemId);
        if (!itemConfig) {
            return {
                type: 'item',
                id: itemId,
                name: itemId,
                icon: '馃摝',
                count: Math.max(0, Number(count) || 0),
                rarity: 'common',
                description: '未知道具',
                detailTypeLabel: '道具',
                detailExtra: [],
                ...extra
            };
        }

        const detailExtra = [];
        const effectText = RewardModal.formatEffect(itemConfig.effect);
        const statsText = RewardModal.formatStats(itemConfig.stats);
        if (effectText) detailExtra.push(`效果：${effectText}`);
        if (statsText) detailExtra.push(`属性：${statsText}`);

        return {
            type: 'item',
            id: itemId,
            name: itemConfig.name,
            icon: itemConfig.icon,
            iconSrc: itemConfig.iconSrc || null,
            count: Math.max(0, Number(count) || 0),
            rarity: itemConfig.rarity || 'common',
            description: itemConfig.description || '暂无说明',
            detailTypeLabel: '道具',
            detailExtra,
            ...extra
        };
    }

    static createHeroReward(heroConfigId, extra = {}) {
        const heroConfig = HeroConfig.getHeroConfig(heroConfigId);
        if (!heroConfig) {
            return {
                type: 'hero',
                id: heroConfigId,
                name: '未知英雄',
                icon: '馃',
                count: 1,
                rarity: 'common',
                description: '新英雄已加入队伍',
                detailTypeLabel: '英雄',
                detailExtra: [],
                ...extra
            };
        }

        const detailExtra = [];
        if (heroConfig.skill) {
            detailExtra.push(`技能：${heroConfig.skill.name}`);
            detailExtra.push(heroConfig.skill.description);
        }

        return {
            type: 'hero',
            id: heroConfig.id,
            name: heroConfig.name,
            icon: heroConfig.icon,
            iconSrc: heroConfig.cardPortrait || heroConfig.portrait || null,
            count: 1,
            rarity: heroConfig.rarity || 'common',
            description: '新英雄已加入你的英雄列表',
            detailTypeLabel: '英雄',
            detailExtra,
            ...extra
        };
    }

    static createFragmentReward(heroConfigId, count, extra = {}) {
        const heroConfig = HeroConfig.getHeroConfig(heroConfigId);
        if (!heroConfig) {
            return {
                type: 'fragment',
                id: heroConfigId,
                name: '未知英雄碎片',
                icon: '馃З',
                iconSrc: null,
                count: Math.max(0, Number(count) || 0),
                rarity: 'common',
                description: '用于升星或后续合成英雄',
                detailTypeLabel: '英雄碎片',
                detailExtra: [],
                ...extra
            };
        }

        const detailExtra = [
            `对应英雄：${heroConfig.name}`,
            '用途：用于英雄升星，后续也可用于英雄合成'
        ];
        if (heroConfig.skill) {
            detailExtra.push(`英雄技能：${heroConfig.skill.name}`);
            detailExtra.push(heroConfig.skill.description);
        }

        return {
            type: 'fragment',
            id: `${heroConfig.id}_fragment`,
            name: `${heroConfig.name}碎片`,
            icon: heroConfig.icon || '❓',
            iconSrc: heroConfig.cardPortrait || heroConfig.portrait || null,
            count: Math.max(0, Number(count) || 0),
            rarity: heroConfig.rarity || 'common',
            description: `收集后可用于强化 ${heroConfig.name}`,
            detailTypeLabel: '英雄碎片',
            detailExtra,
            ...extra
        };
    }

    static createEquipmentReward(equipment, extra = {}) {
        const resolvedEquipment = equipment instanceof Equipment ? equipment : Equipment.fromSaveData(equipment);
        if (!resolvedEquipment) {
            return {
                type: 'equipment',
                id: 'unknown_equipment',
                name: '未知装备',
                icon: '馃摝',
                count: 1,
                rarity: 'common',
                description: '随机打造获得的装备',
                detailTypeLabel: '装备',
                detailExtra: [],
                ...extra
            };
        }

        return {
            type: 'equipment',
            id: resolvedEquipment.instanceId || resolvedEquipment.templateId,
            name: resolvedEquipment.name,
            icon: resolvedEquipment.icon,
            iconSrc: resolvedEquipment.iconSrc || null,
            count: 1,
            rarity: resolvedEquipment.rarity || 'common',
            description: resolvedEquipment.description || '随机打造获得的装备',
            detailTypeLabel: '装备',
            detailExtra: [
                `部位：${EquipmentConfig.getSlotName(resolvedEquipment.slot)}`,
                `品质：${EquipmentConfig.getRarityName(resolvedEquipment.rarity)}`,
                ...(typeof resolvedEquipment.getStatLines === 'function' ? resolvedEquipment.getStatLines() : [])
            ],
            ...extra
        };
    }

    static createVirtualReward(config) {

        return {
            type: 'virtual',
            id: config.id || 'virtual_reward',
            name: config.name || '奖励',
            icon: config.icon || '✨',
            count: Math.max(0, Number(config.count) || 0),
            rarity: config.rarity || 'common',
            description: config.description || '特殊奖励',
            detailTypeLabel: config.detailTypeLabel || '特殊奖励',
            detailExtra: Array.isArray(config.detailExtra) ? config.detailExtra : [],
            ...config
        };
    }

    static getFallbackResourceInfo(resourceId) {
        const getIconSrc = (id) => (typeof ResourceVisualConfig !== 'undefined' ? ResourceVisualConfig.get(id)?.src : '') || '';
        const map = {
            gold: { name: '金币', icon: 'G', iconSrc: getIconSrc('gold'), rarity: 'common', description: '通用货币，可用于招募、商城购买和建筑发展' },
            wood: { name: '木材', icon: 'W', iconSrc: getIconSrc('wood'), rarity: 'common', description: '避难所建设的基础材料之一' },
            stone: { name: '石材', icon: 'S', iconSrc: getIconSrc('stone'), rarity: 'common', description: '避难所建设的基础材料之一' },
            meat: { name: '肉类', icon: 'M', iconSrc: getIconSrc('meat'), rarity: 'common', description: '重要食物资源，可维持生存' },
            iron_ore: { name: '铁矿石', icon: 'I', iconSrc: getIconSrc('iron_ore'), rarity: 'rare', description: '装备强化的重要材料' },
            water: { name: '水源', icon: '💧', rarity: 'common', description: '旧版本资源，仅用于兼容历史存档' },
            diamond: { name: '钻石', icon: 'D', iconSrc: getIconSrc('diamond'), rarity: 'epic', description: '高价值稀有货币' }
        };

        return map[resourceId] || {
            name: resourceId,
            icon: '馃摝',
            rarity: 'common',
            description: '基础资源'
        };
    }

    static getRarityColor(rarity) {
        return GameConfig.getRarityConfig(rarity || 'common').color;
    }

    static renderIconMarkup(reward, options = {}) {
        const fallbackText = options.fallbackText || reward?.icon || '馃摝';
        const imageClass = options.imageClass || 'reward-icon-image';
        if (reward?.iconSrc) {
            const alt = reward?.name || 'reward';
            return `<img class="${imageClass}" src="${reward.iconSrc}" alt="${alt}">`;
        }
        return fallbackText;
    }

    static getRarityName(rarity) {
        return GameConfig.getRarityConfig(rarity || 'common').name;
    }

    static formatEffect(effect) {
        if (!effect || !effect.type) {
            return '';
        }

        switch (effect.type) {
            case 'heal':
                return `恢复 ${effect.value} 点生命`;
            case 'energy':
                return `恢复 ${effect.value} 点体力`;
            case 'gacha':
                return effect.poolId === 'equipment_pool'
                    ? `可进行${effect.count || 1}次装备打造`
                    : `可进行${effect.count || 1}次英雄招募`;
            default:
                return '';
        }
    }

    static formatStats(stats) {
        if (!stats) {
            return '';
        }

        const lines = [];
        const labelMap = {
            hp: '生命',
            attack: '攻击',
            defense: '防御',
            speed: '速度',
            crit: '暴击',
            antiCrit: '抗暴',
            defensePen: '破防',
            accuracy: '命中率',
            dodge: '闪避率',
            attackRange: '攻击距离',
            moveRange: '移动距离'
        };
        Object.entries(stats).forEach(([key, value]) => {
            if (Number(value) !== 0) {
                lines.push(`${labelMap[key] || key}+${value}`);
            }
        });
        return lines.join('，');

    }
}

RewardModal.activeInstances = new Set();
window.RewardModal = RewardModal;
