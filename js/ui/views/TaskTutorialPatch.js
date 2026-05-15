(function() {
    if (typeof TaskView === 'undefined' || !window.taskView) {
        return;
    }

    TaskView.prototype.renderTutorialShortcut = function() {
        const tutorialDone = taskManager.getAchievements().some(task => task.id === 'achievement_finish_tutorial' && task.completed);
        const shortcutText = tutorialDone
            ? '想再熟悉一次功能入口，可以从这里重新打开新手指引。'
            : '如果还没完成新手指引，也可以从这里重新开始。';

        return `
            <div class="task-tutorial-shortcut card">
                <div class="task-card-icon" aria-hidden="true">N</div>
                <div class="task-tutorial-shortcut-main">
                    <div class="task-card-title-row">
                        <div class="task-tutorial-shortcut-title">新手指引</div>
                        <div class="task-card-status">${tutorialDone ? '可回放' : '未完成'}</div>
                    </div>
                    <div class="task-tutorial-shortcut-desc">${shortcutText}</div>
                </div>
                <div class="task-card-action">
                    <button class="btn btn-primary task-claim-btn" onclick="window.game.ui.taskView.restartTutorial()">${tutorialDone ? '回放' : '开始'}</button>
                </div>
            </div>
        `;
    };

    const originalRender = TaskView.prototype.render;
    TaskView.prototype.render = function() {
        originalRender.call(this);
        if (!this.visible || this.activeTab !== 'achievement') {
            return;
        }
        const taskList = this.element.querySelector('.task-list');
        if (taskList) {
            taskList.insertAdjacentHTML('afterbegin', this.renderTutorialShortcut());
        }
    };

    TaskView.prototype.restartTutorial = function() {
        const replay = tutorialManager.hasSeen?.() || Boolean(taskManager.achievementClaimed?.achievement_finish_tutorial);
        tutorialManager.stop(false);
        tutorialManager.start({ replay });
    };
})();
