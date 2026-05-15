/**
 * 签到与福利管理器 - 单例模式
 */
class CheckinManager {
    constructor() {
        if (CheckinManager.instance) {
            return CheckinManager.instance;
        }
        this.checkinDay = 1;
        this.lastCheckinDate = null;
        this.totalCheckins = 0;
        this.welfareAdCounts = {};
        this.monthCardStates = {};
        this.rewardVideoStats = { monthKey: '', count: 0, total: 0 };
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

    static DAILY_REWARDS = [
        { type: 'resource', id: 'diamond', count: 100 },
        { type: 'item', id: 'stimulant', count: 1 },
        { type: 'resource', id: 'meat', count: 10 }
    ];

    init(saveData) {
        if (saveData) {
            this.checkinDay = this.normalizeCheckinDay(saveData.checkinDay);
            this.lastCheckinDate = saveData.lastCheckinDate || null;
            this.totalCheckins = saveData.totalCheckins || 0;
            this.welfareAdCounts = this.normalizeWelfareAdCounts(saveData.welfareAdCounts);
            this.monthCardStates = this.normalizeMonthCardStates(saveData.monthCardStates);
            this.rewardVideoStats = this.normalizeRewardVideoStats(saveData.rewardVideoStats);
        } else {
            this.checkinDay = 1;
            this.lastCheckinDate = null;
            this.totalCheckins = 0;
            this.welfareAdCounts = {};
            this.monthCardStates = {};
            this.rewardVideoStats = { monthKey: '', count: 0, total: 0 };
        }
    }

    isCheckedInToday() {
        if (!this.lastCheckinDate) return false;
        const today = new Date().toDateString();
        return this.lastCheckinDate === today;
    }

    getTodayKey() {
        return new Date().toDateString();
    }

    checkin() {
        if (this.isCheckedInToday()) {
            return { success: false, message: '今日已签到' };
        }

        const claimedDay = this.checkinDay;
        const bonusRewardConfig = CheckinManager.REWARDS[claimedDay - 1];
        if (!bonusRewardConfig) {
            return { success: false, message: '签到配置错误' };
        }

        const inventoryCheck = this.canGrantRewards([
            ...CheckinManager.DAILY_REWARDS,
            ...(bonusRewardConfig.rewards || [])
        ]);
        if (!inventoryCheck.success) {
            return { success: false, message: inventoryCheck.message || '背包容量达到上限' };
        }

        const dailyRewards = this.grantRewards(CheckinManager.DAILY_REWARDS);
        const bonusRewards = this.grantRewards(bonusRewardConfig);
        const rewards = [...dailyRewards, ...bonusRewards];
        this.lastCheckinDate = this.getTodayKey();
        this.totalCheckins++;
        this.checkinDay++;
        if (this.checkinDay > 7) {
            this.checkinDay = 1;
        }

        const payload = {
            day: claimedDay,
            rewards,
            dailyRewards,
            bonusRewards,
            nextDay: this.checkinDay
        };
        eventManager.emit('checkinComplete', payload);
        return {
            success: true,
            message: '签到成功！',
            claimedDay,
            nextDay: this.checkinDay,
            rewards,
            dailyRewards,
            bonusRewards
        };
    }

    grantRewards(rewardConfig) {
        const rewards = [];

        const rewardList = Array.isArray(rewardConfig) ? rewardConfig : (rewardConfig?.rewards || []);
        rewardList.forEach(reward => {
            if (reward.type === 'resource') {
                shelterManager.addResource(reward.id, reward.count);
                rewards.push(RewardModal.createResourceReward(reward.id, reward.count));
            } else if (reward.type === 'item') {
                itemManager.addItem(reward.id, reward.count);
                rewards.push(RewardModal.createItemReward(reward.id, reward.count));
            } else if (reward.type === 'fragment') {
                const item = ItemConfig.getItemConfig(reward.id) || {};
                if (item.fragmentHeroId) {
                    heroManager.addFragments(item.fragmentHeroId, reward.count);
                    rewards.push(RewardModal.createFragmentReward(item.fragmentHeroId, reward.count));
                }
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

    canGrantRewards(rewardConfig) {
        const rewardList = Array.isArray(rewardConfig) ? rewardConfig : (rewardConfig?.rewards || []);
        const itemEntries = rewardList
            .filter(reward => reward?.type === 'item')
            .map(reward => ({ id: reward.id, count: reward.count || 1 }));
        return itemManager.canAddItemBundle(itemEntries);
    }

    normalizeCheckinDay(day) {
        const normalizedDay = Math.floor(Number(day) || 1);
        if (normalizedDay < 1) return 1;
        return ((normalizedDay - 1) % 7) + 1;
    }

    normalizeWelfareAdCounts(raw) {
        const result = {};
        if (!raw || typeof raw !== 'object') {
            return result;
        }
        Object.entries(raw).forEach(([giftId, info]) => {
            if (!giftId || !info || typeof info !== 'object') {
                return;
            }
            const date = String(info.date || '').trim();
            const count = Math.max(0, Number(info.count) || 0);
            if (!date && !count) {
                return;
            }
            result[giftId] = { date, count };
        });
        return result;
    }

    normalizeMonthCardStates(raw) {
        const result = {};
        if (!raw || typeof raw !== 'object') {
            return result;
        }
        Object.entries(raw).forEach(([cardId, info]) => {
            if (!cardId || !info || typeof info !== 'object') {
                return;
            }
            result[cardId] = {
                active: Boolean(info.active),
                activatedAt: String(info.activatedAt || '').trim(),
                expiresAt: String(info.expiresAt || '').trim(),
                watchedToday: Math.max(0, Number(info.watchedToday) || 0),
                watchedMonth: Math.max(0, Number(info.watchedMonth) || 0),
                totalWatched: Math.max(0, Number(info.totalWatched) || 0),
                lastWatchDate: String(info.lastWatchDate || '').trim(),
                watchMonthKey: String(info.watchMonthKey || '').trim(),
                lastClaimDate: String(info.lastClaimDate || '').trim()
            };
        });
        return result;
    }

    normalizeRewardVideoStats(raw) {
        if (!raw || typeof raw !== 'object') {
            return { monthKey: '', count: 0, total: 0 };
        }
        return {
            monthKey: String(raw.monthKey || '').trim(),
            count: Math.max(0, Number(raw.count) || 0),
            total: Math.max(0, Number(raw.total) || 0)
        };
    }

    ensureMonthCardState(cardId) {
        const id = String(cardId || '').trim();
        if (!id) {
            return {
                active: false,
                activatedAt: '',
                expiresAt: '',
                watchedToday: 0,
                watchedMonth: 0,
                totalWatched: 0,
                lastWatchDate: '',
                watchMonthKey: '',
                lastClaimDate: ''
            };
        }
        if (!this.monthCardStates[id]) {
            this.monthCardStates[id] = {
                active: false,
                activatedAt: '',
                expiresAt: '',
                watchedToday: 0,
                watchedMonth: 0,
                totalWatched: 0,
                lastWatchDate: '',
                watchMonthKey: '',
                lastClaimDate: ''
            };
        }
        return this.monthCardStates[id];
    }

    isMonthCardActive(cardId) {
        const state = this.ensureMonthCardState(cardId);
        this.refreshMonthCardActiveState(state);
        return Boolean(state.active);
    }

    getMonthKey(date = new Date()) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    getMonthCardDurationDays(cardConfig = null) {
        return Math.max(1, Number(cardConfig?.durationDays ?? 30) || 30);
    }

    refreshMonthCardActiveState(state, now = new Date()) {
        if (!state?.active || !state.expiresAt) {
            return;
        }
        const expiresAt = Date.parse(state.expiresAt);
        if (Number.isFinite(expiresAt) && expiresAt <= now.getTime()) {
            state.active = false;
        }
    }

    getMonthlyRewardVideoViews() {
        const currentMonthKey = this.getMonthKey();
        if (!this.rewardVideoStats || this.rewardVideoStats.monthKey !== currentMonthKey) {
            this.rewardVideoStats = {
                monthKey: currentMonthKey,
                count: 0,
                total: Math.max(0, Number(this.rewardVideoStats?.total) || 0)
            };
        }
        return Math.max(0, Number(this.rewardVideoStats.count) || 0);
    }

    recordRewardVideoWatch() {
        this.getMonthlyRewardVideoViews();
        this.rewardVideoStats.count += 1;
        this.rewardVideoStats.total += 1;
        return {
            monthKey: this.rewardVideoStats.monthKey,
            count: this.rewardVideoStats.count,
            total: this.rewardVideoStats.total
        };
    }

    activateMonthCard(state, cardConfig) {
        if (!state || state.active) {
            return;
        }
        const now = new Date();
        const expiresAt = new Date(now.getTime() + this.getMonthCardDurationDays(cardConfig) * 24 * 60 * 60 * 1000);
        state.active = true;
        state.activatedAt = now.toISOString();
        state.expiresAt = expiresAt.toISOString();
    }

    getMonthCardTier() {
        if (this.isMonthCardActive('supreme_month_card')) {
            return 'supreme';
        }
        if (this.isMonthCardActive('welfare_month_card')) {
            return 'welfare';
        }
        return 'none';
    }

    getWelfareAdLimit(baseLimitMap = null) {
        const map = baseLimitMap || {
            normal: 3,
            welfare: 4,
            supreme: 5
        };
        const tier = this.getMonthCardTier();
        if (tier === 'supreme') {
            return Math.max(0, Number(map.supreme ?? map.welfare ?? map.normal ?? 5) || 0);
        }
        if (tier === 'welfare') {
            return Math.max(0, Number(map.welfare ?? map.normal ?? 4) || 0);
        }
        return Math.max(0, Number(map.normal ?? 3) || 0);
    }

    getWelfareGiftUsage(giftId, baseLimitMap = null) {
        const id = String(giftId || '').trim();
        const today = this.getTodayKey();
        const saved = this.welfareAdCounts[id] || { date: '', count: 0 };
        const used = saved.date === today ? Math.max(0, Number(saved.count) || 0) : 0;
        const limit = this.getWelfareAdLimit(baseLimitMap);
        return {
            used,
            limit,
            remaining: Math.max(0, limit - used)
        };
    }

    canWatchWelfareGift(giftId, baseLimitMap = null) {
        const usage = this.getWelfareGiftUsage(giftId, baseLimitMap);
        return {
            success: usage.remaining > 0,
            ...usage,
            message: usage.remaining > 0 ? '' : '今日该礼包观看次数已达上限'
        };
    }

    recordWelfareGiftWatch(giftId) {
        const id = String(giftId || '').trim();
        if (!id) {
            return;
        }
        const today = this.getTodayKey();
        const current = this.welfareAdCounts[id] || { date: today, count: 0 };
        const nextCount = current.date === today ? (Math.max(0, Number(current.count) || 0) + 1) : 1;
        this.welfareAdCounts[id] = {
            date: today,
            count: nextCount
        };
    }

    getMonthCardStatus(cardConfig) {
        const cardId = String(cardConfig?.id || '').trim();
        const state = this.ensureMonthCardState(cardId);
        const today = this.getTodayKey();
        this.refreshMonthCardActiveState(state);
        const requiredViews = Math.max(1, Number(cardConfig?.requiredViews ?? cardConfig?.activationViews ?? 1) || 1);
        const watchProgress = state.lastWatchDate === today
            ? Math.max(0, Number(state.watchedToday) || 0)
            : 0;
        const monthProgress = this.getMonthlyRewardVideoViews();
        if (!state.active && monthProgress >= requiredViews) {
            this.activateMonthCard(state, cardConfig);
        }
        const canClaim = state.active && state.lastClaimDate !== today;
        return {
            id: cardId,
            active: Boolean(state.active),
            requiredViews,
            watchedToday: watchProgress,
            watchedMonth: monthProgress,
            totalWatched: Math.max(0, Number(state.totalWatched) || 0),
            remainingViews: Math.max(0, requiredViews - monthProgress),
            canClaim,
            activatedAt: state.activatedAt || '',
            expiresAt: state.expiresAt || '',
            durationDays: this.getMonthCardDurationDays(cardConfig)
        };
    }

    recordMonthCardWatch(cardConfig) {
        const cardId = String(cardConfig?.id || '').trim();
        const state = this.ensureMonthCardState(cardId);
        const today = this.getTodayKey();
        const currentMonthKey = this.getMonthKey();
        if (state.lastWatchDate !== today) {
            state.lastWatchDate = today;
            state.watchedToday = 0;
        }
        if (state.watchMonthKey !== currentMonthKey) {
            state.watchMonthKey = currentMonthKey;
            state.watchedMonth = 0;
        }
        state.watchedToday += 1;
        state.watchedMonth += 1;
        state.totalWatched = Math.max(0, Number(state.totalWatched) || 0) + 1;
        return this.getMonthCardStatus(cardConfig);
    }

    claimMonthCardRewards(cardConfig) {
        const cardId = String(cardConfig?.id || '').trim();
        const status = this.getMonthCardStatus(cardConfig);
        if (!status.active) {
            return { success: false, message: '月卡尚未激活' };
        }
        if (!status.canClaim) {
            return { success: false, message: '今日已领取该月卡奖励' };
        }
        const rewards = Array.isArray(cardConfig?.dailyRewards) ? cardConfig.dailyRewards : [];
        const inventoryCheck = this.canGrantRewards(rewards);
        if (!inventoryCheck.success) {
            return { success: false, message: inventoryCheck.message || '背包容量不足' };
        }
        const grantedRewards = this.grantRewards(rewards);
        this.ensureMonthCardState(cardId).lastClaimDate = this.getTodayKey();
        return {
            success: true,
            rewards: grantedRewards,
            message: '领取成功'
        };
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
            totalCheckins: this.totalCheckins,
            welfareAdCounts: this.welfareAdCounts,
            monthCardStates: this.monthCardStates,
            rewardVideoStats: this.rewardVideoStats
        };
    }

    getCheckinStatus() {
        const today = this.getTodayKey();
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
            rewards: CheckinManager.REWARDS,
            dailyRewards: CheckinManager.DAILY_REWARDS
        };
    }
}

const checkinManager = new CheckinManager();
window.checkinManager = checkinManager;
