/**
 * 招募场景视图
 */
class GachaView {
    constructor() {
        this.element = document.getElementById('main-display');
        this.visible = false;
        this.activePoolId = 'hero_pool';
        this.activeRatePopover = null;
    }

    show() {
        this.visible = true;
        this.render();
    }

    hide() {
        this.visible = false;
        this.activeRatePopover = null;
        this.element.innerHTML = '';
    }

    getAvailablePools() {
        return GachaConfig.getAllPools();
    }

    getPoolConfig(poolId) {
        return GachaConfig.getPoolConfig(poolId);
    }

    setActivePool(poolId) {
        if (!this.getPoolConfig(poolId)) {
            return;
        }
        this.activePoolId = poolId;
        this.activeRatePopover = null;
        this.refresh();
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

    getRecruitUiAssets() {
        return {
            heroBackdrop: this.resolveAssetUrl('assets/media/recruit/hero_recruit_bg.png'),
            forgeBackdrop: this.resolveAssetUrl('assets/media/recruit/forge_recruit_bg.png'),
            heroHalo: this.resolveAssetUrl('assets/media/recruit/hero_energy_halo.png'),
            consoleFrame: this.resolveAbsoluteAssetUrl('assets/media/recruit/summon_console_frame.png'),
            heroEmblem: this.resolveAbsoluteAssetUrl('assets/media/recruit/emblem_hero.png'),
            forgeEmblem: this.resolveAbsoluteAssetUrl('assets/media/recruit/emblem_forge.png'),
            actionEmblem: this.resolveAbsoluteAssetUrl('assets/media/recruit/emblem_action.png'),
            premiumEmblem: this.resolveAbsoluteAssetUrl('assets/media/recruit/emblem_premium.png')
        };
    }

    getEntryRateText(poolId, entryId) {
        const entries = GachaConfig.getPoolDisplayEntries(poolId);
        return entries.find(entry => entry.id === entryId)?.rateText || '--';
    }

    getTenDiscount(poolId) {
        const single = gachaManager.calculateCost(poolId, 1);
        const ten = gachaManager.calculateCost(poolId, 10);
        if (!single || !ten || single.type !== ten.type) {
            return null;
        }

        const savedAmount = Math.max(0, (Number(single.amount) || 0) * 10 - (Number(ten.amount) || 0));
        if (savedAmount <= 0) {
            return null;
        }

        const resourceInfo = shelterManager.getResourceInfo(single.type) || {};
        return {
            type: single.type,
            icon: resourceInfo.icon || '💠',
            label: resourceInfo.name || single.type,
            amount: savedAmount
        };
    }

    getPreferredHeroRoster() {
        const preferredIds = ['hero_010', 'hero_024', 'hero_025'];
        const roster = [];
        const seen = new Set();

        const pushHero = (hero) => {
            if (!hero || !hero.id || seen.has(hero.id) || !hero.portrait) {
                return;
            }
            roster.push(hero);
            seen.add(hero.id);
        };

        preferredIds.forEach((id) => pushHero(HeroConfig.getHeroConfig(id)));

        ['epic', 'rare', 'common'].forEach((rarity) => {
            HeroConfig.getHeroesByRarity(rarity).forEach(pushHero);
        });

        return roster.slice(0, 4);
    }

    getHeroPoolVisual() {
        const uiAssets = this.getRecruitUiAssets();
        const pool = this.getPoolConfig('hero_pool') || {};
        const roster = this.getPreferredHeroRoster();
        const primaryHero = roster[0] || null;
        const supportingHeroes = roster.slice(1, 4);

        return {
            sceneBackdrop: uiAssets.heroBackdrop,
            themeClass: 'hero',
            eyebrow: 'SIGNAL RECRUITMENT',
            title: pool.name || '英雄招募',
            featureName: primaryHero?.name || '末日信标已开启',
            description: '在废墟信标中招募新的战力，重复获得的英雄将自动转化为对应碎片。',
            footNote: '展示角色仅作招募氛围呈现，实际结果以奖池概率为准。',
            portrait: primaryHero?.portrait || '',
            supportingHeroes,
            highlightChips: [
                { label: '史诗整卡', value: this.getEntryRateText('hero_pool', 'hero_unit_epic') },
                { label: '稀有整卡', value: this.getEntryRateText('hero_pool', 'hero_unit_rare') },
                { label: '史诗碎片', value: this.getEntryRateText('hero_pool', 'hero_fragment_epic') }
            ]
        };
    }

    getEquipmentPoolVisual() {
        const uiAssets = this.getRecruitUiAssets();
        const pool = this.getPoolConfig('equipment_pool') || {};
        const forgeItems = [
            EquipmentConfig.getTemplate('weapon_katana'),
            EquipmentConfig.getTemplate('weapon_axe'),
            EquipmentConfig.getTemplate('clothes_tactical'),
            EquipmentConfig.getTemplate('shoes_boots')
        ].filter(Boolean).map((item) => ({
            name: item.name,
            icon: item.icon,
            slot: EquipmentConfig.getSlotName(item.slot)
        }));

        return {
            sceneBackdrop: uiAssets.forgeBackdrop,
            themeClass: 'forge',
            eyebrow: 'FORGE WORKSHOP',
            title: pool.name || '装备打造',
            featureName: '钢火未熄',
            description: '启动工坊熔炉，有机会直接获得装备，也可能带回金币与强化、建设材料。',
            footNote: '打造结果与装备品质以奖池概率为准。',
            forgeItems,
            highlightChips: [
                { label: '史诗装备', value: this.getEntryRateText('equipment_pool', 'equip_epic') },
                { label: '稀有装备', value: this.getEntryRateText('equipment_pool', 'equip_rare') },
                { label: '钻石返还', value: this.getEntryRateText('equipment_pool', 'equip_diamond') }
            ]
        };
    }

    getPoolVisual(poolId) {
        if (poolId === 'equipment_pool') {
            return this.getEquipmentPoolVisual();
        }
        return this.getHeroPoolVisual();
    }

    getPoolTabVisual(poolId) {
        if (poolId === 'equipment_pool') {
            return {
                className: 'forge',
                subtitle: 'EQUIPMENT FORGE'
            };
        }

        return {
            className: 'hero',
            subtitle: 'HERO RECRUIT'
        };
    }

    renderPoolTabs() {
        return `
            <div class="recruit-pool-tabs" role="tablist" aria-label="奖池切换">
                ${this.getAvailablePools().map((pool) => {
                    const tabVisual = this.getPoolTabVisual(pool.id);
                    return `
                        <button
                            type="button"
                            class="recruit-pool-tab recruit-pool-tab-${tabVisual.className} ${pool.id === this.activePoolId ? 'is-active' : ''}"
                            onclick="window.game.ui.gachaView.setActivePool('${pool.id}')"
                            role="tab"
                            aria-selected="${pool.id === this.activePoolId}"
                        >
                            <span class="recruit-pool-tab-icon" aria-hidden="true"></span>
                            <span class="recruit-pool-tab-copy">
                                <span class="recruit-pool-tab-text">${pool.name}</span>
                                <span class="recruit-pool-tab-subtitle">${tabVisual.subtitle}</span>
                            </span>
                        </button>
                    `;
                }).join('')}
            </div>
        `;
    }

    renderHighlightChips(chips = []) {
        return `
            <div class="recruit-highlight-row">
                ${chips.map((chip) => `
                    <div class="recruit-highlight-chip">
                        <span class="recruit-highlight-label">${chip.label}</span>
                        <strong class="recruit-highlight-value">${chip.value || '--'}</strong>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderSupportHeroes(heroes = []) {
        if (!heroes.length) {
            return '';
        }

        return `
            <div class="recruit-support-strip">
                ${heroes.map((hero) => `
                    <div class="recruit-support-card">
                        <div class="recruit-support-avatar">
                            <img src="${hero.portrait}" alt="${hero.name}" class="recruit-support-avatar-image">
                        </div>
                        <div class="recruit-support-name">${hero.name}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderForgeItems(items = []) {
        if (!items.length) {
            return '';
        }

        return `
            <div class="recruit-forge-items">
                ${items.map((item) => `
                    <div class="recruit-forge-item">
                        <span class="recruit-forge-item-icon">${item.icon || '⚒️'}</span>
                        <span class="recruit-forge-item-name">${item.name}</span>
                        <span class="recruit-forge-item-slot">${item.slot}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderBannerFigure(visual) {
        if (visual.themeClass === 'forge') {
            return `
                <div class="recruit-banner-figure recruit-banner-figure-forge">
                    <div class="recruit-forge-core">
                        <div class="recruit-forge-ring recruit-forge-ring-outer"></div>
                        <div class="recruit-forge-ring recruit-forge-ring-inner"></div>
                        <div class="recruit-forge-sigil recruit-emblem-crop recruit-emblem-crop-forge"></div>
                    </div>
                    ${this.renderForgeItems(visual.forgeItems)}
                </div>
            `;
        }

        return `
            <div class="recruit-banner-figure recruit-banner-figure-hero">
                <img src="${visual.portrait}" alt="${visual.featureName}" class="recruit-banner-character">
                ${this.renderSupportHeroes(visual.supportingHeroes)}
            </div>
        `;
    }

    renderBanner(poolId) {
        const visual = this.getPoolVisual(poolId);
        const bannerGradient = visual.themeClass === 'hero'
            ? 'linear-gradient(140deg, rgba(6, 9, 16, 0.18) 0%, rgba(6, 9, 16, 0.36) 42%, rgba(7, 9, 15, 0.66) 100%)'
            : 'linear-gradient(140deg, rgba(9, 12, 18, 0.42) 0%, rgba(8, 11, 18, 0.6) 42%, rgba(8, 10, 16, 0.82) 100%)';
        const bannerStyle = visual.sceneBackdrop
            ? `style="background-image: ${bannerGradient}, url('${visual.sceneBackdrop}');"`
            : '';
        return `
            <section class="recruit-banner recruit-banner-${visual.themeClass}" ${bannerStyle}>
                <div class="recruit-banner-overlay"></div>
                <div class="recruit-banner-copy">
                    <div class="recruit-banner-eyebrow">${visual.eyebrow}</div>
                    <div class="recruit-banner-title-row">
                        <span class="recruit-banner-title-emblem recruit-emblem-crop recruit-emblem-crop-${visual.themeClass}"></span>
                        <h2 class="recruit-banner-title">${visual.title}</h2>
                    </div>
                    <div class="recruit-banner-feature">${visual.featureName}</div>
                    <p class="recruit-banner-description">${visual.description}</p>
                    ${this.renderHighlightChips(visual.highlightChips)}
                </div>
                ${this.renderBannerFigure(visual)}
                <div class="recruit-banner-toolbar">
                    <button
                        type="button"
                        class="recruit-inline-action"
                        onclick="window.game.ui.gachaView.toggleRatePopover('${poolId}')"
                    >
                        <span class="recruit-inline-action-emblem recruit-emblem-crop recruit-emblem-crop-action" aria-hidden="true"></span>
                        概率详情
                    </button>
                    <div class="recruit-banner-footnote">${visual.footNote}</div>
                </div>
            </section>
        `;
    }

    renderDrawButton(poolId, count) {
        const cost = gachaManager.calculateCost(poolId, count);
        const actionText = poolId === 'equipment_pool' ? '打造' : '招募';
        const resourceInfo = shelterManager.getResourceInfo(cost?.type) || {};
        const resourceIcon = resourceInfo.icon || '💠';

        return `
            <button
                type="button"
                class="recruit-draw-button recruit-draw-button-${count === 10 ? 'ten' : 'single'}"
                onclick="window.game.ui.gachaView.executePool('${poolId}', ${count})"
            >
                ${count === 10 ? '<span class="recruit-draw-button-emblem recruit-emblem-crop recruit-emblem-crop-premium" aria-hidden="true"></span>' : ''}
                <span class="recruit-draw-button-label">${actionText}${count}次</span>
                <span class="recruit-draw-button-cost">${resourceIcon}${cost?.amount || 0}</span>
            </button>
        `;
    }

    renderConsole(poolId) {
        return `
            <section class="recruit-console">
                <div class="recruit-console-frame-art" aria-hidden="true"></div>
                <div class="recruit-console-actions">
                    ${this.renderDrawButton(poolId, 1)}
                    ${this.renderDrawButton(poolId, 10)}
                </div>
            </section>
        `;
    }

    renderPoolRates(poolId) {
        const pool = this.getPoolConfig(poolId) || {};
        const entries = GachaConfig.getPoolDisplayEntries(poolId);

        return `
            <div class="recruit-rate-sheet-card">
                <div class="recruit-rate-sheet-header">
                    <div>
                        <div class="recruit-rate-sheet-eyebrow">POOL DATA</div>
                        <div class="recruit-rate-sheet-title">${pool.name || '奖池'}概率详情</div>
                    </div>
                    <button
                        type="button"
                        class="recruit-rate-sheet-close"
                        onclick="window.game.ui.gachaView.closeRatePopover()"
                        aria-label="关闭概率详情"
                    >
                        ×
                    </button>
                </div>
                <div class="recruit-rate-sheet-list">
                    ${entries.map((entry) => `
                        <div class="recruit-rate-row">
                            <span class="recruit-rate-label">${entry.label}</span>
                            <strong class="recruit-rate-value">${entry.rateText}</strong>
                        </div>
                    `).join('')}
                </div>
                <div class="recruit-rate-sheet-note">所有抽取结果以实际结算为准，展示角色不代表概率提升。</div>
            </div>
        `;
    }

    renderRateSheet(poolId) {
        if (this.activeRatePopover !== poolId) {
            return '';
        }

        return `
            <button
                type="button"
                class="recruit-rate-sheet-backdrop"
                onclick="window.game.ui.gachaView.closeRatePopover()"
                aria-label="关闭概率详情"
            ></button>
            <div class="recruit-rate-sheet-shell">
                ${this.renderPoolRates(poolId)}
            </div>
        `;
    }

    toggleRatePopover(poolId = this.activePoolId) {
        this.activeRatePopover = this.activeRatePopover === poolId ? null : poolId;
        this.refresh();
    }

    closeRatePopover() {
        this.activeRatePopover = null;
        this.refresh();
    }

    formatCostText(cost, options = {}) {
        const includeLabel = options.includeLabel !== false;
        const resourceLabel = shelterManager.getResourceInfo(cost?.type)?.name || cost?.type || '资源';
        const resourceIcon = shelterManager.getResourceInfo(cost?.type)?.icon || '💠';
        return includeLabel
            ? `${resourceIcon}${cost?.amount || 0} ${resourceLabel}`
            : `${resourceIcon}${cost?.amount || 0}`;
    }

    render() {
        const poolId = this.activePoolId;
        const visual = this.getPoolVisual(poolId);
        const uiAssets = this.getRecruitUiAssets();
        const sceneGradient = visual.themeClass === 'hero'
            ? 'linear-gradient(180deg, rgba(7, 10, 15, 0.38), rgba(7, 10, 15, 0.82))'
            : 'linear-gradient(180deg, rgba(7, 10, 15, 0.62), rgba(7, 10, 15, 0.92))';
        const sceneStyle = visual.sceneBackdrop
            ? `style="background-image: ${sceneGradient}, url('${visual.sceneBackdrop}');"`
            : '';
        const sceneBackground = visual.sceneBackdrop ? this.resolveAbsoluteAssetUrl(visual.sceneBackdrop) : '';
        const recruitUiStyle = `style="--recruit-scene-bg: url('${sceneBackground}'); --recruit-console-frame: url('${uiAssets.consoleFrame}'); --recruit-emblem-hero: url('${uiAssets.heroEmblem}'); --recruit-emblem-forge: url('${uiAssets.forgeEmblem}'); --recruit-emblem-action: url('${uiAssets.actionEmblem}'); --recruit-emblem-premium: url('${uiAssets.premiumEmblem}');"`;

        this.element.innerHTML = `
            <div class="gacha-view recruit-view recruit-theme-${visual.themeClass}" ${recruitUiStyle}>
                <div class="recruit-scene-backdrop" ${sceneStyle}></div>
                <div class="recruit-scene-vignette"></div>
                <div class="recruit-stage">
                    <div class="recruit-stage-header">
                        <div class="recruit-stage-heading-group">
                            <div class="recruit-stage-kicker">SURVIVOR SIGNAL HUB</div>
                            <h1 class="recruit-stage-title">招募中心</h1>
                        </div>
                        <div class="recruit-stage-subtitle">在废墟信标与工坊之间切换，集中获取新的战力与装备。</div>
                    </div>
                    ${this.renderPoolTabs()}
                    ${this.renderBanner(poolId)}
                    ${this.renderConsole(poolId)}
                </div>
                ${this.renderRateSheet(poolId)}
            </div>
        `;
    }

    async executePool(poolId, count) {
        const pool = gachaManager.getPoolConfig(poolId);
        const cost = gachaManager.calculateCost(poolId, count);
        if (!pool || !cost) {
            Toast.error('招募配置异常');
            return;
        }

        const resourceInfo = shelterManager.getResourceInfo(cost.type) || {};
        const resourceLabel = resourceInfo.name || cost.type;
        if (shelterManager.getResource(cost.type) < cost.amount) {
            Toast.error(`${resourceLabel}不足，需要 ${cost.amount}`);
            return;
        }

        const result = gachaManager.pull(poolId, count);
        if (!result.success) {
            Toast.error(result.message);
            return;
        }

        const rewardResult = gachaManager.addResults(result.results);
        await RewardModal.show({
            title: `${pool.name}${count > 1 ? ` x${count}` : ''}`,
            rewards: rewardResult.rewards,
            summaryText: `已消耗 ${cost.amount} ${resourceLabel}`
        });

        window.game.save();
        this.refresh();
    }

    refresh() {
        if (this.visible) {
            this.render();
        }
    }
}

const gachaView = new GachaView();
window.gachaView = gachaView;
