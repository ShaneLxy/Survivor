class TaskView {
    constructor() {
        this.element = document.getElementById('main-display');
        this.visible = false;
        this.activeTab = 'daily';
        this.pageSize = 30;
        this.sortedTasks = [];
        this.renderedCount = 0;
        this.loadMoreObserver = null;
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
        this.disconnectLoadMoreObserver();
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

    sortTasksByClaimState(tasks) {
        const rank = (task) => {
            if (task.completed && !task.claimed) return 0;
            if (!task.completed) return 1;
            return 2;
        };
        return tasks.slice().sort((left, right) => rank(left) - rank(right));
    }

    getSummary() {
        return this.activeTab === 'daily' ? taskManager.getDailySummary() : taskManager.getAchievementSummary();
    }

    getTabMeta() {
        const dailySummary = taskManager.getDailySummary();
        const achievementSummary = taskManager.getAchievementSummary();

        return [
            {
                id: 'daily',
                icon: 'D',
                title: '每日任务',
                caption: 'DAILY',
                summary: dailySummary
            },
            {
                id: 'achievement',
                icon: 'A',
                title: '成就档案',
                caption: 'ARCHIVE',
                summary: achievementSummary
            }
        ];
    }

    getViewMeta(tasks, summary) {
        const claimable = tasks.filter(task => task.completed && !task.claimed).length;
        const progressPercent = summary.total > 0
            ? Math.min(100, Math.round((summary.completed / summary.total) * 100))
            : 0;

        if (this.activeTab === 'daily') {
            return {
                kicker: 'MISSION CONTROL',
                title: '任务中心',
                subtitle: '追踪今日行动目标，领取维持避难所运转的补给。',
                boardKicker: 'DAILY OBJECTIVES',
                boardTitle: '今日作战清单',
                summaryLabel: '今日进度',
                claimable,
                progressPercent
            };
        }

        return {
            kicker: 'MISSION CONTROL',
            title: '任务中心',
            subtitle: '归档长期成就，记录队伍从废土边缘推进到深区的每一次突破。',
            boardKicker: 'ACHIEVEMENT LOG',
            boardTitle: '长期档案',
            summaryLabel: '成就进度',
            claimable,
            progressPercent
        };
    }

    getTaskIcon(task) {
        if (!task?.id) {
            return 'T';
        }

        if (task.id.includes('recruit')) {
            return 'R';
        }
        if (task.id.includes('upgrade')) {
            return 'B';
        }
        if (task.id.includes('dungeon') || task.id.includes('clear')) {
            return 'C';
        }
        if (task.id.includes('collect')) {
            return 'S';
        }
        if (task.id.includes('tutorial')) {
            return 'N';
        }
        if (task.id.includes('login')) {
            return 'L';
        }

        return this.activeTab === 'daily' ? 'D' : 'A';
    }

    getTaskStateMeta(task) {
        if (task.claimed) {
            return {
                className: 'is-claimed',
                label: '已领取',
                buttonText: '已领取',
                buttonClass: 'btn-secondary'
            };
        }

        if (task.completed) {
            return {
                className: 'is-ready',
                label: '待领取',
                buttonText: '领取',
                buttonClass: 'btn-success'
            };
        }

        return {
            className: 'is-active',
            label: '进行中',
            buttonText: '进行中',
            buttonClass: 'btn-secondary'
        };
    }

    getTaskProgressPercent(task) {
        if (!task?.target) {
            return 0;
        }

        return Math.min(100, Math.round((Math.min(task.progress, task.target) / task.target) * 100));
    }

    getRewardMeta(reward) {
        if (reward.type === 'item') {
            const itemConfig = ItemConfig.getItemConfig(reward.id);
            return {
                label: itemConfig?.name || reward.id,
                icon: itemConfig?.icon || 'ITEM',
                iconSrc: itemConfig?.iconSrc || null,
                className: 'is-item'
            };
        }

        const resourceInfo = shelterManager.getResourceInfo?.(reward.id) || {};
        return {
            label: shelterManager.getResourceDisplayName(reward.id),
            icon: resourceInfo.icon || 'RES',
            iconSrc: resourceInfo.iconSrc || null,
            className: `is-resource is-${reward.id}`
        };
    }

    renderRewardIconMarkup(rewardMeta) {
        if (rewardMeta?.iconSrc) {
            return `<img class="task-reward-icon-image" src="${rewardMeta.iconSrc}" alt="${rewardMeta.label || '奖励'}">`;
        }
        return rewardMeta?.icon || 'RES';
    }

    renderHeader(meta) {
        return `
            <div class="task-stage-header">
                <div class="task-stage-heading-group">
                    <div class="task-stage-kicker">${meta.kicker}</div>
                    <h2 class="task-title">${meta.title}</h2>
                    <div class="task-subtitle">${meta.subtitle}</div>
                </div>
            </div>
        `;
    }

    renderTabs() {
        return `
            <div class="task-tabs" role="tablist" aria-label="任务分类">
                ${this.getTabMeta().map(tab => `
                    <button class="task-tab-button ${this.activeTab === tab.id ? 'is-active' : ''}"
                        type="button"
                        role="tab"
                        aria-selected="${this.activeTab === tab.id ? 'true' : 'false'}"
                        onclick="window.game.ui.taskView.setTab('${tab.id}')">
                        <span class="task-tab-icon" aria-hidden="true">${tab.icon}</span>
                        <span class="task-tab-copy">
                            <span>${tab.title}</span>
                            <small>${tab.caption}</small>
                        </span>
                        <strong>${tab.summary.completed}/${tab.summary.total}</strong>
                    </button>
                `).join('')}
            </div>
        `;
    }

    renderBoardHeader(meta, tasks) {
        return `
            <div class="task-board-header">
                <div>
                    <div class="task-board-kicker">${meta.boardKicker}</div>
                    <div class="task-board-title">${meta.boardTitle}</div>
                </div>
                <div class="task-board-count">${tasks.length} 项</div>
            </div>
            <div class="task-board-meter" aria-hidden="true">
                <span style="--task-progress: ${meta.progressPercent}%;"></span>
            </div>
        `;
    }

    render() {
        this.disconnectLoadMoreObserver();
        const summary = this.getSummary();
        this.sortedTasks = this.sortTasksByClaimState(this.getTasks());
        const meta = this.getViewMeta(this.sortedTasks, summary);

        const initialBatch = this.sortedTasks.slice(0, this.pageSize);
        this.renderedCount = initialBatch.length;
        const hasMore = this.sortedTasks.length > this.renderedCount;

        this.element.innerHTML = `
            <div class="task-view">
                ${this.renderHeader(meta)}
                ${this.renderTabs()}
                <div class="task-command-board">
                    ${this.renderBoardHeader(meta, this.sortedTasks)}
                    <div class="task-list">
                        ${initialBatch.map(task => this.renderTaskCard(task)).join('')}
                        ${hasMore ? '<div class="task-list-sentinel" aria-hidden="true"></div>' : ''}
                    </div>
                </div>
            </div>
        `;

        if (hasMore) {
            this.observeSentinel();
        }
    }

    observeSentinel() {
        const list = this.element.querySelector('.task-list');
        const sentinel = list?.querySelector('.task-list-sentinel');
        if (!list || !sentinel || typeof IntersectionObserver === 'undefined') {
            return;
        }
        this.loadMoreObserver = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                this.loadMoreTasks();
            }
        }, { root: list, rootMargin: '160px 0px', threshold: 0 });
        this.loadMoreObserver.observe(sentinel);
    }

    loadMoreTasks() {
        const list = this.element.querySelector('.task-list');
        const sentinel = list?.querySelector('.task-list-sentinel');
        if (!list || !sentinel) {
            this.disconnectLoadMoreObserver();
            return;
        }
        const nextBatch = this.sortedTasks.slice(this.renderedCount, this.renderedCount + this.pageSize);
        if (nextBatch.length === 0) {
            this.disconnectLoadMoreObserver();
            sentinel.remove();
            return;
        }
        sentinel.insertAdjacentHTML('beforebegin', nextBatch.map(task => this.renderTaskCard(task)).join(''));
        this.renderedCount += nextBatch.length;
        if (this.renderedCount >= this.sortedTasks.length) {
            this.disconnectLoadMoreObserver();
            sentinel.remove();
        }
    }

    disconnectLoadMoreObserver() {
        if (this.loadMoreObserver) {
            this.loadMoreObserver.disconnect();
            this.loadMoreObserver = null;
        }
    }

    renderTaskCard(task) {
        const stateMeta = this.getTaskStateMeta(task);
        const progressPercent = this.getTaskProgressPercent(task);
        const rewards = (task.reward || []).map(reward => {
            const rewardMeta = this.getRewardMeta(reward);
            return `
                <span class="task-reward-chip ${rewardMeta.className}">
                    <span class="task-reward-icon">${this.renderRewardIconMarkup(rewardMeta)}</span>
                    <span>${rewardMeta.label} x${reward.count}</span>
                </span>
            `;
        }).join('');
        const claimAction = this.activeTab === 'daily'
            ? `window.game.ui.taskView.claimDaily('${task.id}')`
            : `window.game.ui.taskView.claimAchievement('${task.id}')`;

        return `
            <div class="task-card card ${stateMeta.className}">
                <div class="task-card-icon" aria-hidden="true">${this.getTaskIcon(task)}</div>
                <div class="task-card-main">
                    <div class="task-card-title-row">
                        <div class="task-card-title">${task.title}</div>
                        <div class="task-card-status">${stateMeta.label}</div>
                    </div>
                    <div class="task-card-desc">${task.description}</div>
                    <div class="task-card-detail-row">
                        <div class="task-card-progress-line">
                            <div class="task-card-progress-text">${Math.min(task.progress, task.target)}/${task.target}</div>
                            <div class="task-card-progress-track" aria-hidden="true">
                                <span style="--task-progress: ${progressPercent}%;"></span>
                            </div>
                        </div>
                        <div class="task-card-rewards">${rewards}</div>
                    </div>
                </div>
                <div class="task-card-action">
                    <button class="btn ${stateMeta.buttonClass} task-claim-btn" ${task.completed && !task.claimed ? '' : 'disabled'} onclick="${claimAction}">
                        ${stateMeta.buttonText}
                    </button>
                </div>
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
