class TaskManager {
    constructor() {
        if (TaskManager.instance) {
            return TaskManager.instance;
        }
        this.dailyProgress = {};
        this.dailyClaimed = {};
        this.achievementProgress = {};
        this.achievementClaimed = {};
        this.lastDailyReset = this.getTodayKey();
        this.eventsBound = false;
        this.bindEvents();
        TaskManager.instance = this;
    }

    static DAILY_TASKS = [
        {
            id: 'daily_login',
            title: '每日登录',
            description: '今天登录游戏 1 次',
            target: 1,
            reward: [{ type: 'resource', id: 'gold', count: 120 }]
        },
        {
            id: 'daily_recruit',
            title: '招募尝试',
            description: '进行 1 次招募或打造',
            target: 1,
            reward: [{ type: 'resource', id: 'wood', count: 25 }]
        },
        {
            id: 'daily_upgrade_building',
            title: '建设避难所',
            description: '升级任意建筑 1 次',
            target: 1,
            reward: [{ type: 'resource', id: 'stone', count: 20 }]
        },
        {
            id: 'daily_clear_dungeon',
            title: '副本推进',
            description: '完成 1 次副本',
            target: 1,
            reward: [{ type: 'resource', id: 'gold', count: 180 }]
        },
        {
            id: 'daily_collect_shelter',
            title: '收获资源',
            description: '收获 1 次避难所资源',
            target: 1,
            reward: [{ type: 'item', id: 'exp_potion', count: 1 }]
        }
    ];

    static ACHIEVEMENTS = [
        {
            id: 'achievement_first_login',
            title: '幸存者报到',
            description: '完成首次登录',
            target: 1,
            reward: [{ type: 'resource', id: 'gold', count: 200 }]
        },
        {
            id: 'achievement_first_recruit',
            title: '集结新战力',
            description: '首次进行招募或打造',
            target: 1,
            reward: [{ type: 'resource', id: 'wood', count: 40 }]
        },
        {
            id: 'achievement_first_upgrade',
            title: '建设起步',
            description: '首次升级建筑',
            target: 1,
            reward: [{ type: 'resource', id: 'stone', count: 35 }]
        },
        {
            id: 'achievement_first_clear',
            title: '初战告捷',
            description: '首次完成副本',
            target: 1,
            reward: [{ type: 'resource', id: 'gold', count: 300 }]
        },
        {
            id: 'achievement_first_collect',
            title: '丰收时刻',
            description: '首次收获避难所资源',
            target: 1,
            reward: [{ type: 'item', id: 'exp_potion', count: 2 }]
        }
    ];

    bindEvents() {
        if (this.eventsBound) {
            return;
        }
        eventManager.on('gachaPull', () => this.record('recruit'));
        eventManager.on('buildingUpgrade', () => this.record('buildingUpgrade'));
        eventManager.on('dungeonComplete', () => this.record('dungeonComplete'));
        eventManager.on('shelterProductionCollect', () => this.record('shelterCollect'));
        this.eventsBound = true;
    }

    init(saveData) {
        this.dailyProgress = { ...(saveData?.dailyProgress || {}) };
        this.dailyClaimed = { ...(saveData?.dailyClaimed || {}) };
        this.achievementProgress = { ...(saveData?.achievementProgress || {}) };
        this.achievementClaimed = { ...(saveData?.achievementClaimed || {}) };
        this.lastDailyReset = saveData?.lastDailyReset || this.getTodayKey();
        this.resetDailyIfNeeded();
        this.emitUpdate();
    }

    getTodayKey() {
        return new Date().toLocaleDateString('zh-CN', {
            timeZone: 'Asia/Shanghai'
        });
    }

    resetDailyIfNeeded() {
        const today = this.getTodayKey();
        if (this.lastDailyReset === today) {
            return;
        }
        this.dailyProgress = {};
        this.dailyClaimed = {};
        this.lastDailyReset = today;
    }

    emitUpdate() {
        eventManager.emit('taskUpdate', {
            dailyProgress: { ...this.dailyProgress },
            achievementProgress: { ...this.achievementProgress }
        });
    }

    markProgress(store, taskId, value, target) {
        const currentValue = Number(store[taskId]) || 0;
        const nextValue = Math.min(target, Math.max(currentValue, value));
        store[taskId] = nextValue;
    }

    incrementProgress(store, taskId, amount, target) {
        const currentValue = Number(store[taskId]) || 0;
        store[taskId] = Math.min(target, currentValue + amount);
    }

