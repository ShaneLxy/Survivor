/**
 * 红点提示管理器 - 单例模式
 *
 * 聚合"可领取/待处理"信号到各底部 Tab:
 *  - shelter:邮箱有附件可领的邮件
 *  - task:每日任务/成就中有 completed && !claimed 的项
 *  - checkin:今日未签到,或任意已激活月卡 canClaim
 *
 * 故意不把"福利礼包广告档"(gift_gold 等)计入红点,因为它们每天有额度,
 * 常年有剩余次数,否则福利 Tab 红点会常驻,玩家会脱敏。
 *
 * 计算结果通过事件 'redDotUpdate' 广播,载荷形如:
 *   { shelter: false, task: true, checkin: true, total: 2 }
 *
 * 刷新时机(多重保障,确保不丢):
 *   1) 业务事件触发(mailUpdate / taskUpdate / checkinComplete /
 *      monthCardActivated / viewChange)
 *   2) Game.refreshRuntimeUI 之后(领奖、登录后存档应用)
 *   3) onLoginSuccess 完成后(GamePatch 中 hook)
 *   4) View show 时(TaskView/CheckinView/ShelterView 打开都补刷)
 *   5) setInterval 兜底(3s,跨天 + 月卡到期 + 兜底未被事件覆盖的场景)
 *
 * Debug:浏览器 DevTools 里执行
 *   window.redDotManager.refresh()
 *   window.redDotManager.getState()
 * 可查看实时状态。
 */
class RedDotManager {
    constructor() {
        if (RedDotManager.instance) {
            return RedDotManager.instance;
        }

        this.state = {
            shelter: false,
            task: false,
            checkin: false,
            total: 0,
            detail: {
                mailClaimable: 0,
                taskClaimable: 0,
                checkinAvailable: false,
                monthCardClaimable: 0
            }
        };

        // 兜底间隔缩短到 3 秒。第一版用 60s 会导致跨天/init 失序的红点延迟,
        // 玩家体感差。3s 对性能影响可忽略(逻辑都是内存读取)。
        this.fallbackInterval = 3 * 1000;
        this.fallbackTimer = null;
        this.eventsBound = false;
        this.verbose = false; // 设为 true 会把每次 refresh 的结果打到 console

        RedDotManager.instance = this;
    }

    /**
     * 启动:绑定事件 + 立刻算一次 + 启用兜底定时器
     */
    start() {
        if (!this.eventsBound) {
            this.bindEvents();
            this.eventsBound = true;
        }

        this.refresh();

        if (!this.fallbackTimer) {
            this.fallbackTimer = setInterval(() => this.refresh(), this.fallbackInterval);
        }
    }

    stop() {
        if (this.fallbackTimer) {
            clearInterval(this.fallbackTimer);
            this.fallbackTimer = null;
        }
    }

    bindEvents() {
        if (typeof eventManager === 'undefined') {
            return;
        }
        const refresh = () => this.refresh();
        eventManager.on('mailUpdate', refresh);
        eventManager.on('taskUpdate', refresh);
        eventManager.on('checkinComplete', refresh);
        eventManager.on('monthCardActivated', refresh);
        // viewChange 切 tab 时也算一次,确保进入页面前红点对
        eventManager.on('viewChange', refresh);
        // 部分业务路径(领奖)只会触发 authChange / loginSuccess
        eventManager.on('loginSuccess', refresh);
        eventManager.on('authChange', refresh);
    }

    /**
     * 计算邮箱红点:有任一可领取邮件
     */
    computeMail() {
        const mgr = window.mailManager;
        if (!mgr || typeof mgr.getVisibleMails !== 'function') {
            return 0;
        }
        try {
            return mgr.getVisibleMails().filter(mail => mgr.canClaim(mail)).length;
        } catch (error) {
            console.warn('[RedDotManager] computeMail failed:', error);
            return 0;
        }
    }

