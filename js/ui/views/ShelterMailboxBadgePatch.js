/**
 * 避难所页内邮箱按钮的红点徽标
 *
 *  当 mailManager 里有"附件可领"的邮件时,在避难所页内的邮箱按钮右上角
 *  显示一个常亮(无脉冲)红点 + 数字;无可领时移除。
 *
 *  数据源:统一来自 RedDotManager.state.detail.mailClaimable,确保和底部
 *  导航栏 shelter tab 的红点状态完全一致(不会出现一处亮一处不亮)。
 *
 *  刷新时机:
 *   - ShelterView.render 调用后(玩家进入避难所页 / 视图重渲染)
 *   - eventManager 'redDotUpdate'(RedDotManager 每次 refresh 都 emit)
 *
 *  加载顺序:必须在 ShelterMailboxPatch.js 之后(它定义了邮箱按钮),
 *  在 RedDotManager.js 之后(数据源)。
 */
(function() {
    if (typeof ShelterView === 'undefined' || !window.shelterView) {
        return;
    }

    function findMailboxButton() {
        const view = window.shelterView;
        if (!view?.element) return null;
        return view.element.querySelector('button[data-shelter-action="mailbox"]')
            || view.element.querySelector('.shelter-side-button-mailbox');
    }

    function syncMailboxBadge() {
        const btn = findMailboxButton();
        if (!btn) return;

        const count = window.redDotManager?.getState?.()?.detail?.mailClaimable || 0;

        let badge = btn.querySelector('.shelter-mailbox-badge');
        if (count <= 0) {
            if (badge) badge.remove();
            btn.classList.remove('has-mail-badge');
            return;
        }

        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'shelter-mailbox-badge';
            btn.appendChild(badge);
        }
        // 9 封以内显示数字徽标,超过 99 显示 99+;若不想显示数字,
        // 可以删掉下面这段并给 badge 加 .is-dot-only
        badge.classList.remove('is-dot-only');
        badge.textContent = count > 99 ? '99+' : String(count);
        btn.classList.add('has-mail-badge');
    }

    // 1) hook render:render 会重置 innerHTML,需要在 DOM 重建后挂红点
    const originalRender = ShelterView.prototype.render;
    ShelterView.prototype.render = function() {
        const result = originalRender.apply(this, arguments);
        // 微任务后执行,确保 DOM 已渲染
        Promise.resolve().then(syncMailboxBadge);
        return result;
    };

    // 2) 监听 RedDotManager 状态变化:领取一封邮件后这里会触发
    if (typeof eventManager !== 'undefined') {
        eventManager.on('redDotUpdate', syncMailboxBadge);
        // 兜底:mailUpdate 来得早于 redDotUpdate 时也响应一次
        eventManager.on('mailUpdate', () => Promise.resolve().then(syncMailboxBadge));
    }

    // 3) 启动时先同步一次(虽然此时 view 可能还没显示)
    Promise.resolve().then(syncMailboxBadge);
})();