    record(action) {
        this.resetDailyIfNeeded();
        switch (action) {
            case 'login':
                this.markProgress(this.dailyProgress, 'daily_login', 1, 1);
                this.markProgress(this.achievementProgress, 'achievement_first_login', 1, 1);
                break;
            case 'recruit':
                this.incrementProgress(this.dailyProgress, 'daily_recruit', 1, 1);
                this.markProgress(this.achievementProgress, 'achievement_first_recruit', 1, 1);
                break;
            case 'buildingUpgrade':
                this.incrementProgress(this.dailyProgress, 'daily_upgrade_building', 1, 1);
                this.markProgress(this.achievementProgress, 'achievement_first_upgrade', 1, 1);
                break;
            case 'dungeonComplete':
                this.incrementProgress(this.dailyProgress, 'daily_clear_dungeon', 1, 1);
                this.markProgress(this.achievementProgress, 'achievement_first_clear', 1, 1);
                break;
            case 'shelterCollect':
                this.incrementProgress(this.dailyProgress, 'daily_collect_shelter', 1, 1);
                this.markProgress(this.achievementProgress, 'achievement_first_collect', 1, 1);
                break;
            default:
                return;
        }
        this.emitUpdate();
        window.game?.save?.();
    }

    getTaskState(definition, progressStore, claimedStore) {
        const progress = Number(progressStore[definition.id]) || 0;
        const claimed = Boolean(claimedStore[definition.id]);
        const completed = progress >= definition.target;
        return {
            ...definition,
            progress,
            claimed,
            completed
        };
    }

    getDailyTasks() {
        this.resetDailyIfNeeded();
        return TaskManager.DAILY_TASKS.map(task => this.getTaskState(task, this.dailyProgress, this.dailyClaimed));
    }

    getAchievements() {
        return TaskManager.ACHIEVEMENTS.map(task => this.getTaskState(task, this.achievementProgress, this.achievementClaimed));
    }

    grantRewards(rewards) {
        const rewardEntries = [];
        (rewards || []).forEach(reward => {
            if (reward.type === 'item') {
                itemManager.addItem(reward.id, reward.count);
                rewardEntries.push(RewardModal.createItemReward(reward.id, reward.count));
                return;
            }
            shelterManager.addResource(reward.id, reward.count);
            rewardEntries.push(RewardModal.createResourceReward(reward.id, reward.count));
        });
        return rewardEntries;
    }

    canClaimRewards(rewards) {
        const itemEntries = (Array.isArray(rewards) ? rewards : [])
            .filter(reward => reward?.type === 'item')
            .map(reward => ({ id: reward.id, count: reward.count || 1 }));
        return itemManager.canAddItemBundle(itemEntries);
    }

    claimDaily(taskId) {
        this.resetDailyIfNeeded();
        const definition = TaskManager.DAILY_TASKS.find(task => task.id === taskId);
        if (!definition) {
            return { success: false, message: '任务不存在' };
        }
        const task = this.getTaskState(definition, this.dailyProgress, this.dailyClaimed);
        if (!task.completed) {
            return { success: false, message: '任务尚未完成' };
        }
        if (task.claimed) {
            return { success: false, message: '奖励已领取' };
        }

        const inventoryCheck = this.canClaimRewards(definition.reward);
        if (!inventoryCheck.success) {
            return { success: false, message: inventoryCheck.message || '背包容量达到上限' };
        }

        this.dailyClaimed[taskId] = true;
        const rewardEntries = this.grantRewards(definition.reward);
        this.emitUpdate();
        window.game?.save?.();
        return { success: true, title: definition.title, rewardEntries };
    }

    claimAchievement(taskId) {
        const definition = TaskManager.ACHIEVEMENTS.find(task => task.id === taskId);
        if (!definition) {
            return { success: false, message: '成就不存在' };
        }
        const task = this.getTaskState(definition, this.achievementProgress, this.achievementClaimed);
        if (!task.completed) {
            return { success: false, message: '成就尚未完成' };
        }
        if (task.claimed) {
            return { success: false, message: '奖励已领取' };
        }

        const inventoryCheck = this.canClaimRewards(definition.reward);
        if (!inventoryCheck.success) {
            return { success: false, message: inventoryCheck.message || '背包容量达到上限' };
        }

        this.achievementClaimed[taskId] = true;
        const rewardEntries = this.grantRewards(definition.reward);
        this.emitUpdate();
        window.game?.save?.();
        return { success: true, title: definition.title, rewardEntries };
    }

    getDailySummary() {
        const tasks = this.getDailyTasks();
        return {
            completed: tasks.filter(task => task.completed).length,
            claimed: tasks.filter(task => task.claimed).length,
            total: tasks.length
        };
    }

    getAchievementSummary() {
        const tasks = this.getAchievements();
        return {
            completed: tasks.filter(task => task.completed).length,
            claimed: tasks.filter(task => task.claimed).length,
            total: tasks.length
        };
    }

    getSaveData() {
        return {
            dailyProgress: { ...this.dailyProgress },
            dailyClaimed: { ...this.dailyClaimed },
            achievementProgress: { ...this.achievementProgress },
            achievementClaimed: { ...this.achievementClaimed },
            lastDailyReset: this.lastDailyReset
        };
    }
}

const taskManager = new TaskManager();
window.taskManager = taskManager;
