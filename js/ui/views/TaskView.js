class TaskView {
    constructor() {
        this.element = document.getElementById('main-display');
        this.visible = false;
        this.activeTab = 'daily';
        this.bindEvents();
    }

    bindEvents() {
        eventManager.on('taskUpdate', () => this.refresh());
    }

    show() {
        this.visible = true;
        this.render();
    }

    hide() {
        this.visible = false;
        this.element.innerHTML = '';
    }

    setTab(tab) {
        this.activeTab = tab;
        this.render();
    }

    getTasks() {
        return this.activeTab === 'daily' ? taskManager.getDailyTasks() : taskManager.getAchievements();
    }

    getSummary() {
        return this.activeTab === 'daily' ? taskManager.getDailySummary() : taskManager.getAchievementSummary();
    }

    render() {
        const summary = this.getSummary();
        const tasks = this.getTasks();
        const subtitle = this.activeTab === 'daily'
            ? '每日目标会在每天刷新，完成后可领取当天奖励。'
            : '成就会永久保留，记录你的成长历程。';
        const summaryLabel = this.activeTab === 'daily' ? '今日进度' : '成就进度';

        this.element.innerHTML = `
            <div class="task-view">
                <div class="task-view-header">
                    <div>
                        <h2 class="task-title">任务中心</h2>
                        <div class="task-subtitle">${subtitle}</div>
                    </div>
                    <div class="task-summary card">
                        <div class="task-summary-label">${summaryLabel}</div>
                        <div class="task-summary-value">${summary.completed}/${summary.total}</div>
                    </div>
                </div>
                <div class="task-tabs">
                    <button class="item-grid-tab ${this.activeTab === 'daily' ? 'active' : ''}" onclick="window.game.ui.taskView.setTab('daily')">每日任务</button>
                    <button class="item-grid-tab ${this.activeTab === 'achievement' ? 'active' : ''}" onclick="window.game.ui.taskView.setTab('achievement')">成就</button>
                </div>
                <div class="task-list">
                    ${tasks.map(task => this.renderTaskCard(task)).join('')}
                </div>
            </div>
        `;
    }

    renderTaskCard(task) {
        const rewardText = (task.reward || []).map(reward => `${reward.type === 'item'
            ? (ItemConfig.getItemConfig(reward.id)?.name || reward.id)
            : shelterManager.getResourceDisplayName(reward.id)} x${reward.count}`).join(' · ');
        const buttonText = task.claimed ? '已领取' : (task.completed ? '领取奖励' : '进行中');
        const buttonClass = task.claimed ? 'btn-secondary' : (task.completed ? 'btn-success' : 'btn-secondary');
        const claimAction = this.activeTab === 'daily'
            ? `window.game.ui.taskView.claimDaily('${task.id}')`
            : `window.game.ui.taskView.claimAchievement('${task.id}')`;

        return `
            <div class="task-card card ${task.completed ? 'is-complete' : ''} ${task.claimed ? 'is-claimed' : ''}">
                <div class="task-card-main">
                    <div class="task-card-title-row">
                        <div class="task-card-title">${task.title}</div>
                        <div class="task-card-progress">${task.progress}/${task.target}</div>
                    </div>
                    <div class="task-card-desc">${task.description}</div>
                    <div class="task-card-reward">奖励：${rewardText}</div>
                </div>
                <button class="btn ${buttonClass} task-claim-btn" ${task.completed && !task.claimed ? '' : 'disabled'} onclick="${claimAction}">
                    ${buttonText}
                </button>
            </div>
        `;
    }

    async claimDaily(taskId) {
        const result = taskManager.claimDaily(taskId);
        if (!result.success) {
            Toast.info(result.message);
            return;
        }
        await RewardModal.show({
            title: `${result.title} 奖励`,
            rewards: result.rewardEntries,
            summaryText: '任务奖励已发放到背包与资源库'
        });
        window.game.refreshRuntimeUI();
        this.render();
    }

    async claimAchievement(taskId) {
        const result = taskManager.claimAchievement(taskId);
        if (!result.success) {
            Toast.info(result.message);
            return;
        }
        await RewardModal.show({
            title: `${result.title} 奖励`,
            rewards: result.rewardEntries,
            summaryText: '成就奖励已发放到背包与资源库'
        });
        window.game.refreshRuntimeUI();
        this.render();
    }

    refresh() {
        if (this.visible) {
            this.render();
        }
    }
}

const taskView = new TaskView();
window.taskView = taskView;
