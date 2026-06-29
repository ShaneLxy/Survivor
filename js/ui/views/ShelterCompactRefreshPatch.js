(function() {
    if (typeof ShelterView === 'undefined' || !window.shelterView) {
        return;
    }

    // ===== 建筑分类（影响图标/徽章配色） =====
    const TYPE_META = {
        building_shelter: { kind: 'core', label: 'CORE' },
        building_farm: { kind: 'production', label: 'FARM' },
        building_mine: { kind: 'production', label: 'EXTRACT' },
        building_armory: { kind: 'combat', label: 'ARMORY' },
        building_training_ground: { kind: 'combat', label: 'COMBAT' }
    };

    function svgIcon(buildingId, size = 32, variant = 'default') {
        if (window.BuildingIcon?.has?.(buildingId)) {
            return window.BuildingIcon.render(buildingId, { size, variant });
        }
        return '';
    }

    ShelterView.prototype.getCompactButtonList = function() {
        return [
            { id: 'building_shelter', label: '避难所', icon: '🏚️' },
            { id: 'building_armory', label: '武器库', icon: '🛠️' },
            { id: 'building_training_ground', label: '训练场', icon: '🏘️' }
        ];
    };
    ShelterView.prototype.formatShelterReward = function(entry) {
        if (!entry) return '';
        if (entry.type === 'item') {
            return `${ItemConfig.getItemConfig(entry.id)?.name || entry.id} x${entry.amount}`;
        }
        return `${shelterManager.getResourceDisplayName(entry.id)} x${entry.amount}`;
    };

    ShelterView.prototype.formatBuildingOutput = function(output) {
        if (!output) return '';
        const name = output.type === 'item'
            ? (ItemConfig.getItemConfig(output.id)?.name || output.id)
            : shelterManager.getResourceDisplayName(output.id);
        return `${name} ${output.amountPerHour}/小时`;
    };

    function renderCurrentEffectBlock(building, metrics) {
        if (building?.id === 'building_armory') {
            const rules = shelterManager.getArmoryReforgeRules?.() || {};
            const statNames = (rules.unlockedStats || []).map((statKey) => {
                return window.HeroConfig?.getStatDefinition?.(statKey)?.name || statKey;
            });
            return `
                <div class="shelter-detail-realtime">
                    <span class="shelter-detail-realtime-label">已解锁洗炼属性</span>
                    <strong class="shelter-detail-realtime-value">${statNames.length ? statNames.join(' · ') : '暂无'}</strong>
                </div>
                <div class="shelter-detail-realtime">
                    <span class="shelter-detail-realtime-label">洗炼额外加成</span>
                    <strong class="shelter-detail-realtime-value">+${Number(rules.bonus) || 0}</strong>
                </div>
            `;
        }

        const rows = (metrics || []).map((metric) => `
            <div class="shelter-detail-realtime">
                <span class="shelter-detail-realtime-label">${metric.label}</span>
                <strong class="shelter-detail-realtime-value">${metric.current}</strong>
            </div>
        `).join('');

        return rows || `
            <div class="shelter-detail-realtime">
                <span class="shelter-detail-realtime-label">当前效果</span>
                <strong class="shelter-detail-realtime-value">-</strong>
            </div>
        `;
    }

    // ====================================================================
    // 单建筑状态：可升级 / 可收取 / 已满级
    // ====================================================================
    ShelterView.prototype.getBuildingButtonState = function(buildingId) {
        if (buildingId === 'collect_all') {
            const aggregate = shelterManager.getAggregateProductionStatus?.();
            const total = (aggregate?.rewards || []).reduce((s, r) => s + (r.amount || 0), 0);
            return { canUpgrade: false, hasPending: total > 0, isMaxed: false, pendingCount: total };
        }
        const building = shelterManager.getBuilding?.(buildingId);
        if (!building) {
            return { canUpgrade: false, hasPending: false, isMaxed: false, pendingCount: 0 };
        }
        const info = building.getInfo();
        const isMaxed = !info.canUpgrade;
        const upgradeCost = info.upgradeCost || {};
        const canAfford = Object.entries(upgradeCost).every(([type, amount]) => shelterManager.getResource(type) >= amount);
        const status = info.effect?.type === 'production' ? shelterManager.getProductionStatus(buildingId) : null;
        const pendingCount = (status?.rewards || []).reduce((s, r) => s + (r.amount || 0), 0);
        return {
            canUpgrade: !isMaxed && canAfford,
            hasPending: pendingCount > 0,
            isMaxed,
            pendingCount
        };
    };

    // ====================================================================
    // 侧边按钮渲染：使用 SVG logo + 状态徽章
    // ====================================================================
    ShelterView.prototype.getCompactSideButtonMarkup = function(button) {
        const isCollect = button.id === 'collect_all';
        const isMenu = button.id === 'building_menu';
        const action = isMenu
            ? 'window.game.ui.shelterView.toggleCompactBuildingMenu(event)'
            : `window.game.ui.shelterView.openBuildingDetail('${button.id}')`;

        const useSvg = window.BuildingIcon?.has?.(button.id);
        const iconMarkup = useSvg
            ? `<span class="shelter-side-button-icon shelter-side-button-icon-svg">${svgIcon(button.id, 32)}</span>`
            : `<span class="shelter-side-button-icon">${button.icon}</span>`;

        let badgeMarkup = '';
        if (!isMenu) {
            const state = this.getBuildingButtonState(button.id);
            if (state.isMaxed) {
                badgeMarkup = '<span class="shelter-side-badge shelter-side-badge-maxed">MAX</span>';
            } else if (state.hasPending) {
                const n = state.pendingCount;
                badgeMarkup = `<span class="shelter-side-badge shelter-side-badge-collect">${n > 99 ? '99+' : n}</span>`;
            } else if (state.canUpgrade && !isCollect) {
                badgeMarkup = '<span class="shelter-side-badge shelter-side-badge-upgrade">↑</span>';
            }
        }

        const stateClasses = [];
        if (!isMenu) {
            const s = this.getBuildingButtonState(button.id);
            if (s.isMaxed) stateClasses.push('is-maxed');
            if (s.hasPending) stateClasses.push('is-pending');
            if (s.canUpgrade) stateClasses.push('is-upgradable');
        }

        return `
            <button type="button"
                class="shelter-side-button shelter-side-button-${button.id} ${isCollect ? 'collect-all' : ''} ${isMenu ? 'building-menu' : ''} ${stateClasses.join(' ')}"
                data-shelter-action="${button.id}"
                onclick="${action}">
                ${iconMarkup}
                <span class="shelter-side-button-label">${button.label}</span>
                ${badgeMarkup}
            </button>
        `;
    };

    // ====================================================================
    // 顶部状态：金属废土风（对齐 hero-stage-header）
    // ====================================================================
    ShelterView.prototype.getCompactTopStatus = function() {
        const shelter = shelterManager.getBuilding('building_shelter');
        const aggregate = shelterManager.getAggregateProductionStatus();
        const level = shelter?.level || 1;
        const maxLevel = shelter?.maxLevel || 10;
        const stage = this.getShelterStageText?.(level) || '初始营地';
        const totalPending = (aggregate.rewards || []).reduce((s, r) => s + (r.amount || 0), 0);

        return `
            <div class="shelter-top-status card shelter-top-status-hud">
                <div class="shelter-stage-heading-row">
                    <div class="shelter-stage-heading-group">
                        <div class="shelter-stage-kicker">SHELTER COMMAND</div>
                        <h2 class="shelter-view-title">避难所</h2>
                    </div>
                    <div class="shelter-stage-stats">
                        <div class="shelter-stage-stat">
                            <span class="shelter-stage-stat-label">等级</span>
                            <strong class="shelter-stage-stat-value">Lv.${level}<span class="shelter-stage-stat-sub">/${maxLevel}</span></strong>
                        </div>
                        <div class="shelter-stage-stat shelter-stage-stat-timer ${totalPending > 0 ? 'is-ready' : ''}">
                            <span class="shelter-stage-stat-label">
                                <span class="shelter-stage-stat-dot"></span>CYCLE
                            </span>
                            <strong class="shelter-stage-stat-value">${this.formatElapsedTimer(aggregate.elapsedSeconds)}</strong>
                        </div>
                    </div>
                </div>
                <div class="shelter-stage-subtitle">// 第 ${String(level).padStart(2, '0')} 阶段 · ${stage} · 管理营地建筑、收取产出、规划升级</div>
            </div>
        `;
    };

    ShelterView.prototype.getBuildingPreviewMetrics = function(building) {
        const info = building.getInfo();
        const currentLevel = BuildingConfig.getBuildingLevelConfig(building.id, building.level);
        const nextLevel = building.level < building.maxLevel
            ? BuildingConfig.getBuildingLevelConfig(building.id, building.level + 1)
            : null;

        if (building.id === 'building_shelter') {
            return [{
                label: '体力上限',
                current: `+${currentLevel?.energyBonus || 0}`,
                next: nextLevel ? `+${nextLevel.energyBonus || 0}` : '已满级',
                currentRaw: currentLevel?.energyBonus || 0,
                nextRaw: nextLevel?.energyBonus || 0,
                unit: ''
            }];
        }

        if (building.id === 'building_training_ground') {
            return [{
                label: '属性加成',
                current: `+${((currentLevel?.statBonus || 0) * 100).toFixed(0)}%`,
                next: nextLevel ? `+${((nextLevel?.statBonus || 0) * 100).toFixed(0)}%` : '已满级',
                currentRaw: (currentLevel?.statBonus || 0) * 100,
                nextRaw: (nextLevel?.statBonus || 0) * 100,
                unit: '%'
            }];
        }

        if (info.effect?.type === 'production') {
            const currentOutputs = currentLevel?.outputs || [];
            const nextOutputs = nextLevel?.outputs || [];
            const outputMap = new Map();

            currentOutputs.forEach((output) => outputMap.set(`${output.type}:${output.id}`, { current: output, next: null }));
            nextOutputs.forEach((output) => {
                const key = `${output.type}:${output.id}`;
                const row = outputMap.get(key) || { current: null, next: null };
                row.next = output;
                outputMap.set(key, row);
            });

            return [...outputMap.values()].map((entry) => {
                const sample = entry.current || entry.next;
                const name = sample.type === 'item'
                    ? (ItemConfig.getItemConfig(sample.id)?.name || sample.id)
                    : shelterManager.getResourceDisplayName(sample.id);
                const cur = entry.current?.amountPerHour || 0;
                const nxt = entry.next?.amountPerHour || 0;
                return {
                    label: name,
                    current: `${cur}/h`,
                    next: entry.next ? `${nxt}/h` : '已满级',
                    currentRaw: cur,
                    nextRaw: nxt,
                    unit: '/h'
                };
            });
        }

        return [{
            label: '当前效果',
            current: info.description || '-',
            next: nextLevel ? '升级后增强' : '已满级',
            currentRaw: 0,
            nextRaw: 0,
            unit: ''
        }];
    };

    ShelterView.prototype.getUpgradeCostMarkup = function(cost) {
        if (!cost) {
            return '<div class="shelter-building-cost-empty">// MAX_LEVEL_REACHED</div>';
        }

        return `
            <div class="shelter-building-cost-grid">
                ${Object.entries(cost).map(([type, amount]) => {
                    const current = shelterManager.getResource(type);
                    const enough = current >= amount;
                    const lack = enough ? 0 : (amount - current);
                    return `
                        <div class="shelter-building-cost-cell ${enough ? 'is-ok' : 'is-lack'}">
                            <div class="shelter-cost-cell-head">
                                <span class="shelter-cost-cell-name">${shelterManager.getResourceDisplayName(type)}</span>
                                <span class="shelter-cost-cell-status">${enough ? '✓' : `差${lack}`}</span>
                            </div>
                            <div class="shelter-cost-cell-value">
                                <strong>${amount}</strong>
                                <span class="shelter-cost-cell-have">/ ${current}</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    };

    // ====================================================================
    // 等级进度条：10 段切角小块
    // ====================================================================
    function renderLevelTrack(level, maxLevel) {
        const total = Math.max(1, maxLevel || 10);
        const segments = [];
        for (let i = 1; i <= total; i++) {
            let cls = 'shelter-level-segment';
            if (i < level) cls += ' is-done';
            else if (i === level) cls += ' is-current';
            segments.push(`<span class="${cls}"></span>`);
        }
        return `<div class="shelter-level-track">${segments.join('')}</div>`;
    }

    // ====================================================================
    // 当前 vs 升级后 对比卡
    // ====================================================================
    function renderCompareBlock(metrics, currentLevel, nextLevel, isMaxed) {
        if (isMaxed) {
            return `
                <div class="shelter-compare-maxed">
                    <span class="shelter-compare-maxed-icon">✦</span>
                    <span>已达至高形态 · 无更高蓝图</span>
                </div>
            `;
        }
        const leftRows = metrics.map((m) => `
            <div class="shelter-compare-row">
                <span class="shelter-compare-row-label">${m.label}</span>
                <strong class="shelter-compare-row-value">${m.current}</strong>
            </div>
        `).join('');
        const rightRows = metrics.map((m) => {
            const diff = (typeof m.nextRaw === 'number' && typeof m.currentRaw === 'number')
                ? (m.nextRaw - m.currentRaw) : 0;
            const diffStr = diff > 0
                ? `<span class="shelter-compare-diff">+${diff}${m.unit || ''}</span>`
                : '';
            return `
                <div class="shelter-compare-row">
                    <span class="shelter-compare-row-label">${m.label}</span>
                    <strong class="shelter-compare-row-value shelter-compare-row-value-next">${m.next}</strong>
                    ${diffStr}
                </div>
            `;
        }).join('');

        return `
            <div class="shelter-compare-block">
                <div class="shelter-compare-card shelter-compare-card-current">
                    <div class="shelter-compare-card-head">
                        <span class="shelter-compare-card-kicker">CURRENT</span>
                        <span class="shelter-compare-card-level">Lv.${currentLevel}</span>
                    </div>
                    ${leftRows}
                </div>
                <div class="shelter-compare-arrow" aria-hidden="true">
                    <span class="shelter-compare-arrow-line"></span>
                    <span class="shelter-compare-arrow-tip">▶</span>
                </div>
                <div class="shelter-compare-card shelter-compare-card-next">
                    <div class="shelter-compare-card-head">
                        <span class="shelter-compare-card-kicker">UPGRADE</span>
                        <span class="shelter-compare-card-level">Lv.${nextLevel}</span>
                    </div>
                    ${rightRows}
                </div>
            </div>
        `;
    }

    // ====================================================================
    // 新版升级 Modal（升级后保持开启，可连续升级）
    // ====================================================================
    ShelterView.prototype.openBuildingDetail = function(buildingId) {
        if (buildingId === 'collect_all') {
            this.collectAllProduction();
            return;
        }

        const initialBuilding = shelterManager.getBuilding(buildingId);
        if (!initialBuilding) {
            Toast.error('建筑不存在');
            return;
        }

        const self = this;

        const buildContent = () => {
            const building = shelterManager.getBuilding(buildingId);
            if (!building) return '';
            const info = building.getInfo();
            const meta = TYPE_META[buildingId] || { kind: 'core', label: 'NODE' };
            const isMaxed = !info.canUpgrade;
            const metrics = self.getBuildingPreviewMetrics(building);
            const isProductionBuilding = info.effect?.type === 'production';
            const productionStatus = isProductionBuilding ? shelterManager.getProductionStatus(buildingId) : null;
            const currentIncome = productionStatus?.rewards?.length
                ? productionStatus.rewards.map((reward) => self.formatShelterReward(reward)).join(' · ')
                : '尚未达到结算条件';
            const currentEffectRows = renderCurrentEffectBlock(building, metrics);
            const realtimeBlock = isProductionBuilding ? `
                    <div class="shelter-detail-section">
                        <div class="shelter-detail-section-title">▸ 实时数据</div>
                        <div class="shelter-detail-realtime">
                            <span class="shelter-detail-realtime-label">累计可收取</span>
                            <strong class="shelter-detail-realtime-value">${currentIncome}</strong>
                        </div>
                    </div>
            ` : '';

            const cost = info.upgradeCost;
            const canAfford = cost && Object.entries(cost).every(([type, amount]) => shelterManager.getResource(type) >= amount);
            const upgradeEnabled = !isMaxed && canAfford;

            const iconMarkup = window.BuildingIcon?.has?.(buildingId)
                ? window.BuildingIcon.render(buildingId, { size: 80, variant: isMaxed ? 'maxed' : 'default' })
                : `<span class="building-icon-emoji" style="font-size:48px;">${info.icon}</span>`;

            return `
                <div class="shelter-building-detail shelter-building-detail-cyber">
                    <div class="shelter-cyber-scanline" aria-hidden="true"></div>

                    <div class="shelter-detail-header">
                        <div class="shelter-detail-icon-wrap kind-${meta.kind}">
                            ${iconMarkup}
                            ${isMaxed ? '<span class="shelter-detail-maxed-star" aria-hidden="true">★</span>' : ''}
                        </div>
                        <div class="shelter-detail-header-main">
                            <div class="shelter-detail-name-row">
                                <strong class="shelter-detail-name">${info.name}</strong>
                                <span class="shelter-detail-type-badge kind-${meta.kind}">${meta.label}</span>
                            </div>
                            <div class="shelter-detail-level-row">
                                <span class="shelter-detail-level-text">Lv.${info.level}${info.maxLevel ? ` / ${info.maxLevel}` : ''}</span>
                                ${renderLevelTrack(info.level, info.maxLevel)}
                            </div>
                            <div class="shelter-detail-desc">${info.description || '建筑效果将在此展示。'}</div>
                        </div>
                    </div>

                    <div class="shelter-detail-section">
                        <div class="shelter-detail-section-title">▸ 当前生效效果</div>
                        ${currentEffectRows}
                    </div>

                    ${realtimeBlock}

                    <div class="shelter-detail-section">
                        <div class="shelter-detail-section-title">▸ 升级蓝图</div>
                        ${renderCompareBlock(metrics, info.level, info.level + 1, isMaxed)}
                    </div>

                    ${!isMaxed ? `
                        <div class="shelter-detail-section">
                            <div class="shelter-detail-section-title">▸ 升级消耗</div>
                            ${self.getUpgradeCostMarkup(cost)}
                        </div>
                    ` : ''}

                    <button class="shelter-detail-upgrade-btn ${upgradeEnabled ? 'is-ready' : isMaxed ? 'is-maxed' : 'is-lack'}"
                        ${upgradeEnabled ? '' : 'disabled'}
                        type="button"
                        id="shelter-detail-upgrade-btn">
                        <span class="shelter-detail-upgrade-btn-shimmer" aria-hidden="true"></span>
                        <span class="shelter-detail-upgrade-btn-text">
                            ${isMaxed ? '已达至高形态' : (canAfford ? '执行升级 ▸' : '资源不足')}
                        </span>
                    </button>
                </div>
            `;
        };

        const initialMeta = TYPE_META[buildingId] || { kind: 'core', label: 'NODE' };
        const buildingIdx = ['building_shelter', 'building_armory', 'building_training_ground'].indexOf(buildingId);
        const codeNum = String(buildingIdx >= 0 ? buildingIdx + 1 : 0).padStart(3, '0');

        const modal = new Modal({
            className: `shelter-building-modal-shell shelter-building-modal-cyber kind-${initialMeta.kind}`,
            title: `// BUILDING_${codeNum} · ${initialMeta.label}`,
            showClose: true,
            content: buildContent(),
            buttons: []
        });
        modal.show();

        const bindUpgrade = () => {
            const btn = modal.element?.querySelector('#shelter-detail-upgrade-btn');
            if (!btn || btn.disabled) return;
            btn.addEventListener('click', () => {
                const result = shelterManager.upgradeBuilding(buildingId);
                if (!result?.success) {
                    Toast.error(result?.message || '升级失败');
                    return;
                }
                Toast.success(result.message || '升级成功');
                window.game?.save?.();
                // 同步刷新避难所主视图（背景）
                self.refresh?.();
                // 刷新弹窗内容，保持打开状态以便连续升级
                modal.setContent(buildContent());
                bindUpgrade();
            });
        };
        bindUpgrade();
    };

    // ====================================================================
    // 顶部 HUD 横向布局：状态卡 + 横向操作条（替代右侧竖列）
    // ====================================================================
    ShelterView.prototype.render = function() {
        const compactButtons = this.getCompactButtonList();
        const mainButtons = this.getCompactMainButtons(compactButtons);
        const buildingButtons = this.getCompactBuildingButtons(compactButtons);

        this.element.innerHTML = `
            <div class="scene-view shelter-view shelter-view-compact shelter-view-hud">
                <div class="scene-view-backdrop shelter-scene-backdrop">
                    ${this.getSceneMediaMarkup('shelter')}
                    <div class="scene-backdrop-glow scene-backdrop-glow-a"></div>
                    <div class="scene-backdrop-glow scene-backdrop-glow-b"></div>
                    <div class="scene-backdrop-grid"></div>
                </div>
                <div class="scene-view-content shelter-compact-content shelter-compact-content-hud">
                    <div class="shelter-hud-top-stack">
                        ${this.getCompactTopStatus()}
                        <div class="shelter-side-button-column shelter-side-button-column-hud">
                            ${mainButtons.map((button) => this.getCompactSideButtonMarkup(button)).join('')}
                            <div class="shelter-building-button-popover">
                                ${buildingButtons.map((button) => this.getCompactSideButtonMarkup(button)).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    };

    // ====================================================================
    // 点击外部关闭建筑 popover
    // ====================================================================
    let _shelterPopoverOutsideHandler = null;

    function uninstallOutsideHandler() {
        if (_shelterPopoverOutsideHandler) {
            document.removeEventListener('click', _shelterPopoverOutsideHandler, true);
            document.removeEventListener('touchstart', _shelterPopoverOutsideHandler, true);
            _shelterPopoverOutsideHandler = null;
        }
    }

    function installOutsideHandler(column) {
        uninstallOutsideHandler();
        _shelterPopoverOutsideHandler = (ev) => {
            if (!column || !column.isConnected) {
                uninstallOutsideHandler();
                return;
            }
            const target = ev.target;
            // 点击发生在 column 内（包括 popover 和 building-menu 按钮）则不关闭
            if (column.contains(target)) return;
            column.classList.remove('is-buildings-open');
            uninstallOutsideHandler();
        };
        // 使用 capture 阶段，确保在 onclick 之前能拦截到屏幕其它区域的点击
        document.addEventListener('click', _shelterPopoverOutsideHandler, true);
        document.addEventListener('touchstart', _shelterPopoverOutsideHandler, true);
    }

    ShelterView.prototype.toggleCompactBuildingMenu = function(event) {
        event?.stopPropagation?.();
        const column = this.element?.querySelector('.shelter-side-button-column');
        if (!column) return;
        const willOpen = !column.classList.contains('is-buildings-open');
        column.classList.toggle('is-buildings-open');
        if (willOpen) {
            // 推迟一帧绑定，避免同一次点击被立即识别为外部点击
            window.requestAnimationFrame(() => installOutsideHandler(column));
        } else {
            uninstallOutsideHandler();
        }
    };

    // 视图隐藏/重新渲染时清理监听
    const _originalHide = ShelterView.prototype.hide;
    ShelterView.prototype.hide = function() {
        uninstallOutsideHandler();
        if (typeof _originalHide === 'function') return _originalHide.apply(this, arguments);
    };
})();

(function() {
    if (typeof ShelterView === 'undefined' || !window.shelterView) {
        return;
    }

    const hiddenBuildingIds = new Set(['building_farm', 'building_mine', 'building_well']);
    const previousGetCompactButtonList = ShelterView.prototype.getCompactButtonList;
    ShelterView.prototype.getCompactButtonList = function() {
        const buttons = typeof previousGetCompactButtonList === 'function'
            ? previousGetCompactButtonList.call(this)
            : [];
        return buttons.filter((button) => !hiddenBuildingIds.has(button?.id));
    };

    ShelterView.prototype.getBuildingPreviewMetrics = function(building) {
        const info = building.getInfo();
        const currentLevel = BuildingConfig.getBuildingLevelConfig(building.id, building.level) || {};
        const nextLevel = building.level < building.maxLevel
            ? (BuildingConfig.getBuildingLevelConfig(building.id, building.level + 1) || null)
            : null;

        if (building.id === 'building_training_ground') {
            return [{
                label: '\u5c5e\u6027\u52a0\u6210',
                current: `+${((currentLevel.statBonus || 0) * 100).toFixed(0)}%`,
                next: nextLevel ? `+${((nextLevel.statBonus || 0) * 100).toFixed(0)}%` : '\u5df2\u6ee1\u7ea7',
                currentRaw: (currentLevel.statBonus || 0) * 100,
                nextRaw: (nextLevel?.statBonus || 0) * 100,
                unit: '%'
            }];
        }

        if (info.effect?.type === 'production') {
            const currentOutputs = Array.isArray(currentLevel.outputs) ? currentLevel.outputs : [];
            const nextOutputs = Array.isArray(nextLevel?.outputs) ? nextLevel.outputs : [];
            const outputMap = new Map();

            currentOutputs.forEach((output) => outputMap.set(`${output.type || 'resource'}:${output.id}`, { current: output, next: null }));
            nextOutputs.forEach((output) => {
                const key = `${output.type || 'resource'}:${output.id}`;
                const row = outputMap.get(key) || { current: null, next: null };
                row.next = output;
                outputMap.set(key, row);
            });

            return [...outputMap.values()].map((entry) => {
                const sample = entry.current || entry.next || {};
                const name = sample.type === 'item'
                    ? (ItemConfig.getItemConfig(sample.id)?.name || sample.id)
                    : shelterManager.getResourceDisplayName(sample.id);
                const current = Number(entry.current?.amountPerHour) || 0;
                const next = Number(entry.next?.amountPerHour) || 0;
                return {
                    label: name,
                    current: `${current}/h`,
                    next: entry.next ? `${next}/h` : '\u5df2\u6ee1\u7ea7',
                    currentRaw: current,
                    nextRaw: next,
                    unit: '/h'
                };
            });
        }

        return [{
            label: '\u5f53\u524d\u6548\u679c',
            current: info.description || '-',
            next: nextLevel ? '\u5347\u7ea7\u540e\u589e\u5f3a' : '\u5df2\u6ee1\u7ea7',
            currentRaw: 0,
            nextRaw: 0,
            unit: ''
        }];
    };
})();
