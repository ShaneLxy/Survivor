(function() {
    if (typeof DungeonView === 'undefined' || !window.dungeonView) {
        return;
    }

    DungeonView.prototype.getDungeonProgressSummaryMarkup = function() {
        const progress = dungeonManager.getProgress();
        return `
            <div class="dungeon-progress-summary card">
                <div class="dungeon-progress-item">
                    <span>已通关</span>
                    <strong>${progress.completed}/${progress.total}</strong>
                </div>
                <div class="dungeon-progress-item">
                    <span>总星数</span>
                    <strong>${progress.totalStars}/${progress.maxStars}</strong>
                </div>
                <div class="dungeon-progress-item">
                    <span>推进率</span>
                    <strong>${progress.percent}%</strong>
                </div>
            </div>
        `;
    };

    const originalRender = DungeonView.prototype.render;
    DungeonView.prototype.render = function() {
        originalRender.call(this);
        const header = this.element.querySelector('.dungeon-header-bar-patched');
        if (header) {
            header.insertAdjacentHTML('beforeend', this.getDungeonProgressSummaryMarkup());
        }
    };
})();
