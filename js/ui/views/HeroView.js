/**
 * 英雄管理场景视图
 */
class HeroView {
    constructor() {
        this.element = document.getElementById('main-display');
        this.visible = false;
        this.teamModal = null;
        this.heroDetailModal = null;
        this.activeHeroId = null;
        this.statTooltip = null;
        this.boundOutsideClick = null;
        this.equipmentBubble = null;
    }

    show() {
        this.visible = true;
        this.render();
    }

    hide() {
        this.visible = false;
        this.cleanupStatTooltip();
        this.equipmentBubble = null;
        this.element.innerHTML = '';
    }

    render() {
        this.element.innerHTML = `
            <div class="hero-view">
                <h2 class="hero-view-title">英雄管理</h2>
                <div style="display:flex;justify-content:center;gap:15px;margin-bottom:20px;">
                    <button class="btn btn-secondary" onclick="window.game.ui.heroView.showTeam()">编队</button>
                    <button class="btn btn-secondary" onclick="window.game.ui.heroView.showHeroAlbum()">图鉴</button>
                </div>
                <div class="hero-grid-wrapper">
                    <div id="hero-grid" class="hero-grid"></div>
                </div>
            </div>
        `;
        this.renderHeroes();
    }

    showHeroAlbum() {
        const allHeroConfigs = HeroConfig.getAllHeroes();
        const ownedConfigIds = heroManager.getAllHeroes().map(hero => hero.configId);
        let content = '<div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;max-height:400px;overflow-y:auto;padding:10px;">';
        allHeroConfigs.forEach(heroConfig => {
            const isOwned = ownedConfigIds.includes(heroConfig.id);
            const rarityColor = this.getRarityColor(heroConfig.rarity);
            content += `
                <div class="hero-card card ${isOwned ? '' : 'grayscale'}" style="opacity:${isOwned ? '1' : '0.5'};cursor:default;${isOwned ? '' : 'filter:grayscale(100%);'}">
                    <div class="hero-avatar" style="font-size:32px;">${heroConfig.icon}</div>
                    <div class="hero-name" style="color:${rarityColor}">${heroConfig.name}</div>
                    <div class="hero-level" style="font-size:10px;">${this.getRarityName(heroConfig.rarity)}</div>
                    <div class="hero-stars" style="font-size:10px;color:${isOwned ? '#4caf50' : '#f44336'}">${isOwned ? '已拥有' : '未获得'}</div>
                </div>
            `;
        });
        content += '</div>';
        const modal = new Modal({
            title: '英雄图鉴',
            content,
            buttons: [{ text: '关闭', className: 'btn-secondary', onClick: () => modal.close() }]
        });
        modal.show();
    }

    renderHeroes() {
        const grid = this.element.querySelector('#hero-grid');
        if (!grid) {
            return;
        }
        grid.innerHTML = '';
        const heroes = heroManager.getAllHeroes();
        if (heroes.length === 0) {
            grid.innerHTML = '<div class="hero-grid-empty">暂无英雄，快去招募吧！</div>';
            return;
        }
        heroes.forEach(hero => {
            const card = new HeroCard({
                hero,
                selected: heroManager.isHeroInTeam(hero.id),
                onClick: () => this.onHeroClick(hero)
            });
            card.render(grid);
        });
    }

    onHeroClick(hero) {
        this.activeHeroId = hero.id;
        this.equipmentBubble = null;
        if (this.heroDetailModal && this.heroDetailModal.isShown()) {
            this.updateHeroDetailModal(hero);
            return;
        }

        this.heroDetailModal = new Modal({
            title: hero.name,
            content: this.getHeroDetailContent(hero),
            buttons: [
                { text: '关闭', className: 'btn-secondary', onClick: () => this.closeHeroDetail() }
            ],
            onClose: () => this.closeHeroDetail(false)
        });
        this.heroDetailModal.show();
        this.bindHeroDetailInteractions(hero);
    }

    closeHeroDetail(closeModal = true) {
        this.cleanupStatTooltip();
        this.equipmentBubble = null;
        if (closeModal && this.heroDetailModal) {
            this.heroDetailModal.close();
        }
        this.heroDetailModal = null;
        this.activeHeroId = null;
    }

