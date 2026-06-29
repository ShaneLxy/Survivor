/**
 * 红点系统的"加固挂载点"补丁:
 *  覆盖各 View 的 show() 和 Game 的关键钩子,在这些时刻强制
 *  redDotManager.refresh(),确保红点与实时数据对齐。
 *
 *  之所以做这个补丁(而不是只依赖 RedDotManager 自身监听的事件),是因为:
 *   - mailManager.init / checkinManager.init 不会 emit 对应事件
 *   - 部分领奖路径只在 view 内部调 refreshRuntimeUI,可能跑得很早
 *   - 玩家打开任务/福利页时,期望红点已经反映"当前可领数",任何延迟都会
 *     导致 UI 自相矛盾(页内有可领项 但 tab 没红点)
 *
 *  本补丁加载顺序必须在 TaskView / CheckinView / ShelterView 之后。
 */
(function() {
    const safeRefresh = () => {
        try {
            window.redDotManager?.refresh?.();
        } catch (error) {
            console.warn('[RedDotViewHooksPatch] refresh failed:', error);
        }
    };

    // === TaskView.show ===
    if (typeof TaskView !== 'undefined' && TaskView.prototype) {
        const originalShow = TaskView.prototype.show;
        TaskView.prototype.show = function() {
            const result = originalShow.apply(this, arguments);
            safeRefresh();
            return result;
        };
    }

    // === CheckinView.show ===
    if (typeof CheckinView !== 'undefined' && CheckinView.prototype) {
        const originalShow = CheckinView.prototype.show;
        CheckinView.prototype.show = function() {
            const result = originalShow.apply(this, arguments);
            safeRefresh();
            return result;
        };
    }

    // === ShelterView.show ===
    if (typeof ShelterView !== 'undefined' && ShelterView.prototype) {
        const originalShow = ShelterView.prototype.show;
        if (typeof originalShow === 'function') {
            ShelterView.prototype.show = function() {
                const result = originalShow.apply(this, arguments);
                safeRefresh();
                return result;
            };
        }
    }

    // === Game.onLoginSuccess 完成后 ===
    if (typeof Game !== 'undefined' && Game.prototype) {
        const originalOnLoginSuccess = Game.prototype.onLoginSuccess;
        if (typeof originalOnLoginSuccess === 'function') {
            Game.prototype.onLoginSuccess = async function() {
                const result = await originalOnLoginSuccess.apply(this, arguments);
                // 登录流程会调 mailManager.init、checkinManager.init 等
                // 但这两个 init 都不 emit 事件,所以我们在登录完成时主动 refresh
                safeRefresh();
                return result;
            };
        }
    }
})();
