/**
 * GachaView 抛光补丁：保底进度条、抽1/抽10 主次重排、资源持有对比、
 * 概率详情底部抽屉、tab 切换动画、showcase 间隔加长、十连开卡动画、
 * SIGNAL HUB 信号指示器、装备打造工坊氛围。
 */
(function () {
    if (typeof GachaView === 'undefined' || !window.gachaView) {
        return;
    }

    // ============================================
    // SIGNAL HUB 信号指示器 SVG
    // ============================================
    function signalBarsSvg() {
        return `
            <span class="recruit-signal-bars" aria-hidden="true">
                <span class="recruit-signal-bar"></span>
                <span class="recruit-signal-bar"></span>
                <span class="recruit-signal-bar"></span>
                <span class="recruit-signal-bar"></span>
            </span>
        `;
    }

    // ============================================
    // 资源持有量
    // ============================================
    function getOwnedAmount(payment) {
        if (!payment) return 0;
        if (payment.type === 'item') {
            return itemManager.getItemCount?.(payment.itemId) || 0;
        }
        return shelterManager.getResource?.(payment.type) || 0;
    }

    function getCostIconMarkup(payment, sizeClass = '') {
        if (!payment) return '';
        if (payment.type === 'item') {
            const itemConfig = ItemConfig.getItemConfig?.(payment.itemId);
            const iconSrc = payment.iconSrc || itemConfig?.iconSrc;
            const iconText = payment.icon || itemConfig?.icon || '🎟️';
            return iconSrc
                ? `<img class="recruit-cost-icon-image ${sizeClass}" src="${iconSrc}" alt="${payment.name || ''}">`
                : `<span class="recruit-cost-icon-emoji ${sizeClass}">${iconText}</span>`;
        }
        const info = shelterManager.getResourceInfo?.(payment.type) || {};
        return info.iconSrc
            ? `<img class="recruit-cost-icon-image ${sizeClass}" src="${info.iconSrc}" alt="${info.name || ''}">`
            : `<span class="recruit-cost-icon-emoji ${sizeClass}">${info.icon || '💠'}</span>`;
    }

    // ============================================
    // 抽奖按钮：保持原 console 底座的两等位结构，
    // 抽1 在左、抽10 在右，尺寸一致；仅在按钮内显示资源持有/需要对比
    // ============================================
    GachaView.prototype.renderDrawButton = function (poolId, count) {
        const cost = gachaManager.getPaymentOption(poolId, count);
        if (!cost) {
            return '';
        }
        const baseLabel = poolId === 'equipment_pool' ? '打造' : '招募';
        const labelText = `${baseLabel}${count}次`;
        const owned = getOwnedAmount(cost);
        const need = cost.amount || 1;
        const enough = owned >= need;
        const icon = getCostIconMarkup(cost, 'is-small');

        return `
            <button
                type="button"
                class="recruit-draw-button recruit-draw-button-${count === 10 ? 'ten' : 'single'} ${enough ? '' : 'is-lack'}"
                ${enough ? '' : 'disabled'}
                onclick="window.game.ui.gachaView.executePool('${poolId}', ${count})"
            >
                ${count === 10 ? '<span class="recruit-draw-button-emblem recruit-emblem-crop recruit-emblem-crop-premium" aria-hidden="true"></span>' : ''}
                <span class="recruit-draw-button-label">${labelText}</span>
                <span class="recruit-draw-button-cost recruit-draw-cost-v2">
                    ${icon}
                    <span class="recruit-draw-cost-need">${need}</span>
                </span>
            </button>
        `;
    };

    // 保持原 renderConsole 的 1fr 1fr 等分结构，不在底座内塞 pity panel
    // 不再覆盖 renderConsole；pity 面板通过 render() 后注入到 banner 内

    // ============================================
    // 概率详情：底部抽屉 + 横向 bar 占比图
    // ============================================
    const RARITY_COLOR_MAP = {
        common: '#9aa6b1',
        rare: '#7cc6ff',
        epic: '#c87df7',
        legendary: '#f6c96b'
    };

    function inferEntryRarity(entry) {
        const label = String(entry.label || '');
        if (entry.rarity) return entry.rarity;
        if (entry.heroRarity) return entry.heroRarity;
        if (label.includes('传说')) return 'legendary';
        if (label.includes('史诗')) return 'epic';
        if (label.includes('稀有')) return 'rare';
        if (label.includes('普通')) return 'common';
        return 'common';
    }

    GachaView.prototype.renderPoolRates = function (poolId) {
        const pool = this.getPoolConfig(poolId) || {};
        const entries = GachaConfig.getPoolDisplayEntries(poolId) || [];
        const total = entries.reduce((sum, e) => sum + (parseFloat(String(e.rateText).replace('%', '')) || 0), 0) || 100;

        return `
            <div class="recruit-rate-sheet-card">
                <div class="recruit-rate-sheet-header">
                    <div>
                        <div class="recruit-rate-sheet-eyebrow">POOL DATA</div>
                        <div class="recruit-rate-sheet-title">${pool.name || '奖池'} · 概率详情</div>
                    </div>
                    <button
                        type="button"
                        class="recruit-rate-sheet-close"
                        onclick="window.game.ui.gachaView.closeRatePopover()"
                        aria-label="关闭概率详情"
                    >×</button>
                </div>
                <div class="recruit-rate-pity-banner">
                    <span class="recruit-rate-pity-kicker">SSR 保底机制</span>
                    <span class="recruit-rate-pity-text">连续 <strong>50</strong> 抽未出史诗时，第 50 抽必定为史诗（保底范围不含传说品质）</span>
                </div>
                <div class="recruit-rate-sheet-list">
                    ${entries.map((entry) => {
                        const rarity = inferEntryRarity(entry);
                        const color = RARITY_COLOR_MAP[rarity] || '#9aa6b1';
                        const rate = parseFloat(String(entry.rateText).replace('%', '')) || 0;
                        const widthPct = total > 0 ? (rate / total) * 100 : 0;
                        return `
                            <div class="recruit-rate-row recruit-rate-row-v2 rarity-${rarity}">
                                <span class="recruit-rate-bar-bg">
                                    <span class="recruit-rate-bar-fill" style="width:${widthPct.toFixed(2)}%; background:${color};"></span>
                                </span>
                                <span class="recruit-rate-label">${entry.label}</span>
                                <strong class="recruit-rate-value" style="color:${color}">${entry.rateText}</strong>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div class="recruit-rate-sheet-note">所有抽取结果以实际结算为准，展示角色不代表概率提升。</div>
            </div>
        `;
    };

    // ============================================
    // 概率详情容器：底部抽屉
    // ============================================
    GachaView.prototype.renderRateSheet = function (poolId) {
        if (this.activeRatePopover !== poolId) {
            return '';
        }
        return `
            <button
                type="button"
                class="recruit-rate-sheet-backdrop recruit-rate-sheet-backdrop-v2"
                onclick="window.game.ui.gachaView.closeRatePopover()"
                aria-label="关闭概率详情"
            ></button>
            <div class="recruit-rate-sheet-shell recruit-rate-sheet-shell-v2">
                ${this.renderPoolRates(poolId)}
            </div>
        `;
    };

    // ============================================
    // 池切换：banner 进场动画
    // ============================================
    const _originalSetActivePool = GachaView.prototype.setActivePool;
    GachaView.prototype.setActivePool = function (poolId) {
        const prevDirection = this.activePoolId === poolId
            ? null
            : (this.activePoolId === 'hero_pool' ? 'right' : 'left');
        _originalSetActivePool.call(this, poolId);
        if (prevDirection && this.element) {
            const banner = this.element.querySelector('.recruit-banner');
            if (banner) {
                banner.classList.add(prevDirection === 'right' ? 'recruit-banner-enter-right' : 'recruit-banner-enter-left');
                window.requestAnimationFrame(() => {
                    window.requestAnimationFrame(() => {
                        banner.classList.add('is-entered');
                    });
                });
            }
        }
    };

    // ============================================
    // showcase 间隔放慢（从 2s → 3.5s）
    // ============================================
    const _origStartShowcase = GachaView.prototype.startShowcaseRotation;
    GachaView.prototype.startShowcaseRotation = function () {
        // 用闭包覆盖 displayDuration 不太可行，直接重写更稳：
        const banner = this.element?.querySelector?.('.recruit-banner');
        const items = this.showcaseItems || [];
        const count = Number(banner?.dataset?.recruitShowcaseCount || items.length || 0);
        if (!banner || count <= 1) {
            return _origStartShowcase?.call(this);
        }
        // 把原来的 2000ms 改成 3500ms：直接调用原方法但提前打 patch
        const originalSetTimeout = window.setTimeout;
        const view = this;
        window.setTimeout = function (fn, ms) {
            // 仅当调用栈是 startShowcaseRotation 内部时替换 2000ms
            if (ms === 2000) {
                return originalSetTimeout(fn, 3500);
            }
            return originalSetTimeout(fn, ms);
        };
        try {
            _origStartShowcase.call(this);
        } finally {
            window.setTimeout = originalSetTimeout;
        }
    };

    // ============================================
    // 保底进度面板 markup（横向紧凑版，作为 banner-copy 内一条独立细条）
    // ============================================
    function buildPityPanelMarkup(poolId) {
        const pity = gachaManager.getPityState?.(poolId) || { current: 0, threshold: 50, remaining: 50, percent: 0 };
        const isImminent = pity.remaining <= 5;
        const targetText = poolId === 'equipment_pool' ? '史诗装备' : '史诗英雄';
        return `
            <div class="recruit-pity-panel recruit-pity-panel-inline ${isImminent ? 'is-imminent' : ''}">
                <div class="recruit-pity-meta">
                    <span class="recruit-pity-kicker">SSR 保底</span>
                    <span class="recruit-pity-value">
                        <strong>${pity.current}</strong>
                        <span class="recruit-pity-sep">/</span>
                        <span class="recruit-pity-max">${pity.threshold}</span>
                    </span>
                </div>
                <div class="recruit-pity-bar">
                    <div class="recruit-pity-bar-fill" style="width:${pity.percent.toFixed(2)}%"></div>
                    <div class="recruit-pity-bar-shimmer" aria-hidden="true"></div>
                </div>
                <div class="recruit-pity-hint">
                    ${isImminent
                        ? `<span class="recruit-pity-flash">▲</span> 还差 <strong>${pity.remaining}</strong> 抽必出${targetText}`
                        : `再 <strong>${pity.remaining}</strong> 抽必出${targetText}`}
                </div>
            </div>
        `;
    }

    // ============================================
    // 渲染：加 SIGNAL HUB 信号指示器 + 工坊火星层 + 保底面板（注入 banner-copy 内）
    // ============================================
    const _origRender = GachaView.prototype.render;
    GachaView.prototype.render = function () {
        _origRender.call(this);
        if (!this.element) return;

        // 1) Kicker 旁边塞信号指示器
        const kicker = this.element.querySelector('.recruit-stage-kicker');
        if (kicker && !kicker.querySelector('.recruit-signal-bars')) {
            kicker.insertAdjacentHTML('beforeend', signalBarsSvg());
        }

        // 2) 装备打造主题：在 banner figure 区追加火星粒子层
        const forgeFigure = this.element.querySelector('.recruit-banner-figure-forge');
        if (forgeFigure && !forgeFigure.querySelector('.recruit-forge-sparks')) {
            const sparks = document.createElement('div');
            sparks.className = 'recruit-forge-sparks';
            sparks.setAttribute('aria-hidden', 'true');
            sparks.innerHTML = Array.from({ length: 10 }, (_, i) =>
                `<span class="recruit-forge-spark" style="--spark-i:${i};"></span>`
            ).join('');
            forgeFigure.appendChild(sparks);
        }

        // 3) 在 banner-toolbar 上方注入保底进度面板（不进 console，保持底座按钮布局完整）
        const toolbar = this.element.querySelector('.recruit-banner-toolbar');
        if (toolbar && !toolbar.parentElement?.querySelector('.recruit-pity-panel-inline')) {
            toolbar.insertAdjacentHTML('beforebegin', buildPityPanelMarkup(this.activePoolId));
        }
    };

    // ============================================
    // 重写 executePool：仅在 summary 文案上叠一个"保底已触发"
    // 不再插入开卡翻牌动画（按需求已移除）
    // ============================================
    GachaView.prototype.executePool = async function (poolId, count) {
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
            summaryText: result.pityTriggered?.length
                ? `已消耗 ${cost.amount} ${resourceLabel} · 保底已触发 ✦`
                : `已消耗 ${cost.amount} ${resourceLabel}`
        });

        window.game.save();
        this.refresh();

        if (modalAction === 'secondary') {
            await this.executePool(poolId, count);
        }
    };
})();
