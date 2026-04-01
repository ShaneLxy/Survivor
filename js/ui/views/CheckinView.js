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
            const isChecked = day < status.currentDay || (status.isTodayCheckedIn && day === status.currentDay);
            const isToday = !status.isTodayCheckedIn && day === status.currentDay;
            const isFuture = day > status.currentDay;
            
            // 样式
            let dayClass = 'checkin-day';
            if (isChecked) dayClass += ' checked';
            if (isToday) dayClass += ' today';
            if (isFuture) dayClass += ' future';
            
            // 第7天特别大
            const daySize = day === 7 ? 'large' : '';

            // 奖励文本
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

    /**
     * 获取奖励文本
     */
    getRewardText(reward) {
        const texts = [];
        reward.rewards.forEach(r => {
            if (r.type === 'resource') {
                const names = { gold: '金币', wood: '木材', stone: '石材', meat: '肉类', water: '水源' };
                texts.push(`${names[r.id] || r.id}x${r.count}`);
            } else if (r.type === 'item') {
                const names = { energy_potion: '体力药水', hero_summon: '召唤券' };
                texts.push(`${names[r.id] || r.id}x${r.count}`);
            } else if (r.type === 'random_fragments') {
                texts.push(`随机碎片x${r.total}`);
            }
        });
        return texts.join(' ');
    }

    /**
     * 执行签到
     */
    doCheckin() {
        const result = checkinManager.checkin();
        if (result.success) {
            // 显示奖励
            let rewardText = result.rewards.map(r => `${r.name}x${r.count}`).join(', ');
            Toast.success(`签到成功！获得: ${rewardText}`);
            this.render();
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