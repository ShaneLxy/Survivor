(function() {
    if (typeof ShelterView === 'undefined' || !window.shelterView) {
        return;
    }

    ShelterView.prototype.getShelterStageText = function(level) {
        if (level >= 10) {
            return '钢铁堡垒';
        }
        if (level >= 7) {
            return '坚固营地';
        }
        if (level >= 4) {
            return '扩建前哨';
        }
        return '初始营火';
    };

    const previousRenderBuildings = ShelterView.prototype.renderBuildings;
    ShelterView.prototype.render = function() {
        const shelterLevel = shelterManager.getBuilding('building_shelter')?.level || 1;
        this.element.innerHTML = `
            <div class="scene-view shelter-view shelter-scene-view shelter-tier-${Math.min(shelterLevel, 5)}">
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
                            <div class="shelter-subtitle">先用场景主区感受营地氛围，再从建筑卡片里完成升级与收获。</div>
                        </div>
                        <div class="shelter-scene-stage card">
                            <div class="shelter-scene-stage-label">避难所阶段</div>
                            <div class="shelter-scene-stage-value">Lv.${shelterLevel}</div>
                            <div class="shelter-scene-stage-tip">${this.getShelterStageText(shelterLevel)}</div>
                        </div>
                    </div>
                    <div id="building-grid" class="building-grid shelter-building-grid"></div>
                </div>
            </div>
        `;
        previousRenderBuildings.call(this);
    };
})();
