/**
 * 英雄管理场景视图
 */
class HeroView {
    constructor() {
        this.element = document.getElementById('main-display');
        this.visible = false;
        this.teamModal = null;
        this.heroDetailModal = null;
        this.fragmentDetailModal = null;
        this.equipmentSelectionModal = null;
        this.activeHeroId = null;
        this.statTooltip = null;
        this.boundOutsideClick = null;
        this.equipmentBubble = null;
        this.professionFilter = 'all';
        this.activePanel = 'home';
    }

    show() {
        this.visible = true;
        this.render();
    }

    hide() {
        this.visible = false;
        this.cleanupStatTooltip();
        this.closeHeroPreview();
        this.equipmentBubble = null;
        this.activePanel = 'home';
        this.syncHeroSubpageMode(false);
        this.element.innerHTML = '';
    }

    resolveAssetUrl(path) {
        if (!path) {
            return '';
        }
        return window.VersionManager?.getVersionedAssetUrl?.(path) || path;
    }

    resolveAbsoluteAssetUrl(path) {
        const resolved = this.resolveAssetUrl(path);
        if (!resolved) {
            return '';
        }

        try {
            return new URL(resolved, window.location.href).toString();
        } catch (error) {
            return resolved;
        }
    }

    getHeroUiStyle() {
        const actionEmblem = this.resolveAbsoluteAssetUrl('assets/media/recruit/emblem_action.png');
        return `style="--hero-command-action-emblem: url('${actionEmblem}');"`;
    }

    render() {
        if (this.activePanel === 'album') {
            this.renderHeroAlbumPage();
            return;
        }
        if (this.activePanel === 'team') {
            this.renderTeamPage();
            return;
        }

        this.syncHeroSubpageMode(false);
        const allHeroes = heroManager.getAllHeroes();
        const teamCount = allHeroes.filter(hero => heroManager.isHeroInTeam(hero.id)).length;
        this.element.innerHTML = `
            <div class="hero-view" ${this.getHeroUiStyle()}>
                <div class="hero-stage-header">
                    <div class="hero-stage-heading-row">
                        <div class="hero-stage-heading-group">
                            <div class="hero-stage-kicker">HERO COMMAND</div>
                            <h2 class="hero-view-title">英雄管理</h2>
                        </div>
                        <div class="hero-stage-stats">
                            <div class="hero-stage-stat">
                                <span class="hero-stage-stat-label">已收编</span>
                                <strong class="hero-stage-stat-value">${allHeroes.length}</strong>
                            </div>
                            <div class="hero-stage-stat">
                                <span class="hero-stage-stat-label">出战中</span>
                                <strong class="hero-stage-stat-value">${teamCount}</strong>
                            </div>
                            <div class="hero-view-team-power hero-stage-stat hero-stage-stat-power" id="hero-team-power">
                                <span class="hero-view-team-power-label">总战力</span>
                                <span class="hero-view-team-power-value">${this.formatPower(heroManager.getTeamPower())}</span>
                            </div>
                        </div>
                    </div>
                    <div class="hero-stage-subtitle">整备幸存者小队，筛选职业、查看图鉴，并调整出战编队。</div>
                </div>
                <div class="hero-toolbar hero-command-toolbar">
                    ${this.renderProfessionTabs()}
                    <div class="hero-command-actions">
                        <button class="hero-command-action" type="button" onclick="window.game.ui.heroView.showHeroAlbum()">
                            <span class="hero-command-action-icon" aria-hidden="true"></span>
                            <span>图鉴</span>
                        </button>
                        <button class="hero-command-action hero-command-action-primary" type="button" onclick="window.game.ui.heroView.showTeam()">
                            <span class="hero-command-action-icon" aria-hidden="true"></span>
                            <span>编队</span>
                        </button>
                    </div>
                </div>
                <div class="hero-grid-wrapper">
                    <div id="hero-grid" class="hero-grid"></div>
                </div>
            </div>
        `;
        this.renderHeroes();
    }

    syncHeroSubpageMode(enabled) {
        document.getElementById('app')?.classList.toggle('hero-subpage-mode', Boolean(enabled));
    }

    openHeroPanel(panel) {
        this.cleanupStatTooltip();
        this.equipmentBubble = null;
        this.closeEquipmentSelectionModal();
        if (this.heroDetailModal?.isShown()) {
            this.closeHeroDetail();
        }
        this.activePanel = panel || 'home';
        if (this.visible) {
            this.render();
        }
    }

    showHeroHome() {
        this.activePanel = 'home';
        if (this.visible) {
            this.render();
        } else {
            this.syncHeroSubpageMode(false);
        }
    }

    renderHeroSecondaryPage({ panelClass = '', body = '' }) {
        this.syncHeroSubpageMode(true);
        this.element.innerHTML = `
            <div class="hero-view hero-view-secondary ${panelClass}" ${this.getHeroUiStyle()}>
                <div class="hero-secondary-body">
                    ${body}
                </div>
            </div>
        `;
    }

    renderHeroAlbumPage() {
        this.renderHeroSecondaryPage({
            panelClass: 'hero-album-page',
            body: this.getHeroAlbumModalContent()
        });
        this.bindHeroAlbumCardEvents();
    }

