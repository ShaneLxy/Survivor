(function() {
    if (typeof ShelterView === 'undefined' || !window.shelterView) {
        return;
    }

    ShelterView.prototype.getCompactButtonList = function() {
        return [
            { id: 'building_shelter', label: '避难所', icon: '🏠' },
            { id: 'building_farm', label: '农场', icon: '🌾' },
            { id: 'building_mine', label: '矿场', icon: '⛏️' },
            { id: 'building_well', label: '水井', icon: '💧' },
            { id: 'collect_all', label: '一键收取', icon: '📦' }
        ];
    };

    ShelterView.prototype.formatShelterReward = function(entry) {
        if (!entry) {
            return '';
        }
        if (entry.type === 'item') {
            return `${ItemConfig.getItemConfig(entry.id)?.name || entry.id} x${entry.amount}`;
        }
        return `${shelterManager.getResourceDisplayName(entry.id)} x${entry.amount}`;
    };

    ShelterView.prototype.formatBuildingOutput = function(output) {
        if (!output) {
            return '';
        }
        const name = output.type === 'item'
            ? (ItemConfig.getItemConfig(output.id)?.name || output.id)
            : shelterManager.getResourceDisplayName(output.id);
        return `${name} ${output.amountPerHour}/小时`;
    };

    ShelterView.prototype.getCompactTopStatus = function() {
        const shelter = shelterManager.getBuilding('building_shelter');
        const aggregate = shelterManager.getAggregateProductionStatus();
        const rewardText = aggregate.rewards.length > 0
            ? aggregate.rewards.map((reward) => this.formatShelterReward(reward)).join(' · ')
            : '满 1 小时后可统一结算';

        return `
            <div class="shelter-top-status card">
                <div class="shelter-top-status-main">
                    <div class="shelter-top-status-heading-group">
                        <div class="shelter-top-status-kicker">SHELTER</div>
                        <div class="shelter-top-status-title">避难所 Lv.${shelter?.level || 1}</div>
                        <div class="shelter-top-status-stage">${this.getShelterStageText?.(shelter?.level || 1) || '初始营地'}</div>
                    </div>
                    <div class="shelter-top-status-timer">
                        <span>统一计时</span>
                        <strong>${this.formatElapsedTimer(aggregate.elapsedSeconds)}</strong>
                    </div>
                </div>
                <div class="shelter-top-status-subtitle">管理营地建筑、统一收取产出，并规划下一次升级。</div>
                <div class="shelter-top-status-preview">${rewardText}</div>
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
                next: nextLevel ? `+${nextLevel.energyBonus || 0}` : '已满级'
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
                return {
                    label: name,
                    current: `${entry.current?.amountPerHour || 0}/小时`,
                    next: entry.next ? `${entry.next.amountPerHour || 0}/小时` : '已满级'
                };
            });
        }

        return [{
            label: '当前效果',
            current: info.description || '-',
            next: nextLevel ? '升级后增强' : '已满级'
        }];
    };

    ShelterView.prototype.getUpgradeCostMarkup = function(cost) {
        if (!cost) {
            return '<div class="shelter-building-cost-empty">已满级</div>';
        }

        return `
            <div class="shelter-building-cost-list">
                ${Object.entries(cost).map(([type, amount]) => {
                    const current = shelterManager.getResource(type);
                    const enough = current >= amount;
                    return `
                        <div class="shelter-building-cost-item ${enough ? 'is-ok' : 'is-lack'}">
                            <span>${shelterManager.getResourceDisplayName(type)}</span>
                            <strong>${current}/${amount}</strong>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    };

    ShelterView.prototype.openBuildingDetail = function(buildingId) {
        if (buildingId === 'collect_all') {
            this.collectAllProduction();
            return;
        }

        const building = shelterManager.getBuilding(buildingId);
        if (!building) {
            Toast.error('建筑不存在');
            return;
        }

        const info = building.getInfo();
        const productionStatus = info.effect?.type === 'production' ? shelterManager.getProductionStatus(buildingId) : null;
        const currentIncome = productionStatus?.rewards?.length
            ? productionStatus.rewards.map((reward) => this.formatShelterReward(reward)).join(' · ')
            : '当前尚未达到可收取条件';
        const metrics = this.getBuildingPreviewMetrics(building);

        const modal = new Modal({
            className: 'shelter-building-modal-shell',
            title: info.name,
            content: `
                <div class="shelter-building-detail">
                    <div class="shelter-building-detail-head">
                        <div class="shelter-building-detail-icon">${info.icon}</div>
                        <div class="shelter-building-detail-main">
                            <div class="shelter-building-detail-name-row">
                                <strong>${info.name}</strong>
                                <span>Lv.${info.level}${info.maxLevel ? ` / ${info.maxLevel}` : ''}</span>
                            </div>
                            <div class="shelter-building-detail-desc">${info.description || '建筑效果将在此展示。'}</div>
                        </div>
                    </div>
                    <div class="shelter-building-detail-panel">
                        <div class="shelter-building-detail-panel-title">当前产出</div>
                        <div class="shelter-building-detail-note">
                            ${info.effect?.type === 'production'
                                ? (info.effect.outputs || []).map((output) => this.formatBuildingOutput(output)).join(' · ')
                                : '该建筑提供避难所核心增益'}
                        </div>
                        <div class="shelter-building-detail-note">累计可收取: ${currentIncome}</div>
                    </div>
                    <div class="shelter-building-compare">
                        <div class="shelter-building-compare-header">
                            <span>属性</span>
                            <span>当前</span>
                            <span>升级后</span>
                        </div>
                        ${metrics.map((metric) => `
                            <div class="shelter-building-compare-row">
                                <span>${metric.label}</span>
                                <strong>${metric.current}</strong>
                                <strong class="next">${metric.next}</strong>
                            </div>
                        `).join('')}
                    </div>
                    <div class="shelter-building-detail-panel">
                        <div class="shelter-building-detail-panel-title">升级消耗</div>
                        ${this.getUpgradeCostMarkup(info.upgradeCost)}
                    </div>
                </div>
            `,
            buttons: [
                {
                    text: info.canUpgrade ? '升级' : '已满级',
                    className: info.canUpgrade ? 'btn-primary' : 'btn-secondary',
                    disabled: !info.canUpgrade,
                    onClick: () => {
                        modal.close();
                        this.upgradeBuilding(buildingId);
                    }
                },
                { text: '关闭', className: 'btn-secondary', onClick: () => modal.close() }
            ]
        });
        modal.show();
    };
})();
