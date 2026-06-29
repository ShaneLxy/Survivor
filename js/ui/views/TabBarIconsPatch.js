/**
 * TabBar 图标补丁:
 *  将默认的 Unicode 字符图标替换为 1.8px stroke 的 SVG 线条图标。
 *
 *  风格:
 *   - 24x24 viewBox,以 22x22 像素渲染
 *   - fill="none" + stroke="currentColor" → 自动跟随 .tab-item 的 color
 *     变化(默认 #808080,active 时 #ffd700)
 *   - round 端点 + round 转角,小尺寸下更柔和
 *
 *  加载顺序要求:必须在 TabBarPatch.js 之后(它会接管 create()
 *  以同步红点),这样我们 splice 完图标再 create(),会一并触发红点同步。
 */
(function() {
    if (!window.tabBar) {
        return;
    }

    const svg = (paths) => `
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round"
             class="tab-svg-icon" aria-hidden="true">
            ${paths}
        </svg>
    `;

    const ICONS = {
        // 避难所 - 房子 + 烟囱 + 门
        shelter: svg(`
            <path d="M3 11.5 L12 4 L21 11.5"/>
            <path d="M5 10 V20.5 H19 V10"/>
            <path d="M10 20.5 V14 H14 V20.5"/>
            <path d="M16 7.5 V4.5 H17.8 V8.5"/>
        `),

        // 英雄 - 盾牌 + 内部勾
        hero: svg(`
            <path d="M12 3 L20 5.5 V12 C20 16.5 12 21 12 21 C12 21 4 16.5 4 12 V5.5 Z"/>
            <path d="M9 12 L11 14 L15 10"/>
        `),

        // 招募 - 人头剪影 + 召唤星光
        recruit: svg(`
            <circle cx="11.5" cy="9" r="3.2"/>
            <path d="M5.5 21 V18 C5.5 14.8 7.8 13 11.5 13 C13.5 13 15.1 13.5 16.3 14.4"/>
            <path d="M18.5 4.5 L19.2 6.3 L21 7 L19.2 7.7 L18.5 9.5 L17.8 7.7 L16 7 L17.8 6.3 Z"
                  fill="currentColor" stroke="none"/>
            <path d="M18.5 13.5 L19 14.7 L20.2 15.2 L19 15.7 L18.5 17 L18 15.7 L16.8 15.2 L18 14.7 Z"
                  fill="currentColor" stroke="none"/>
        `),

        // 副本 - 城堡(两侧矮塔 + 中央高塔 + 门)
        dungeon: svg(`
            <path d="M3 20.5 V11.5 H5 V8.5 H7 V11.5 H10 V14 H14 V11.5 H17 V8.5 H19 V11.5 H21 V20.5 Z"/>
            <path d="M10.5 20.5 V16 H13.5 V20.5"/>
        `),

        // 商城 - 购物袋(梯形袋身 + 圆弧提手)
        shop: svg(`
            <path d="M5.5 9 L4.5 20.5 H19.5 L18.5 9 Z"/>
            <path d="M8.5 9 V7 C8.5 5.1 10 3.5 12 3.5 C14 3.5 15.5 5.1 15.5 7 V9"/>
        `),

        // 任务 - 剪贴板 + 顶部夹子 + 内部勾
        task: svg(`
            <path d="M6 5.5 H18 V20.5 H6 Z"/>
            <path d="M9.5 4 H14.5 V6.5 H9.5 Z"/>
            <path d="M9 13 L11 15 L15 10.5"/>
        `),

        // 福利 - 礼盒 + 蝴蝶结(顶部盖带 + 主盒身 + 垂直丝带)
        checkin: svg(`
            <path d="M3.5 9 H20.5 V12.5 H3.5 Z"/>
            <path d="M5 12.5 V20.5 H19 V12.5"/>
            <path d="M12 9 V20.5"/>
            <path d="M12 9 C9 9 7 7.5 7 5.8 C7 4.5 8 3.8 9 4 C10.5 4.3 11.5 6.5 12 9 Z"
                  fill="currentColor" fill-opacity="0.18"/>
            <path d="M12 9 C15 9 17 7.5 17 5.8 C17 4.5 16 3.8 15 4 C13.5 4.3 12.5 6.5 12 9 Z"
                  fill="currentColor" fill-opacity="0.18"/>
        `)
    };

    // 替换每个 tab 的 icon 字段
    let changed = false;
    window.tabBar.tabs.forEach(tab => {
        if (ICONS[tab.id] && tab.icon !== ICONS[tab.id]) {
            tab.icon = ICONS[tab.id];
            changed = true;
        }
    });

    if (changed) {
        window.tabBar.create();
    }
})();
