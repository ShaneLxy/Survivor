(function() {
    if (typeof ShelterView === 'undefined' || !window.shelterView) {
        return;
    }

    ShelterView.prototype.show = function() {
        this.visible = true;
        this.render();
        this.startTicker();
    };

    ShelterView.prototype.hide = function() {
        this.visible = false;
        this.stopTicker();
        this.element.innerHTML = '';
    };

    ShelterView.prototype.startTicker = function() {
        this.stopTicker();
        this.timer = setInterval(() => {
            if (this.visible) {
                this.updateProductionTimers();
            }
        }, 1000);
    };

    ShelterView.prototype.stopTicker = function() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    };

    ShelterView.prototype.render = function() {
        this.element.innerHTML = `
            <div class="scene-view shelter-view shelter-scene-view">
                <div class="scene-view-backdrop shelter-scene-backdrop">
                    ${this.getSceneMediaMarkup('shelter')}
                    <div class="scene-backdrop-glow scene-backdrop-glow-a"></div>
                    <div class="scene-backdrop-glow scene-backdrop-glow-b"></div>
                    <div class="scene-backdrop-grid"></div>
                </div>
                <div class="scene-view-overlay"></div>
                <div class="scene-view-content">
                    <div class="shelter-scene-header">
                        <div>
                            <h2 class="shelter-title">避难所</h2>
                            <div class="shelter-subtitle">资源会持续累积，满 1 小时后即可手动收获。</div>
                        </div>
                    </div>
                    <div id="building-grid" class="building-grid shelter-building-grid"></div>
                </div>
            </div>
        `;
        this.renderBuildings();
    };

    ShelterView.prototype.renderBuildings = function() {
        const grid = this.element.querySelector('#building-grid');
        const buildings = shelterManager.getAllBuildings();

        if (!grid) {
            return;
        }
        if (!buildings || buildings.length === 0) {
            grid.innerHTML = '<div class="shelter-empty">暂无建筑</div>';
            return;
        }

        grid.innerHTML = '';
        buildings.forEach((building) => {
            grid.appendChild(this.createBuildingCard(building));
        });
        this.updateProductionTimers();
    };

    ShelterView.prototype.createBuildingCard = function(building) {
        const card = document.createElement('div');
        card.className = 'building-card card shelter-building-card';
        const info = building.getInfo();
        const productionMarkup = this.getProductionMarkup(info.id, info.effect);

        card.innerHTML = `
            <div class="building-card-top">
                <div class="building-icon">${info.icon}</div>
                <div class="building-meta">
                    <div class="building-name">${info.name}</div>
                    <div class="building-level">Lv.${info.level}${info.maxLevel ? ` / ${info.maxLevel}` : ''}</div>
                </div>
            </div>
            <div class="building-effect">${this.getEffectTextPatched(info.effect)}</div>
            ${productionMarkup}
            <div class="building-action-row">${this.getUpgradeButtonPatched(info)}</div>
        `;
        return card;
    };

    ShelterView.prototype.getEffectTextPatched = function(effect) {
        if (!effect) {
            return '';
        }
        switch (effect.type) {
            case 'energyBonus':
                return `体力上限 +${effect.value}`;
            case 'production':
                return (effect.outputs || [])
                    .map((output) => `${output.type === 'item'
                        ? (ItemConfig.getItemConfig(output.id)?.name || output.id)
                        : shelterManager.getResourceDisplayName(output.id)} ${output.amountPerHour}/小时`)
                    .join(' · ');
            case 'statBonus':
                return `属性加成 ${(effect.value * 100).toFixed(0)}%`;
            default:
                return '';
        }
    };

    ShelterView.prototype.getUpgradeButtonPatched = function(info) {
        if (!info.canUpgrade) {
            return '<button class="btn btn-small btn-secondary" disabled>已满级</button>';
        }
        if (!info.upgradeCost) {
            return '<button class="btn btn-small btn-secondary" disabled>暂无升级数据</button>';
        }
        const costText = Object.entries(info.upgradeCost)
            .map(([type, amount]) => `${shelterManager.getResourceDisplayName(type)}:${amount}`)
            .join(' ');
        return `<button class="btn btn-small btn-primary" onclick="window.game.ui.shelterView.upgradeBuilding('${info.id}')">升级 (${costText})</button>`;
    };

    ShelterView.prototype.getProductionMarkup = function(buildingId, effect) {
        if (effect?.type !== 'production') {
            return '';
        }
        const status = shelterManager.getProductionStatus(buildingId);
        return `
            <div class="building-production-panel" data-building-id="${buildingId}">
                <div class="building-production-row">
                    <span class="building-production-label">累计计时</span>
                    <strong class="building-production-timer">${this.formatElapsedTimer(status.elapsedSeconds)}</strong>
                </div>
                <div class="building-production-row">
                    <span class="building-production-label">当前可结算</span>
                    <span class="building-production-preview">${this.formatProductionRewards(status.rewards, status.roundedHours)}</span>
                </div>
                <button class="btn ${status.canCollect ? 'btn-success' : 'btn-secondary'} building-collect-btn"
                    ${status.canCollect ? '' : 'disabled'}
                    onclick="window.game.ui.shelterView.collectBuildingProduction('${buildingId}')">
                    ${status.canCollect ? '收获资源' : '未满 1 小时'}
                </button>
            </div>
        `;
    };

    ShelterView.prototype.formatElapsedTimer = function(totalSeconds) {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
    };

    ShelterView.prototype.formatProductionRewards = function(rewards, roundedHours) {
        if (!rewards.length || roundedHours < 1) {
            return '满 1 小时后可收获';
        }
        return `${roundedHours} 小时 · ${rewards.map((reward) => `${reward.type === 'item'
            ? (ItemConfig.getItemConfig(reward.id)?.name || reward.id)
            : shelterManager.getResourceDisplayName(reward.id)} x${reward.amount}`).join(' · ')}`;
    };

    ShelterView.prototype.updateProductionTimers = function() {
        if (!this.visible) {
            return;
        }
        this.element.querySelectorAll('.building-production-panel').forEach((panel) => {
            const buildingId = panel.dataset.buildingId;
            const status = shelterManager.getProductionStatus(buildingId);
            const timer = panel.querySelector('.building-production-timer');
            const preview = panel.querySelector('.building-production-preview');
            const button = panel.querySelector('.building-collect-btn');

            if (timer) {
                timer.textContent = this.formatElapsedTimer(status.elapsedSeconds);
            }
            if (preview) {
                preview.textContent = this.formatProductionRewards(status.rewards, status.roundedHours);
            }
            if (button) {
                button.disabled = !status.canCollect;
                button.className = `btn ${status.canCollect ? 'btn-success' : 'btn-secondary'} building-collect-btn`;
                button.textContent = status.canCollect ? '收获资源' : '未满 1 小时';
            }
        });
    };

    ShelterView.prototype.collectBuildingProduction = async function(buildingId) {
        const result = shelterManager.collectProduction(buildingId);
        if (!result.success) {
            Toast.info(result.message);
            return;
        }

        const rewards = result.rewards.map((reward) => reward.type === 'item'
            ? RewardModal.createItemReward(reward.id, reward.amount)
            : RewardModal.createResourceReward(reward.id, reward.amount));

        await RewardModal.show({
            title: '资源收获',
            rewards,
            summaryText: `本次累计时长 ${result.hours} 小时`
        });

        this.render();
        window.game.refreshRuntimeUI();
        window.game.save();
    };

    ShelterView.prototype.refresh = function() {
        if (this.visible) {
            this.render();
        }
    };
})();
