(function() {
    if (typeof ShelterView === 'undefined' || !window.shelterView) {
        return;
    }

    ShelterView.prototype.ensureSelectedBuilding = function() {
        if (!this.selectedBuildingId || !shelterManager.getBuilding(this.selectedBuildingId)) {
            this.selectedBuildingId = 'building_shelter';
        }
        return shelterManager.getBuilding(this.selectedBuildingId);
    };

    ShelterView.prototype.selectBuilding = function(buildingId) {
        this.selectedBuildingId = buildingId;
        this.render();
        setTimeout(() => {
            const targetCard = this.element.querySelector(`.shelter-building-card[data-building-id="${buildingId}"]`);
            targetCard?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
        }, 40);
    };

    ShelterView.prototype.getHotspotLayout = function() {
        return [
            { id: 'building_shelter', label: '避难所核心', top: '14%', left: '52%' },
            { id: 'building_farm', label: '农场', top: '56%', left: '18%' },
            { id: 'building_mine', label: '林矿', top: '46%', left: '76%' },
            { id: 'building_well', label: '\u6c34\u4e95', top: '68%', left: '56%' },
            { id: 'building_training_ground', label: '\u8bad\u7ec3\u573a', top: '30%', left: '22%' }
        ];
    };

    ShelterView.prototype.getBuildingSceneSummary = function(building) {
        const info = building.getInfo();
        const status = shelterManager.getProductionStatus(info.id);
        return `
            <div class="shelter-focus-card card">
                <div class="shelter-focus-kicker">当前聚焦</div>
                <div class="shelter-focus-title-row">
                    <div class="shelter-focus-icon">${info.icon}</div>
                    <div>
                        <div class="shelter-focus-title">${info.name}</div>
                        <div class="shelter-focus-subtitle">Lv.${info.level} · ${this.getShelterStageText(info.level)}</div>
                    </div>
                </div>
                <div class="shelter-focus-desc">${this.getEffectTextPatched(info.effect)}</div>
                ${info.effect?.type === 'production' ? `
                    <div class="shelter-focus-meta">累计时长 ${this.formatElapsedTimer(status.elapsedSeconds)}</div>
                    <div class="shelter-focus-meta">${this.formatProductionRewards(status.rewards, status.roundedHours)}</div>
                ` : `
                    <div class="shelter-focus-meta">该建筑提供永久增益与避难所成长支持。</div>
                `}
            </div>
        `;
    };

    const originalCreateBuildingCard = ShelterView.prototype.createBuildingCard;
    ShelterView.prototype.createBuildingCard = function(building) {
        const card = originalCreateBuildingCard.call(this, building);
        card.dataset.buildingId = building.id;
        if (building.id === this.selectedBuildingId) {
            card.classList.add('is-selected');
        }
        card.addEventListener('click', (event) => {
            if (event.target.closest('button')) {
                return;
            }
            this.selectBuilding(building.id);
        });
        return card;
    };

    const previousRender = ShelterView.prototype.render;
    ShelterView.prototype.render = function() {
        this.ensureSelectedBuilding();
        previousRender.call(this);
        const selectedBuilding = this.ensureSelectedBuilding();
        const sceneContent = this.element.querySelector('.scene-view-content');
        if (!sceneContent || !selectedBuilding) {
            return;
        }

        const focusMarkup = this.getBuildingSceneSummary(selectedBuilding);
        const hotspotMarkup = `
            <div class="shelter-hotspot-stage">
                ${this.getHotspotLayout().map((spot) => `
                    <button type="button"
                        class="shelter-hotspot ${spot.id === this.selectedBuildingId ? 'is-active' : ''}"
                        style="top:${spot.top};left:${spot.left};"
                        onclick="window.game.ui.shelterView.selectBuilding('${spot.id}')">
                        <span class="shelter-hotspot-dot"></span>
                        <span class="shelter-hotspot-label">${spot.label}</span>
                    </button>
                `).join('')}
                ${focusMarkup}
            </div>
        `;

        sceneContent.insertAdjacentHTML('beforeend', hotspotMarkup);
    };
})();
