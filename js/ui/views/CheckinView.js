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
        const rewards = CheckinManager.REWARDS;

        let itemsHtml = '';
        rewards.forEach((reward, index) => {
            const day = index + 1;
            const isChecked = day <= status.claimedDay;
            const isToday = status.canCheckin && day === status.nextDay;
            const isFuture = day > status.claimedDay && day !== status.nextDay;

            let dayClass = 'checkin-day';
            if (isChecked) dayClass += ' checked';
            if (isToday) dayClass += ' today';
            if (isFuture) dayClass += ' future';
            const daySize = day === 7 ? 'large' : '';
            const rewardText = this.getRewardText(reward);

            itemsHtml += `
                <div class="${dayClass} ${daySize}" onclick="${!isChecked && isToday ? "window.game.ui.checkinView.doCheckin()" : ''}">
                    <div class="day-number">${day}</div>
                    <div class="day-status">${isChecked ? '✓' : (isToday ? '可签到' : '待签到')}</div>
                    <div class="day-reward">${rewardText}</div>
                </div>
            `;
        });

        this.element.innerHTML = `
            <div class="checkin-view">
                <h2 class="checkin-title">每日签到</h2>
                <p class="checkin-subtitle">连续签到7天，循环领取奖励</p>
                <div class="checkin-days">
                    ${itemsHtml}
                </div>
                ${status.isTodayCheckedIn ? `
                    <div class="checkin-tips">今日已签到，明天再来吧~</div>
                ` : `
                    <button class="btn btn-primary btn-large" onclick="window.game.ui.checkinView.doCheckin()">签到</button>
                `}
            </div>
        `;
    }

    getRewardText(reward) {
        const texts = [];
        reward.rewards.forEach(r => {
            if (r.type === 'resource') {
                texts.push(`${shelterManager.getResourceDisplayName(r.id)}x${r.count}`);
            } else if (r.type === 'item') {
                const itemName = ItemConfig.getItemConfig(r.id)?.name || r.id;
                texts.push(`${itemName}x${r.count}`);
            } else if (r.type === 'random_fragments') {
                texts.push(`随机碎片x${r.total}`);
            }
        });
        return texts.join(' ');
    }

    async doCheckin() {
        const result = checkinManager.checkin();
        if (result.success) {
            this.render();
            await RewardModal.show({
                title: `签到成功 - 第${result.claimedDay}天`,
                rewards: result.rewards,
                summaryText: '本次签到奖励已入账'
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
