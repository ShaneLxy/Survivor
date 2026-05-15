/**
 * 招募场景视图
 */
class GachaView {
    constructor() {
        this.element = document.getElementById('main-display');
        this.visible = false;
        this.activePoolId = 'hero_pool';
        this.activeRatePopover = null;
        this.showcaseTimer = null;
        this.showcaseTransitionTimer = null;
        this.showcaseItems = [];
        this.showcaseRunId = 0;
    }

    show() {
        this.visible = true;
        this.render();
    }

    hide() {
        this.visible = false;
        this.activeRatePopover = null;
        this.stopShowcaseRotation();
        this.showcaseItems = [];
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
            iconSrc: resourceInfo.iconSrc || null,
            label: resourceInfo.name || single.type,
            amount: savedAmount
        };
    }

    shuffleShowcaseItems(items = []) {
        const shuffled = [...items];
        for (let index = shuffled.length - 1; index > 0; index -= 1) {
            const swapIndex = Math.floor(Math.random() * (index + 1));
            [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
        }
        return shuffled;
    }

    truncateShowcaseName(name, maxLength = 10) {
        const text = String(name || '');
        if (text.length <= maxLength) {
            return text;
        }
        return `${text.slice(0, maxLength)}...`;
    }

    getHeroShowcaseItems() {
        const roster = [];
        const seen = new Set();

        const pushHero = (hero) => {
            if (!hero || !hero.id || seen.has(hero.id) || !hero.portrait) {
                return;
            }
            roster.push({
                id: hero.id,
                name: hero.name,
                image: hero.portrait,
                rarity: hero.rarity,
                rarityName: window.GameConfig?.getRarityConfig?.(hero.rarity)?.name || hero.rarity,
                rarityColor: window.GameConfig?.getRarityConfig?.(hero.rarity)?.color || '#f6c96b',
                professionName: HeroConfig.getProfessionName(hero.profession)
            });
            seen.add(hero.id);
        };

        ['legendary', 'epic', 'rare'].forEach((rarity) => {
            HeroConfig.getHeroesByRarity(rarity).forEach(pushHero);
        });

        return this.shuffleShowcaseItems(roster);
    }

    getEquipmentShowcaseItems() {
        const recruitRarities = new Set(['rare', 'epic', 'legendary']);
        const items = EquipmentConfig.getAllTemplates()
            .filter((item) => Array.isArray(item?.rarities) && item.rarities.some((rarity) => recruitRarities.has(rarity)))
            .filter((item) => item?.iconSrc || item?.icon)
            .map((item) => ({
                id: item.id,
                name: item.name,
                displayName: this.truncateShowcaseName(item.name, 10),
                image: item.iconSrc || '',
                icon: item.icon || '⚒️',
                rarity: item.rarities.find((rarity) => recruitRarities.has(rarity)) || 'rare',
                slot: EquipmentConfig.getSlotName(item.slot)
            }));

        return this.shuffleShowcaseItems(items);
    }

    getHeroPoolVisual() {
        const uiAssets = this.getRecruitUiAssets();
        const pool = this.getPoolConfig('hero_pool') || {};
        const showcaseItems = this.getHeroShowcaseItems();
        const primaryHero = showcaseItems[0] || null;

        return {
            sceneBackdrop: uiAssets.heroBackdrop,
            themeClass: 'hero',
            eyebrow: 'SIGNAL RECRUITMENT',
            title: pool.name || '英雄招募',
            featureName: primaryHero?.name || '末日信标已开启',
            footNote: '展示角色仅作招募氛围呈现，实际结果以奖池概率为准。',
            showcaseItems
        };
    }

    getEquipmentPoolVisual() {
        const uiAssets = this.getRecruitUiAssets();
        const pool = this.getPoolConfig('equipment_pool') || {};
        const showcaseItems = this.getEquipmentShowcaseItems();
        const primaryItem = showcaseItems[0] || null;

        return {
            sceneBackdrop: uiAssets.forgeBackdrop,
            themeClass: 'forge',
            eyebrow: 'FORGE WORKSHOP',
            title: pool.name || '装备打造',
            featureName: primaryItem?.displayName || primaryItem?.name || '钢火未熄',
            footNote: '打造结果与装备品质以奖池概率为准。',
            showcaseItems
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
                            data-pool-id="${pool.id}"
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

    renderBannerFigure(visual) {
        const showcaseItems = visual.showcaseItems || [];
        const primaryItem = showcaseItems[0] || null;
        const secondaryItem = showcaseItems[1] || primaryItem;
        if (!primaryItem) {
            return '';
        }

        if (visual.themeClass === 'forge') {
            return `
                <div class="recruit-banner-figure recruit-banner-figure-forge">
                    <div class="recruit-forge-core recruit-showcase-stage">
                        ${this.renderForgeShowcaseVisual(primaryItem, 'primary', true)}
                        ${this.renderForgeShowcaseVisual(secondaryItem, 'secondary', false)}
                    </div>
                </div>
            `;
        }

        return `
            <div class="recruit-banner-figure recruit-banner-figure-hero">
                ${this.renderHeroShowcaseVisual(primaryItem, 'primary', true)}
                ${this.renderHeroShowcaseVisual(secondaryItem, 'secondary', false)}
            </div>
        `;
    }

    renderHeroShowcaseVisual(item, slot, isActive) {
        if (!item?.image) {
            return '';
        }
        return `<img src="${item.image}" alt="${item.name}" class="recruit-banner-character recruit-showcase-visual ${isActive ? 'is-active' : ''}" data-recruit-showcase-visual="${slot}">`;
    }

    renderForgeShowcaseVisual(item, slot, isActive) {
        return `
            <div class="recruit-forge-equipment-art recruit-showcase-visual ${isActive ? 'is-active' : ''}" data-recruit-showcase-visual="${slot}" aria-label="${item?.name || ''}">
                <img src="${item?.image || ''}" alt="${item?.name || ''}" class="recruit-forge-equipment-image ${item?.image ? '' : 'is-hidden'}">
                <span class="recruit-forge-equipment-icon ${item?.image ? 'is-hidden' : ''}">${item?.icon || '⚒️'}</span>
            </div>
        `;
    }

    renderBannerFeature(visual) {
        const showcaseItems = visual.showcaseItems || [];
        const primaryItem = showcaseItems[0] || null;
        const secondaryItem = showcaseItems[1] || primaryItem;
        if (!showcaseItems.length) {
            return `<div class="recruit-banner-feature">${visual.featureName}</div>`;
        }

        return `
            <div class="recruit-banner-feature recruit-banner-feature-showcase">
                ${this.renderShowcaseCaption(primaryItem, 'primary', visual.themeClass === 'hero', true)}
                ${this.renderShowcaseCaption(secondaryItem, 'secondary', visual.themeClass === 'hero', false)}
            </div>
        `;
    }

    renderShowcaseCaption(item, slot, withHeroMeta = false, isActive = false) {
        if (!withHeroMeta) {
            return `<span class="recruit-showcase-caption ${isActive ? 'is-active' : ''}" data-recruit-showcase-caption="${slot}">${item.displayName || item.name}</span>`;
        }

        return `
            <span class="recruit-showcase-caption recruit-showcase-caption-hero ${isActive ? 'is-active' : ''}" data-recruit-showcase-caption="${slot}">
                <span class="recruit-showcase-rarity" data-recruit-showcase-rarity="${slot}" style="color: ${item.rarityColor || '#f6c96b'}">${item.rarityName || item.rarity || ''}</span>
                <span class="recruit-showcase-profession" data-recruit-showcase-profession="${slot}">${item.professionName || ''}</span>
                <span class="recruit-showcase-name" data-recruit-showcase-name="${slot}">${item.displayName || item.name}</span>
            </span>
        `;
    }

    renderBanner(poolId, visual = this.getPoolVisual(poolId)) {
        const bannerGradient = visual.themeClass === 'hero'
            ? 'linear-gradient(140deg, rgba(6, 9, 16, 0.18) 0%, rgba(6, 9, 16, 0.36) 42%, rgba(7, 9, 15, 0.66) 100%)'
            : 'linear-gradient(140deg, rgba(9, 12, 18, 0.42) 0%, rgba(8, 11, 18, 0.6) 42%, rgba(8, 10, 16, 0.82) 100%)';
        const bannerStyle = visual.sceneBackdrop
            ? `style="background-image: ${bannerGradient}, url('${visual.sceneBackdrop}');"`
            : '';
        return `
            <section class="recruit-banner recruit-banner-${visual.themeClass}" data-recruit-showcase-count="${visual.showcaseItems?.length || 0}" ${bannerStyle}>
                <div class="recruit-banner-overlay"></div>
                <div class="recruit-banner-copy">
                    <div class="recruit-banner-eyebrow">${visual.eyebrow}</div>
                    <div class="recruit-banner-title-row">
                        <span class="recruit-banner-title-emblem recruit-emblem-crop recruit-emblem-crop-${visual.themeClass}"></span>
                        <h2 class="recruit-banner-title">${visual.title}</h2>
                    </div>
                    ${this.renderBannerFeature(visual)}
                    <div class="recruit-banner-toolbar">
                        <button
                            type="button"
                            class="recruit-inline-action"
                            onclick="window.game.ui.gachaView.toggleRatePopover('${poolId}')"
                        >
                            <span class="recruit-inline-action-emblem recruit-emblem-crop recruit-emblem-crop-action" aria-hidden="true"></span>
                            概率详情
                        </button>
                    </div>
                </div>
                ${this.renderBannerFigure(visual)}
                ${this.renderConsole(poolId)}
            </section>
        `;
    }

    renderDrawButton(poolId, count) {
        const cost = gachaManager.getPaymentOption(poolId, count);
        const actionText = poolId === 'equipment_pool' ? '打造' : '招募';
        const itemConfig = cost?.type === 'item' ? ItemConfig.getItemConfig(cost.itemId) : null;
        const resourceInfo = cost?.type === 'item'
            ? {
                name: cost.name || itemConfig?.name || '招募券',
                icon: cost.icon || itemConfig?.icon || '🎟️',
                iconSrc: cost.iconSrc || itemConfig?.iconSrc || null
            }
            : (shelterManager.getResourceInfo(cost?.type) || {});
        const resourceIcon = resourceInfo.iconSrc
            ? `<img class="recruit-cost-icon-image" src="${resourceInfo.iconSrc}" alt="${resourceInfo.name || cost?.type || '资源'}">`
            : (resourceInfo.icon || '💠');
        const costText = cost?.type === 'item'
            ? `${resourceIcon}${resourceInfo.name || '招募券'}`
            : `${resourceIcon}${cost?.amount || 0}`;

        return `
            <button
                type="button"
                class="recruit-draw-button recruit-draw-button-${count === 10 ? 'ten' : 'single'}"
                onclick="window.game.ui.gachaView.executePool('${poolId}', ${count})"
            >
                ${count === 10 ? '<span class="recruit-draw-button-emblem recruit-emblem-crop recruit-emblem-crop-premium" aria-hidden="true"></span>' : ''}
                <span class="recruit-draw-button-label">${actionText}${count}次</span>
                <span class="recruit-draw-button-cost">${costText}</span>
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

    getRepeatActionText(poolId, count) {
        if (poolId === 'equipment_pool') {
            return count >= 10 ? '\u7ee7\u7eed\u5341\u953b' : '\u7ee7\u7eed\u6253\u9020';
        }

        return count >= 10 ? '\u7ee7\u7eed\u5341\u8fde' : '\u7ee7\u7eed\u62db\u52df';
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
        const resourceInfo = shelterManager.getResourceInfo(cost?.type) || {};
        const resourceIcon = resourceInfo.iconSrc
            ? `<img class="recruit-cost-icon-image" src="${resourceInfo.iconSrc}" alt="${resourceLabel}">`
            : (resourceInfo.icon || '💠');
        return includeLabel
            ? `${resourceIcon}${cost?.amount || 0} ${resourceLabel}`
            : `${resourceIcon}${cost?.amount || 0}`;
    }

    render() {
        this.stopShowcaseRotation();
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
                    ${this.renderBanner(poolId, visual)}
                </div>
                ${this.renderRateSheet(poolId)}
            </div>
        `;
        this.showcaseItems = visual.showcaseItems || [];
        this.startShowcaseRotation();
    }

    async executePool(poolId, count) {
        const pool = gachaManager.getPoolConfig(poolId);
        const cost = gachaManager.getPaymentOption(poolId, count);
        if (!pool || !cost) {
            Toast.error('招募配置异常');
            return;
        }

        const resourceLabel = gachaManager.getPaymentLabel(cost);
        if (!gachaManager.hasEnoughPayment(cost)) {
            Toast.error(`${resourceLabel}不足，需要 ${cost.amount}`);
            return;
        }

        const result = gachaManager.pull(poolId, count);
        if (!result.success) {
            Toast.error(result.message);
            return;
        }

        const rewardResult = gachaManager.addResults(result.results);
        const modalAction = await RewardModal.show({
            title: `${pool.name}${count > 1 ? ` x${count}` : ''}`,
            rewards: rewardResult.rewards,
            secondaryActionText: this.getRepeatActionText(poolId, count),
            summaryText: `已消耗 ${cost.amount} ${resourceLabel}`
        });

        window.game.save();
        this.refresh();

        if (modalAction === 'secondary') {
            await this.executePool(poolId, count);
        }
    }

    refresh() {
        if (this.visible) {
            this.render();
        }
    }

    startShowcaseRotation() {
        const banner = this.element.querySelector('.recruit-banner');
        const items = this.showcaseItems || [];
        const count = Number(banner?.dataset?.recruitShowcaseCount || items.length || 0);
        if (!banner || count <= 1) {
            return;
        }

        const runId = ++this.showcaseRunId;
        const displayDuration = 2000;
        const transitionDuration = 1000;
        const transitionBuffer = 80;
        let activeIndex = 0;
        let activeSlot = 'primary';

        this.setShowcaseSlotActive('primary', true);
        this.setShowcaseSlotActive('secondary', false);
        this.preloadShowcaseItem(items[1]);

        const scheduleNext = () => {
            if (runId !== this.showcaseRunId) {
                return;
            }
            this.showcaseTimer = window.setTimeout(beginTransition, displayDuration);
        };

        const beginTransition = () => {
            if (runId !== this.showcaseRunId) {
                return;
            }
            this.showcaseTimer = null;

            const nextIndex = (activeIndex + 1) % count;
            const nextSlot = activeSlot === 'primary' ? 'secondary' : 'primary';
            const currentSlot = activeSlot;

            this.setShowcaseSlotActive(nextSlot, false);
            this.updateShowcaseSlot(nextSlot, items[nextIndex]);
            window.requestAnimationFrame(() => {
                window.requestAnimationFrame(() => {
                    if (runId !== this.showcaseRunId) {
                        return;
                    }
                    this.setShowcaseSlotActive(currentSlot, false);
                    this.setShowcaseSlotActive(nextSlot, true);
                });
            });

            this.showcaseTransitionTimer = window.setTimeout(() => {
                if (runId !== this.showcaseRunId) {
                    return;
                }
                this.setShowcaseSlotActive(currentSlot, false);
                this.setShowcaseSlotActive(nextSlot, true);
                activeIndex = nextIndex;
                activeSlot = nextSlot;
                this.showcaseTransitionTimer = null;
                this.preloadShowcaseItem(items[(activeIndex + 1) % count]);
                scheduleNext();
            }, transitionDuration + transitionBuffer);
        };

        scheduleNext();
    }

    preloadShowcaseItem(item) {
        if (!item?.image || typeof window.Image !== 'function') {
            return;
        }
        const image = new window.Image();
        image.src = item.image;
    }

    setShowcaseSlotActive(slot, isActive) {
        this.element.querySelectorAll(`[data-recruit-showcase-visual="${slot}"], [data-recruit-showcase-caption="${slot}"]`).forEach((element) => {
            element.classList.toggle('is-active', isActive);
        });
    }

    updateShowcaseSlot(slot, item) {
        if (!item) {
            return;
        }

        const caption = this.element.querySelector(`[data-recruit-showcase-caption="${slot}"]`);
        if (caption) {
            const name = caption.querySelector?.(`[data-recruit-showcase-name="${slot}"]`);
            const rarity = caption.querySelector?.(`[data-recruit-showcase-rarity="${slot}"]`);
            const profession = caption.querySelector?.(`[data-recruit-showcase-profession="${slot}"]`);
            if (name || rarity || profession) {
                if (name) {
                    name.textContent = item.displayName || item.name;
                }
                if (rarity) {
                    rarity.textContent = item.rarityName || item.rarity || '';
                    rarity.style.color = item.rarityColor || '#f6c96b';
                }
                if (profession) {
                    profession.textContent = item.professionName || '';
                }
            } else {
                caption.textContent = item.displayName || item.name;
            }
        }

        const heroImage = this.element.querySelector(`img[data-recruit-showcase-visual="${slot}"]`);
        if (heroImage) {
            heroImage.src = item.image || '';
            heroImage.alt = item.name || '';
            return;
        }

        const forgeVisual = this.element.querySelector(`[data-recruit-showcase-visual="${slot}"]`);
        const forgeImage = forgeVisual?.querySelector?.('.recruit-forge-equipment-image');
        const forgeIcon = forgeVisual?.querySelector?.('.recruit-forge-equipment-icon');
        if (forgeVisual) {
            forgeVisual.setAttribute('aria-label', item.name || '');
        }
        if (forgeImage) {
            forgeImage.src = item.image || '';
            forgeImage.alt = item.name || '';
            forgeImage.classList.toggle('is-hidden', !item.image);
        }
        if (forgeIcon) {
            forgeIcon.textContent = item.icon || '⚒️';
            forgeIcon.classList.toggle('is-hidden', Boolean(item.image));
        }
    }

    stopShowcaseRotation() {
        this.showcaseRunId += 1;
        if (!this.showcaseTimer) {
            if (this.showcaseTransitionTimer) {
                window.clearTimeout(this.showcaseTransitionTimer);
                this.showcaseTransitionTimer = null;
            }
            return;
        }
        window.clearTimeout(this.showcaseTimer);
        this.showcaseTimer = null;
        if (this.showcaseTransitionTimer) {
            window.clearTimeout(this.showcaseTransitionTimer);
            this.showcaseTransitionTimer = null;
        }
    }
}

const gachaView = new GachaView();
window.gachaView = gachaView;
