/**
 * 建筑 SVG Logo 工具
 * 统一赛博朋克末日风格：青/金双色线条 + 切角几何 + 发光描边
 *
 * 用法：BuildingIcon.render('building_farm', { size: 64, variant: 'default' })
 *   variant: default | collectable | maxed | locked
 */
(function () {
    const VIEWBOX = 64;
    const STROKE = '#7accd6';
    const ACCENT = '#f6c96b';
    const BG = 'rgba(8, 14, 22, 0.62)';

    function wrap(inner, { size = 64, variant = 'default', className = '' } = {}) {
        const variantClass = `building-svg-icon variant-${variant} ${className}`.trim();
        return `
            <svg class="${variantClass}" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}" width="${size}" height="${size}"
                xmlns="http://www.w3.org/2000/svg" fill="none" stroke-linecap="square" stroke-linejoin="miter">
                <defs>
                    <linearGradient id="bsg-glow" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stop-color="${STROKE}" stop-opacity="0.95"/>
                        <stop offset="1" stop-color="${ACCENT}" stop-opacity="0.95"/>
                    </linearGradient>
                </defs>
                <polygon points="6,2 58,2 62,6 62,58 58,62 6,62 2,58 2,6"
                    fill="${BG}" stroke="${STROKE}" stroke-width="1.2" stroke-opacity="0.45"/>
                ${inner}
                <line x1="14" y1="56" x2="50" y2="56" stroke="${ACCENT}" stroke-width="0.8" stroke-opacity="0.55"/>
                <line x1="6" y1="10" x2="12" y2="10" stroke="${STROKE}" stroke-width="0.8" stroke-opacity="0.7"/>
                <line x1="52" y1="10" x2="58" y2="10" stroke="${STROKE}" stroke-width="0.8" stroke-opacity="0.7"/>
            </svg>
        `.trim();
    }

    // 避难所：六边形外壳 + 屋顶 + 天线
    function iconShelter() {
        return `
            <polygon points="32,12 48,20 48,44 32,52 16,44 16,20"
                stroke="${STROKE}" stroke-width="1.8" />
            <path d="M22 34 L32 24 L42 34 L42 44 L22 44 Z"
                stroke="${ACCENT}" stroke-width="1.8" />
            <rect x="29" y="38" width="6" height="6" stroke="${STROKE}" stroke-width="1.2" />
            <line x1="32" y1="24" x2="32" y2="14" stroke="${ACCENT}" stroke-width="1.5"/>
            <circle cx="32" cy="13" r="1.6" fill="${ACCENT}" stroke="none"/>
        `;
    }

    // 农场：三根麦穗 + 地表 + 阳光
    function iconFarm() {
        return `
            <path d="M32 18 L32 46 M28 24 Q32 26 36 24 M27 30 Q32 32 37 30 M26 36 Q32 38 38 36"
                stroke="${ACCENT}" stroke-width="1.8" />
            <path d="M22 22 L22 46 M19 28 Q22 30 25 28 M18 34 Q22 36 26 34"
                stroke="${STROKE}" stroke-width="1.5" />
            <path d="M42 22 L42 46 M39 28 Q42 30 45 28 M38 34 Q42 36 46 34"
                stroke="${STROKE}" stroke-width="1.5" />
            <line x1="14" y1="48" x2="50" y2="48" stroke="${ACCENT}" stroke-width="1.6"/>
            <circle cx="14" cy="16" r="2" fill="${ACCENT}" stroke="none"/>
            <line x1="10" y1="16" x2="8" y2="16" stroke="${ACCENT}" stroke-width="1"/>
            <line x1="14" y1="12" x2="14" y2="10" stroke="${ACCENT}" stroke-width="1"/>
            <line x1="11" y1="13" x2="9" y2="11" stroke="${ACCENT}" stroke-width="1"/>
        `;
    }

    // 林矿：左侧树（三角）+ 右侧矿石（菱形）+ 地基
    function iconMine() {
        return `
            <polygon points="20,18 12,32 28,32" stroke="${STROKE}" stroke-width="1.6" />
            <polygon points="20,28 14,38 26,38" stroke="${STROKE}" stroke-width="1.6" />
            <line x1="20" y1="38" x2="20" y2="46" stroke="${STROKE}" stroke-width="1.6"/>
            <polygon points="44,20 52,26 50,38 38,38 36,26"
                stroke="${ACCENT}" stroke-width="1.8" />
            <line x1="44" y1="20" x2="50" y2="38" stroke="${ACCENT}" stroke-width="1" stroke-opacity="0.7"/>
            <line x1="36" y1="26" x2="50" y2="38" stroke="${ACCENT}" stroke-width="1" stroke-opacity="0.7"/>
            <line x1="44" y1="20" x2="38" y2="38" stroke="${ACCENT}" stroke-width="1" stroke-opacity="0.7"/>
            <line x1="10" y1="48" x2="54" y2="48" stroke="${ACCENT}" stroke-width="1.4"/>
        `;
    }

    // 水井：中心水滴 + 扩散弧线 + 提取箭头
    function iconWell() {
        return `
            <path d="M32 22 Q26 32 32 40 Q38 32 32 22 Z"
                fill="${STROKE}" fill-opacity="0.18" stroke="${STROKE}" stroke-width="1.8" />
            <circle cx="32" cy="34" r="2.2" fill="${ACCENT}" stroke="none"/>
            <path d="M18 36 Q32 50 46 36" stroke="${STROKE}" stroke-width="1.4" stroke-opacity="0.65"/>
            <path d="M14 40 Q32 56 50 40" stroke="${STROKE}" stroke-width="1.1" stroke-opacity="0.42"/>
            <line x1="32" y1="18" x2="32" y2="10" stroke="${ACCENT}" stroke-width="1.6"/>
            <polyline points="29,13 32,10 35,13" stroke="${ACCENT}" stroke-width="1.6" stroke-linejoin="miter"/>
        `;
    }

    // 训练场：靶心十字 + 切角场地 + 哑铃
    function iconTraining() {
        return `
            <polygon points="14,14 50,14 54,18 54,40 50,44 14,44 10,40 10,18"
                stroke="${STROKE}" stroke-width="1.4" stroke-opacity="0.7"/>
            <circle cx="32" cy="29" r="9" stroke="${STROKE}" stroke-width="1.6"/>
            <circle cx="32" cy="29" r="4.5" stroke="${ACCENT}" stroke-width="1.4"/>
            <circle cx="32" cy="29" r="1.4" fill="${ACCENT}" stroke="none"/>
            <line x1="32" y1="16" x2="32" y2="22" stroke="${ACCENT}" stroke-width="1.4"/>
            <line x1="32" y1="36" x2="32" y2="42" stroke="${ACCENT}" stroke-width="1.4"/>
            <line x1="19" y1="29" x2="25" y2="29" stroke="${ACCENT}" stroke-width="1.4"/>
            <line x1="39" y1="29" x2="45" y2="29" stroke="${ACCENT}" stroke-width="1.4"/>
            <rect x="16" y="49" width="3" height="6" stroke="${STROKE}" stroke-width="1.2"/>
            <rect x="45" y="49" width="3" height="6" stroke="${STROKE}" stroke-width="1.2"/>
            <line x1="19" y1="52" x2="45" y2="52" stroke="${STROKE}" stroke-width="1.6"/>
        `;
    }

    // 武器库：切角外框 + 青色护盾 + 金色长剑 + 底部储物架
    function iconArmory() {
        return `
            <polygon points="14,14 50,14 54,18 54,40 50,44 14,44 10,40 10,18"
                stroke="${STROKE}" stroke-width="1.4" stroke-opacity="0.7"/>
            <path d="M32 17 L44 21 L44 30 Q44 38 32 44 Q20 38 20 30 L20 21 Z"
                stroke="${STROKE}" stroke-width="1.8" />
            <line x1="32" y1="22" x2="32" y2="40" stroke="${ACCENT}" stroke-width="1.8"/>
            <line x1="27" y1="27" x2="37" y2="27" stroke="${ACCENT}" stroke-width="1.6"/>
            <polyline points="30,40 32,42 34,40" stroke="${ACCENT}" stroke-width="1.4" stroke-linejoin="miter"/>
            <circle cx="32" cy="21" r="1.4" fill="${ACCENT}" stroke="none"/>
            <rect x="16" y="49" width="32" height="6" stroke="${STROKE}" stroke-width="1.2"/>
            <line x1="24" y1="49" x2="24" y2="55" stroke="${STROKE}" stroke-width="1"/>
            <line x1="32" y1="49" x2="32" y2="55" stroke="${STROKE}" stroke-width="1"/>
            <line x1="40" y1="49" x2="40" y2="55" stroke="${STROKE}" stroke-width="1"/>
        `;
    }

    // 一键收取：盒子 + 向下箭头 + 资源点
    function iconCollect() {
        return `
            <polygon points="14,28 50,28 54,32 54,50 10,50 10,32"
                stroke="${ACCENT}" stroke-width="1.6"/>
            <line x1="14" y1="36" x2="50" y2="36" stroke="${ACCENT}" stroke-width="1.2" stroke-opacity="0.7"/>
            <line x1="32" y1="10" x2="32" y2="24" stroke="${STROKE}" stroke-width="1.8"/>
            <polyline points="26,18 32,24 38,18" stroke="${STROKE}" stroke-width="1.8" stroke-linejoin="miter"/>
            <circle cx="22" cy="14" r="1.6" fill="${STROKE}" stroke="none"/>
            <circle cx="42" cy="14" r="1.6" fill="${STROKE}" stroke="none"/>
            <line x1="20" y1="44" x2="24" y2="44" stroke="${STROKE}" stroke-width="1.4"/>
            <line x1="30" y1="44" x2="34" y2="44" stroke="${STROKE}" stroke-width="1.4"/>
            <line x1="40" y1="44" x2="44" y2="44" stroke="${STROKE}" stroke-width="1.4"/>
        `;
    }

    const ICONS = {
        building_shelter: iconShelter,
        building_farm: iconFarm,
        building_mine: iconMine,
        building_well: iconWell,
        building_armory: iconArmory,
        building_training_ground: iconTraining,
        collect_all: iconCollect
    };

    const EMOJI_FALLBACK = {
        building_shelter: '🏠',
        building_farm: '🌾',
        building_mine: '⛏️',
        building_well: '💧',
        building_armory: '🛠️',
        building_training_ground: '🏋️',
        collect_all: '📦'
    };

    function render(buildingId, options = {}) {
        const fn = ICONS[buildingId];
        if (!fn) {
            return `<span class="building-icon-emoji">${EMOJI_FALLBACK[buildingId] || '✨'}</span>`;
        }
        try {
            return wrap(fn(), options);
        } catch (e) {
            return `<span class="building-icon-emoji">${EMOJI_FALLBACK[buildingId] || '✨'}</span>`;
        }
    }

    function has(buildingId) {
        return Boolean(ICONS[buildingId]);
    }

    window.BuildingIcon = { render, has };
})();
