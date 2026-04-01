/**
 * 签到管理器 - 单例模式
 */
class CheckinManager {
    constructor() {
        if (CheckinManager.instance) {
            return CheckinManager.instance;
        }
        this.checkinDay = 1; // 当前签到天数 1-7
        this.lastCheckinDate = null; // 上次签到日期
        this.totalCheckins = 0; // 累计签到次数
        CheckinManager.instance = this;
    }

    /**
     * 签到配置
     */
    static REWARDS = [
        { day: 1, rewards: [{ type: 'resource', id: 'gold', count: 100 }] },
        { day: 2, rewards: [{ type: 'resource', id: 'wood', count: 50 }] },
        { day: 3, rewards: [{ type: 'item', id: 'energy_potion', count: 1 }] },
        { day: 4, rewards: [{ type: 'item', id: 'hero_summon', count: 1 }] },
        { day: 5, rewards: [{ type: 'resource', id: 'gold', count: 200 }] },
        { day: 6, rewards: [{ type: 'resource', id: 'meat', count: 3 }] },
        { day: 7, rewards: [{ type: 'random_fragments', total: 50 }] }
    ];

    /**
     * 初始化
     */
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

    /**
     * 获取今天是否已签到
     */
    isCheckedInToday() {
        if (!this.lastCheckinDate) return false;
        
        const today = new Date().toDateString();
        return this.lastCheckinDate === today;
    }

    /**
     * 执行签到
     */
    checkin() {
        if (this.isCheckedInToday()) {
            return { success: false, message: '今日已签到' };
        }

        // 获取当前天数的奖励
        const rewardConfig = CheckinManager.REWARDS[this.checkinDay - 1];
        if (!rewardConfig) {
            return { success: false, message: '签到配置错误' };
        }

        // 发放奖励
        const rewards = this发放奖励(rewardConfig);

        // 更新签到数据
        this.lastCheckinDate = new Date().toDateString();
        this.totalCheckins++;
        
        // 天数循环
        this.checkinDay++;
        if (this.checkinDay > 7) {
            this.checkinDay = 1; // 循环回第一天
        }

        eventManager.emit('checkinComplete', { day: this.checkinDay, rewards });

        return { success: true, message: '签到成功!', rewards };
    }

    /**
     * 发放奖励
     */
    发放奖励(rewardConfig) {
        const rewards = [];

        rewardConfig.rewards.forEach(reward => {
            if (reward.type === 'resource') {
                shelterManager.addResource(reward.id, reward.count);
                rewards.push({ type: 'resource', name: this.getResourceName(reward.id), count: reward.count });
            } else if (reward.type === 'item') {
                itemManager.addItem(reward.id, reward.count);
                rewards.push({ type: 'item', name: this.getItemName(reward.id), count: reward.count });
            } else if (reward.type === 'random_fragments') {
                // 50个碎片随机分成2-5份给不同英雄
                const fragments = this.generateRandomFragments(reward.total);
                fragments.forEach(f => {
                    heroManager.addFragments(f.configId, f.count);
                    rewards.push({ type: 'fragment', name: `${f.name}碎片`, count: f.count });
                });
            }
        });

        return rewards;
    }

    /**
     * 生成随机碎片分配
     * @param {number} total - 总碎片数
     * @returns {Array}
     */
    generateRandomFragments(total) {
        // 随机分成2-5份
        const numParts = Math.floor(Math.random() * 4) + 2; // 2-5
        const parts = [];
        
        // 随机分配碎片
        let remaining = total;
        for (let i = 0; i < numParts - 1; i++) {
            const maxPart = remaining - (numParts - i - 1); // 保证剩余的还能分
            const part = Math.floor(Math.random() * (maxPart - 1)) + 1;
            parts.push(part);
            remaining -= part;
        }
        parts.push(remaining); // 最后一份

        // 随机选择英雄
        const allHeroConfigs = HeroConfig.getAllHeroConfigs();
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

    /**
     * 获取资源名称
     */
    getResourceName(id) {
        const names = { gold: '金币', wood: '木材', stone: '石材', meat: '肉类', water: '水源' };
        return names[id] || id;
    }

    /**
     * 获取物品名称
     */
    getItemName(id) {
        const names = { energy_potion: '体力药水', hero_summon: '英雄召唤券' };
        return names[id] || id;
    }

    /**
     * 获取保存数据
     */
    getSaveData() {
        return {
            checkinDay: this.checkinDay,
            lastCheckinDate: this.lastCheckinDate,
            totalCheckins: this.totalCheckins
        };
    }

    /**
     * 获取签到状态（用于UI显示）
     */
    getCheckinStatus() {
        const today = new Date().toDateString();
        const isTodayCheckedIn = this.lastCheckinDate === today;

        return {
            currentDay: this.checkinDay,
            isTodayCheckedIn,
            canCheckin: !isTodayCheckedIn,
            rewards: CheckinManager.REWARDS
        };
    }
}

// 导出单例
const checkinManager = new CheckinManager();

// 暴露到全局
window.checkinManager = checkinManager;