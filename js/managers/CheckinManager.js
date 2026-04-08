/**
 * 签到管理器 - 单例模式
 */
class CheckinManager {
    constructor() {
        if (CheckinManager.instance) {
            return CheckinManager.instance;
        }
        this.checkinDay = 1;
        this.lastCheckinDate = null;
        this.totalCheckins = 0;
        CheckinManager.instance = this;
    }

    static REWARDS = [
        { day: 1, rewards: [{ type: 'resource', id: 'gold', count: 100 }] },
        { day: 2, rewards: [{ type: 'resource', id: 'wood', count: 50 }] },
        { day: 3, rewards: [{ type: 'item', id: 'energy_potion', count: 1 }] },
        { day: 4, rewards: [{ type: 'item', id: 'hero_summon', count: 1 }] },
        { day: 5, rewards: [{ type: 'resource', id: 'gold', count: 200 }] },
        { day: 6, rewards: [{ type: 'resource', id: 'meat', count: 3 }] },
        { day: 7, rewards: [{ type: 'random_fragments', total: 50 }] }
    ];

    init(saveData) {
        if (saveData) {
            this.checkinDay = saveData.checkinDay || 1;
            this.lastCheckinDate = saveData.lastCheckinDate || null;
            this.totalCheckins = saveData.totalCheckins || 0;
        } else {
            this.checkinDay = 1;
            this.lastCheckinDate = null;
            this.totalCheckins = 0;
        }
    }

    isCheckedInToday() {
        if (!this.lastCheckinDate) return false;
        const today = new Date().toDateString();
        return this.lastCheckinDate === today;
    }

    checkin() {
        if (this.isCheckedInToday()) {
            return { success: false, message: '今日已签到' };
        }

        const claimedDay = this.checkinDay;
        const rewardConfig = CheckinManager.REWARDS[claimedDay - 1];
        if (!rewardConfig) {
            return { success: false, message: '签到配置错误' };
        }

        const rewards = this.grantRewards(rewardConfig);
        this.lastCheckinDate = new Date().toDateString();
        this.totalCheckins++;
        this.checkinDay++;
        if (this.checkinDay > 7) {
            this.checkinDay = 1;
        }

        eventManager.emit('checkinComplete', { day: claimedDay, rewards, nextDay: this.checkinDay });
        return { success: true, message: '签到成功!', claimedDay, nextDay: this.checkinDay, rewards };
    }

    grantRewards(rewardConfig) {
        const rewards = [];

        rewardConfig.rewards.forEach(reward => {
            if (reward.type === 'resource') {
                shelterManager.addResource(reward.id, reward.count);
                rewards.push(RewardModal.createResourceReward(reward.id, reward.count));
            } else if (reward.type === 'item') {
                itemManager.addItem(reward.id, reward.count);
                rewards.push(RewardModal.createItemReward(reward.id, reward.count));
            } else if (reward.type === 'random_fragments') {
                const fragments = this.generateRandomFragments(reward.total);
                fragments.forEach(f => {
                    heroManager.addFragments(f.configId, f.count);
                    rewards.push(RewardModal.createFragmentReward(f.configId, f.count));
                });
            }
        });

        return rewards;
    }

    generateRandomFragments(total) {
        const numParts = Math.floor(Math.random() * 4) + 2;
        const parts = [];
        let remaining = total;
        for (let i = 0; i < numParts - 1; i++) {
            const maxPart = remaining - (numParts - i - 1);
            const part = Math.floor(Math.random() * (maxPart - 1)) + 1;
            parts.push(part);
            remaining -= part;
        }
        parts.push(remaining);

        const allHeroConfigs = HeroConfig.getAllHeroes();
        const selectedHeroes = [];
        const shuffled = [...allHeroConfigs].sort(() => Math.random() - 0.5);
        for (let i = 0; i < numParts; i++) {
            const hero = shuffled[i % shuffled.length];
            selectedHeroes.push({
                configId: hero.id,
                name: hero.name,
                count: parts[i]
            });
        }
        return selectedHeroes;
    }

    getResourceName(id) {
        return shelterManager.getResourceDisplayName(id);
    }

    getItemName(id) {
        return ItemConfig.getItemConfig(id)?.name || id;
    }

    getSaveData() {
        return {
            checkinDay: this.checkinDay,
            lastCheckinDate: this.lastCheckinDate,
            totalCheckins: this.totalCheckins
        };
    }

    getCheckinStatus() {
        const today = new Date().toDateString();
        const isTodayCheckedIn = this.lastCheckinDate === today;
        const nextDay = this.checkinDay;
        const claimedDay = isTodayCheckedIn
            ? (nextDay === 1 ? 7 : nextDay - 1)
            : Math.max(0, nextDay - 1);

        return {
            currentDay: nextDay,
            nextDay,
            claimedDay,
            isTodayCheckedIn,
            canCheckin: !isTodayCheckedIn,
            rewards: CheckinManager.REWARDS
        };
    }
}

const checkinManager = new CheckinManager();
window.checkinManager = checkinManager;
