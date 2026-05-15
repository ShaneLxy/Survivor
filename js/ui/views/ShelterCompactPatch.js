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
            ...(collectButton ? [collectButton] : []),
            { id: 'reward_ad_test', label: '\u5e7f\u544a\u6d4b\u8bd5', icon: 'AD' }
        ];
    };

    ShelterView.prototype.getCompactBuildingButtons = function(buttons) {
        const list = Array.isArray(buttons) ? buttons : this.getCompactButtonList();
        return list.filter((button) => this.isCompactBuildingButton(button));
    };

    ShelterView.prototype.getCompactSideButtonMarkup = function(button) {
        const isCollect = button.id === 'collect_all';
        const isMenu = button.id === 'building_menu';
        const isAdTest = button.id === 'reward_ad_test';
        const action = isAdTest
            ? 'window.game.ui.shelterView.watchRewardAdTest(event)'
            : isMenu
            ? 'window.game.ui.shelterView.toggleCompactBuildingMenu(event)'
            : `window.game.ui.shelterView.openBuildingDetail('${button.id}')`;

        return `
            <button type="button"
                class="shelter-side-button shelter-side-button-${button.id} ${isCollect ? 'collect-all' : ''} ${isMenu ? 'building-menu' : ''} ${isAdTest ? 'reward-ad-test' : ''}"
                data-shelter-action="${button.id}"
                onclick="${action}">
                <span class="shelter-side-button-icon">${button.icon}</span>
                <span class="shelter-side-button-label">${button.label}</span>
            </button>
        `;
    };

    ShelterView.prototype.getDirichletRewardAdPlugin = function() {
        return window.Capacitor?.Plugins?.DirichletRewardAd || null;
    };

    ShelterView.prototype.getRewardAdTestUserId = function() {
        const player = window.game?.player;
        return String(player?.id || player?.accountId || player?.username || player?.name || 'guest');
    };

    ShelterView.prototype.watchRewardAdTest = async function(event) {
        event?.stopPropagation?.();

        const itemCheck = itemManager.canAddItemBundle([{ id: 'hero_summon', count: 1 }]);
        if (!itemCheck.success) {
            Toast.error(itemCheck.message || '\u80cc\u5305\u5bb9\u91cf\u8fbe\u5230\u4e0a\u9650');
            return;
        }

        const button = this.element?.querySelector('[data-shelter-action="reward_ad_test"]');
        button?.setAttribute('disabled', 'disabled');
        button?.classList.add('is-loading');

        try {
            let skippedAd = false;
            if (itemManager.hasAdSkipCard?.()) {
                const consumeResult = itemManager.consumeAdSkipCard?.(1);
                if (!consumeResult?.success) {
                    Toast.error(consumeResult?.message || '\u514d\u5e7f\u544a\u5361\u6d88\u8017\u5931\u8d25');
                    return;
                }
                skippedAd = true;
                Toast.success(`\u5df2\u6d88\u80171\u5f20\u514d\u5e7f\u544a\u5361\uff0c\u5269\u4f59${consumeResult.remaining}\u5f20`);
            } else {
                const plugin = this.getDirichletRewardAdPlugin();
                if (!plugin?.showRewardVideo) {
                    Toast.error('\u5f53\u524d\u73af\u5883\u672a\u63a5\u5165\u6fc0\u52b1\u89c6\u9891\u5e7f\u544a');
                    return;
                }
                Toast.info('\u6b63\u5728\u52a0\u8f7d\u6fc0\u52b1\u89c6\u9891...');
                const result = await plugin.showRewardVideo({
                    spaceId: 1056294,
                    userId: this.getRewardAdTestUserId(),
                    rewardName: '\u907f\u96be\u6240\u6d4b\u8bd5\u5956\u52b1',
                    rewardAmount: 1,
                    extra: 'shelter_reward_ad_test'
                });

                const rewardGranted = Boolean(result?.rewardGranted || result?.rewardVerify || result?.videoComplete);
                if (!rewardGranted) {
                    Toast.error(result?.message || '\u5e7f\u544a\u672a\u5b8c\u6210\uff0c\u672a\u53d1\u653e\u5956\u52b1');
                    return;
                }
            }

            checkinManager?.recordRewardVideoWatch?.();
            const itemAdded = itemManager.addItem('hero_summon', 1);
            if (!itemAdded) {
                Toast.error('\u80cc\u5305\u5bb9\u91cf\u8fbe\u5230\u4e0a\u9650');
                return;
            }
            shelterManager.addResource('diamond', 100);

            window.game.save();
            window.game.refreshRuntimeUI();
            await RewardModal.show({
                title: '\u5e7f\u544a\u6d4b\u8bd5\u5956\u52b1',
                rewards: [
                    RewardModal.createResourceReward('diamond', 100),
                    RewardModal.createItemReward('hero_summon', 1)
                ],
                summaryText: skippedAd ? '\u5df2\u4f7f\u7528\u514d\u5e7f\u544a\u5361\u8df3\u8fc7\u5e7f\u544a' : '\u6fc0\u52b1\u89c6\u9891\u5df2\u5b8c\u6210'
            });
            window.game.save();
        } catch (error) {
            const message = error?.message || error || '\u6fc0\u52b1\u89c6\u9891\u64ad\u653e\u5931\u8d25';
            Toast.error(String(message));
        } finally {
            button?.removeAttribute('disabled');
            button?.classList.remove('is-loading');
        }
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
                <div class="scene-view-overlay shelter-compact-overlay"></div>
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
