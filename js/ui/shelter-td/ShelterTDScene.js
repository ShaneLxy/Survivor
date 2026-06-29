// 主场景 v2：震屏、霓虹辉光合成、双层背景渲染、点击缩放反馈
(function() {
    window.ShelterTD = window.ShelterTD || {};
    const {
        AssetLoader, ParticleSystem, ProjectileSystem,
        ResourceDrop, EnemyManager, DefenseSystem,
        Building, CityBackground
    } = window.ShelterTD;

    const LOGICAL_W = 480;
    const LOGICAL_H = 270;
    const SHELTER_MEDIA = {
        background: 'assets/media/shelter/shelter_bg.png?v=2026.05.27.475',
        house: 'assets/media/shelter/shelter_house.png?v=2026.05.27.475',
        turretLeft: 'assets/media/shelter/shelter_left_weapon.png?v=2026.05.27.475',
        turretRight: 'assets/media/shelter/shelter_right_weapon.png?v=2026.05.27.475',
        spikes: 'assets/media/shelter/shelter_spikes.png?v=2026.05.27.475',
        powerGrid: 'assets/media/shelter/shelter_power_grid.png?v=2026.05.27.475',
        enemyHugeLeft: 'assets/media/shelter/enemyHugeLeft.png?v=2026.05.28.1',
        enemyHugeRight: 'assets/media/shelter/enemyHugeRight.png?v=2026.05.28.1',
        enemyHugeLeftAttack: 'assets/media/shelter/enemyHugeLeftAttack.png?v=2026.05.30.1',
        enemyHugeRightAttack: 'assets/media/shelter/enemyHugeRightAttack.png?v=2026.05.30.1'
    };

    class ShelterTDScene {
        constructor(opts) {
            this.opts = opts || {};
            this.container = null;
            this.wrapper = null;
            this.canvas = null;
            this.ctx = null;
            this.glowCanvas = null; // 辉光合成离屏
            this.glowCtx = null;
            this.level = opts.level || 1;
            this.running = false;
            this.lastTs = 0;
            this.rafId = 0;
            this.fps = 60;
            this._fpsAcc = 0;
            this._fpsFrames = 0;
            this._onTapBonus = opts.onTapBonus || null;
            this._showFps = !!opts.showFps;
            this._baked = false;
            // 震屏
            this._shakeAmp = 0; this._shakeTime = 0;
            // 点击缩放
            this._tapScale = 1; this._tapScaleTimer = 0;
            // 全屏闪白
            this._flashTimer = 0;
            this._scanlinePhase = Math.random();
            this.lowPowerMode = this._shouldUseLowPowerMode();
            this.targetFrameDuration = this.lowPowerMode ? (1000 / 30) : 0;
            this.lastRenderTs = 0;
            this.media = {};
            this.weaponLayout = null;
            this._tdTuneTimer = 0;
            this._monitorStatus = {
                idleSeconds: 0,
                chestStored: 0,
                chestCapacity: 2,
                chestNextSeconds: 0,
                tapCount: 0,
                tapLimit: 200,
                tapBonusPercent: 0
            };
        }

        mount(container) {
            if (this.wrapper && this.wrapper.parentElement === container) return;
            this._ensureBaked();
            this._buildDom(container);
            this._buildSystems();
            this._bindEvents();
            this.start();
        }
        rebind(container) {
            if (!this.wrapper) return this.mount(container);
            if (this.wrapper.parentElement !== container) container.appendChild(this.wrapper);
        }
        _ensureBaked() {
            if (!this._baked) { AssetLoader.bake(); this._baked = true; }
        }

        _buildDom(container) {
            this.container = container;
            const wrapper = document.createElement('div');
            wrapper.className = 'shelter-td-wrapper';
            wrapper.style.cssText = `
                position: relative;
                width: 100%;
                aspect-ratio: 16 / 9;
                margin-top: 8px;
                border-radius: 10px;
                overflow: hidden;
                background: #15120d;
                box-shadow: 0 0 0 1px rgba(161, 133, 86, 0.32), 0 10px 30px rgba(0,0,0,0.42);
                isolation: isolate;
                touch-action: manipulation;
                user-select: none;
                -webkit-user-select: none;
            `;
            const canvas = document.createElement('canvas');
            canvas.width = LOGICAL_W;
            canvas.height = LOGICAL_H;
            canvas.style.cssText = `
                display:block; width:100%; height:100%;
                cursor: pointer;
                transition: transform 0.08s ease-out;
            `;
            wrapper.appendChild(canvas);

            const tip = document.createElement('div');
            tip.style.cssText = `
                position: absolute; right: 8px; top: 6px;
                color: rgba(143, 226, 255, 0.92);
                font: 600 9px/1.1 sans-serif;
                text-shadow: 0 1px 2px rgba(0,0,0,0.7);
                pointer-events: none; opacity: 0.88;
                animation: ${this.lowPowerMode ? 'none' : 'shelterTdPulse 1.6s ease-in-out infinite'};
                z-index: 2;
            `;
            tip.textContent = '\u70b9\u51fb\u652f\u63f4';
            wrapper.appendChild(tip);

            // 注入 keyframes（只注入一次）
            if (!document.getElementById('shelter-td-style')) {
                const s = document.createElement('style');
                s.id = 'shelter-td-style';
                s.textContent = `
                    @keyframes shelterTdPulse {
                        0%,100% { opacity: 0.52; }
                        50% { opacity: 1; }
                    }
                    @keyframes shelterTdScanline {
                        0% { transform: translateY(-100%); }
                        100% { transform: translateY(100%); }
                    }
                `;
                document.head.appendChild(s);
            }

            // CRT 扫描线动画（CSS 层，效果更柔）
            if (!this.lowPowerMode) {
                const scan = document.createElement('div');
                scan.style.cssText = `
                    position: absolute; left: 0; right: 0; height: 30%;
                    background: linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,240,210,0.03) 50%, rgba(255,255,255,0) 100%);
                    pointer-events: none;
                    animation: shelterTdScanline 6s linear infinite;
                    z-index: 1;
                `;
                wrapper.appendChild(scan);
            }

            if (this._showFps) {
                const fps = document.createElement('div');
                fps.style.cssText = `
                    position: absolute; left: 8px; bottom: 6px;
                    color: #7ee0ff; font: 9px/1 monospace;
                    text-shadow: 1px 1px 0 #000; pointer-events: none;
                `;
                wrapper.appendChild(fps);
                this._fpsEl = fps;
            }

            container.appendChild(wrapper);
            this.wrapper = wrapper;
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.ctx.imageSmoothingEnabled = true;

            // 辉光合成层（同分辨率）
            this.glowCanvas = document.createElement('canvas');
            this.glowCanvas.width = LOGICAL_W;
            this.glowCanvas.height = LOGICAL_H;
            this.glowCtx = this.glowCanvas.getContext('2d');
            this.glowCtx.imageSmoothingEnabled = true;
            this._loadMedia();
        }

        _resolveMediaSrc(path) {
            const src = window.VersionManager?.getVersionedAssetUrl?.(path) || path;
            return src.includes('shelter_') ? `${src}&img=2026.05.27.475` : src;
        }

        _loadMedia() {
            Object.entries(SHELTER_MEDIA).forEach(([key, path]) => {
                const img = new Image();
                img.decoding = 'async';
                img.src = this._resolveMediaSrc(path);
                this.media[key] = img;
            });
        }

        _buildSystems() {
            if (this.systemsBuilt) return;
            this.background = new CityBackground(LOGICAL_W, LOGICAL_H);
            this.building = new Building();
            this.building.x = LOGICAL_W / 2;
            this.building.y = LOGICAL_H * 0.85;
            this.building.setLevel(this.level);

            this.particles = new ParticleSystem();
            this.enemies = new EnemyManager(this);
            this.enemies.configure({
                groundY: this.building.y,
                leftSpawnX: -16,
                rightSpawnX: LOGICAL_W + 16,
                buildingX: this.building.x,
                stopRadius: 58
            });
            this.enemies.setLevel(this.level);
            this._syncTdTuning();
            this.projectiles = new ProjectileSystem(this.enemies, this.particles);
            this.drops = new ResourceDrop(this.particles, this.building);
            this.defense = new DefenseSystem(this, this.projectiles, this.particles, this.enemies);
            this.defense.setLevel(this.level, this.building, this._getShelterTdConfig());
            this._syncDefenseLayout();

            this.enemies.onKill = (e) => {
                if (!e.forcedExpire) {
                    const lootType = Math.random() < 0.05 ? 'rare' : 'normal';
                    this.drops.drop(e.x, e.y - 6, lootType);
                }
                this._flashTimer = 0.04;
            };
            this.enemies.onBreachAttack = (enemy) => {
                const side = enemy.x <= this.building.x ? -1 : 1;
                const impactX = this.building.x + side * (enemy.giant ? 46 : 34);
                const impactY = this.building.y - (enemy.giant ? 46 : 26);
                this.building.hit(enemy.giant ? 1.6 : 1);
                this.particles.spark(impactX, impactY, side);
                this.particles.spikeHit(impactX, impactY);
                if (enemy.giant) {
                    this.particles.explosion(impactX, impactY + 8);
                }
                this.shake(enemy.giant ? 3.2 : 1.8, enemy.giant ? 0.16 : 0.1);
            };

            this.systemsBuilt = true;
        }

        _bindEvents() {
            if (this._eventsBound) return;
            this._eventsBound = true;
            const onTap = (ev) => {
                ev.preventDefault();
                const point = this._resolvePointer(ev);
                if (this._isChestHit(point.x, point.y)) {
                    this.opts?.onChestClick?.();
                    return;
                }
                this._handleTap();
            };
            this.canvas.addEventListener('click', onTap);
            this.canvas.addEventListener('touchstart', onTap, { passive: false });

            this._visHandler = () => {
                if (document.visibilityState === 'hidden') this.pause();
                else this.resume();
            };
            document.addEventListener('visibilitychange', this._visHandler);
        }

        _resolvePointer(ev) {
            const rect = this.canvas.getBoundingClientRect();
            const touch = ev.touches?.[0] || ev.changedTouches?.[0] || ev;
            const scaleX = LOGICAL_W / Math.max(1, rect.width);
            const scaleY = LOGICAL_H / Math.max(1, rect.height);
            return {
                x: (touch.clientX - rect.left) * scaleX,
                y: (touch.clientY - rect.top) * scaleY
            };
        }

        _isChestHit(x, y) {
            return x >= LOGICAL_W - 86 && x <= LOGICAL_W - 38 && y >= 64 && y <= 112;
        }

        _handleTap() {
            this.defense.boost(2.5, 1.5);
            this.enemies.spawnRate(1.6);
            clearTimeout(this._spawnBoostTimer);
            this._spawnBoostTimer = setTimeout(() => this.enemies.spawnRate(1), 1500);
            this._tapScale = 1.04;
            this._tapScaleTimer = 0.15;
            this.canvas.style.transform = 'scale(1.02)';
            setTimeout(() => { if (this.canvas) this.canvas.style.transform = 'scale(1)'; }, 120);
            this.particles.floatText(this.building.x, this.building.y - 70, 'BOOST!', '#4de3ff');
            this.shake(3, 0.12);
            if (this._onTapBonus) {
                try {
                    const result = this._onTapBonus({});
                    if (result?.counted) {
                        this.setMonitorStatus({
                            tapCount: result.tapCount,
                            tapLimit: result.tapLimit,
                            tapBonusPercent: result.tapBonusPercent
                        });
                        if (result.justLeveled) {
                            this.particles.floatText(this.building.x, this.building.y - 96, `+${result.tapBonusPercent}%`, '#ffe07a');
                        }
                    } else if (result?.reason === 'cooldown') {
                        this.particles.floatText(this.building.x, this.building.y - 92, 'WAIT', '#8cecff');
                    }
                } catch (e) {}
            }
        }

        setMonitorStatus(status) {
            this._monitorStatus = {
                ...this._monitorStatus,
                ...(status || {})
            };
        }

        // 震屏 API
        shake(amp, duration) {
            this._shakeAmp = Math.max(this._shakeAmp, amp);
            this._shakeTime = Math.max(this._shakeTime, duration);
        }

        setLevel(level) {
            this.level = Math.max(1, Math.min(10, level));
            if (!this.systemsBuilt) return;
            this.building.setLevel(this.level);
            this.enemies.setLevel(this.level);
            this._syncTdTuning();
            this.defense.setLevel(this.level, this.building, this._getShelterTdConfig());
            this._syncDefenseLayout();
        }

        start() {
            if (this.running) return;
            this.running = true;
            this.lastTs = performance.now();
            this.lastRenderTs = 0;
            const loop = (ts) => {
                if (!this.running) return;
                if (this.targetFrameDuration && this.lastRenderTs && (ts - this.lastRenderTs) < this.targetFrameDuration) {
                    this.rafId = requestAnimationFrame(loop);
                    return;
                }
                let dt = (ts - this.lastTs) / 1000;
                if (dt > 0.1) dt = 0.1;
                this.lastTs = ts;
                this.lastRenderTs = ts;
                this._update(dt);
                this._render();
                this._fpsAcc += dt;
                this._fpsFrames++;
                if (this._fpsAcc >= 0.5) {
                    this.fps = this._fpsFrames / this._fpsAcc;
                    this._fpsAcc = 0; this._fpsFrames = 0;
                    if (this._fpsEl) this._fpsEl.textContent = `FPS ${this.fps.toFixed(0)} 路 E${this.enemies.pool.size} P${this.particles.count}`;
                }
                this.rafId = requestAnimationFrame(loop);
            };
            this.rafId = requestAnimationFrame(loop);
        }
        pause() { this.running = false; cancelAnimationFrame(this.rafId); }
        resume() {
            if (this.running) return;
            if (this.wrapper && document.visibilityState === 'visible') this.start();
        }

        _update(dt) {
            this.background.update(dt);
            this.building.update?.(dt);
            this.enemies.update(dt);
            this._tdTuneTimer += dt;
            if (this._tdTuneTimer >= 1) {
                this._tdTuneTimer = 0;
                this._syncTdTuning();
                try { this.opts?.onSecondTick?.(); } catch (e) {}
            }
            this.defense.update(dt);
            this.projectiles.update(dt);
            this.drops.update(dt, this.building.y);
            this.particles.update(dt);
            if (!this.lowPowerMode) {
                this._scanlinePhase = (this._scanlinePhase + dt * 0.18) % 1;
            }

            if (this._shakeTime > 0) {
                this._shakeTime -= dt;
                if (this._shakeTime <= 0) this._shakeAmp = 0;
            }
            if (this._flashTimer > 0) this._flashTimer -= dt;
        }

        _render() {
            const ctx = this.ctx;
            // 计算震屏偏移
            let sx = 0, sy = 0;
            if (this._shakeAmp > 0 && this._shakeTime > 0) {
                const decay = Math.max(0, this._shakeTime / 0.3);
                sx = (Math.random() - 0.5) * 2 * this._shakeAmp * decay;
                sy = (Math.random() - 0.5) * 2 * this._shakeAmp * decay;
            }

            ctx.save();
            ctx.translate(Math.round(sx), Math.round(sy));
            this._renderBackdrop(ctx);
            this._renderShelterArt(ctx);
            this.projectiles.render(ctx);
            this.drops.render(ctx);
            this.particles.render(ctx);
            this.enemies.render(ctx);

            // 全屏闪白
            if (this._flashTimer > 0) {
                ctx.fillStyle = `rgba(255,255,255,${Math.min(0.4, this._flashTimer * 4)})`;
                ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
            }

            ctx.restore();
        }

        _drawImageCover(ctx, image, x, y, w, h) {
            if (!image || !image.complete || !image.naturalWidth || !image.naturalHeight) return false;
            const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
            const drawW = image.naturalWidth * scale;
            const drawH = image.naturalHeight * scale;
            const drawX = x + (w - drawW) / 2;
            const drawY = y + (h - drawH) / 2;
            ctx.drawImage(image, drawX, drawY, drawW, drawH);
            return true;
        }

        _drawImageContain(ctx, image, x, y, w, h, alpha = 1) {
            if (!image || !image.complete || !image.naturalWidth || !image.naturalHeight) return false;
            const scale = Math.min(w / image.naturalWidth, h / image.naturalHeight);
            const drawW = image.naturalWidth * scale;
            const drawH = image.naturalHeight * scale;
            const drawX = x + (w - drawW) / 2;
            const drawY = y + (h - drawH) / 2;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.drawImage(image, drawX, drawY, drawW, drawH);
            ctx.restore();
            return true;
        }

        _drawImageContainFlipped(ctx, image, x, y, w, h, alpha = 1) {
            if (!image || !image.complete || !image.naturalWidth || !image.naturalHeight) return false;
            const scale = Math.min(w / image.naturalWidth, h / image.naturalHeight);
            const drawW = image.naturalWidth * scale;
            const drawH = image.naturalHeight * scale;
            const drawX = x + (w - drawW) / 2;
            const drawY = y + (h - drawH) / 2;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(drawX + drawW, drawY);
            ctx.scale(-1, 1);
            ctx.drawImage(image, 0, 0, drawW, drawH);
            ctx.restore();
            return true;
        }

        _renderBackdrop(ctx) {
            const bg = this.media.background;
            const drewBg = this._drawImageCover(ctx, bg, 0, 0, LOGICAL_W, LOGICAL_H);
            if (!drewBg) {
                ctx.fillStyle = '#18130d';
                ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
            }
            const overlay = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
            overlay.addColorStop(0, 'rgba(22, 18, 12, 0.10)');
            overlay.addColorStop(0.68, 'rgba(18, 14, 10, 0.12)');
            overlay.addColorStop(1, 'rgba(10, 8, 6, 0.42)');
            ctx.fillStyle = overlay;
            ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
            ctx.fillStyle = 'rgba(118, 160, 150, 0.06)';
            for (let y = 0; y < LOGICAL_H; y += 4) {
                ctx.fillRect(0, y, LOGICAL_W, 1);
            }
            this._renderMonitorFx(ctx);
        }

        _renderShelterArt(ctx) {
            const baseY = this.building.y;
            const layout = this._getWeaponLayout();
            const { houseBox, turretLeftBox, turretRightBox, spikesBox, gridBox } = layout;
            const renderables = this.defense?.getRenderableWeapons?.() || [];
            const hasTurretLeft = renderables.some((weapon) => weapon.id === 'turret_left');
            const hasTurretRight = renderables.some((weapon) => weapon.id === 'turret_right');
            const hasSpikesLeft = renderables.some((weapon) => weapon.id === 'spikes_left');
            const hasGridRight = renderables.some((weapon) => weapon.id === 'grid_right');
            const spikeImpact = this.defense?.impacts?.spikesLeft || 0;
            const gridImpact = this.defense?.impacts?.gridRight || 0;

            ctx.save();
            ctx.fillStyle = 'rgba(0,0,0,0.28)';
            ctx.beginPath();
            ctx.ellipse(LOGICAL_W / 2, baseY + 8, 156, 22, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(82, baseY + 11, 48, 14, -0.08, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(398, baseY + 11, 48, 14, 0.08, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            this._drawImageContain(ctx, this.media.house, houseBox.x, houseBox.y, houseBox.w, houseBox.h);
            if (hasTurretLeft) this._drawImageContain(ctx, this.media.turretLeft, turretLeftBox.x, turretLeftBox.y, turretLeftBox.w, turretLeftBox.h);
            if (hasTurretRight) {
                const drewRight = this._drawImageContain(ctx, this.media.turretRight, turretRightBox.x, turretRightBox.y, turretRightBox.w, turretRightBox.h);
                if (!drewRight) {
                    this._drawImageContainFlipped(ctx, this.media.turretLeft, turretRightBox.x, turretRightBox.y, turretRightBox.w, turretRightBox.h);
                }
            }
            if (hasSpikesLeft) {
                this._drawImageContain(ctx, this.media.spikes, spikesBox.x, spikesBox.y - spikeImpact * 5, spikesBox.w, spikesBox.h);
                if (spikeImpact > 0.05) {
                    ctx.save();
                    ctx.globalAlpha = 0.28 * spikeImpact;
                    ctx.fillStyle = '#ff9b45';
                    ctx.fillRect(spikesBox.x + 26, spikesBox.y - 4 - spikeImpact * 8, 56, 22);
                    ctx.fillStyle = '#ffe4ad';
                    ctx.fillRect(spikesBox.x + 42, spikesBox.y - 10 - spikeImpact * 10, 18, 10);
                    ctx.restore();
                }
            }
            if (hasGridRight) {
                this._drawImageContain(ctx, this.media.powerGrid, gridBox.x, gridBox.y, gridBox.w, gridBox.h);
                if (gridImpact > 0.05) {
                    ctx.save();
                    ctx.globalAlpha = 0.34 * gridImpact;
                    ctx.strokeStyle = '#8cecff';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.moveTo(gridBox.x + 14, gridBox.y + 22);
                    ctx.lineTo(gridBox.x + 36, gridBox.y + 2);
                    ctx.lineTo(gridBox.x + 58, gridBox.y + 24);
                    ctx.lineTo(gridBox.x + 82, gridBox.y + 5);
                    ctx.stroke();
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(gridBox.x + 20, gridBox.y + 24);
                    ctx.lineTo(gridBox.x + 48, gridBox.y + 8);
                    ctx.lineTo(gridBox.x + 74, gridBox.y + 20);
                    ctx.stroke();
                    ctx.restore();
                }
            }

            const glow = ctx.createLinearGradient(0, houseBox.y + 6, 0, houseBox.y + houseBox.h - 8);
            glow.addColorStop(0, 'rgba(255, 214, 134, 0.08)');
            glow.addColorStop(0.55, 'rgba(255, 196, 88, 0.04)');
            glow.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = glow;
            ctx.fillRect(houseBox.x + 28, houseBox.y + 8, houseBox.w - 56, houseBox.h - 24);
        }

        _getWeaponLayout() {
            if (!this.weaponLayout) {
                this.weaponLayout = {
                    houseBox: { x: 134, y: 104, w: 212, h: 126 },
                    turretLeftBox: { x: 106, y: 150, w: 78, h: 68 },
                    turretRightBox: { x: 300, y: 150, w: 78, h: 68 },
                    spikesBox: { x: 52, y: 189, w: 104, h: 44 },
                    gridBox: { x: 328, y: 189, w: 100, h: 44 }
                };
            }
            return this.weaponLayout;
        }

        _syncDefenseLayout() {
            if (!this.defense) return;
            const layout = this._getWeaponLayout();
            this.defense.setWeaponLayout?.({
                turret_left: {
                    x: layout.turretLeftBox.x + 18,
                    y: layout.turretLeftBox.y + 22,
                    muzzleX: layout.turretLeftBox.x + 5,
                    muzzleY: layout.turretLeftBox.y + 20
                },
                turret_right: {
                    x: layout.turretRightBox.x + layout.turretRightBox.w - 18,
                    y: layout.turretRightBox.y + 22,
                    muzzleX: layout.turretRightBox.x + layout.turretRightBox.w - 5,
                    muzzleY: layout.turretRightBox.y + 20
                },
                spikes_left: {
                    x: layout.spikesBox.x + layout.spikesBox.w * 0.5,
                    y: layout.spikesBox.y + 18,
                    range: 72
                },
                grid_right: {
                    x: layout.gridBox.x + layout.gridBox.w * 0.5,
                    y: layout.gridBox.y + 18,
                    range: 76
                }
            });
        }

        _getShelterTdConfig() {
            const levelConfig = window.BuildingConfig?.getBuildingLevelConfig?.('building_shelter', this.level) || {};
            const td = levelConfig.td || {};
            return {
                weaponDamageMultiplier: Math.max(0.1, Number(td.weaponDamageMultiplier) || 1),
                weaponAttackSpeedMultiplier: Math.max(0.1, Number(td.weaponAttackSpeedMultiplier) || 0.5),
                enemySpawnMultiplier: Math.max(0.1, Number(td.enemySpawnMultiplier) || 1)
            };
        }

        _getUnlockedStageMultiplier() {
            const unlocked = Math.max(1, Number(window.dungeonManager?.getUnlockedDungeonCount?.()) || 1);
            return 1 + Math.max(0, unlocked - 1) * 0.05;
        }

        _syncTdTuning() {
            const td = this._getShelterTdConfig();
            const spawnMultiplier = 2 * this._getUnlockedStageMultiplier() * td.enemySpawnMultiplier;
            this.enemies?.setProgressMultiplier?.(spawnMultiplier);
        }

        _renderMonitorFx(ctx) {
            ctx.save();
            ctx.strokeStyle = 'rgba(114, 138, 128, 0.45)';
            ctx.lineWidth = 6;
            ctx.strokeRect(3, 3, LOGICAL_W - 6, LOGICAL_H - 6);
            ctx.strokeStyle = 'rgba(18, 22, 19, 0.9)';
            ctx.lineWidth = 2;
            ctx.strokeRect(8, 8, LOGICAL_W - 16, LOGICAL_H - 16);

            ctx.fillStyle = 'rgba(10, 14, 12, 0.48)';
            ctx.fillRect(14, 12, 116, 18);
            ctx.fillStyle = 'rgba(180, 208, 190, 0.88)';
            ctx.font = '600 10px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText('CAM 03  SHELTER OUTER', 20, 24);

            ctx.fillStyle = '#ff4b4b';
            ctx.beginPath();
            ctx.arc(LOGICAL_W - 52, LOGICAL_H - 18, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255, 235, 235, 0.92)';
            ctx.font = '600 10px sans-serif';
            ctx.fillText('REC', LOGICAL_W - 42, LOGICAL_H - 14);

            if (!this.lowPowerMode) {
                const scanY = -28 + (LOGICAL_H + 56) * this._scanlinePhase;
                const scan = ctx.createLinearGradient(0, scanY, 0, scanY + 28);
                scan.addColorStop(0, 'rgba(255,255,255,0)');
                scan.addColorStop(0.5, 'rgba(168,255,235,0.12)');
                scan.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = scan;
                ctx.fillRect(10, scanY, LOGICAL_W - 20, 28);

                if (this._scanlinePhase > 0.78 && this._scanlinePhase < 0.82) {
                    ctx.fillStyle = 'rgba(160, 255, 240, 0.08)';
                    ctx.fillRect(10, 0, LOGICAL_W - 20, LOGICAL_H);
                }
            }

            const idleText = this._formatClock(this._monitorStatus.idleSeconds || 0);
            ctx.fillStyle = 'rgba(10, 14, 12, 0.5)';
            ctx.fillRect(14, 34, 136, 34);
            ctx.fillStyle = 'rgba(196, 226, 210, 0.82)';
            ctx.font = '600 9px sans-serif';
            ctx.fillText('防线运转', 20, 46);
            ctx.fillStyle = '#f5e6bf';
            ctx.font = '700 14px monospace';
            ctx.fillText(idleText, 20, 62);

            const tapText = `协助 ${this._monitorStatus.tapCount || 0}/${this._monitorStatus.tapLimit || 200}`;
            const bonusText = `收益 +${this._monitorStatus.tapBonusPercent || 0}%`;
            ctx.fillStyle = 'rgba(10, 14, 12, 0.46)';
            ctx.fillRect(LOGICAL_W - 146, 34, 132, 34);
            ctx.fillStyle = 'rgba(170, 214, 255, 0.84)';
            ctx.font = '600 9px sans-serif';
            ctx.fillText(tapText, LOGICAL_W - 138, 46);
            ctx.fillStyle = '#ffe07a';
            ctx.font = '700 11px sans-serif';
            ctx.fillText(bonusText, LOGICAL_W - 138, 61);

            this._renderChestHud(ctx);
            ctx.restore();
        }

        _renderChestHud(ctx) {
            const pulse = 0.85 + Math.sin(window.performance.now() * 0.004) * 0.1;
            const x = LOGICAL_W - 62;
            const y = 78;
            const ready = (this._monitorStatus.idleSeconds || 0) >= 3600;
            ctx.save();
            ctx.translate(x, y);
            if (ready) {
                ctx.shadowColor = 'rgba(255, 214, 92, 0.85)';
                ctx.shadowBlur = 14 * pulse;
            }
            ctx.fillStyle = ready ? '#d59a34' : '#6b5737';
            ctx.fillRect(-18, -8, 36, 24);
            ctx.fillStyle = ready ? '#f0c865' : '#89704a';
            ctx.fillRect(-18, -8, 36, 7);
            ctx.fillStyle = '#4a2f17';
            ctx.fillRect(-4, -8, 8, 24);
            ctx.fillStyle = '#e8d8a4';
            ctx.fillRect(-5, 1, 10, 7);
            ctx.fillStyle = '#20150d';
            ctx.fillRect(-2, 3, 4, 3);
            ctx.restore();

            ctx.textAlign = 'center';
            if (ready) {
                ctx.fillStyle = 'rgba(255, 236, 178, 0.96)';
                ctx.font = '700 10px sans-serif';
                ctx.fillText('\u5f85\u9886\u53d6', x, y + 27);
            }
            ctx.textAlign = 'left';
        }

        _formatClock(totalSeconds) {
            const sec = Math.max(0, Math.floor(Number(totalSeconds) || 0));
            const h = String(Math.floor(sec / 3600)).padStart(2, '0');
            const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
            const s = String(sec % 60).padStart(2, '0');
            return `${h}:${m}:${s}`;
        }

        _shouldUseLowPowerMode() {
            const isNativeApp = Boolean(window.Capacitor && (
                typeof window.Capacitor.isNativePlatform === 'function'
                    ? window.Capacitor.isNativePlatform()
                    : true
            ));
            const ua = navigator.userAgent || '';
            return isNativeApp || /Android|iPhone|iPad|iPod/i.test(ua);
        }

        destroy() {
            this.pause();
            if (this._visHandler) document.removeEventListener('visibilitychange', this._visHandler);
            if (this.wrapper && this.wrapper.parentElement) this.wrapper.parentElement.removeChild(this.wrapper);
            this.wrapper = null; this.canvas = null; this.ctx = null;
            this.systemsBuilt = false; this._eventsBound = false;
        }

        playCollectBurst() {
            for (let i = 0; i < 10; i++) {
                setTimeout(() => {
                    this.drops.drop(this.building.x + (Math.random() - 0.5) * 50, this.building.y - 70, 'normal');
                }, i * 50);
            }
            this.particles.floatText(this.building.x, this.building.y - 90, 'COLLECT!', '#ffd24a');
            this._flashTimer = 0.15;
            this.shake(2, 0.2);
        }
    }

    window.ShelterTD.ShelterTDScene = ShelterTDScene;
})();