    getHeroStarMarkup(starLevel, extraClass = '') {
        const starInfo = HeroConfig.getStarDisplayInfo(starLevel);
        return `<div class="hero-stars ${starInfo.className} ${extraClass}" title="${starInfo.label}">${starInfo.text}</div>`;
    }

    getEquipmentSlotMarkup(hero, slot, side) {
        const equipment = hero.equipment[slot];
        const slotName = EquipmentConfig.getSlotName(slot);
        const isBubbleShown = Boolean(equipment && this.equipmentBubble?.heroId === hero.id && this.equipmentBubble?.slot === slot);
        const statText = equipment && equipment.getStatLines().length > 0 ? equipment.getStatLines().join('<br>') : '无额外属性';

        return `
            <div class="hero-equipment-slot hero-equipment-slot-${side}">
                <button type="button" class="hero-equipment-button ${equipment ? 'filled' : 'empty'}" onclick="window.game.ui.heroView.onHeroEquipmentSlotClick('${hero.id}', '${slot}')">
                    <span class="hero-equipment-slot-name">${slotName}</span>
                    <span class="hero-equipment-slot-icon">${equipment ? equipment.icon : '⬜'}</span>
                </button>
                ${isBubbleShown ? `
                    <div class="hero-equipment-popover hero-equipment-popover-${side}">
                        <div class="hero-equipment-popover-name" style="color:${this.getRarityColor(equipment.rarity)};">${equipment.icon} ${equipment.name}</div>
                        <div class="hero-equipment-popover-stats">${statText}</div>
                        <div class="hero-equipment-popover-actions">
                            <button class="btn btn-primary btn-small" onclick="window.game.ui.heroView.showEquipSelection('${hero.id}', '${slot}')">更换</button>
                            <button class="btn btn-danger btn-small" onclick="window.game.ui.heroView.unequipHeroSlot('${hero.id}', '${slot}')">卸下</button>
                            <button class="btn btn-secondary btn-small" onclick="window.game.ui.heroView.closeEquipmentBubble('${hero.id}')">关闭</button>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    getHeroDetailContent(hero) {
        const info = hero.getInfo();
        const starUpgradeInfo = heroManager.canUpgradeStarsWithFragments(hero.id);
        const expRequired = hero.getExpRequired();
        const currentFragments = heroManager.getFragments(hero.configId);
        const starDisplay = info.starInfo || HeroConfig.getStarDisplayInfo(info.stars);
        const statRows = HeroConfig.getDisplayStats().map(statKey => {
            const definition = HeroConfig.getStatDefinition(statKey);
            const value = statKey === 'hp' ? info.stats.maxHp : info.stats[statKey];
            return `
                <div class="hero-stat-row" data-stat-key="${statKey}" role="button" tabindex="0">
                    <span>${definition.name}</span>
                    <strong>${value ?? 0}</strong>
                </div>
            `;
        }).join('');

        const leftSlots = ['weapon', 'pants'].map(slot => this.getEquipmentSlotMarkup(hero, slot, 'left')).join('');
        const rightSlots = ['clothes', 'shoes'].map(slot => this.getEquipmentSlotMarkup(hero, slot, 'right')).join('');
        const starCostHtml = starUpgradeInfo.isMax
            ? `<span style="color:#fbbf24;">已升满</span>（当前 ${currentFragments}）`
            : `<span style="color:${starUpgradeInfo.can ? '#4caf50' : '#f87171'}">${starUpgradeInfo.cost}个碎片</span>（当前 ${currentFragments}）`;

        return `
            <div class="hero-detail-panel">
                <div class="hero-detail-header">
                    <div class="hero-detail-equipment-column">${leftSlots}</div>
                    <div class="hero-detail-main">
                        <div class="hero-detail-avatar">${hero.icon}</div>
                        <div class="hero-detail-name" style="color:${this.getRarityColor(hero.rarity)};">${hero.name}</div>
                        <div class="hero-detail-subtitle">${this.getRarityName(hero.rarity)} · Lv.${info.level}</div>
                        ${this.getHeroStarMarkup(info.stars, 'hero-detail-rank')}
                        <div class="hero-detail-rank-label">当前阶位：${starDisplay.label}</div>
                        <div class="hero-detail-power">战力 ${info.power}</div>
                    </div>
                    <div class="hero-detail-equipment-column">${rightSlots}</div>
                </div>
                <div class="hero-detail-actions">
                    <button class="btn btn-primary" onclick="window.game.ui.heroView.levelUpHero('${hero.id}')">升级</button>
                    <button class="btn btn-primary" onclick="window.game.ui.heroView.upgradeStars('${hero.id}')">升星</button>
                    <button class="btn btn-secondary" onclick="window.game.ui.heroView.showSpecialTraits('${hero.id}')">特技</button>
                </div>
                <div class="hero-exp-progress">经验：${info.exp}/${expRequired}</div>
                <div class="hero-star-cost">升星消耗：${starCostHtml}</div>
                <div class="hero-stat-grid">${statRows}</div>
            </div>
        `;
    }

    bindHeroDetailInteractions(hero) {
        if (!this.heroDetailModal || !this.heroDetailModal.element) {
            return;
        }

        const rows = this.heroDetailModal.element.querySelectorAll('.hero-stat-row[data-stat-key]');
        rows.forEach(row => {
            const openTooltip = event => {
                event.stopPropagation();
                this.showStatTooltip(row, row.dataset.statKey);
            };
            row.addEventListener('click', openTooltip);
            row.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openTooltip(event);
                }
            });
        });

        if (this.boundOutsideClick) {
            document.removeEventListener('click', this.boundOutsideClick, true);
        }
        this.boundOutsideClick = (event) => {
            if (this.statTooltip && !this.statTooltip.contains(event.target) && !event.target.closest('.hero-stat-row[data-stat-key]')) {
                this.hideStatTooltip();
            }
        };
        document.addEventListener('click', this.boundOutsideClick, true);
    }

    showStatTooltip(target, statKey) {
        this.hideStatTooltip();
        const definition = HeroConfig.getStatDefinition(statKey);
        if (!definition) {
            return;
        }

        const tooltip = document.createElement('div');
        tooltip.className = 'hero-stat-tooltip';
        tooltip.innerHTML = `<strong>${definition.name}</strong><div>${definition.description}</div>`;
        document.body.appendChild(tooltip);
        const rect = target.getBoundingClientRect();
        const tooltipWidth = 220;
        const left = Math.max(8, Math.min(window.innerWidth - tooltipWidth - 8, rect.left + window.scrollX));
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${rect.bottom + window.scrollY + 8}px`;
        this.statTooltip = tooltip;
    }

    hideStatTooltip() {
        if (this.statTooltip?.parentNode) {
            this.statTooltip.parentNode.removeChild(this.statTooltip);
        }
        this.statTooltip = null;
    }

    cleanupStatTooltip() {
        this.hideStatTooltip();
        if (this.boundOutsideClick) {
            document.removeEventListener('click', this.boundOutsideClick, true);
            this.boundOutsideClick = null;
        }
    }

    updateHeroDetailModal(hero) {
        if (!this.heroDetailModal || !this.heroDetailModal.isShown()) {
            this.onHeroClick(hero);
            return;
        }
        const bodyEl = this.heroDetailModal.element.querySelector('.modal-body');
        if (bodyEl) {
            bodyEl.innerHTML = this.getHeroDetailContent(hero);
            this.bindHeroDetailInteractions(hero);
        }
        const titleEl = this.heroDetailModal.element.querySelector('.modal-title');
        if (titleEl) {
            titleEl.textContent = hero.name;
        }
    }

    levelUpHero(heroId) {
        const hero = heroManager.getHero(heroId);
        if (!hero) return;
        const result = heroManager.levelUpHero(hero.id);
        if (result) {
            Toast.success(`${hero.name}升级了！`);
            this.render();
            this.updateHeroDetailModal(hero);
        } else {
            Toast.info('当前经验不足');
        }
    }

    upgradeStars(heroId) {
        const hero = heroManager.getHero(heroId);
        if (!hero) return;
        const starInfo = heroManager.canUpgradeStarsWithFragments(hero.id);
        if (starInfo.isMax) {
            Toast.info('当前星阶已升满');
            return;
        }
        if (!starInfo.can) {
            Toast.error(starInfo.message);
            return;
        }
        if (!heroManager.removeFragments(hero.configId, starInfo.cost)) {
            Toast.error('碎片扣除失败');
            return;
        }
        const result = heroManager.upgradeHeroStars(hero.id);
        if (result) {
            this.equipmentBubble = null;
            Toast.success(`${hero.name}升星成功！`);
            this.render();
            this.updateHeroDetailModal(hero);
            window.game.save();
        } else {
            heroManager.addFragments(hero.configId, starInfo.cost);
            Toast.error('星阶已满或条件不足');
        }
    }

    showSpecialTraits(heroId) {
        const hero = heroManager.getHero(heroId);
        if (!hero) {
            return;
        }
        const currentStage = hero.stars;
        const traits = hero.getSpecialTraitStages();
        const content = `
            <div class="hero-trait-panel">
                <div class="hero-trait-intro">当前阶位：${HeroConfig.getStarDisplayInfo(currentStage).label}</div>
                <div class="hero-trait-list">
                    ${traits.map(trait => `
                        <div class="hero-trait-row ${currentStage >= trait.stage ? 'unlocked' : 'locked'}">
                            <div class="hero-trait-stage ${trait.className}">${trait.text}</div>
                            <div class="hero-trait-content">
                                <div class="hero-trait-title">${trait.label}</div>
                                <div class="hero-trait-desc">${trait.description}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        const modal = new Modal({
            title: `${hero.name} · 特技`,
            content,
            buttons: [{ text: '关闭', className: 'btn-secondary', onClick: () => modal.close() }]
        });
        modal.show();
    }

    onHeroEquipmentSlotClick(heroId, slot) {
        const hero = heroManager.getHero(heroId);
        if (!hero) {
            return;
        }
        const equipment = hero.equipment[slot];
        if (!equipment) {
            this.showEquipSelection(heroId, slot);
            return;
        }
        if (this.equipmentBubble?.heroId === heroId && this.equipmentBubble?.slot === slot) {
            this.closeEquipmentBubble(heroId);
            return;
        }
        this.equipmentBubble = { heroId, slot };
        this.updateHeroDetailModal(hero);
    }

    closeEquipmentBubble(heroId = this.activeHeroId) {
        if (!this.equipmentBubble) {
            return;
        }
        this.equipmentBubble = null;
        const hero = heroManager.getHero(heroId);
        if (hero && this.heroDetailModal?.isShown()) {
            this.updateHeroDetailModal(hero);
        }
    }

    showEquipSelection(heroId, slot) {
        const hero = heroManager.getHero(heroId);
        if (!hero) {
            return;
        }
        this.closeEquipmentBubble(heroId);
        const equipments = itemManager.getEquipmentBySlot(slot);
        const currentEquipment = hero.equipment[slot];

        let content = `<div style="display:flex;flex-direction:column;gap:12px;max-height:420px;overflow-y:auto;">`;
        if (currentEquipment) {
            content += `
                <div class="card" style="padding:12px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
                    <div>
                        <div style="font-weight:bold;color:${this.getRarityColor(currentEquipment.rarity)};">当前装备：${currentEquipment.icon} ${currentEquipment.name}</div>
                        <div style="font-size:12px;color:#a0a0a0;">${currentEquipment.getStatLines().join(' / ') || '无额外属性'}</div>
                    </div>
                    <button class="btn btn-danger btn-small" onclick="window.game.ui.heroView.unequipHeroSlot('${heroId}', '${slot}')">卸下</button>
                </div>
            `;
        }

        if (equipments.length === 0) {
            content += '<div style="text-align:center;color:#a0a0a0;padding:20px 0;">背包中没有该部位装备</div>';
        } else {
            equipments.forEach(equipment => {
                content += `
                    <div class="card" style="padding:12px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
                        <div>
                            <div style="font-weight:bold;color:${this.getRarityColor(equipment.rarity)};">${equipment.icon} ${equipment.name}</div>
                            <div style="font-size:12px;color:#a0a0a0;">${equipment.getStatLines().join(' / ') || '无额外属性'}</div>
                        </div>
                        <button class="btn btn-primary btn-small" onclick="window.game.ui.heroView.equipHeroItem('${heroId}', '${equipment.instanceId}')">穿戴</button>
                    </div>
                `;
            });
        }
        content += '</div>';

        const modal = new Modal({
            title: `${hero.name} - ${EquipmentConfig.getSlotName(slot)}`,
            content,
            buttons: [{ text: '关闭', className: 'btn-secondary', onClick: () => modal.close() }]
        });
        modal.show();
    }

    equipHeroItem(heroId, equipmentInstanceId) {
        const result = heroManager.equipToHero(heroId, equipmentInstanceId);
        if (!result.success) {
            Toast.error(result.message);
            return;
        }
        this.equipmentBubble = null;
        Toast.success(`已为${result.hero.name}装备 ${result.equipment.name}`);
        this.render();
        this.updateHeroDetailModal(result.hero);
        window.game.save();
    }

    unequipHeroSlot(heroId, slot) {
        const result = heroManager.unequipFromHero(heroId, slot);
        if (!result.success) {
            Toast.error(result.message);
            return;
        }
        this.equipmentBubble = null;
        Toast.success(`已卸下 ${result.equipment.name}`);
        this.render();
        this.updateHeroDetailModal(result.hero);
        window.game.save();
    }

    showTeam() {
        if (this.teamModal && this.teamModal.isShown()) {
            return;
        }
        this.teamModal = new Modal({
            title: '英雄编队',
            content: this.getTeamModalContent(),
            buttons: [{ text: '关闭', className: 'btn-secondary', onClick: () => { if (this.teamModal) { this.teamModal.close(); this.teamModal = null; } } }]
        });
        this.teamModal.show();
    }

    getTeamModalContent() {
        const heroes = heroManager.getAllHeroes();
        let content = '<div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;">';
        heroes.forEach(hero => {
            const inTeam = heroManager.isHeroInTeam(hero.id);
            const rarityColor = this.getRarityColor(hero.rarity);
            content += `
                <div class="hero-card card ${inTeam ? 'selected' : ''}" style="cursor:pointer;border-color:${rarityColor};" onclick="window.game.ui.heroView.toggleTeam('${hero.id}')">
                    ${inTeam ? '<div class="hero-team-badge">已参战</div>' : ''}
                    <div class="hero-avatar" style="color:${rarityColor};">${hero.icon}</div>
                    <div class="hero-name" style="color:${rarityColor};">${hero.name}</div>
                    <div class="hero-level">Lv.${hero.level}</div>
                    ${this.getHeroStarMarkup(hero.stars, 'hero-team-stars')}
                    <div class="hero-power">战力:${hero.getPower()}</div>
                </div>
            `;
        });
        content += '</div>';
        return content;
    }

    toggleTeam(heroId) {
        const hero = heroManager.getHero(heroId);
        if (!hero) {
            return;
        }
        if (heroManager.isHeroInTeam(heroId)) {
            heroManager.removeFromTeam(heroId);
            Toast.info('已取消参战');
        } else {
            const success = heroManager.addToTeam(heroId);
            if (success) {
                Toast.info('已设为参战');
            } else {
                Toast.error('参战队伍已满');
            }
        }
        if (this.visible) {
            this.renderHeroes();
        }
        this.updateTeamModal();
        window.game.save();
    }

    updateTeamModal() {
        if (!this.teamModal || !this.teamModal.isShown()) {
            return;
        }
        const bodyEl = this.teamModal.element.querySelector('.modal-body');
        if (bodyEl) {
            bodyEl.innerHTML = this.getTeamModalContent();
        }
    }

    getRarityColor(rarity) {
        return GameConfig.getRarityConfig(rarity || 'common').color;
    }

    getRarityName(rarity) {
        return GameConfig.getRarityConfig(rarity || 'common').name;
    }

    refresh() {
        if (this.visible) {
            this.render();
        }
        if (this.activeHeroId) {
            const hero = heroManager.getHero(this.activeHeroId);
            if (hero) {
                this.updateHeroDetailModal(hero);
            }
        }
    }
}

const heroView = new HeroView();
window.heroView = heroView;
