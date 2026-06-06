(function() {
    if (typeof ShelterView === 'undefined' || !window.shelterView) {
        return;
    }

    const ARMORY_ID = 'building_armory';

    function normalizeBuildingId(id) {
        return id === 'building_well' ? ARMORY_ID : id;
    }

    const originalGetCompactButtonList = ShelterView.prototype.getCompactButtonList;
    ShelterView.prototype.getCompactButtonList = function() {
        const buttons = typeof originalGetCompactButtonList === 'function'
            ? originalGetCompactButtonList.call(this)
            : [];

        return buttons.map((button) => {
            if (button?.id === 'building_well' || button?.id === ARMORY_ID) {
                return { ...button, id: ARMORY_ID, label: '武器库', icon: '🛠️' };
            }
            return button;
        });
    };

    const originalGetHotspotLayout = ShelterView.prototype.getHotspotLayout;
    if (typeof originalGetHotspotLayout === 'function') {
        ShelterView.prototype.getHotspotLayout = function() {
            const hotspots = originalGetHotspotLayout.call(this) || [];
            return hotspots.map((entry) => {
                if (entry?.id === 'building_well' || entry?.id === ARMORY_ID) {
                    return { ...entry, id: ARMORY_ID, label: '武器库' };
                }
                return entry;
            });
        };
    }

    const originalEnsureSelectedBuilding = ShelterView.prototype.ensureSelectedBuilding;
    if (typeof originalEnsureSelectedBuilding === 'function') {
        ShelterView.prototype.ensureSelectedBuilding = function() {
            if (this.selectedBuildingId === 'building_well') {
                this.selectedBuildingId = ARMORY_ID;
            }
            return originalEnsureSelectedBuilding.call(this);
        };
    }

    const originalSelectBuilding = ShelterView.prototype.selectBuilding;
    if (typeof originalSelectBuilding === 'function') {
        ShelterView.prototype.selectBuilding = function(buildingId) {
            return originalSelectBuilding.call(this, normalizeBuildingId(buildingId));
        };
    }

    const originalGetBuildingSceneSummary = ShelterView.prototype.getBuildingSceneSummary;
    if (typeof originalGetBuildingSceneSummary === 'function') {
        ShelterView.prototype.getBuildingSceneSummary = function(building) {
            if (building?.id !== ARMORY_ID) {
                return originalGetBuildingSceneSummary.call(this, building);
            }

            const info = building.getInfo();
            const reforgeInfo = shelterManager.getArmoryReforgeRules?.() || { unlockedStats: [], bonus: 0 };
            const unlockedStats = (reforgeInfo.unlockedStats || [])
                .map((statKey) => Equipment.getStatName(statKey))
                .filter(Boolean)
                .join(' / ') || '暂无';

            return `
                <div class="shelter-focus-card card">
                    <div class="shelter-focus-kicker">当前聚焦</div>
                    <div class="shelter-focus-title-row">
                        <div class="shelter-focus-icon">${info.icon}</div>
                        <div>
                            <div class="shelter-focus-title">${info.name}</div>
                            <div class="shelter-focus-subtitle">Lv.${info.level} · 装备洗炼</div>
                        </div>
                    </div>
                    <div class="shelter-focus-desc">${info.description}</div>
                    <div class="shelter-focus-meta">当前解锁：${unlockedStats}</div>
                    <div class="shelter-focus-meta">洗炼额外加成：+${Number(reforgeInfo.bonus) || 0}</div>
                </div>
            `;
        };
    }

    const originalGetBuildingPreviewMetrics = ShelterView.prototype.getBuildingPreviewMetrics;
    if (typeof originalGetBuildingPreviewMetrics === 'function') {
        ShelterView.prototype.getBuildingPreviewMetrics = function(building) {
            if (building?.id !== ARMORY_ID) {
                return originalGetBuildingPreviewMetrics.call(this, building);
            }

            const currentLevel = BuildingConfig.getBuildingLevelConfig(ARMORY_ID, building.level) || {};
            const nextLevel = building.level < building.maxLevel
                ? (BuildingConfig.getBuildingLevelConfig(ARMORY_ID, building.level + 1) || null)
                : null;

            const currentUnlocked = Array.isArray(currentLevel.reforgeStats) ? currentLevel.reforgeStats.length : 0;
            const nextUnlocked = nextLevel
                ? (Array.isArray(nextLevel.reforgeStats) ? nextLevel.reforgeStats.length : currentUnlocked)
                : currentUnlocked;
            const currentBonus = Number(currentLevel.reforgeBonus || 0);
            const nextBonus = nextLevel ? Number(nextLevel.reforgeBonus || 0) : currentBonus;

            return [
                {
                    label: '解锁属性',
                    current: `${currentUnlocked}项`,
                    next: nextLevel ? `${nextUnlocked}项` : '已满级',
                    currentRaw: currentUnlocked,
                    nextRaw: nextUnlocked,
                    unit: ''
                },
                {
                    label: '洗炼加成',
                    current: `+${currentBonus}`,
                    next: nextLevel ? `+${nextBonus}` : '已满级',
                    currentRaw: currentBonus,
                    nextRaw: nextBonus,
                    unit: ''
                }
            ];
        };
    }

    const originalOpenBuildingDetail = ShelterView.prototype.openBuildingDetail;
    ShelterView.prototype.openBuildingDetail = function(buildingId) {
        return originalOpenBuildingDetail.call(this, normalizeBuildingId(buildingId));
    };
})();
