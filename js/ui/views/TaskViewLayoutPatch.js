(function() {
    if (typeof TaskView === 'undefined' || !window.taskView) {
        return;
    }

    TaskView.prototype.renderTaskCard = function(task) {
        const rewardText = (task.reward || []).map((reward) => `${reward.type === 'item'
            ? (ItemConfig.getItemConfig(reward.id)?.name || reward.id)
            : shelterManager.getResourceDisplayName(reward.id)} x${reward.count}`).join(' · ');
        const buttonText = task.claimed ? '已领取' : (task.completed ? '领取' : '进行中');
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
                    <div class="task-card-reward">奖励: ${rewardText}</div>
                </div>
                <div class="task-card-action">
                    <button class="btn ${buttonClass} task-claim-btn" ${task.completed && !task.claimed ? '' : 'disabled'} onclick="${claimAction}">
                        ${buttonText}
                    </button>
                </div>
            </div>
        `;
    };
})();
