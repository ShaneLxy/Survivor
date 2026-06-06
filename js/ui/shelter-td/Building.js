// Building.js v2 - 建筑 + 4 层视差城市背景 + 大气层
(function() {
    window.ShelterTD = window.ShelterTD || {};
    const { AssetLoader } = window.ShelterTD;

    class Building {
        constructor() {
            this.x = 240;
            this.y = 200;
            this.level = 1;
            this.hitTimer = 0;
        }
        setLevel(level) {
            this.level = Math.max(1, Math.min(10, level));
        }
        hit(strength = 1) {
            this.hitTimer = Math.max(this.hitTimer, 0.12 + Math.max(0, strength) * 0.04);
        }
        update(dt) {
            if (this.hitTimer > 0) {
                this.hitTimer = Math.max(0, this.hitTimer - dt);
            }
        }
        get tier() {
            if (this.level >= 8) return 3;
            if (this.level >= 4) return 2;
            return 1;
        }
        render(ctx) {
            const renderFn = this.hitTimer > 0 ? AssetLoader.drawSpriteFlash : AssetLoader.drawSprite;
            renderFn(ctx, `building_t${this.tier}`, this.x, this.y);
            // 等级附加件
            this._renderExtras(ctx);
        }
        _renderExtras(ctx, time) {
            // 等级 2/6/9 加额外的霓虹灯条/招牌
            const t = (window.performance.now() / 1000);
            if (this.level >= 6) {
                // 顶部红色航空警示灯闪烁
                const blink = Math.sin(t * 4) > 0;
                if (blink) {
                    ctx.fillStyle = '#ff4040';
                    ctx.fillRect(this.x - 1, this.y - 96, 2, 2);
                    ctx.fillStyle = 'rgba(255, 64, 64, 0.4)';
                    ctx.fillRect(this.x - 3, this.y - 98, 6, 6);
                }
            }
            if (this.level >= 8) {
                // 门两侧地面探照灯光锥(扫描)
                const sweep = Math.sin(t * 0.8) * 12;
                ctx.fillStyle = 'rgba(77, 227, 255, 0.08)';
                ctx.beginPath();
                ctx.moveTo(this.x - 12 + sweep, this.y - 30);
                ctx.lineTo(this.x - 30 + sweep, this.y);
                ctx.lineTo(this.x - 4 + sweep, this.y);
                ctx.closePath();
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(this.x + 12 - sweep, this.y - 30);
                ctx.lineTo(this.x + 4 - sweep, this.y);
                ctx.lineTo(this.x + 30 - sweep, this.y);
                ctx.closePath();
                ctx.fill();
            }
        }
    }

    // 多层视差城市背景
    class CityBackground {
        constructor(width, height) {
            this.W = width;
            this.H = height;
            this.layers = [];
            this._bakeAll();
            this._neonFlickerSeed = Math.random() * 1000;
            this._fogOffset = 0;
        }

        _makeLayer(w, h) {
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            const cx = c.getContext('2d');
            cx.imageSmoothingEnabled = false;
            return { canvas: c, ctx: cx };
        }

        _bakeAll() {
            // 静态层
            this.skyLayer = this._bakeSky();
            this.farLayer = this._bakeFarCity();
            this.midLayer = this._bakeMidCity();
            this.nearLayer = this._bakeNearCity();
            this.groundLayer = this._bakeGround();
            // 霓虹窗动态层(若干随机窗,运行时按节奏闪)
            this.neonWindows = this._collectNeonWindows();
            // 雾叠加(向右缓慢漂移用的图块)
            this.fogTile = this._bakeFogTile();
            // 暗角
            this.vignette = this._bakeVignette();
        }

        _bakeSky() {
            const W = this.W, H = this.H;
            const layer = this._makeLayer(W, H);
            const ctx = layer.ctx;
            // 渐变:深紫 → 暗橙(末日黄昏)
            const g = ctx.createLinearGradient(0, 0, 0, H);
            g.addColorStop(0, '#0a0612');
            g.addColorStop(0.4, '#1a1024');
            g.addColorStop(0.7, '#2e1828');
            g.addColorStop(0.95, '#3a201a');
            g.addColorStop(1, '#1a1006');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, W, H);

            // 远处灰云(几层水平条)
            for (let i = 0; i < 6; i++) {
                const y = 20 + i * 18 + (i % 2) * 4;
                const alpha = 0.04 + Math.random() * 0.05;
                ctx.fillStyle = `rgba(120, 80, 60, ${alpha})`;
                ctx.fillRect(0, y, W, 6 + Math.floor(Math.random() * 6));
            }

            // 月亮(破碎)
            const mx = W - 60, my = 38;
            ctx.fillStyle = '#5a4060';
            ctx.fillRect(mx - 8, my - 8, 16, 16);
            ctx.fillStyle = '#8a6080';
            ctx.fillRect(mx - 7, my - 7, 14, 14);
            ctx.fillStyle = '#b890b0';
            ctx.fillRect(mx - 6, my - 7, 12, 12);
            // 月坑
            ctx.fillStyle = '#5a4060';
            ctx.fillRect(mx - 3, my - 3, 2, 2);
            ctx.fillRect(mx + 1, my, 2, 2);
            ctx.fillRect(mx - 2, my + 2, 1, 1);
            // 月光辉
            ctx.fillStyle = 'rgba(184, 144, 176, 0.08)';
            ctx.fillRect(mx - 14, my - 14, 28, 28);

            // 星星
            ctx.fillStyle = '#7a5870';
            for (let i = 0; i < 35; i++) {
                const x = (i * 41 + 7) % W;
                const y = (i * 17 + 3) % Math.floor(H * 0.35);
                ctx.fillRect(x, y, 1, 1);
            }
            // 几颗亮星
            ctx.fillStyle = '#e0c8e0';
            ctx.fillRect(20, 12, 1, 1);
            ctx.fillRect(80, 28, 1, 1);
            ctx.fillRect(200, 8, 1, 1);
            ctx.fillRect(380, 22, 1, 1);

            return layer;
        }

        _bakeFarCity() {
            const W = this.W, H = this.H;
            const layer = this._makeLayer(W, H);
            const ctx = layer.ctx;
            const baseY = H * 0.62;
            // 最远层 - 几乎纯黑剪影
            ctx.fillStyle = '#080510';
            this._cityRow(ctx, baseY, 10, 26, 0.55, 0.4);
            // 远窗(极少)
            const colors = ['#ff3e8a', '#4de3ff', '#ffd24a'];
            for (let i = 0; i < 8; i++) {
                ctx.fillStyle = colors[i % 3];
                const x = (i * 53) % W;
                ctx.fillRect(x, baseY - 6 - (i % 4) * 4, 1, 1);
            }
            return layer;
        }

        _bakeMidCity() {
            const W = this.W, H = this.H;
            const layer = this._makeLayer(W, H);
            const ctx = layer.ctx;
            const baseY = H * 0.72;

            // 中景城市
            ctx.fillStyle = '#120a1c';
            this._cityRow(ctx, baseY, 18, 44, 0.72, 0.5);

            // 高光左侧(月光照射)
            ctx.fillStyle = '#1c1428';
            this._cityRowLeftLit(ctx, baseY, 0.5);

            // 大型霓虹广告牌:HOPE IS A LUXURY
            this._neonBillboard(ctx, W - 80, baseY - 36, 64, 28, ['HOPE', 'IS A', 'LUXURY'], '#ff3e8a');

            // 中型招牌
            this._neonBillboard(ctx, 30, baseY - 24, 38, 14, ['NO HOPE'], '#4de3ff');

            // 中等霓虹窗(密)
            const neonColors = ['#ff3e8a', '#4de3ff', '#ffd24a', '#a868ff', '#3eff7a'];
            for (let i = 0; i < 80; i++) {
                ctx.fillStyle = neonColors[i % 5];
                const x = (i * 19 + 5) % W;
                const y = baseY - 4 - ((i * 7) % 22);
                ctx.fillRect(x, y, 1, 1);
            }
            // 加几个 2x1 的窗
            for (let i = 0; i < 15; i++) {
                ctx.fillStyle = neonColors[(i + 1) % 5];
                const x = (i * 31 + 10) % (W - 3);
                const y = baseY - 8 - ((i * 11) % 18);
                ctx.fillRect(x, y, 2, 1);
            }

            // 红色屋顶警示灯
            for (let i = 0; i < 5; i++) {
                const x = (i * 73 + 20) % W;
                ctx.fillStyle = '#ff4040';
                ctx.fillRect(x, baseY - 28 - (i % 3) * 6, 1, 1);
            }

            return layer;
        }

        _bakeNearCity() {
            const W = this.W, H = this.H;
            const layer = this._makeLayer(W, H);
            const ctx = layer.ctx;
            const baseY = H * 0.82;

            ctx.fillStyle = '#1a1024';
            this._cityRow(ctx, baseY, 22, 56, 0.8, 0.6);

            // 高光右侧
            ctx.fillStyle = '#241a30';
            this._cityRowRightLit(ctx, baseY, 0.6);

            // 烟囱(冒烟基座)
            const chimneys = [70, 200, 360, 440];
            for (const cx of chimneys) {
                ctx.fillStyle = '#2a1a30';
                ctx.fillRect(cx - 2, baseY - 50, 4, 50);
                ctx.fillStyle = '#3a2840';
                ctx.fillRect(cx - 2, baseY - 50, 1, 50);
                // 烟囱顶
                ctx.fillStyle = '#4a3050';
                ctx.fillRect(cx - 3, baseY - 52, 6, 2);
                // 红警示灯
                ctx.fillStyle = '#ff4040';
                ctx.fillRect(cx, baseY - 53, 1, 1);
            }

            // 大量近景窗(暖黄+霓虹混合)
            const colors = ['#ffd24a', '#ff8830', '#4de3ff', '#ff3e8a', '#a868ff'];
            for (let i = 0; i < 120; i++) {
                ctx.fillStyle = colors[i % 5];
                const x = (i * 13 + 3) % W;
                const y = baseY - 4 - ((i * 5) % 36);
                ctx.fillRect(x, y, 1, 1);
            }
            for (let i = 0; i < 25; i++) {
                ctx.fillStyle = colors[(i + 2) % 5];
                const x = (i * 23 + 12) % (W - 3);
                const y = baseY - 6 - ((i * 9) % 32);
                ctx.fillRect(x, y, 2, 1);
            }

            return layer;
        }

        _bakeGround() {
            const W = this.W, H = this.H;
            const layer = this._makeLayer(W, H);
            const ctx = layer.ctx;
            const groundY = H * 0.85;
            // 地面
            ctx.fillStyle = '#2a221c';
            ctx.fillRect(0, groundY, W, H - groundY);
            // 暗带
            ctx.fillStyle = '#1a1410';
            ctx.fillRect(0, groundY, W, 1);
            ctx.fillRect(0, H - 4, W, 4);
            // 高光
            ctx.fillStyle = '#3a322a';
            ctx.fillRect(0, groundY + 1, W, 1);

            // 砖纹
            ctx.fillStyle = '#1a1410';
            for (let x = 0; x < W; x += 14) {
                ctx.fillRect(x, groundY + 4, 1, 1);
                ctx.fillRect(x + 7, groundY + 10, 1, 1);
                ctx.fillRect(x + 3, groundY + 16, 1, 1);
            }
            // 裂缝
            ctx.fillStyle = '#0a0608';
            ctx.fillRect(60, groundY + 6, 30, 1);
            ctx.fillRect(280, groundY + 12, 24, 1);
            ctx.fillRect(180, groundY + 20, 18, 1);

            // 围栏(铁丝网)- 在近景城市和地面交界处
            const fenceY = H * 0.84 - 2;
            ctx.fillStyle = '#0a0608';
            for (let x = 0; x < W; x += 5) {
                ctx.fillRect(x, fenceY - 6, 1, 6);
            }
            ctx.fillRect(0, fenceY, W, 1);
            ctx.fillRect(0, fenceY - 6, W, 1);
            // 围栏柱(每 40px 一根)
            for (let x = 0; x < W; x += 40) {
                ctx.fillStyle = '#1a1410';
                ctx.fillRect(x, fenceY - 10, 2, 10);
            }
            // 网格交叉点
            ctx.fillStyle = '#3a2830';
            for (let x = 0; x < W; x += 5) {
                for (let y = fenceY - 5; y < fenceY; y += 2) {
                    ctx.fillRect(x + 2, y, 1, 1);
                }
            }

            return layer;
        }

        _bakeFogTile() {
            // 一个 64x80 的雾平铺图,带柔和颗粒
            const layer = this._makeLayer(64, 80);
            const ctx = layer.ctx;
            for (let i = 0; i < 60; i++) {
                const x = Math.floor(Math.random() * 64);
                const y = Math.floor(Math.random() * 80);
                const alpha = 0.02 + Math.random() * 0.04;
                ctx.fillStyle = `rgba(180, 160, 200, ${alpha})`;
                const s = 2 + Math.floor(Math.random() * 4);
                ctx.fillRect(x, y, s, s);
            }
            return layer;
        }

        _bakeVignette() {
            const W = this.W, H = this.H;
            const layer = this._makeLayer(W, H);
            const ctx = layer.ctx;
            // 径向暗角
            const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
            g.addColorStop(0, 'rgba(0,0,0,0)');
            g.addColorStop(0.6, 'rgba(0,0,0,0.15)');
            g.addColorStop(1, 'rgba(0,0,0,0.55)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, W, H);
            return layer;
        }

        _cityRow(ctx, baseY, minH, maxH, density, jitter) {
            let x = -4;
            let seed = 1;
            const rand = () => {
                seed = (seed * 9301 + 49297) % 233280;
                return seed / 233280;
            };
            while (x < this.W + 4) {
                const w = 6 + Math.floor(rand() * 16);
                const h = minH + Math.floor(rand() * (maxH - minH));
                if (rand() < density) {
                    ctx.fillRect(x, baseY - h, w, h);
                    // 顶部装饰
                    const r = rand();
                    if (r < 0.2) {
                        // 尖顶
                        ctx.fillRect(x + Math.floor(w / 2), baseY - h - 4, 1, 4);
                    } else if (r < 0.35) {
                        // 双塔
                        ctx.fillRect(x + 1, baseY - h - 2, 2, 2);
                        ctx.fillRect(x + w - 3, baseY - h - 2, 2, 2);
                    } else if (r < 0.45) {
                        // 平台
                        ctx.fillRect(x - 1, baseY - h - 1, w + 2, 1);
                    }
                }
                x += w + Math.floor(rand() * 3);
            }
        }

        _cityRowLeftLit(ctx, baseY, density) {
            // 给中景城市左边描一道月光高光(竖条)
            let x = -4;
            let seed = 37;
            const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
            while (x < this.W) {
                const w = 6 + Math.floor(rand() * 16);
                const h = 18 + Math.floor(rand() * 26);
                if (rand() < density) {
                    ctx.fillRect(x, baseY - h, 1, h);
                }
                x += w + 1;
            }
        }

        _cityRowRightLit(ctx, baseY, density) {
            let x = -4;
            let seed = 91;
            const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
            while (x < this.W) {
                const w = 8 + Math.floor(rand() * 18);
                const h = 22 + Math.floor(rand() * 34);
                if (rand() < density) {
                    ctx.fillRect(x + w - 1, baseY - h, 1, h);
                }
                x += w + 1;
            }
        }

        _neonBillboard(ctx, x, y, w, h, lines, color) {
            // 边框
            ctx.fillStyle = '#1a1410';
            ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
            ctx.fillStyle = '#2a1820';
            ctx.fillRect(x, y, w, h);
            // 内边发光
            ctx.fillStyle = color;
            ctx.fillRect(x, y, w, 1);
            ctx.fillRect(x, y + h - 1, w, 1);
            // 文字
            ctx.font = 'bold 7px monospace';
            ctx.textBaseline = 'top';
            ctx.fillStyle = color;
            const lineH = Math.floor((h - 4) / lines.length);
            for (let i = 0; i < lines.length; i++) {
                ctx.fillText(lines[i], x + 3, y + 2 + i * lineH);
            }
            // 支架
            ctx.fillStyle = '#1a1410';
            ctx.fillRect(x + 4, y + h, 2, 6);
            ctx.fillRect(x + w - 6, y + h, 2, 6);
        }

        _collectNeonWindows() {
            // 在中近景城市选 12 个位置做闪烁
            const list = [];
            for (let i = 0; i < 12; i++) {
                list.push({
                    x: 20 + Math.floor((i * 41) % (this.W - 40)),
                    y: Math.floor(this.H * 0.6 + (i % 5) * 10),
                    color: ['#ff3e8a', '#4de3ff', '#ffd24a'][i % 3],
                    period: 0.4 + Math.random() * 1.6,
                    phase: Math.random() * Math.PI * 2,
                    w: 1 + (i % 3 === 0 ? 1 : 0)
                });
            }
            return list;
        }

        update(dt) {
            this._fogOffset = (this._fogOffset + dt * 8) % 64;
        }

        renderBack(ctx) {
            // 顺序:天 → 远城 → 雾 → 中城 → 近城 → 地面
            ctx.drawImage(this.skyLayer.canvas, 0, 0);
            ctx.drawImage(this.farLayer.canvas, 0, 0);

            // 远雾(在远城上盖一层)
            ctx.globalAlpha = 0.4;
            this._renderFog(ctx, this._fogOffset, this.H * 0.5);
            ctx.globalAlpha = 1;

            ctx.drawImage(this.midLayer.canvas, 0, 0);

            // 闪烁霓虹窗(中近景顶层)
            this._renderNeonFlicker(ctx);

            // 中雾
            ctx.globalAlpha = 0.5;
            this._renderFog(ctx, -this._fogOffset * 0.6, this.H * 0.65);
            ctx.globalAlpha = 1;

            ctx.drawImage(this.nearLayer.canvas, 0, 0);
            ctx.drawImage(this.groundLayer.canvas, 0, 0);
        }

        renderFront(ctx) {
            // 顶层:近景雾 + 暗角 + 扫描线
            ctx.globalAlpha = 0.35;
            this._renderFog(ctx, this._fogOffset * 1.4, this.H * 0.78);
            ctx.globalAlpha = 1;

            // 扫描线(CRT 风格)
            ctx.fillStyle = 'rgba(0,0,0,0.08)';
            for (let y = 0; y < this.H; y += 2) {
                ctx.fillRect(0, y, this.W, 1);
            }

            // 暗角
            ctx.drawImage(this.vignette.canvas, 0, 0);
        }

        _renderFog(ctx, offset, baseY) {
            const tile = this.fogTile.canvas;
            const tw = tile.width, th = tile.height;
            const ox = -Math.floor(offset);
            for (let x = ox; x < this.W; x += tw) {
                ctx.drawImage(tile, x, baseY);
            }
        }

        _renderNeonFlicker(ctx) {
            const t = window.performance.now() / 1000;
            for (const n of this.neonWindows) {
                const v = Math.sin(t / n.period + n.phase);
                if (v > -0.2) {
                    ctx.fillStyle = n.color;
                    ctx.fillRect(n.x, n.y, n.w, 1);
                }
            }
        }
    }

    window.ShelterTD.Building = Building;
    window.ShelterTD.CityBackground = CityBackground;
})();
