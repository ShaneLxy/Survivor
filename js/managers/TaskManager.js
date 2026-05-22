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
        this.dailyTasks = TaskManager.FALLBACK_QUESTS.slice();
        this.achievements = TaskManager.FALLBACK_ACHIEVEMENTS.slice();
        this.eventsBound = false;
        this.bindEvents();
        TaskManager.instance = this;
    }

    static EVENT_DEFINITIONS = [
        { event: 'login', label: '玩家登录', conditions: [] },
        { event: 'gachaPull', label: '招募/打造', conditions: ['poolId'] },
        { event: 'buildingUpgrade', label: '建筑升级', conditions: ['buildingId'] },
        { event: 'dungeonComplete', label: '副本完成', conditions: ['dungeonId', 'stars'] },
        { event: 'shelterProductionCollect', label: '收获资源', conditions: ['buildingId'] },
        { event: 'tutorialComplete', label: '完成新手教程', conditions: [] },
        { event: 'heroLevelUp', label: '英雄升级', conditions: ['heroId'] },
        { event: 'heroStarsUp', label: '英雄升星', conditions: ['heroId', 'stars'] },
        { event: 'equipmentAdd', label: '获得装备', conditions: ['rarity', 'slot'] },
        { event: 'checkinComplete', label: '完成签到', conditions: [] }
    ];

    static FALLBACK_QUESTS = [
        {
            id: 'daily_login',
            title: '每日登录',
            description: '今天登录游戏 1 次',
            period: 'daily',
            trigger: { event: 'login', conditions: {}, mode: 'mark' },
            target: 1,
            rewards: [{ type: 'resource', id: 'gold', count: 120 }]
        },
        {
            id: 'daily_recruit',
            title: '招募尝试',
            description: '进行 1 次招募或打造',
            period: 'daily',
            trigger: { event: 'gachaPull', conditions: {}, mode: 'increment' },
            target: 1,
            rewards: [{ type: 'resource', id: 'wood', count: 25 }]
        },
        {
            id: 'daily_upgrade_building',
            title: '建设避难所',
            description: '升级任意建筑 1 次',
            period: 'daily',
            trigger: { event: 'buildingUpgrade', conditions: {}, mode: 'increment' },
            target: 1,
            rewards: [{ type: 'resource', id: 'stone', count: 20 }]
        },
        {
            id: 'daily_clear_dungeon',
            title: '副本推进',
            description: '完成 1 次副本',
            period: 'daily',
            trigger: { event: 'dungeonComplete', conditions: {}, mode: 'increment' },
            target: 1,
            rewards: [{ type: 'resource', id: 'gold', count: 180 }]
        },
        {
            id: 'daily_collect_shelter',
            title: '收获资源',
            description: '收获 1 次避难所资源',
            period: 'daily',
            trigger: { event: 'shelterProductionCollect', conditions: {}, mode: 'increment' },
            target: 1,
            rewards: [{ type: 'item', id: 'exp_potion', count: 1 }]
        }
    ];

    static FALLBACK_ACHIEVEMENTS = [
        {
            id: 'achievement_finish_tutorial',
            title: '完成新手指引',
            description: '完成首次新手教程，熟悉主要功能入口',
            period: 'permanent',
            trigger: { event: 'tutorialComplete', conditions: {}, mode: 'mark' },
            target: 1,
            rewards: [{ type: 'resource', id: 'gold', count: 260 }]
        },
        {
            id: 'achievement_first_login',
            title: '幸存者报到',
            description: '完成首次登录',
            period: 'permanent',
            trigger: { event: 'login', conditions: {}, mode: 'mark' },
            target: 1,
            rewards: [{ type: 'resource', id: 'gold', count: 200 }]
        },
        {
            id: 'achievement_first_recruit',
            title: '集结新战力',
            description: '首次进行招募或打造',
            period: 'permanent',
            trigger: { event: 'gachaPull', conditions: {}, mode: 'mark' },
            target: 1,
            rewards: [{ type: 'resource', id: 'wood', count: 40 }]
        },
        {
            id: 'achievement_first_upgrade',
            title: '建设起步',
            description: '首次升级建筑',
            period: 'permanent',
            trigger: { event: 'buildingUpgrade', conditions: {}, mode: 'mark' },
            target: 1,
            rewards: [{ type: 'resource', id: 'stone', count: 35 }]
        },
        {
            id: 'achievement_first_clear',
            title: '初战告捷',
            description: '首次完成副本',
            period: 'permanent',
            trigger: { event: 'dungeonComplete', conditions: {}, mode: 'mark' },
            target: 1,
            rewards: [{ type: 'resource', id: 'gold', count: 300 }]
        },
        {
            id: 'achievement_first_collect',
            title: '丰收时刻',
            description: '首次收获避难所资源',
            period: 'permanent',
            trigger: { event: 'shelterProductionCollect', conditions: {}, mode: 'mark' },
            target: 1,
            rewards: [{ type: 'item', id: 'exp_potion', count: 2 }]
        }
    ];

    bindEvents() {
        if (this.eventsBound) {
            return;
        }
        TaskManager.EVENT_DEFINITIONS.forEach((def) => {
            eventManager.on(def.event, (payload) => this.handleEvent(def.event, payload || {}));
        });
        this.eventsBound = true;
    }

    setDefinitions(quests, achievements) {
        this.dailyTasks = Array.isArray(quests) && quests.length > 0
            ? quests.map((entry) => this.normalizeDefinition(entry, 'daily'))
            : TaskManager.FALLBACK_QUESTS.slice();
        this.achievements = Array.isArray(achievements) && achievements.length > 0
            ? achievements.map((entry) => this.normalizeDefinition(entry, 'permanent'))
            : TaskManager.FALLBACK_ACHIEVEMENTS.slice();
        this.resetDailyIfNeeded();
        this.emitUpdate();
    }

    normalizeDefinition(entry, defaultPeriod) {
        const trigger = entry?.trigger || {};
        const rewardsRaw = Array.isArray(entry?.rewards)
            ? entry.rewards
            : (Array.isArray(entry?.reward) ? entry.reward : []);
        return {
            id: String(entry?.id || '').trim(),
            title: String(entry?.title || '').trim(),
            description: String(entry?.description || '').trim(),
            period: entry?.period || defaultPeriod,
            target: Math.max(1, Math.floor(Number(entry?.target) || 1)),
            trigger: {
                event: String(trigger?.event || '').trim(),
                conditions: (trigger?.conditions && typeof trigger.conditions === 'object') ? trigger.conditions : {},
                mode: trigger?.mode === 'mark' ? 'mark' : 'increment'
            },
            rewards: rewardsRaw.filter(Boolean).map((reward) => ({
                type: reward.type,
                id: reward.id,
                count: Math.max(1, Number(reward.count) || 1)
            }))
        };
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

    handleEvent(eventName, payload) {
        this.resetDailyIfNeeded();
        let changed = false;

        const apply = (definitions, progressStore) => {
            definitions.forEach((def) => {
                if (!def?.trigger || def.trigger.event !== eventName) {
                    return;
                }
                if (!this.matchConditions(payload, def.trigger.conditions)) {
                    return;
                }
                const target = Math.max(1, Number(def.target) || 1);
                const before = Number(progressStore[def.id]) || 0;
                if (before >= target) {
                    return;
                }
                let next;
                if (def.trigger.mode === 'mark') {
                    next = Math.min(target, Math.max(before, 1));
                } else {
                    next = Math.min(target, before + 1);
                }
                if (next !== before) {
                    progressStore[def.id] = next;
                    changed = true;
                }
            });
        };

        apply(this.dailyTasks, this.dailyProgress);
        apply(this.achievements, this.achievementProgress);

        if (changed) {
            this.emitUpdate();
            window.game?.save?.();
        }
    }

    matchConditions(payload, conditions) {
        if (!conditions || typeof conditions !== 'object') {
            return true;
        }
        const keys = Object.keys(conditions);
        if (keys.length === 0) {
            return true;
        }
        if (!payload || typeof payload !== 'object') {
            return false;
        }
        return keys.every((key) => {
            const expected = conditions[key];
            const actual = payload[key];
            return actual === expected || String(actual) === String(expected);
        });
    }

    record(action, payload = {}) {
        const actionToEvent = {
            login: 'login',
            recruit: 'gachaPull',
            buildingUpgrade: 'buildingUpgrade',
            dungeonComplete: 'dungeonComplete',
            shelterCollect: 'shelterProductionCollect',
            tutorialComplete: 'tutorialComplete'
        };
        const eventName = actionToEvent[action] || action;
        this.handleEvent(eventName, payload);
    }

    getTaskState(definition, progressStore, claimedStore) {
        const progress = Number(progressStore[definition.id]) || 0;
        const target = Math.max(1, Number(definition.target) || 1);
        const claimed = Boolean(claimedStore[definition.id]);
        const completed = progress >= target;
        return {
            ...definition,
            reward: definition.rewards || definition.reward || [],
            target,
            progress,
            claimed,
            completed
        };
    }

    getDailyTasks() {
        this.resetDailyIfNeeded();
        return this.dailyTasks.map((task) => this.getTaskState(task, this.dailyProgress, this.dailyClaimed));
    }

    getAchievements() {
        return this.achievements.map((task) => this.getTaskState(task, this.achievementProgress, this.achievementClaimed));
    }

    grantRewards(rewards) {
        const rewardEntries = [];
        (rewards || []).forEach((reward) => {
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
            .filter((reward) => reward?.type === 'item')
            .map((reward) => ({ id: reward.id, count: reward.count || 1 }));
        return itemManager.canAddItemBundle(itemEntries);
    }

    getDefinitionRewards(definition) {
        return Array.isArray(definition?.rewards) && definition.rewards.length > 0
            ? definition.rewards
            : (Array.isArray(definition?.reward) ? definition.reward : []);
    }

    claimDaily(taskId) {
        this.resetDailyIfNeeded();
        const definition = this.dailyTasks.find((task) => task.id === taskId);
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

        const rewards = this.getDefinitionRewards(definition);
        const inventoryCheck = this.canClaimRewards(rewards);
        if (!inventoryCheck.success) {
            return { success: false, message: inventoryCheck.message || '背包容量达到上限' };
        }

        this.dailyClaimed[taskId] = true;
        const rewardEntries = this.grantRewards(rewards);
        this.emitUpdate();
        window.game?.save?.();
        return { success: true, title: definition.title, rewardEntries };
    }

    claimAchievement(taskId) {
        const definition = this.achievements.find((task) => task.id === taskId);
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

        const rewards = this.getDefinitionRewards(definition);
        const inventoryCheck = this.canClaimRewards(rewards);
        if (!inventoryCheck.success) {
            return { success: false, message: inventoryCheck.message || '背包容量达到上限' };
        }

        this.achievementClaimed[taskId] = true;
        const rewardEntries = this.grantRewards(rewards);
        this.emitUpdate();
        window.game?.save?.();
        return { success: true, title: definition.title, rewardEntries };
    }

    getDailySummary() {
        const tasks = this.getDailyTasks();
        return {
            completed: tasks.filter((task) => task.completed).length,
            claimed: tasks.filter((task) => task.claimed).length,
            total: tasks.length
        };
    }

    getAchievementSummary() {
        const tasks = this.getAchievements();
        return {
            completed: tasks.filter((task) => task.completed).length,
            claimed: tasks.filter((task) => task.claimed).length,
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