    /**
     * 计算任务红点:每日 + 成就中 completed 且未 claimed 的总数
     */
    computeTask() {
        const mgr = window.taskManager;
        if (!mgr) {
            return 0;
        }
        try {
            const daily = typeof mgr.getDailyTasks === 'function' ? mgr.getDailyTasks() : [];
            const achievements = typeof mgr.getAchievements === 'function' ? mgr.getAchievements() : [];
            const ready = (list) => list.filter(t => t.completed && !t.claimed).length;
            return ready(daily) + ready(achievements);
        } catch (error) {
            console.warn('[RedDotManager] computeTask failed:', error);
            return 0;
        }
    }

    /**
     * 计算福利红点:
     *   - 今日尚未签到 → 红
     *   - 任一已激活月卡今日 canClaim → 红
     * 不包含广告档福利礼包(避免常驻红点)
     */
    computeCheckin() {
        const mgr = window.checkinManager;
        if (!mgr) {
            return { checkinAvailable: false, monthCardClaimable: 0 };
        }

        let checkinAvailable = false;
        try {
            if (typeof mgr.isCheckedInToday === 'function') {
                checkinAvailable = !mgr.isCheckedInToday();
            }
        } catch (error) {
            console.warn('[RedDotManager] computeCheckin (signin) failed:', error);
        }

        let monthCardClaimable = 0;
        try {
            const view = window.checkinView;
            const cards = view && typeof view.getMonthCardConfigs === 'function'
                ? view.getMonthCardConfigs()
                : [];
            cards.forEach(card => {
                if (!card?.id) return;
                const status = mgr.getMonthCardStatus(card);
                if (status?.active && status?.canClaim) {
                    monthCardClaimable += 1;
                }
            });
        } catch (error) {
            console.warn('[RedDotManager] computeCheckin (month-card) failed:', error);
        }

        return { checkinAvailable, monthCardClaimable };
    }

    /**
     * 重新计算所有红点并广播
     *
     * 注:不再做 isSameState 早返回 —— 加固第一版后,发现状态比较失败可能
     * 导致 emit 漏发(eg DOM 重建后红点没被重新渲染)。改为每次必 emit,
     * 让 TabBarPatch 那边的 syncAllDots 总是有机会跑一次,确保 DOM 一致。
     * 计算开销极小,emit 的下游也只是改几个 DOM class,可以放心。
     */
    refresh() {
        const mailClaimable = this.computeMail();
        const taskClaimable = this.computeTask();
        const { checkinAvailable, monthCardClaimable } = this.computeCheckin();

        const next = {
            shelter: mailClaimable > 0,
            task: taskClaimable > 0,
            checkin: checkinAvailable || monthCardClaimable > 0,
            total: 0,
            detail: {
                mailClaimable,
                taskClaimable,
                checkinAvailable,
                monthCardClaimable
            }
        };
        next.total = (next.shelter ? 1 : 0) + (next.task ? 1 : 0) + (next.checkin ? 1 : 0);

        this.state = next;

        if (this.verbose) {
            console.log('[RedDotManager] state', JSON.parse(JSON.stringify(this.state)));
        }

        if (typeof eventManager !== 'undefined') {
            eventManager.emit('redDotUpdate', { ...this.state });
        }
        return this.state;
    }

    getState() {
        return { ...this.state };
    }

    /**
     * 给定 tabId 返回是否需要红点(供 TabBar 渲染时查询)
     */
    isTabDotVisible(tabId) {
        return Boolean(this.state[tabId]);
    }

    /**
     * 给定 tabId 返回可选数字(用于邮箱/任务带数字红点);
     * 福利不返回数字,保持纯红点。
     */
    getTabDotCount(tabId) {
        if (tabId === 'shelter') {
            return this.state.detail?.mailClaimable || 0;
        }
        if (tabId === 'task') {
            return this.state.detail?.taskClaimable || 0;
        }
        return 0;
    }
}

const redDotManager = new RedDotManager();
window.redDotManager = redDotManager;
