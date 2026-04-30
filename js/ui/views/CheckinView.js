/**
 * 签到视图
 */
class CheckinView {
    constructor() {
        this.element = document.getElementById('main-display');
        this.visible = false;
    }

    show() {
        this.visible = true;
        this.render();
    }

    hide() {
        this.visible = false;
        this.element.innerHTML = '';
    }

    render() {
        const status = checkinManager.getCheckinStatus();
        const bonusRewards = CheckinManager.REWARDS;
        const dailyRewards = CheckinManager.DAILY_REWARDS;
        const cycleProgress = Math.round((status.claimedDay / bonusRewards.length) * 100);
        const activeDay = status.isTodayCheckedIn ? status.claimedDay : status.nextDay;
        const todayBonusReward = bonusRewards[Math.max(0, activeDay - 1)] || bonusRewards[0];
        const totalCheckins = checkinManager.totalCheckins || 0;
        const dailyRewardText = this.getRewardText(dailyRewards);
        const bonusRewardText = this.getRewardText(todayBonusReward);

        this.element.innerHTML = `
            <div class="checkin-view">
                <div class="checkin-stage-header">
                    <div class="checkin-stage-heading-row">
                        <div class="checkin-stage-heading-group">
                            <div class="checkin-stage-kicker">SUPPLY CHECKPOINT</div>
                            <h1 class="checkin-title">每日签到</h1>
                            <div class="checkin-subtitle">每日固定补给稳定入账，七日补给队列作为累计签到额外奖励循环发放。</div>
                        </div>
                    </div>
                    <div class="checkin-stage-stats">
                        <div class="checkin-stage-stat">
                            <span>今日状态</span>
                            <strong>${status.isTodayCheckedIn ? '已领取' : '待领取'}</strong>
                        </div>
                        <div class="checkin-stage-stat">
                            <span>本轮队列</span>
                            <strong>${activeDay}/7</strong>
                        </div>
                        <div class="checkin-stage-stat">
                            <span>累计签到</span>
                            <strong>${totalCheckins}</strong>
                        </div>
                    </div>
                </div>
                <div class="checkin-supply-board">
                    <div class="checkin-board-head">
                        <div>
                            <div class="checkin-board-kicker">BONUS SUPPLY ROUTE</div>
                            <div class="checkin-board-title">七日补给队列</div>
                            <div class="checkin-board-desc">额外补给按签到次数推进，第 8 次从 DAY 1 重新循环。</div>
                        </div>
                        <div class="checkin-board-count">${status.claimedDay}/${bonusRewards.length}</div>
                    </div>
                    <div class="checkin-cycle-meter" style="--checkin-progress: ${cycleProgress}%">
                        <span></span>
                    </div>
                    <div class="checkin-days">
                        ${bonusRewards.map((reward, index) => this.renderDayCard(reward, index + 1, status)).join('')}
                    </div>
                </div>
                <div class="checkin-action-panel ${status.isTodayCheckedIn ? 'is-complete' : 'is-ready'}">
                    <div class="checkin-action-copy">
                        <span>${status.isTodayCheckedIn ? 'TODAY LOGGED' : 'READY TO CLAIM'}</span>
                        <strong>${status.isTodayCheckedIn ? `第 ${activeDay} 天补给已入账` : `领取每日补给 + DAY ${activeDay} 额外补给`}</strong>
                        <div class="checkin-claim-rewards">
                            <div class="checkin-claim-row">
                                <span>每日固定</span>
                                <strong>${this.escapeHtml(dailyRewardText)}</strong>
                            </div>
                            <div class="checkin-claim-row is-bonus">
                                <span>队列额外</span>
                                <strong>${this.escapeHtml(bonusRewardText)}</strong>
                            </div>
                        </div>
                    </div>
                    <button class="checkin-claim-button" ${status.isTodayCheckedIn ? 'disabled' : 'onclick="window.game.ui.checkinView.doCheckin()"'}>
                        ${status.isTodayCheckedIn ? '已完成' : '领取'}
                    </button>
                </div>
            </div>
        `;
    }

    renderDayCard(reward, day, status) {
        const isChecked = day <= status.claimedDay;
        const isToday = status.canCheckin && day === status.nextDay;
        const isFuture = day > status.claimedDay && day !== status.nextDay;
        const rewardChips = this.getRewardEntries(reward).map(item => `
            <span class="day-reward-chip">
                <span class="day-reward-icon">${this.escapeHtml(item.icon)}</span>
                <span>${this.escapeHtml(item.label)}x${item.count}</span>
            </span>
        `).join('');
        const classes = [
            'checkin-day',
            day === 7 ? 'is-premium' : '',
            isChecked ? 'checked' : '',
            isToday ? 'today' : '',
            isFuture ? 'future' : ''
        ].filter(Boolean).join(' ');
        const statusText = isChecked ? '已领取' : (isToday ? '今日额外' : '待领取');
        const clickAction = !isChecked && isToday ? 'onclick="window.game.ui.checkinView.doCheckin()"' : '';

        return `
            <div class="${classes}" ${clickAction}>
                <div class="day-topline">
                    <span class="day-index">DAY ${day}</span>
                    <span class="day-status">${statusText}</span>
                </div>
                <div class="day-number">${day}</div>
                <div class="day-reward">${rewardChips}</div>
            </div>
        `;
    }

    getRewardEntries(reward) {
        const rewardList = Array.isArray(reward) ? reward : (reward?.rewards || []);
        return rewardList.map(r => {
            if (r.type === 'resource') {
                const info = shelterManager.getResourceInfo(r.id);
                return {
                    icon: info.icon || '📦',
                    label: info.name || r.id,
                    count: r.count || 0
                };
            }
            if (r.type === 'item') {
                const item = ItemConfig.getItemConfig(r.id) || {};
                return {
                    icon: item.icon || '🎁',
                    label: item.name || r.id,
                    count: r.count || 0
                };
            }
            if (r.type === 'random_fragments') {
                return {
                    icon: '✦',
                    label: '随机碎片',
                    count: r.total || 0
                };
            }
            return {
                icon: '🎁',
                label: r.id || '奖励',
                count: r.count || r.total || 0
            };
        });
    }

    getRewardText(reward) {
        return this.getRewardEntries(reward)
            .map(r => `${r.label}x${r.count}`)
            .join(' ');
    }

    escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    }

    async doCheckin() {
        const result = checkinManager.checkin();
        if (result.success) {
            this.render();
            await RewardModal.show({
                title: `签到成功 - DAY ${result.claimedDay}`,
                rewards: result.rewards,
                summaryText: '每日固定补给与队列额外补给已入账'
            });
            window.game.save();
        } else {
            Toast.error(result.message);
        }
    }

    refresh() {
        if (this.visible) this.render();
    }
}

const checkinView = new CheckinView();
window.checkinView = checkinView;
