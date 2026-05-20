(function() {
    if (typeof ShelterView === 'undefined' || !window.shelterView) {
        return;
    }

    ShelterView.prototype.getCompactButtonList = function() {
        return [
            { id: 'building_shelter', label: '避难所', icon: '🏠' },
            { id: 'building_farm', label: '农场', icon: '🌾' },
            { id: 'building_mine', label: '林矿', icon: '🌲' },
            { id: 'building_well', label: '水井', icon: '🧪' },
            { id: 'building_training_ground', label: '\u8bad\u7ec3\u573a', icon: '\ud83c\udfd8\ufe0f' },
            { id: 'collect_all', label: '一键收获', icon: '🎁' }
        ];
    };

    ShelterView.prototype.isCompactBuildingButton = function(button) {
        return button?.id?.startsWith('building_');
    };

    ShelterView.prototype.getCompactMainButtons = function(buttons) {
        const list = Array.isArray(buttons) ? buttons : this.getCompactButtonList();
        const collectButton = list.find((button) => button.id === 'collect_all');
        const mailboxButton = list.find((button) => button.id === 'mailbox');
        return [
            ...(mailboxButton ? [mailboxButton] : []),
            { id: 'building_menu', label: '\u5efa\u7b51', icon: '\ud83c\udfd7\ufe0f' },
            ...(collectButton ? [collectButton] : [])
        ];
    };

    ShelterView.prototype.getCompactBuildingButtons = function(buttons) {
        const list = Array.isArray(buttons) ? buttons : this.getCompactButtonList();
        return list.filter((button) => this.isCompactBuildingButton(button));
    };

    ShelterView.prototype.getCompactSideButtonMarkup = function(button) {
        const isCollect = button.id === 'collect_all';
        const isMenu = button.id === 'building_menu';
        const action = isMenu
            ? 'window.game.ui.shelterView.toggleCompactBuildingMenu(event)'
            : `window.game.ui.shelterView.openBuildingDetail('${button.id}')`;

        return `
            <button type="button"
                class="shelter-side-button shelter-side-button-${button.id} ${isCollect ? 'collect-all' : ''} ${isMenu ? 'building-menu' : ''}"
                data-shelter-action="${button.id}"
                onclick="${action}">
                <span class="shelter-side-button-icon">${button.icon}</span>
                <span class="shelter-side-button-label">${button.label}</span>
            </button>
        `;
    };

    ShelterView.prototype.toggleCompactBuildingMenu = function(event) {
        event?.stopPropagation?.();
        const column = this.element?.querySelector('.shelter-side-button-column');
        if (!column) {
            return;
        }
        column.classList.toggle('is-buildings-open');
    };

    ShelterView.prototype.getCompactTopStatus = function() {
        const shelter = shelterManager.getBuilding('building_shelter');
        const aggregate = shelterManager.getAggregateProductionStatus();
        const rewardText = aggregate.rewards.length > 0
            ? aggregate.rewards.map((reward) => `${reward.type === 'item'
                ? (ItemConfig.getItemConfig(reward.id)?.name || reward.id)
                : shelterManager.getResourceDisplayName(reward.id)} x${reward.amount}`).join(' · ')
            : '满 1 小时后可结算';

        return `
            <div class="shelter-top-status card">
                <div class="shelter-top-status-main">
                    <div class="shelter-top-status-heading-group">
                        <div class="shelter-top-status-kicker">SHELTER</div>
                        <div class="shelter-top-status-title">避难所 Lv.${shelter?.level || 1}</div>
                        <div class="shelter-top-status-stage">${this.getShelterStageText?.(shelter?.level || 1) || '初始营火'}</div>
                    </div>
                    <div class="shelter-top-status-timer">
                        <span>统一计时</span>
                        <strong>${this.formatElapsedTimer(aggregate.elapsedSeconds)}</strong>
                    </div>
                </div>
                <div class="shelter-top-status-subtitle">管理营地建筑、统一收取产出，并规划下一次升级。</div>
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
        const productionText = info.effect?.type === 'production'
            ? (info.effect.outputs || []).map((output) => `${output.type === 'item'
                ? (ItemConfig.getItemConfig(output.id)?.name || output.id)
                : shelterManager.getResourceDisplayName(output.id)} ${output.amountPerHour}/小时`).join(' · ')
            : '该建筑提供避难所核心增益';
        const currentIncome = productionStatus?.rewards?.length
            ? productionStatus.rewards.map((reward) => `${reward.type === 'item'
                ? (ItemConfig.getItemConfig(reward.id)?.name || reward.id)
                : shelterManager.getResourceDisplayName(reward.id)} x${reward.amount}`).join(' · ')
            : '当前未达到可收获条件';
        const upgradeCost = info.upgradeCost
            ? Object.entries(info.upgradeCost).map(([type, amount]) => `${shelterManager.getResourceDisplayName(type)} ${amount}`).join(' · ')
            : '已满级';

        const modal = new Modal({
            title: info.name,
            content: `
                <div class="shelter-building-detail">
                    <div class="shelter-building-detail-icon">${info.icon}</div>
                    <div class="shelter-building-detail-row"><span>建筑等级</span><strong>Lv.${info.level}</strong></div>
                    <div class="shelter-building-detail-row"><span>单位时间收益</span><strong>${productionText}</strong></div>
                    <div class="shelter-building-detail-row"><span>当前累计收益</span><strong>${currentIncome}</strong></div>
                    <div class="shelter-building-detail-row"><span>升级所需材料</span><strong>${upgradeCost}</strong></div>
                </div>
            `,
            buttons: [
                {
                    text: '升级',
                    className: 'btn-primary',
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

    ShelterView.prototype.collectAllProduction = async function() {
        const result = shelterManager.collectAllProduction();
        if (!result.success) {
            Toast.info(result.message);
            return;
        }
        const rewards = result.rewards.map((reward) => reward.type === 'item'
            ? RewardModal.createItemReward(reward.id, reward.amount)
            : RewardModal.createResourceReward(reward.id, reward.amount));
        await RewardModal.show({
            title: '一键收获',
            rewards,
            summaryText: `本次统一结算 ${result.hours} 小时收益`
        });
        this.render();
        window.game.refreshRuntimeUI();
        window.game.save();
    };

    ShelterView.prototype.render = function() {
        const compactButtons = this.getCompactButtonList();
        const mainButtons = this.getCompactMainButtons(compactButtons);
        const buildingButtons = this.getCompactBuildingButtons(compactButtons);

        this.element.innerHTML = `
            <div class="scene-view shelter-view shelter-view-compact">
                <div class="scene-view-backdrop shelter-scene-backdrop">
                    ${this.getSceneMediaMarkup('shelter')}
                    <div class="scene-backdrop-glow scene-backdrop-glow-a"></div>
                    <div class="scene-backdrop-glow scene-backdrop-glow-b"></div>
                    <div class="scene-backdrop-grid"></div>
                </div>
                <div class="scene-view-content shelter-compact-content">
                    ${this.getCompactTopStatus()}
                    <div class="shelter-side-button-column">
                        ${mainButtons.map((button) => this.getCompactSideButtonMarkup(button)).join('')}
                        <div class="shelter-building-button-popover">
                            ${buildingButtons.map((button) => this.getCompactSideButtonMarkup(button)).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    };

    ShelterView.prototype.renderBuildings = function() {};

    ShelterView.prototype.updateProductionTimers = function() {
        if (!this.visible) {
            return;
        }
        const status = this.element.querySelector('.shelter-top-status');
        if (status) {
            status.outerHTML = this.getCompactTopStatus();
        }
    };

    ShelterView.prototype.refresh = function() {
        if (this.visible) {
            this.render();
        }
    };
})();
