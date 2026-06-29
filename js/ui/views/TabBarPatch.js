/**
 * TabBar 补丁:
 *  1) 插入"任务"Tab(原有逻辑)
 *  2) 接入 RedDotManager,根据红点状态在对应 Tab 上渲染小红点 / 数字徽标
 *
 * 设计要点:
 *  - 仅 shelter / task / checkin 三个 Tab 支持红点
 *  - 切到对应 Tab 时不立刻消除红点;只有真正"领取动作"完成、
 *    业务侧 emit 对应 update 事件 → RedDotManager 重算 → 这里收到
 *    'redDotUpdate' 才更新视图
 *  - 重渲染(tabBar.create)后会重建按钮,因此监听 redDotUpdate 中要
 *    重新查询当前 DOM 节点
 */
(function() {
    if (!window.tabBar) {
        return;
    }

    // === 1) 插入任务 Tab(保留原逻辑) ===
    const hasTaskTab = window.tabBar.tabs.some((tab) => tab.id === 'task');
    if (!hasTaskTab) {
        window.tabBar.tabs.splice(5, 0, { id: 'task', name: '任务', icon: '✓' });
        window.tabBar.create();
    }

    // === 2) 红点能力扩展 ===

    /**
     * 在指定 Tab 按钮上添加 / 更新 / 移除红点
     * @param {string} tabId
     * @param {boolean} visible
     * @param {number} [count]  - 大于 0 时显示数字,否则纯点
     */
    function applyDotOnButton(tabId, visible, count) {
        const root = window.tabBar?.element;
        if (!root) return;
        const btn = root.querySelector(`.tab-item[data-tab="${tabId}"]`);
        if (!btn) return;

        let dot = btn.querySelector('.tab-red-dot');
        if (!visible) {
            if (dot) dot.remove();
            btn.classList.remove('has-red-dot');
            return;
        }

        if (!dot) {
            dot = document.createElement('span');
            dot.className = 'tab-red-dot';
            // 让 dot 放在 tab-icon 容器上方,定位用 CSS
            btn.appendChild(dot);
        }

        const showNumber = Number.isFinite(count) && count > 0;
        if (showNumber) {
            dot.classList.add('has-number');
            dot.textContent = count > 99 ? '99+' : String(count);
        } else {
            dot.classList.remove('has-number');
            dot.textContent = '';
        }
        btn.classList.add('has-red-dot');
    }

    /**
     * 按当前 RedDotManager 状态全量刷新三个 Tab 红点
     */
    function syncAllDots() {
        const mgr = window.redDotManager;
        if (!mgr) return;
        applyDotOnButton('shelter', mgr.isTabDotVisible('shelter'), mgr.getTabDotCount('shelter'));
        applyDotOnButton('task', mgr.isTabDotVisible('task'), mgr.getTabDotCount('task'));
        // 福利只用纯点,不显示数字
        applyDotOnButton('checkin', mgr.isTabDotVisible('checkin'));
    }

    // 包装原 create:每次重建 DOM 后立刻同步红点
    const originalCreate = window.tabBar.create.bind(window.tabBar);
    window.tabBar.create = function() {
        originalCreate();
        // 等下一个微任务,确保 DOM 渲染完
        Promise.resolve().then(syncAllDots);
    };

    // 监听红点状态变化
    if (typeof eventManager !== 'undefined') {
        eventManager.on('redDotUpdate', () => syncAllDots());
    }

    // 启动红点管理器(idempotent)
    if (window.redDotManager?.start) {
        window.redDotManager.start();
    }

    // 初次同步一次,以防 redDotUpdate 早于本 patch 触发
    Promise.resolve().then(syncAllDots);

    // === 调试入口 ===
    // 在 DevTools 控制台执行 `debugRedDot()` 查看实时状态 + DOM 检查
    window.debugRedDot = function() {
        const mgr = window.redDotManager;
        if (!mgr) {
            console.error('[debugRedDot] redDotManager 未加载');
            return null;
        }
        mgr.refresh();
        const state = mgr.getState();
        const root = window.tabBar?.element;
        const tabs = ['shelter', 'task', 'checkin'];
        const domStatus = {};
        tabs.forEach(id => {
            const btn = root?.querySelector(`.tab-item[data-tab="${id}"]`);
            const dot = btn?.querySelector('.tab-red-dot');
            domStatus[id] = {
                btnFound: !!btn,
                dotInDom: !!dot,
                dotText: dot?.textContent || ''
            };
        });
        console.log('[debugRedDot] state =', state);
        console.log('[debugRedDot] DOM   =', domStatus);
        console.log('[debugRedDot] hint  = 若 state 显示 true 但 dotInDom 为 false → 看 console 是否有报错;若 state 全 false → 数据源(mail/task/checkin manager)还没 init');
        return { state, dom: domStatus };
    };

    // 开启 verbose:每次 refresh 在 console 打印一行,方便看流转
    // 设置 window.redDotManager.verbose = true 即可启用
})();
