// AssetLoader v2 - 精修像素美术
// 烘焙到 512x512 atlas;sprite 接口保持兼容
(function() {
    window.ShelterTD = window.ShelterTD || {};

    function px(ctx, x, y, c) { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); }
    function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
    function rectStroke(ctx, x, y, w, h, c) {
        rect(ctx, x, y, w, 1, c); rect(ctx, x, y + h - 1, w, 1, c);
        rect(ctx, x, y, 1, h, c); rect(ctx, x + w - 1, y, 1, h, c);
    }
    function dither(ctx, x, y, w, h, c1, c2) {
        for (let yy = 0; yy < h; yy++) {
            for (let xx = 0; xx < w; xx++) {
                ctx.fillStyle = (xx + yy) % 2 === 0 ? c1 : c2;
                ctx.fillRect(x + xx, y + yy, 1, 1);
            }
        }
    }

    const PALETTE = {
        // 墙体三阶段
        wall1Dark: '#2a2520', wall1Mid: '#3a342c', wall1Hi: '#544a3e', wall1Edge: '#1a1410',
        wall2Dark: '#3a3a44', wall2Mid: '#4e4e5c', wall2Hi: '#6e6e80', wall2Edge: '#1a1820',
        wall3Dark: '#2a3848', wall3Mid: '#3a4c64', wall3Hi: '#5a7a9a', wall3Edge: '#0e1620',
        wall3Glow: '#4de3ff',
        // 通用
        rust: '#7a3a20', rustHi: '#a85030', rustDk: '#3a1810',
        pipe: '#5a4a3a', pipeHi: '#7a6a4a', pipeDk: '#3a2a20',
        metal: '#86796e', metalHi: '#b8a890', metalDk: '#3a3530',
        doorYel: '#d4a64a', doorYelHi: '#f4d680', doorDk: '#5a3a18',
        ledRed: '#ff4040', ledRedHi: '#ffa0a0',
        ledGreen: '#3eff7a', ledGreenHi: '#a0ffc0',
        ledCyan: '#4de3ff', ledCyanHi: '#a0f0ff',
        neonPink: '#ff3e8a', neonPinkHi: '#ffa0c8',
        neonYel: '#ffd24a',
        // 丧尸
        zSkin: '#7a8a5a', zSkinHi: '#9aab78', zSkinDk: '#4a5a3a',
        zSkinH: '#a0a868', // 重甲变种
        zSkinHHi: '#c0c878',
        zSkinR: '#6a4860', // 跑尸偏紫
        zBlood: '#a82020', zBloodDk: '#581010',
        zShirt: '#5a4030', zShirtHi: '#7a6048',
        zEye: '#ff3030', zEyeHi: '#ffa0a0',
        // 资源
        coin: '#ffd24a', coinHi: '#fff0a0', coinDk: '#a07820',
        wood: '#a06030', woodHi: '#c88040', woodDk: '#603018',
        rare: '#a868ff', rareHi: '#e0b0ff', rareDk: '#5028a0',
        // 弹道
        muzzle: '#ffe070', muzzleHot: '#ffffff',
        // 火电
        fire1: '#fff0a0', fire2: '#ffd040', fire3: '#ff7020', fire4: '#a02020',
        elec: '#a0f0ff', elecHot: '#ffffff',
        // 地面与背景
        ground: '#2a221c', groundHi: '#3a322a', groundDk: '#1a1410',
    };

    const atlas = { canvas: null, ctx: null, sprites: {} };
    function reg(name, x, y, w, h, ax = 0.5, ay = 1.0) {
        atlas.sprites[name] = { x, y, w, h, ax, ay };
    }

    // ============ 建筑 - 三个 tier ============
    function drawBuilding(ctx, ox, oy, tier) {
        // 画布单元 140 x 110
        const W = 140, H = 110;
        // 选色
        const dark = tier === 1 ? PALETTE.wall1Dark : (tier === 2 ? PALETTE.wall2Dark : PALETTE.wall3Dark);
        const mid = tier === 1 ? PALETTE.wall1Mid : (tier === 2 ? PALETTE.wall2Mid : PALETTE.wall3Mid);
        const hi = tier === 1 ? PALETTE.wall1Hi : (tier === 2 ? PALETTE.wall2Hi : PALETTE.wall3Hi);
        const edge = tier === 1 ? PALETTE.wall1Edge : (tier === 2 ? PALETTE.wall2Edge : PALETTE.wall3Edge);

        // 主体范围(中央矩形)
        const bx = ox + 18, by = oy + 30, bw = W - 36, bh = H - 36;

        // 阴影
        rect(ctx, ox + 14, oy + H - 6, W - 28, 4, '#000000');
        rect(ctx, ox + 16, oy + H - 4, W - 32, 2, edge);

        // 主墙
        rect(ctx, bx, by, bw, bh, mid);
        // 上高光条
        rect(ctx, bx, by, bw, 2, hi);
        rect(ctx, bx, by + 2, bw, 1, mid);
        // 下暗带
        rect(ctx, bx, by + bh - 4, bw, 2, dark);
        rect(ctx, bx, by + bh - 2, bw, 2, edge);
        // 左右边
        rect(ctx, bx, by, 2, bh, hi);
        rect(ctx, bx + bw - 2, by, 2, bh, dark);
        rect(ctx, bx - 1, by, 1, bh, edge);
        rect(ctx, bx + bw, by, 1, bh, edge);

        // 板块分割线(纵向)
        for (let i = 1; i < 4; i++) {
            const lx = bx + Math.floor(bw * i / 4);
            rect(ctx, lx, by + 4, 1, bh - 8, edge);
            rect(ctx, lx + 1, by + 4, 1, bh - 8, hi);
        }
        // 板块分割线(横向中段)
        rect(ctx, bx + 2, by + Math.floor(bh / 2), bw - 4, 1, edge);
        rect(ctx, bx + 2, by + Math.floor(bh / 2) + 1, bw - 4, 1, hi);

        // 螺栓(顶/底两排)
        for (let i = 0; i < 6; i++) {
            const x = bx + 6 + i * Math.floor((bw - 12) / 5);
            // 顶
            px(ctx, x, by + 6, edge); px(ctx, x + 1, by + 6, hi);
            // 底
            px(ctx, x, by + bh - 8, edge); px(ctx, x + 1, by + bh - 8, hi);
        }

        // 锈迹(t1 多, t3 少)
        const rustCount = tier === 1 ? 8 : (tier === 2 ? 4 : 2);
        for (let i = 0; i < rustCount; i++) {
            const rx = bx + 4 + (i * 17) % (bw - 8);
            const ry = by + 8 + ((i * 11) % (bh - 16));
            rect(ctx, rx, ry, 2, 1, PALETTE.rust);
            px(ctx, rx + 2, ry + 1, PALETTE.rustDk);
        }

        // 弹孔/破损
        if (tier === 1) {
            px(ctx, bx + 20, by + 18, edge); px(ctx, bx + 21, by + 18, PALETTE.rustDk);
            px(ctx, bx + 60, by + 36, edge); px(ctx, bx + 61, by + 36, PALETTE.rustDk);
        }

        // 中央门(嵌入凹槽)
        const dw = 22, dh = 28;
        const dx = ox + W / 2 - dw / 2;
        const dy = oy + H - dh - 6;
        // 凹槽
        rect(ctx, dx - 2, dy - 2, dw + 4, dh + 2, edge);
        rect(ctx, dx - 1, dy - 1, dw + 2, dh + 1, dark);
        // 门主体
        rect(ctx, dx, dy, dw, dh, PALETTE.doorDk);
        rect(ctx, dx + 1, dy + 1, dw - 2, dh - 2, PALETTE.doorYel);
        // 危险斜纹
        for (let i = 0; i < 4; i++) {
            rect(ctx, dx + 2, dy + 3 + i * 6, dw - 4, 2, PALETTE.doorDk);
        }
        // 门高光
        rect(ctx, dx + 1, dy + 1, dw - 2, 1, PALETTE.doorYelHi);
        // 门把手
        px(ctx, dx + dw - 4, dy + Math.floor(dh / 2), edge);
        px(ctx, dx + dw - 3, dy + Math.floor(dh / 2), PALETTE.metalHi);

        // 门两侧红绿灯
        rect(ctx, dx - 4, dy + 6, 2, 3, PALETTE.ledRed);
        px(ctx, dx - 3, dy + 6, PALETTE.ledRedHi);
        rect(ctx, dx + dw + 2, dy + 6, 2, 3, tier >= 2 ? PALETTE.ledGreen : PALETTE.ledRed);
        px(ctx, dx + dw + 2, dy + 6, tier >= 2 ? PALETTE.ledGreenHi : PALETTE.ledRedHi);

        // 编号牌 "08"
        const sgnX = bx + 4, sgnY = by + 6;
        rect(ctx, sgnX, sgnY, 18, 12, edge);
        rect(ctx, sgnX + 1, sgnY + 1, 16, 10, dark);
        ctx.fillStyle = hi;
        ctx.font = 'bold 9px monospace';
        ctx.textBaseline = 'top';
        ctx.fillText('08', sgnX + 3, sgnY + 2);

        // SHELTER-08 横额(t2+ 显示)
        if (tier >= 2) {
            const tx = bx + Math.floor(bw / 2) - 22, ty = dy - 8;
            rect(ctx, tx, ty, 44, 6, edge);
            rect(ctx, tx + 1, ty + 1, 42, 4, dark);
            ctx.fillStyle = PALETTE.ledCyan;
            ctx.font = 'bold 5px monospace';
            ctx.textBaseline = 'top';
            ctx.fillText('SHELTER-08', tx + 3, ty + 1);
        }

        // 通风管道(t1 简,t2 加,t3 复杂)
        // 左侧竖管
        rect(ctx, bx - 4, by + 6, 3, bh - 14, PALETTE.pipe);
        rect(ctx, bx - 4, by + 6, 1, bh - 14, PALETTE.pipeHi);
        rect(ctx, bx - 2, by + 6, 1, bh - 14, PALETTE.pipeDk);
        // 管箍
        for (let i = 0; i < 3; i++) {
            rect(ctx, bx - 5, by + 12 + i * 16, 5, 2, PALETTE.metal);
            rect(ctx, bx - 5, by + 12 + i * 16, 5, 1, PALETTE.metalHi);
        }
        // 右侧竖管
        rect(ctx, bx + bw + 1, by + 6, 3, bh - 14, PALETTE.pipe);
        rect(ctx, bx + bw + 1, by + 6, 1, bh - 14, PALETTE.pipeHi);
        rect(ctx, bx + bw + 3, by + 6, 1, bh - 14, PALETTE.pipeDk);
        for (let i = 0; i < 3; i++) {
            rect(ctx, bx + bw, by + 12 + i * 16, 5, 2, PALETTE.metal);
            rect(ctx, bx + bw, by + 12 + i * 16, 5, 1, PALETTE.metalHi);
        }

        // 屋顶结构
        // 左塔基(炮塔挂载)
        const ltx = ox + 22, lty = oy + 20;
        rect(ctx, ltx, lty, 22, 12, mid);
        rect(ctx, ltx, lty, 22, 2, hi);
        rect(ctx, ltx, lty + 11, 22, 1, dark);
        rect(ctx, ltx - 1, lty, 1, 12, edge);
        rect(ctx, ltx + 22, lty, 1, 12, edge);
        // 右塔基
        const rtx = ox + W - 44, rty = oy + 20;
        rect(ctx, rtx, rty, 22, 12, mid);
        rect(ctx, rtx, rty, 22, 2, hi);
        rect(ctx, rtx, rty + 11, 22, 1, dark);
        rect(ctx, rtx - 1, rty, 1, 12, edge);
        rect(ctx, rtx + 22, rty, 1, 12, edge);

        // 中央穹顶(t2+)
        if (tier >= 2) {
            const cx = ox + W / 2 - 14, cy = oy + 12;
            const cw = 28, ch = 18;
            // 底座
            rect(ctx, cx, cy + ch - 4, cw, 4, dark);
            rect(ctx, cx, cy + ch - 4, cw, 1, hi);
            // 穹顶(梯形)
            for (let i = 0; i < 6; i++) {
                rect(ctx, cx + i, cy + ch - 4 - i, cw - i * 2, 1,
                    i < 2 ? hi : (i < 4 ? mid : dark));
            }
            // 穹顶霓虹环
            rect(ctx, cx + 4, cy + ch - 10, cw - 8, 2, PALETTE.ledCyan);
            rect(ctx, cx + 4, cy + ch - 11, cw - 8, 1, PALETTE.ledCyanHi);
            // 顶部天线
            rect(ctx, cx + cw / 2 - 1, cy + ch - 16, 1, 6, PALETTE.metal);
            px(ctx, cx + cw / 2 - 1, cy + ch - 17, PALETTE.ledRedHi);
        }

        // 旗杆 + 红旗(t3)
        if (tier >= 3) {
            const fx = ox + W / 2;
            rect(ctx, fx, oy + 2, 1, 16, PALETTE.metal);
            // 旗(波浪)
            rect(ctx, fx + 1, oy + 3, 8, 6, '#a02828');
            rect(ctx, fx + 1, oy + 3, 8, 1, '#c84040');
            rect(ctx, fx + 8, oy + 4, 1, 1, '#a02828');
            rect(ctx, fx + 1, oy + 9, 1, 1, '#a02828');
            // 骷髅(白色小点)
            px(ctx, fx + 4, oy + 5, '#e8e0d0');
            px(ctx, fx + 4, oy + 6, '#e8e0d0');
            px(ctx, fx + 3, oy + 6, '#1a1410');
            px(ctx, fx + 5, oy + 6, '#1a1410');
        }

        // 卫星天线(t3)
        if (tier >= 3) {
            const sax = ox + 28, say = oy + 14;
            rect(ctx, sax, say, 1, 6, PALETTE.metal);
            rect(ctx, sax - 3, say - 1, 7, 2, PALETTE.metalHi);
            rect(ctx, sax - 3, say + 1, 7, 1, PALETTE.metalDk);
            // 警示灯(闪烁基色)
            px(ctx, sax, say - 2, PALETTE.ledRed);
        }

        // 屋顶霓虹边(t3)
        if (tier >= 3) {
            rect(ctx, bx, by - 1, bw, 1, PALETTE.wall3Glow);
            // 边缘光晕(向上发散 2px)
            ctx.fillStyle = 'rgba(77, 227, 255, 0.25)';
            ctx.fillRect(bx, by - 3, bw, 2);
        }

        // 暗角(让建筑更立体)
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(bx + 1, by + bh - 12, bw - 2, 10);
    }

    // ============ 炮塔 ============
    function drawTurret(ctx, ox, oy, dir) {
        // 28x14 范围
        // 旋转基座
        rect(ctx, ox - 6, oy - 5, 12, 5, PALETTE.metalDk);
        rect(ctx, ox - 6, oy - 5, 12, 1, PALETTE.metalHi);
        rect(ctx, ox - 6, oy - 1, 12, 1, '#1a1410');
        // 转轴
        rect(ctx, ox - 2, oy - 7, 4, 3, PALETTE.metal);
        rect(ctx, ox - 2, oy - 7, 4, 1, PALETTE.metalHi);
        // 炮管
        const bX = dir > 0 ? ox + 2 : ox - 10;
        rect(ctx, bX, oy - 6, 8, 2, PALETTE.metal);
        rect(ctx, bX, oy - 6, 8, 1, PALETTE.metalHi);
        rect(ctx, bX, oy - 4, 8, 1, PALETTE.metalDk);
        // 炮口
        const muz = dir > 0 ? bX + 7 : bX;
        px(ctx, muz, oy - 6, '#1a1410');
        px(ctx, muz, oy - 5, '#1a1410');
        // 弹链/小细节
        px(ctx, ox, oy - 8, PALETTE.ledRed);
    }

    // ============ 丧尸 ============
    // 16x24 范围,4 帧步行
    function drawZombie(ctx, ox, oy, frame, type) {
        // type 0 普通 / 1 跑尸 / 2 重甲
        const skin = type === 2 ? PALETTE.zSkinH : (type === 1 ? PALETTE.zSkinR : PALETTE.zSkin);
        const skinHi = type === 2 ? PALETTE.zSkinHHi : PALETTE.zSkinHi;
        const skinDk = PALETTE.zSkinDk;
        const shirt = type === 1 ? '#4a2840' : PALETTE.zShirt;
        const shirtHi = PALETTE.zShirtHi;
        const headW = type === 2 ? 7 : 6;
        const bodyW = type === 2 ? 10 : 8;

        // 帧:0 1 2 3 = 站 抬左 站 抬右
        const swingL = (frame === 1) ? 1 : 0;
        const swingR = (frame === 3) ? 1 : 0;
        const bob = (frame === 1 || frame === 3) ? 0 : -1; // 站立时高 1px

        // 脚底中心 (ox, oy)
        const cx = ox;
        const cy = oy + bob;

        // 阴影
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(cx - 4, oy - 1, 8, 1);

        // 腿
        rect(ctx, cx - 2, cy - 6 + swingL, 2, 6 - swingL, skinDk);
        rect(ctx, cx, cy - 6 + swingR, 2, 6 - swingR, skinDk);
        // 鞋
        rect(ctx, cx - 3, cy - 1, 3, 1, '#1a1410');
        rect(ctx, cx, cy - 1, 3, 1, '#1a1410');

        // 躯干
        const tY = cy - 13;
        rect(ctx, cx - bodyW / 2, tY, bodyW, 7, shirt);
        rect(ctx, cx - bodyW / 2, tY, bodyW, 1, shirtHi);
        // 衣物撕裂/血迹
        px(ctx, cx - 2, tY + 2, PALETTE.zBlood);
        px(ctx, cx + 1, tY + 4, PALETTE.zBloodDk);
        rect(ctx, cx - 1, tY + 3, 2, 1, PALETTE.zBlood);

        // 手臂(向前伸,根据帧反向摆动)
        const armSwing = (frame === 1) ? -1 : ((frame === 3) ? 1 : 0);
        // 左臂
        rect(ctx, cx - bodyW / 2 - 2, tY + 1, 2, 5, skin);
        rect(ctx, cx - bodyW / 2 - 2, tY + 1, 1, 5, skinDk);
        px(ctx, cx - bodyW / 2 - 2, tY + 6 + armSwing, skinDk);
        // 右臂
        rect(ctx, cx + bodyW / 2, tY + 1, 2, 5, skin);
        rect(ctx, cx + bodyW / 2 + 1, tY + 1, 1, 5, skinDk);
        px(ctx, cx + bodyW / 2 + 1, tY + 6 - armSwing, skinDk);
        // 手部(爪子)
        px(ctx, cx - bodyW / 2 - 3, tY + 6, skin);
        px(ctx, cx + bodyW / 2 + 2, tY + 6, skin);

        // 头
        const hY = tY - headW - 1;
        rect(ctx, cx - headW / 2, hY, headW, headW + 1, skin);
        rect(ctx, cx - headW / 2, hY, headW, 1, skinHi);
        rect(ctx, cx - headW / 2, hY + headW, headW, 1, skinDk);
        // 头发碎块
        px(ctx, cx - headW / 2 + 1, hY, '#3a2818');
        px(ctx, cx + headW / 2 - 2, hY, '#3a2818');
        // 眼(发光)
        px(ctx, cx - 2, hY + 2, PALETTE.zEye);
        px(ctx, cx + 1, hY + 2, PALETTE.zEye);
        // 眼下血迹
        px(ctx, cx - 2, hY + 3, PALETTE.zBloodDk);
        px(ctx, cx + 1, hY + 3, PALETTE.zBloodDk);
        // 嘴
        rect(ctx, cx - 2, hY + headW - 2, 3, 1, PALETTE.zBlood);
        px(ctx, cx + 1, hY + headW - 1, PALETTE.zBlood);

        // 重甲装饰
        if (type === 2) {
            // 头盔
            rect(ctx, cx - headW / 2 - 1, hY - 1, headW + 2, 3, '#4a4a4a');
            rect(ctx, cx - headW / 2 - 1, hY - 1, headW + 2, 1, '#6a6a6a');
            px(ctx, cx, hY - 2, PALETTE.metalHi);
            // 胸甲
            rect(ctx, cx - bodyW / 2 + 1, tY + 2, bodyW - 2, 3, '#4a4a4a');
            rect(ctx, cx - bodyW / 2 + 1, tY + 2, bodyW - 2, 1, '#6a6a6a');
            px(ctx, cx, tY + 3, PALETTE.ledRed);
        }
        // 跑尸:破布飘动
        if (type === 1) {
            px(ctx, cx - bodyW / 2 - 1, tY + 7, shirt);
            px(ctx, cx + bodyW / 2, tY + 7, shirt);
        }
    }

    // 死亡帧:5 帧从倒下到化为残骸
    function drawZombieDeath(ctx, ox, oy, frame, type) {
        const skin = type === 2 ? PALETTE.zSkinH : (type === 1 ? PALETTE.zSkinR : PALETTE.zSkin);
        const skinDk = PALETTE.zSkinDk;
        const blood = PALETTE.zBlood;
        // 中心 ox, 底 oy
        if (frame === 0) {
            // 倒地中
            rect(ctx, ox - 4, oy - 6, 8, 6, skin);
            rect(ctx, ox - 4, oy - 6, 8, 1, skinDk);
            // 头
            rect(ctx, ox + 4, oy - 5, 4, 4, skin);
            px(ctx, ox + 6, oy - 4, PALETTE.zEye);
        } else if (frame === 1) {
            rect(ctx, ox - 5, oy - 4, 10, 4, skin);
            rect(ctx, ox - 5, oy - 4, 10, 1, skinDk);
            rect(ctx, ox + 5, oy - 3, 4, 3, skin);
            rect(ctx, ox - 4, oy - 1, 8, 1, blood);
        } else if (frame === 2) {
            rect(ctx, ox - 6, oy - 3, 12, 3, skin);
            rect(ctx, ox - 6, oy - 3, 12, 1, skinDk);
            rect(ctx, ox - 4, oy - 1, 8, 1, blood);
            px(ctx, ox - 6, oy - 4, blood);
            px(ctx, ox + 5, oy - 4, blood);
        } else if (frame === 3) {
            rect(ctx, ox - 6, oy - 2, 12, 2, skinDk);
            rect(ctx, ox - 5, oy - 1, 10, 1, blood);
            px(ctx, ox - 7, oy - 3, blood);
            px(ctx, ox + 6, oy - 3, blood);
        } else {
            // 残骸
            rect(ctx, ox - 5, oy - 1, 10, 1, skinDk);
            px(ctx, ox - 3, oy - 1, blood);
            px(ctx, ox + 2, oy - 1, blood);
            px(ctx, ox - 5, oy, '#1a1410');
            px(ctx, ox + 4, oy, '#1a1410');
        }
    }

    // ============ 资源 ============
    function drawCoin(ctx, ox, oy, frame) {
        // 4 帧旋转
        const widths = [6, 4, 1, 4];
        const w = widths[frame];
        const left = ox - Math.floor(w / 2);
        rect(ctx, left, oy - 4, w, 6, PALETTE.coin);
        rect(ctx, left, oy - 4, w, 1, PALETTE.coinHi);
        rect(ctx, left, oy + 1, w, 1, PALETTE.coinDk);
        if (w >= 4) {
            // 中央 $
            px(ctx, ox, oy - 2, PALETTE.coinDk);
            px(ctx, ox, oy, PALETTE.coinDk);
        }
        // 光点
        if (w >= 4) px(ctx, left + 1, oy - 3, '#ffffff');
    }

    function drawWood(ctx, ox, oy) {
        rect(ctx, ox - 4, oy - 3, 8, 4, PALETTE.wood);
        rect(ctx, ox - 4, oy - 3, 8, 1, PALETTE.woodHi);
        rect(ctx, ox - 4, oy, 8, 1, PALETTE.woodDk);
        // 木纹
        px(ctx, ox - 2, oy - 2, PALETTE.woodDk);
        px(ctx, ox + 1, oy - 1, PALETTE.woodDk);
        px(ctx, ox - 1, oy - 1, PALETTE.woodHi);
    }

    function drawRare(ctx, ox, oy, frame) {
        // 紫色水晶,2 帧闪烁
        const hi = frame === 0 ? PALETTE.rareHi : '#ffffff';
        rect(ctx, ox - 2, oy - 5, 4, 6, PALETTE.rare);
        // 切面
        px(ctx, ox - 1, oy - 5, hi);
        px(ctx, ox, oy - 4, hi);
        rect(ctx, ox - 2, oy - 5, 1, 6, PALETTE.rareDk);
        // 底尖
        px(ctx, ox - 1, oy + 1, PALETTE.rareDk);
        px(ctx, ox, oy + 1, PALETTE.rareDk);
        // 光晕(简略,实际靠粒子)
        if (frame === 0) px(ctx, ox + 1, oy - 4, '#ffffff');
    }

    // ============ 弹道/特效 ============
    function drawBullet(ctx, ox, oy) {
        // 子弹 + 拖尾
        rect(ctx, ox - 3, oy, 1, 1, 'rgba(255,224,112,0.3)');
        rect(ctx, ox - 2, oy, 1, 1, 'rgba(255,224,112,0.6)');
        rect(ctx, ox - 1, oy, 1, 1, PALETTE.muzzle);
        rect(ctx, ox, oy, 1, 1, PALETTE.muzzleHot);
        rect(ctx, ox + 1, oy, 1, 1, PALETTE.muzzleHot);
    }

    function drawMuzzleFlash(ctx, ox, oy) {
        // 三层火光
        rect(ctx, ox - 1, oy - 2, 3, 5, PALETTE.fire3);
        rect(ctx, ox, oy - 1, 2, 3, PALETTE.fire2);
        px(ctx, ox + 1, oy, PALETTE.muzzleHot);
        px(ctx, ox + 1, oy - 1, PALETTE.fire1);
        px(ctx, ox + 1, oy + 1, PALETTE.fire1);
    }

    // ============ 地刺/电网/火焰 ============
    function drawSpikes(ctx, ox, oy) {
        // 一组 4 根地刺,带血和血滴
        for (let i = 0; i < 4; i++) {
            const x = ox + i * 4;
            // 三角刺(3 像素宽)
            rect(ctx, x, oy - 5, 1, 5, PALETTE.metalDk);
            rect(ctx, x + 1, oy - 6, 1, 6, PALETTE.metalHi);
            rect(ctx, x + 2, oy - 5, 1, 5, PALETTE.metal);
            // 血迹
            if (i % 2 === 0) {
                px(ctx, x + 1, oy - 6, PALETTE.zBlood);
                px(ctx, x + 1, oy - 4, PALETTE.zBlood);
            }
        }
        // 底座
        rect(ctx, ox - 1, oy, 18, 1, PALETTE.metalDk);
    }

    function drawElecPost(ctx, ox, oy) {
        // 电网柱:中央柱 + 顶部电极
        rect(ctx, ox - 1, oy - 10, 2, 10, PALETTE.metalDk);
        rect(ctx, ox, oy - 10, 1, 10, PALETTE.metalHi);
        // 顶部线圈
        rect(ctx, ox - 2, oy - 12, 4, 2, PALETTE.metal);
        rect(ctx, ox - 2, oy - 12, 4, 1, PALETTE.metalHi);
        // 电火花
        px(ctx, ox, oy - 13, PALETTE.elecHot);
        px(ctx, ox - 1, oy - 13, PALETTE.elec);
        px(ctx, ox + 1, oy - 13, PALETTE.elec);
        // 底座
        rect(ctx, ox - 2, oy, 4, 1, PALETTE.metalDk);
    }

    function drawFireNozzle(ctx, ox, oy, dir) {
        // 喷火嘴 + 火焰预热
        rect(ctx, ox - 2, oy - 4, 4, 4, PALETTE.metalDk);
        rect(ctx, ox - 2, oy - 4, 4, 1, PALETTE.metalHi);
        // 喷口
        if (dir > 0) {
            rect(ctx, ox + 2, oy - 3, 2, 2, '#1a1410');
            // 火苗
            px(ctx, ox + 4, oy - 3, PALETTE.fire2);
            px(ctx, ox + 4, oy - 2, PALETTE.fire3);
        } else {
            rect(ctx, ox - 4, oy - 3, 2, 2, '#1a1410');
            px(ctx, ox - 5, oy - 3, PALETTE.fire2);
            px(ctx, ox - 5, oy - 2, PALETTE.fire3);
        }
        // 燃料罐(背后)
        rect(ctx, ox - 1, oy - 7, 2, 4, '#8a3020');
        px(ctx, ox - 1, oy - 7, '#c84030');
    }

    // ============ 烘焙 ============
    function bake() {
        const A = document.createElement('canvas');
        A.width = 512; A.height = 512;
        const ctx = A.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        atlas.canvas = A; atlas.ctx = ctx;

        // 透明背景
        ctx.clearRect(0, 0, 512, 512);

        // 建筑 3 tier:每个 140x110,垂直堆叠在左侧
        // 建筑 sprite 注册时锚点为(中心, 底部)
        for (let t = 1; t <= 3; t++) {
            const bx = 0;
            const by = (t - 1) * 112;
            drawBuilding(ctx, bx, by, t);
            reg(`building_t${t}`, bx, by, 140, 110, 0.5, 1.0);
        }

        // 防御工事 - 中部
        const dStartX = 145;
        // 炮塔
        drawTurret(ctx, dStartX + 14, 14, +1);
        reg('turret_r', dStartX, 0, 28, 16, 0.5, 1.0);
        drawTurret(ctx, dStartX + 14 + 30, 14, -1);
        reg('turret_l', dStartX + 30, 0, 28, 16, 0.5, 1.0);
        // 地刺(锚点左,底部)
        drawSpikes(ctx, dStartX, 30);
        reg('spikes', dStartX, 24, 18, 7, 0.0, 1.0);
        // 电网柱
        drawElecPost(ctx, dStartX + 24, 44);
        reg('elec_post', dStartX + 21, 32, 6, 14, 0.5, 1.0);
        // 火焰喷嘴
        drawFireNozzle(ctx, dStartX + 38, 44, +1);
        reg('fire_nozzle_r', dStartX + 33, 36, 10, 9, 0.5, 1.0);
        drawFireNozzle(ctx, dStartX + 52, 44, -1);
        reg('fire_nozzle_l', dStartX + 48, 36, 10, 9, 0.5, 1.0);

        // 丧尸步行 3 类型 × 4 帧:每个 16x24,锚点(中心,底)
        const zRowY = 340;
        const cellW = 16, cellH = 26;
        for (let type = 0; type < 3; type++) {
            for (let frame = 0; frame < 4; frame++) {
                const idx = type * 4 + frame;
                const sx = idx * cellW;
                const sy = zRowY;
                // 脚底位置 = (sx+8, sy+24)
                drawZombie(ctx, sx + 8, sy + 24, frame, type);
                reg(`zombie_${type}_${frame}`, sx, sy, cellW, cellH, 0.5, 24 / cellH);
            }
        }

        // 丧尸死亡 3 类型 × 5 帧:每个 16x10
        const zdY = 380;
        const dcellW = 16, dcellH = 10;
        for (let type = 0; type < 3; type++) {
            for (let frame = 0; frame < 5; frame++) {
                const idx = type * 5 + frame;
                const sx = idx * dcellW;
                drawZombieDeath(ctx, sx + 8, zdY + 8, frame, type);
                reg(`corpse_${type}_${frame}`, sx, zdY, dcellW, dcellH, 0.5, 1.0);
            }
        }
        // 兼容旧名
        for (let type = 0; type < 3; type++) {
            atlas.sprites[`corpse_${type}`] = atlas.sprites[`corpse_${type}_4`];
        }

        // 资源 - 右上区
        const resX = 260;
        for (let f = 0; f < 4; f++) {
            const sx = resX + f * 10;
            drawCoin(ctx, sx + 5, 10, f);
            reg(`coin_${f}`, sx, 4, 10, 10, 0.5, 0.7);
        }
        drawWood(ctx, resX + 50, 10);
        reg('wood', resX + 45, 4, 10, 10, 0.5, 0.7);
        for (let f = 0; f < 2; f++) {
            const sx = resX + 60 + f * 8;
            drawRare(ctx, sx + 4, 10, f);
            reg(`rare_${f}`, sx, 2, 8, 12, 0.5, 0.75);
        }

        // 子弹/枪火 - 右上
        drawBullet(ctx, resX + 8, 30);
        reg('bullet', resX, 28, 12, 5, 0.5, 0.5);
        drawMuzzleFlash(ctx, resX + 22, 30);
        reg('muzzle', resX + 18, 26, 8, 8, 0.5, 0.5);
    }

    function getSprite(name) { return atlas.sprites[name]; }

    function drawSprite(targetCtx, name, x, y, opts) {
        const s = atlas.sprites[name];
        if (!s) return;
        const ax = (opts && opts.ax != null) ? opts.ax : s.ax;
        const ay = (opts && opts.ay != null) ? opts.ay : s.ay;
        const dx = Math.round(x - s.w * ax);
        const dy = Math.round(y - s.h * ay);
        targetCtx.drawImage(atlas.canvas, s.x, s.y, s.w, s.h, dx, dy, s.w, s.h);
    }

    // 红闪绘制:把指定 sprite 用纯白色覆盖渲染(用于击中)
    function drawSpriteFlash(targetCtx, name, x, y, opts) {
        const s = atlas.sprites[name];
        if (!s) return;
        const ax = (opts && opts.ax != null) ? opts.ax : s.ax;
        const ay = (opts && opts.ay != null) ? opts.ay : s.ay;
        const dx = Math.round(x - s.w * ax);
        const dy = Math.round(y - s.h * ay);
        // 用 source-atop 模式画白色覆盖
        targetCtx.save();
        targetCtx.drawImage(atlas.canvas, s.x, s.y, s.w, s.h, dx, dy, s.w, s.h);
        targetCtx.globalCompositeOperation = 'source-atop';
        targetCtx.fillStyle = '#ffffff';
        targetCtx.fillRect(dx, dy, s.w, s.h);
        targetCtx.restore();
    }

    window.ShelterTD.AssetLoader = {
        bake, getSprite, drawSprite, drawSpriteFlash, PALETTE,
        get atlasCanvas() { return atlas.canvas; }
    };
})();
