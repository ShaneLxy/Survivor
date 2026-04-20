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
                <div class="task-tutorial-shortcut-main">
                    <div class="task-tutorial-shortcut-title">新手指引</div>
                    <div class="task-tutorial-shortcut-desc">${shortcutText}</div>
                </div>
                <button class="btn btn-primary" onclick="window.game.ui.taskView.restartTutorial()">${tutorialDone ? '重新查看' : '开始指引'}</button>
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
        tutorialManager.stop(false);
        tutorialManager.start();
    };
})();