    bindHeroAlbumCardEvents() {
        const grid = this.element.querySelector('.hero-album-grid');
        if (!grid) return;
        grid.addEventListener('click', (event) => {
            const card = event.target.closest('.hero-album-card[data-hero-config-id]');
            if (!card) return;
            this.showHeroPreview(card.dataset.heroConfigId);
        });
        grid.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            const card = event.target.closest('.hero-album-card[data-hero-config-id]');
            if (!card) return;
            event.preventDefault();
            this.showHeroPreview(card.dataset.heroConfigId);
        });
    }

    renderTeamPage() {
        this.renderHeroSecondaryPage({
            panelClass: 'hero-team-page',
            body: this.getTeamModalContent()
        });
    }

    formatPower(value) {
        return GameConfig.formatCombatPower(value);
    }

    updateTeamPowerDisplay() {
        const powerElement = this.element.querySelector('#hero-team-power .hero-view-team-power-value');
        if (!powerElement) {
            return;
        }
        powerElement.textContent = this.formatPower(heroManager.getTeamPower());
        powerElement.classList.remove('is-power-pulse');
        void powerElement.offsetWidth;
        powerElement.classList.add('is-power-pulse');
    }

    getProfessionFilterOptions() {
        const options = [
            { value: 'all', label: '全部' },
            { value: 'raider', label: HeroConfig.getProfessionName('raider') },
            { value: 'psionic', label: HeroConfig.getProfessionName('psionic') },
            { value: 'defender', label: HeroConfig.getProfessionName('defender') }
        ];
        return options.map(option => `<option value="${option.value}" ${this.professionFilter === option.value ? 'selected' : ''}>${option.label}</option>`).join('');
    }

    getProfessionFilterItems() {
        const heroes = heroManager.getAllHeroes();
        const countByProfession = profession => heroes.filter(hero => hero.profession === profession).length;
        return [
            { value: 'all', label: '全部', subtitle: 'ALL UNITS', count: heroes.length, icon: this.resolveAbsoluteAssetUrl('assets/media/recruit/emblem_action.png') },
            { value: 'raider', label: HeroConfig.getProfessionName('raider'), subtitle: 'RAIDER', count: countByProfession('raider'), icon: HeroConfig.getProfessionIconPath('raider') },
            { value: 'psionic', label: HeroConfig.getProfessionName('psionic'), subtitle: 'PSIONIC', count: countByProfession('psionic'), icon: HeroConfig.getProfessionIconPath('psionic') },
            { value: 'defender', label: HeroConfig.getProfessionName('defender'), subtitle: 'DEFENDER', count: countByProfession('defender'), icon: HeroConfig.getProfessionIconPath('defender') }
        ];
    }

    renderProfessionTabs() {
        return `
            <div class="hero-filter-tabs" role="tablist" aria-label="职业筛选">
                ${this.getProfessionFilterItems().map(item => {
                    const isActive = this.professionFilter === item.value;
                    const icon = item.icon
                        ? `<span class="hero-filter-tab-icon"><img src="${item.icon}" alt="" aria-hidden="true"></span>`
                        : '<span class="hero-filter-tab-icon hero-filter-tab-icon-fallback" aria-hidden="true"></span>';
                    return `
                        <button
                            type="button"
                            class="hero-filter-tab ${isActive ? 'is-active' : ''}"
                            onclick="window.game.ui.heroView.setProfessionFilter('${item.value}')"
                            role="tab"
                            aria-selected="${isActive}"
                            aria-label="${item.label}：${item.count}"
                            title="${item.label}：${item.count}"
                        >
                            ${icon}
                            <strong class="hero-filter-tab-count">${item.count}</strong>
                        </button>
                    `;
                }).join('')}
            </div>
        `;
    }

    setProfessionFilter(value) {
        this.professionFilter = value || 'all';
        if (this.visible) {
            this.render();
        }
    }

    getFilteredHeroes() {
        const heroes = heroManager.getAllHeroes();
        if (!this.professionFilter || this.professionFilter === 'all') {
            return heroes;
        }
        return heroes.filter(hero => hero.profession === this.professionFilter);
    }

    showHeroAlbum() {
        this.openHeroPanel('album');
    }

    getHeroRosterHeader({ kicker, title, subtitle, metrics = [], logoCode = 'HC', showBackButton = false }) {
        const logoUrl = this.resolveAbsoluteAssetUrl('assets/media/recruit/emblem_action.png');
        return `
            <div class="hero-roster-command-header ${showBackButton ? 'has-back-button' : ''}">
                ${showBackButton ? `
                    <button class="hero-secondary-back-button" type="button" onclick="window.game.ui.heroView.showHeroHome()" aria-label="返回英雄管理" title="返回">
                        <span aria-hidden="true">‹</span>
                    </button>
                ` : ''}
                <div class="hero-roster-logo" aria-hidden="true">
                    ${logoUrl ? `<img src="${logoUrl}" alt="">` : ''}
                    <span>${logoCode}</span>
                </div>
                <div class="hero-roster-heading">
                    <div class="hero-roster-kicker">${kicker}</div>
                    <div class="hero-roster-title">${title}</div>
                    <div class="hero-roster-subtitle">${subtitle}</div>
                </div>
                <div class="hero-roster-metrics">
                    ${metrics.map(metric => `
                        <div class="hero-roster-metric">
                            <strong>${metric.value}</strong>
                            <span>${metric.label}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    getHeroAlbumRarityStrip(allHeroConfigs, ownedConfigIds) {
        const rarityOrder = ['legendary', 'epic', 'rare', 'common'];
        const items = rarityOrder
            .map(rarity => {
                const configs = allHeroConfigs.filter(heroConfig => heroConfig.rarity === rarity);
                if (configs.length === 0) {
                    return '';
                }
                const owned = configs.filter(heroConfig => ownedConfigIds.has(heroConfig.id)).length;
                const rarityColor = this.getRarityColor(rarity);
                return `
                    <div class="hero-roster-rarity-chip" style="--hero-card-rarity:${rarityColor};">
                        <span>${this.getRarityName(rarity)}</span>
                        <strong>${owned}/${configs.length}</strong>
                    </div>
                `;
            })
            .filter(Boolean)
            .join('');

        return `<div class="hero-roster-rarity-strip">${items}</div>`;
    }

    getHeroAlbumCardMarkup(heroConfig, isOwned) {
        const rarityColor = this.getRarityColor(heroConfig.rarity);
        return `
            <div class="hero-card hero-card-compact hero-roster-card hero-album-card card ${isOwned ? 'is-owned' : 'is-locked'}" style="--hero-card-rarity:${rarityColor};" title="${heroConfig.name}" data-hero-config-id="${heroConfig.id}" role="button" tabindex="0">
                ${this.getProfessionBadgeMarkup(heroConfig)}
                ${this.getHeroAvatarMarkup(heroConfig)}
                <div class="hero-name">${heroConfig.name}</div>
                <div class="hero-roster-card-status ${isOwned ? 'is-owned' : 'is-locked'}">${isOwned ? '已拥有' : '未获得'}</div>
            </div>
        `;
    }

    getHeroAlbumModalContent() {
        const allHeroConfigs = this.getSortedHeroAlbumConfigs();
        this.preloadHeroPortraits(allHeroConfigs);
        const ownedConfigIds = new Set(heroManager.getAllHeroes().map(hero => hero.configId));
        const ownedCount = allHeroConfigs.filter(heroConfig => ownedConfigIds.has(heroConfig.id)).length;
        const ownedHeroes = heroManager.getAllHeroes();
        const cards = allHeroConfigs
            .map(heroConfig => this.getHeroAlbumCardMarkup(heroConfig, ownedConfigIds.has(heroConfig.id)))
            .join('');

        return `
            <div class="hero-roster-modal hero-album-terminal">
                ${this.getHeroRosterHeader({
                    kicker: 'HERO INDEX',
                    title: '英雄图鉴',
                    subtitle: '查阅已收编与待发现英雄档案，快速确认职业与稀有度。',
                    logoCode: 'IDX',
                    showBackButton: true,
                    metrics: [
                        { value: `${ownedCount}/${allHeroConfigs.length}`, label: '图鉴' },
                        { value: `${ownedHeroes.length}`, label: '已收编' }
                    ]
                })}
                ${this.getHeroAlbumRarityStrip(allHeroConfigs, ownedConfigIds)}
                <div class="hero-modal-grid hero-roster-grid hero-album-grid">
                    ${cards}
                </div>
            </div>
        `;
    }

    showHeroPreview(configId) {
        if (!configId) return;
        const heroConfig = HeroConfig.getHeroConfig(configId);
        if (!heroConfig) return;
        const isOwned = heroManager.getAllHeroes().some(hero => hero.configId === configId);
        const traitFramework = HeroConfig.getSpecialTraitFramework(configId);

        this.closeHeroPreview();
        const modal = new Modal({
            title: `${heroConfig.name} · 图鉴预览`,
            content: this.getHeroPreviewMarkup(heroConfig, traitFramework, isOwned),
            className: 'hero-trait-modal hero-command-modal-shell hero-album-preview-modal',
            buttons: [{ text: '关闭', className: 'btn-secondary', onClick: () => modal.close() }],
            onClose: () => {
                if (this.heroPreviewEscHandler) {
                    document.removeEventListener('keydown', this.heroPreviewEscHandler);
                    this.heroPreviewEscHandler = null;
                }
                this.heroPreviewModal = null;
            }
        });
        modal.show();
        this.heroPreviewModal = modal;

        this.heroPreviewEscHandler = (event) => {
            if (event.key === 'Escape') this.closeHeroPreview();
        };
        document.addEventListener('keydown', this.heroPreviewEscHandler);
    }

    closeHeroPreview() {
        if (this.heroPreviewModal) {
            this.heroPreviewModal.close();
        }
    }

    getHeroPreviewMarkup(heroConfig, traitFramework, isOwned) {
        const rarityColor = this.getRarityColor(heroConfig.rarity);
        const rarityName = this.getRarityName(heroConfig.rarity);
        const professionName = HeroConfig.getProfessionName(heroConfig.profession);
        const portrait = heroConfig.portrait || heroConfig.cardPortrait || '';
        const portraitSrc = portrait ? this.resolveAssetUrl(portrait) : '';
        const traits = Array.isArray(traitFramework?.traits) ? traitFramework.traits : [];

        const statusBadge = isOwned
            ? `<span class="hero-preview-status is-owned">已收编</span>`
            : `<span class="hero-preview-status is-locked">未获得</span>`;
        const obtainHint = isOwned
            ? ''
            : `<div class="hero-album-preview-obtain">通过英雄招募或碎片合成获取</div>`;

        return `
            <div class="hero-album-preview" style="--hero-card-rarity:${rarityColor};">
                <div class="hero-album-preview-banner">
                    <div class="hero-album-preview-portrait">
                        ${portraitSrc
                            ? `<img src="${portraitSrc}" alt="${heroConfig.name}" loading="eager" decoding="async">`
                            : `<div class="hero-album-preview-portrait-fallback">${heroConfig.icon || '英雄'}</div>`}
                        ${this.getProfessionBadgeMarkup(heroConfig)}
                    </div>
                    <div class="hero-album-preview-info">
                        <div class="hero-album-preview-headline">
                            <div class="hero-album-preview-name-row">
                                <div class="hero-album-preview-name" style="color:${rarityColor};">${heroConfig.name}</div>
                                ${statusBadge}
                            </div>
                            <div class="hero-album-preview-chips">
                                <span class="hero-preview-chip is-rarity">${rarityName}</span>
                                <span class="hero-preview-chip is-profession">${professionName}</span>
                            </div>
                            ${obtainHint}
                        </div>
                        <div class="hero-trait-heading">
                            <div class="hero-trait-kicker">SKILL DOSSIER</div>
                            <div class="hero-trait-main-title">${traitFramework?.name || '专属特技'}</div>
                            <div class="hero-trait-subtitle">${traitFramework?.summary || ''}</div>
                        </div>
                    </div>
                </div>
                <div class="hero-trait-panel hero-trait-panel-preview">
                    <div class="hero-trait-section-title">
                        <span>特技位概览</span>
                        <strong>${traits.length} SLOTS</strong>
                    </div>
                    <div class="hero-trait-slots">
                        ${traits.length
                            ? traits.map(trait => this.getHeroPreviewTraitSlotMarkup(trait)).join('')
                            : '<div class="hero-trait-slot locked"><div class="hero-trait-slot-desc">该英雄暂未公开特技资料。</div></div>'}
                    </div>
                </div>
            </div>
        `;
    }

    getHeroPreviewTraitSlotMarkup(trait) {
        const initialUnlock = !trait?.unlockStage || trait.unlockStage <= 1;
        const stateClass = initialUnlock ? 'unlocked' : 'locked';
        const badgeText = initialUnlock ? '初始解锁' : (trait.unlockLabel || `${trait.unlockStage}星解锁`);
        return `
            <div class="hero-trait-slot ${stateClass}">
                <div class="hero-trait-slot-index">0${trait.slot}</div>
                <div class="hero-trait-slot-header">
                    <div class="hero-trait-slot-title">
                        <span>特技${trait.slot}</span>
                        <strong>${trait.name}</strong>
                    </div>
                    <div class="hero-trait-slot-badge">${badgeText}</div>
                </div>
                <div class="hero-trait-slot-desc">${trait.description || ''}</div>
            </div>
        `;
    }

    getHeroRarityOrder(rarity) {
        const order = {
            legendary: 0,
            epic: 1,
            rare: 2,
            common: 3
        };
        return order[String(rarity || 'common').toLowerCase()] ?? 99;
    }

    getSortedHeroAlbumConfigs() {
        const ownedConfigIds = new Set(heroManager.getAllHeroes().map(hero => hero.configId));
        return HeroConfig.getAllHeroes()
            .slice()
            .sort((a, b) => {
                const ownedDiff = Number(ownedConfigIds.has(b.id)) - Number(ownedConfigIds.has(a.id));
                if (ownedDiff !== 0) {
                    return ownedDiff;
                }

                const rarityDiff = this.getHeroRarityOrder(a.rarity) - this.getHeroRarityOrder(b.rarity);
                if (rarityDiff !== 0) {
                    return rarityDiff;
                }

                return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hans-CN');
            });
    }

    renderHeroes() {
        const grid = this.element.querySelector('#hero-grid');
        if (!grid) {
            return;
        }
        grid.innerHTML = '';
        const heroes = this.getFilteredHeroes();
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
            title: '英雄档案',
            content: this.getHeroDetailContent(hero),
            className: 'hero-detail-modal hero-command-modal-shell',
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
        this.closeEquipmentSelectionModal();
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

    getProfessionBadgeMarkup(entity) {
        const professionId = entity?.profession || null;
        const professionIcon = entity?.professionIcon || HeroConfig.getProfessionIconPath(professionId);
        if (!professionIcon) {
            return '';
        }
        const professionName = HeroConfig.getProfessionName(professionId);
        return `
            <div class="hero-profession-badge" title="${professionName}">
                <img class="hero-profession-badge-image" src="${professionIcon}" alt="${professionName}">
            </div>
        `;
    }

    getHeroAvatarMarkup(entity, size = 'default') {
        const portrait = entity?.cardPortrait || entity?.portrait || null;
        const baseClass = size === 'large'
            ? 'hero-avatar hero-detail-avatar hero-avatar-portrait hero-avatar-portrait-large'
            : 'hero-avatar hero-avatar-portrait';
        if (portrait) {
            const src = this.resolveAssetUrl(portrait);
            const loading = size === 'large' ? 'eager' : 'lazy';
            return `<div class="${baseClass}"><img class="hero-avatar-image" src="${src}" alt="${entity?.name || 'hero'}" loading="${loading}" decoding="async" draggable="false"></div>`;
        }
        const style = size === 'large' ? ' style="font-size:56px;"' : '';
        return `<div class="hero-avatar"${style}>${entity?.icon || '❓'}</div>`;
    }

    preloadHeroPortraits(heroes) {
        if (!Array.isArray(heroes) || typeof Image === 'undefined') {
            return;
        }
        heroes.forEach(hero => {
            const portrait = hero?.cardPortrait || hero?.portrait;
            if (!portrait) {
                return;
            }
            const image = new Image();
            image.decoding = 'async';
            image.src = this.resolveAssetUrl(portrait);
        });
    }

    getEquipmentIconMarkup(equipment, imageClass = 'hero-equipment-slot-icon-image') {
        if (!equipment) {
            return '';
        }
        const starBadge = typeof equipment.getStarBadgeMarkup === 'function'
            ? equipment.getStarBadgeMarkup()
            : '';
        if (equipment.iconSrc) {
            return `<span class="equipment-icon-with-star">${starBadge}<img class="${imageClass}" src="${equipment.iconSrc}" alt="${equipment.name || '装备'}"></span>`;
        }
        return `<span class="equipment-icon-with-star equipment-icon-text">${starBadge}${equipment.icon || ''}</span>`;
    }

    getEquipmentSlotMarkup(hero, slot) {
        const equipment = hero.equipment[slot];
        const slotName = EquipmentConfig.getSlotName(slot);
        const isBubbleShown = Boolean(equipment && this.equipmentBubble?.heroId === hero.id && this.equipmentBubble?.slot === slot);

        return `
            <div class="hero-equipment-slot">
                <button
                    type="button"
                    class="hero-equipment-button ${equipment ? 'filled' : 'empty'} ${isBubbleShown ? 'is-active' : ''}"
                    data-hero-id="${hero.id}"
                    data-hero-config-id="${hero.configId || ''}"
                    data-equipment-slot="${slot}"
                    onclick="window.game.ui.heroView.onHeroEquipmentSlotClick('${hero.id}', '${slot}')">
                    <span class="hero-equipment-slot-name">${slotName}</span>
                    <span class="hero-equipment-slot-icon">${this.getEquipmentIconMarkup(equipment)}</span>
                </button>
            </div>
        `;
    }

    getEquipmentInlinePanel(hero) {
        const slot = this.equipmentBubble?.heroId === hero.id ? this.equipmentBubble?.slot : null;
        const equipment = slot ? hero.equipment?.[slot] : null;
        if (!slot || !equipment) {
            return '';
        }
        const statText = equipment.getStatLines().length > 0 ? equipment.getStatLines().join(' / ') : '无额外属性';
        return `
            <div class="hero-equipment-popover hero-equipment-inline-panel">
                <div class="hero-equipment-popover-name" style="color:${this.getRarityColor(equipment.rarity)};">${this.getEquipmentIconMarkup(equipment, 'hero-equipment-popover-icon-image')} ${equipment.name}</div>
                <div class="hero-equipment-popover-stats">${statText}</div>
                <div class="hero-equipment-popover-actions">
                    <button class="btn btn-primary btn-small" onclick="window.game.ui.heroView.showEquipSelection('${hero.id}', '${slot}')">更换</button>
                    <button class="btn btn-primary btn-small" onclick="window.game.ui.heroView.enhanceHeroEquipment('${hero.id}', '${slot}')">强化</button>
                    <button class="btn btn-danger btn-small" onclick="window.game.ui.heroView.unequipHeroSlot('${hero.id}', '${slot}')">卸下</button>
                    <button class="btn btn-secondary btn-small" onclick="window.game.ui.heroView.closeEquipmentBubble('${hero.id}')">关闭</button>
                </div>
            </div>
        `;
    }

    getHeroDetailContent(hero) {
        const info = hero.getInfo();
        const starUpgradeInfo = heroManager.canUpgradeStarsWithFragments(hero.id);
        const expRequired = hero.getExpRequired();
        const levelCap = hero.getLevelCap();
        const currentFragments = heroManager.getFragments(hero.configId);
        const buildStatRows = statKeys => statKeys.map(statKey => {
            const definition = HeroConfig.getStatDefinition(statKey);
            const value = statKey === 'hp' ? info.stats.maxHp : info.stats[statKey];
            return `
                <div class="hero-stat-row" data-stat-key="${statKey}" role="button" tabindex="0">
                    <span>${definition.name}</span>
                    <strong>${value ?? 0}</strong>
                </div>
            `;
        }).join('');
        const coreStatKeys = ['hp', 'attack', 'defense', 'speed'];
        const advancedStatKeys = HeroConfig.getDisplayStats().filter(statKey => !coreStatKeys.includes(statKey));
        const coreStatRows = buildStatRows(coreStatKeys);
        const advancedStatRows = buildStatRows(advancedStatKeys);

        const equipmentSlots = ['weapon', 'clothes', 'pants', 'shoes'].map(slot => this.getEquipmentSlotMarkup(hero, slot)).join('');
        const starCostHtml = starUpgradeInfo.isMax
            ? `<span style="color:#fbbf24;">已升满</span>（当前 ${currentFragments}）`
            : `<span style="color:${starUpgradeInfo.can ? '#4caf50' : '#f87171'}">${starUpgradeInfo.cost} 个碎片</span>（当前 ${currentFragments}）`;
        const expPercent = expRequired > 0 ? Math.max(0, Math.min(100, (info.exp / expRequired) * 100)) : 100;

        return `
            <div class="hero-detail-panel">
                <div class="hero-detail-hero-card hero-detail-rarity-${hero.rarity}">
                    <div class="hero-detail-header">
                        <div class="hero-detail-visual">
                            <div class="hero-detail-visual-frame">
                                ${this.getHeroAvatarMarkup(info, 'large')}
                                ${this.getProfessionBadgeMarkup(info)}
                                <div class="hero-detail-overlay hero-detail-level-overlay">LV.${info.level}</div>
                                ${this.getHeroStarMarkup(info.stars, 'hero-detail-stars')}
                            </div>
                        </div>
                        <div class="hero-detail-info">
                            <div class="hero-detail-info-row hero-detail-info-row-top">
                                <div class="hero-detail-title-group">
                                    <div class="hero-detail-name" style="color:${this.getRarityColor(hero.rarity)};">${hero.name}</div>
                                    <span class="hero-detail-meta-item hero-detail-rarity-tag">${this.getRarityName(hero.rarity)}</span>
                                    <div class="hero-detail-profession">${HeroConfig.getProfessionName(info.profession)}</div>
                                </div>
                                <div class="hero-detail-overlay hero-detail-power-overlay hero-detail-info-power-chip">
                                    <span class="hero-detail-power-label">战力</span>
                                    <strong class="hero-detail-power-value">${info.power}</strong>
                                </div>
                            </div>
                            <div class="hero-detail-growth-compact">
                                <div class="hero-detail-section-head">
                                    <span>成长</span>
                                    <span>等级上限 Lv.${levelCap}</span>
                                </div>
                                <div class="hero-detail-exp-track">
                                    <div class="hero-detail-exp-fill" style="width:${expPercent.toFixed(2)}%;"></div>
                                </div>
                                <div class="hero-detail-growth-meta">
                                    <span class="hero-exp-progress">经验：${info.exp}/${expRequired}</span>
                                    <span class="hero-star-cost">升星消耗：${starCostHtml}</span>
                                </div>
                            </div>
                            <div class="hero-detail-actions">
                                <button class="btn btn-primary" onclick="window.game.ui.heroView.levelUpHero('${hero.id}')">升级</button>
                                <button class="btn btn-primary" onclick="window.game.ui.heroView.upgradeStars('${hero.id}')">升星</button>
                                <button class="btn btn-secondary" onclick="window.game.ui.heroView.showSpecialTraits('${hero.id}')">特技</button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="hero-detail-equipment-panel">
                    <div class="hero-detail-section-head">
                        <span>装备</span>
                        <span>点击可查看或更换</span>
                    </div>
                    <div class="hero-detail-equipment-strip">${equipmentSlots}</div>
                    ${this.getEquipmentInlinePanel(hero)}
                </div>
                <div class="hero-detail-stats-panel">
                    <div class="hero-detail-stats-section">
                        <div class="hero-detail-section-head">
                            <span>核心属性</span>
                            <span>战斗基础面板</span>
                        </div>
                        <div class="hero-stat-grid hero-stat-grid-core">${coreStatRows}</div>
                    </div>
                    <div class="hero-detail-stats-section">
                        <div class="hero-detail-section-head">
                            <span>进阶属性</span>
                            <span>点击词条可查看说明</span>
                        </div>
                        <div class="hero-stat-grid hero-stat-grid-advanced">${advancedStatRows}</div>
                    </div>
                </div>
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
            titleEl.textContent = '英雄档案';
        }
    }

    levelUpHero(heroId) {
        const hero = heroManager.getHero(heroId);
        if (!hero) return;
        const result = heroManager.levelUpHero(hero.id);
        if (result?.success) {
            Toast.success(`${hero.name}升级了！`);
            this.render();
            this.updateTeamPowerDisplay();
            this.updateHeroDetailModal(hero);
            window.game.save();
        } else if (result?.reason === 'star_level_cap') {
            Toast.info('等级已达到当前星级上限！');
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
            Toast.success(`${hero.name}升星成功`);
            this.render();
            this.updateTeamPowerDisplay();
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
        const traitFramework = hero.getSpecialTraitFramework();
        const currentStageInfo = HeroConfig.getStarDisplayInfo(currentStage);
        const unlockedTraitCount = traitFramework.traits.filter(trait => currentStage >= trait.unlockStage).length;
        const milestoneCount = traitFramework.milestones.length;
        const currentMilestoneIndex = traitFramework.milestones.reduce((lastIndex, milestone, index) => (
            currentStage >= milestone.stage ? index : lastIndex
        ), -1);
        const progressPercent = milestoneCount > 1 && currentMilestoneIndex >= 0
            ? Math.min(100, Math.max(0, (currentMilestoneIndex / (milestoneCount - 1)) * 100))
            : 0;
        const getMilestoneState = milestone => {
            if (currentStage === milestone.stage) {
                return 'current';
            }
            return currentStage > milestone.stage ? 'unlocked' : 'locked';
        };
        const getStateText = state => {
            if (state === 'current') {
                return '当前';
            }
            return state === 'unlocked' ? '完成' : '未解锁';
        };
        const content = `
            <div class="hero-trait-panel">
                <div class="hero-trait-command-header">
                    <div class="hero-trait-heading">
                        <div class="hero-trait-kicker">SKILL DOSSIER</div>
                        <div class="hero-trait-main-title">${traitFramework.name}</div>
                        <div class="hero-trait-subtitle">${traitFramework.summary}</div>
                    </div>
                    <div class="hero-trait-metrics">
                        <div class="hero-trait-metric is-stage">
                            <strong>${currentStageInfo.label}</strong>
                            <span>当前阶段</span>
                        </div>
                        <div class="hero-trait-metric">
                            <strong>${unlockedTraitCount}/${traitFramework.slotCount}</strong>
                            <span>特技位</span>
                        </div>
                        <div class="hero-trait-metric">
                            <strong>${this.getRarityName(hero.rarity)}</strong>
                            <span>品质轨道</span>
                        </div>
                    </div>
                </div>
                <div class="hero-trait-progress-rail" style="--hero-trait-progress:${progressPercent.toFixed(2)}%;">
                    ${traitFramework.milestones.map(milestone => {
                        const stateClass = getMilestoneState(milestone);
                        return `
                            <div class="hero-trait-progress-node ${stateClass}" title="${milestone.label}">
                                <span>${milestone.text}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div class="hero-trait-section-title">
                    <span>特技位概览</span>
                    <strong>${unlockedTraitCount} ACTIVE</strong>
                </div>
                <div class="hero-trait-slots">
                    ${traitFramework.traits.map(trait => {
                        const unlocked = currentStage >= trait.unlockStage;
                        return `
                            <div class="hero-trait-slot ${unlocked ? 'unlocked' : 'locked'}">
                                <div class="hero-trait-slot-index">0${trait.slot}</div>
                                <div class="hero-trait-slot-header">
                                    <div class="hero-trait-slot-title">
                                        <span>特技${trait.slot}</span>
                                        <strong>${trait.name}</strong>
                                    </div>
                                    <div class="hero-trait-slot-badge">${unlocked ? '已解锁' : trait.unlockLabel}</div>
                                </div>
                                <div class="hero-trait-slot-desc">${trait.description}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div class="hero-trait-section-title">
                    <span>成长节点</span>
                    <strong>${currentStageInfo.label}</strong>
                </div>
                <div class="hero-trait-list">
                    ${traitFramework.milestones.map(milestone => {
                        const relatedTrait = milestone.slot ? traitFramework.traits[milestone.slot - 1] : null;
                        const stateClass = getMilestoneState(milestone);
                        return `
                        <div class="hero-trait-row ${stateClass}">
                            <div class="hero-trait-stage ${milestone.className}">${milestone.text}</div>
                            <div class="hero-trait-content">
                                <div class="hero-trait-title-row">
                                    <div class="hero-trait-node-title">${milestone.label}${relatedTrait ? ` · ${relatedTrait.name}` : ''}</div>
                                    <span class="hero-trait-row-state">${getStateText(stateClass)}</span>
                                </div>
                                <div class="hero-trait-desc">${milestone.description}</div>
                            </div>
                        </div>
                    `;}).join('')}
                </div>
            </div>
        `;
        const modal = new Modal({
            title: `${hero.name} · 特技`,
            content,
            className: 'hero-trait-modal hero-command-modal-shell',
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

    enhanceHeroEquipment(heroId, slot) {
        const hero = heroManager.getHero(heroId);
        const equipment = hero?.equipment?.[slot];
        if (!equipment) {
            Toast.info('该部位暂无装备');
            return;
        }
        this.closeEquipmentBubble(heroId);
        equipmentEnhanceModal.show(equipment.instanceId);
    }

    upgradeHeroEquipmentStars(heroId, slot) {
        const hero = heroManager.getHero(heroId);
        const equipment = hero?.equipment?.[slot];
        if (!equipment) {
            Toast.info('该部位暂无装备');
            return;
        }
        if (!equipment.canStarUpgrade()) {
            Toast.info('当前装备不可升星');
            return;
        }
        this.closeEquipmentBubble(heroId);
        equipmentStarModal.show(equipment.instanceId);
    }

    showEquipSelection(heroId, slot) {
        const hero = heroManager.getHero(heroId);
        if (!hero) {
            return;
        }
        this.closeEquipmentBubble(heroId);
        const equipments = itemManager.getEquipmentBySlot(slot);
        const currentEquipment = hero.equipment[slot];

        let content = `<div class="hero-equipment-selection-panel">`;
        if (currentEquipment) {
            content += `
                <div class="card hero-equipment-selection-card hero-equipment-selection-current">
                    <div class="hero-equipment-selection-copy">
                        <div class="hero-equipment-selection-name" style="color:${this.getRarityColor(currentEquipment.rarity)};">当前装备：${this.getEquipmentIconMarkup(currentEquipment, 'hero-equipment-select-icon-image')} ${currentEquipment.name}</div>
                        <div class="hero-equipment-selection-stats">${currentEquipment.getStatLines().join(' / ') || '无额外属性'}</div>
                    </div>
                    <div class="hero-equipment-selection-actions">
                        <button class="btn btn-primary btn-small" onclick="window.game.ui.heroView.enhanceHeroEquipment('${heroId}', '${slot}')">强化</button>
                        <button class="btn btn-primary btn-small" onclick="window.game.ui.heroView.upgradeHeroEquipmentStars('${heroId}', '${slot}')">升星</button>
                        <button class="btn btn-danger btn-small" onclick="window.game.ui.heroView.unequipHeroSlot('${heroId}', '${slot}')">卸下</button>
                    </div>
                </div>
            `;
        }

        if (equipments.length === 0) {
            content += '<div class="hero-equipment-selection-empty">背包中没有该部位装备</div>';
        } else {
            content += '<div class="hero-equipment-selection-list">';
            equipments.forEach(equipment => {
                content += `
                    <div class="card hero-equipment-selection-card">
                        <div class="hero-equipment-selection-copy">
                            <div class="hero-equipment-selection-name" style="color:${this.getRarityColor(equipment.rarity)};">${this.getEquipmentIconMarkup(equipment, 'hero-equipment-select-icon-image')} ${equipment.name}</div>
                            <div class="hero-equipment-selection-stats">${equipment.getStatLines().join(' / ') || '无额外属性'}</div>
                        </div>
                        <button
                            class="btn btn-primary btn-small hero-equipment-equip-button"
                            data-equipment-id="${equipment.instanceId}"
                            data-equipment-template-id="${equipment.templateId || ''}"
                            onclick="window.game.ui.heroView.equipHeroItem('${heroId}', '${equipment.instanceId}')">穿戴</button>
                    </div>
                `;
            });
            content += '</div>';
        }
        content += '</div>';

        this.closeEquipmentSelectionModal();
        const modal = new Modal({
            title: `${hero.name} - ${EquipmentConfig.getSlotName(slot)}`,
            content,
            className: 'hero-equipment-selection-modal hero-command-modal-shell',
            buttons: [{ text: '关闭', className: 'btn-secondary', onClick: () => this.closeEquipmentSelectionModal() }],
            onClose: () => {
                if (this.equipmentSelectionModal === modal) {
                    this.equipmentSelectionModal = null;
                }
            }
        });
        this.equipmentSelectionModal = modal;
        modal.show();
    }

    closeEquipmentSelectionModal() {
        if (this.equipmentSelectionModal && this.equipmentSelectionModal.isShown()) {
            const modal = this.equipmentSelectionModal;
            this.equipmentSelectionModal = null;
            modal.close();
            return;
        }
        this.equipmentSelectionModal = null;
    }

    equipHeroItem(heroId, equipmentInstanceId) {
        const result = heroManager.equipToHero(heroId, equipmentInstanceId);
        if (!result.success) {
            Toast.error(result.message);
            return;
        }
        this.equipmentBubble = null;
        this.closeEquipmentSelectionModal();
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
        if (this.activePanel === 'team') {
            return;
        }
        this.openHeroPanel('team');
    }

    closeTeamModal() {
        if (this.activePanel === 'team') {
            this.showHeroHome();
            return;
        }
        if (this.teamModal && this.teamModal.isShown()) {
            const modal = this.teamModal;
            this.teamModal = null;
            modal.close();
            return;
        }
        this.teamModal = null;
    }

    getTeamModalContent() {
        const heroes = heroManager.getAllHeroes();
        this.preloadHeroPortraits(heroes);
        const maxTeamSize = Number(heroManager.maxTeamSize) || 4;
        const teamHeroes = typeof heroManager.getTeam === 'function'
            ? heroManager.getTeam()
            : heroes.filter(hero => heroManager.isHeroInTeam(hero.id));
        const teamCount = teamHeroes.length;
        const isTeamFull = teamCount >= maxTeamSize;
        const teamSlots = Array.from({ length: maxTeamSize }).map((_, index) => {
            const hero = teamHeroes[index];
            if (!hero) {
                return `
                    <div class="hero-team-slot is-empty">
                        <span class="hero-team-slot-index">0${index + 1}</span>
                        <strong>待编入</strong>
                        <span>EMPTY</span>
                    </div>
                `;
            }
            const rarityColor = this.getRarityColor(hero.rarity);
            return `
                <button type="button" class="hero-team-slot is-filled" style="--hero-card-rarity:${rarityColor};" onclick="window.game.ui.heroView.toggleTeam('${hero.id}')" title="点击移出编队">
                    <span class="hero-team-slot-index">0${index + 1}</span>
                    <strong>${hero.name}</strong>
                    <span>${this.formatPower(hero.getPower?.() || 0)} 战力</span>
                </button>
            `;
        }).join('');
        const cards = heroes.map(hero => {
            const inTeam = heroManager.isHeroInTeam(hero.id);
            const rarityColor = this.getRarityColor(hero.rarity);
            const blocked = !inTeam && isTeamFull;
            return `
                <div
                    class="hero-card hero-card-compact hero-roster-card hero-team-roster-card card ${inTeam ? 'selected is-in-team' : ''} ${blocked ? 'is-team-blocked' : ''}"
                    data-hero-id="${hero.id}"
                    data-hero-config-id="${hero.configId || ''}"
                    style="--hero-card-rarity:${rarityColor};"
                    onclick="window.game.ui.heroView.toggleTeam('${hero.id}')"
                    title="${inTeam ? '点击移出编队' : '点击加入编队'}">
                    ${inTeam ? '<div class="hero-team-badge">参战</div>' : ''}
                    ${this.getProfessionBadgeMarkup(hero)}
                    ${this.getHeroAvatarMarkup(hero)}
                    <div class="hero-level">Lv.${hero.level}</div>
                    ${this.getHeroStarMarkup(hero.stars)}
                    <div class="hero-card-meta-row">
                        <div class="hero-power">战力 ${this.formatPower(hero.getPower?.() || 0)}</div>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="hero-roster-modal hero-team-terminal">
                ${this.getHeroRosterHeader({
                    kicker: 'SQUAD DEPLOY',
                    title: '英雄编队',
                    subtitle: '点击英雄切换参战状态，满编后需先移出一个席位。',
                    logoCode: 'OPS',
                    showBackButton: true,
                    metrics: [
                        { value: this.formatPower(heroManager.getTeamPower()), label: '总战力' }
                    ]
                })}
                <div class="hero-team-slots">
                    ${teamSlots}
                </div>
                <div class="hero-roster-section-head">
                    <span>候选名单</span>
                    <strong>${heroes.length} 名</strong>
                </div>
                <div class="hero-modal-grid hero-roster-grid hero-team-grid">
                    ${cards}
                </div>
            </div>
        `;
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
            this.updateTeamPowerDisplay();
        }
        this.updateTeamModal();
        window.game.save();
    }

    updateTeamModal() {
        if (this.activePanel === 'team') {
            this.render();
            return;
        }
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
            this.updateTeamPowerDisplay();
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


