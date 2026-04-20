(function() {
    if (typeof TaskManager === 'undefined' || !window.taskManager) {
        return;
    }

    const tutorialAchievement = {
        id: 'achievement_finish_tutorial',
        title: '完成新手指引',
        description: '完成首次新手教程，熟悉主要功能入口',
        target: 1,
        reward: [{ type: 'resource', id: 'gold', count: 260 }]
    };

    if (!TaskManager.ACHIEVEMENTS.some((task) => task.id === tutorialAchievement.id)) {
        TaskManager.ACHIEVEMENTS.unshift(tutorialAchievement);
    }

    const originalRecord = TaskManager.prototype.record;
    TaskManager.prototype.record = function(action) {
        if (action === 'tutorialComplete') {
            this.markProgress(this.achievementProgress, 'achievement_finish_tutorial', 1, 1);
            this.emitUpdate();
            window.game?.save?.();
            return;
        }
        originalRecord.call(this, action);
    };
})();
