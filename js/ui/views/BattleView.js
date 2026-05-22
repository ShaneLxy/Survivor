/**
 * 战斗场景视图
 */
class BattleView {
    constructor() {
        this.element = document.getElementById('main-display');
        this.visible = false;
        this.battleSessionId = 0;
        this.unsubscribeState = null;
        this.pendingAction = null;
        this.selectionMode = null;
        this.currentDungeon = null;
        this.itemSelectModal = null;
        this.pauseModal = null;
        this.isPaused = false;
        this.skipBattleRequested = false;
        this.selectedSkillIndex = null;
        this.selectedBattleItemId = null;
        this.inspectedUnitId = null;
        this.inspectedSpecialTile = null;
        this.inspectedObstacle = null;
        this.isFallenTrayOpen = false;
        // 动画系统相关
        this.animationLayer = null;
        this.lastUnitPositions = new Map();
        this.isAnimating = false;
        this.moveUnsubscribe = null;
        this.actionUnsubscribe = null;
        this.dieUnsubscribe = null;
        // 动画队列系统：确保行动表现串行完成
        this.actionQueue = [];
        this.isProcessingAction = false;
        this.actionQueueWaiters = [];
        // 进度条显示缓存：仅在单位行动结束后同步到UI
        this.progressTokenMap = new Map();
        this.progressValueMap = new Map();
        this.displayProgressMap = new Map();
        this.hpTrailMap = new Map();
        this.hpTrailTimers = new Map();
        this.combatTextBurstMap = new Map();
        this.effectTimers = new Set();
        this.environmentCanvas = null;
        this.environmentParticleCanvas = null;
        this.environmentContext = null;
        this.environmentAnimationFrame = null;
        this.environmentResizeObserver = null;
        this.environmentParticles = [];
        this.environmentEffectType = 'none';
        this.environmentLastTime = 0;
        this.environmentBounds = { width: 0, height: 0 };
        this.environmentFlashAlpha = 0;
        this.environmentFlashCooldown = 0;
        this.environmentFlashStartX = 0;
        this.heroTurnPromptTimer = null;
        this.lastHeroTurnPromptKey = '';
        this.battleStateRenderFrame = null;
        this.lastBoardRenderKey = '';

    }

    show() {
        this.visible = true;
    }

    hide() {
        this.visible = false;
        this.stopBattle();
        this.clearHeroTurnPrompt();
        this.element.style.height = '';
        this.element.style.minHeight = '';
        this.element.innerHTML = '';
    }

    resolveAssetUrl(path) {
        return path ? (window.VersionManager?.getVersionedAssetUrl?.(path) || path) : '';
    }

    renderObstacleMarkup(obstacle) {
        const obstacleName = obstacle?.name || '障碍物';
        const iconSrc = this.resolveAssetUrl(obstacle?.iconSrc || 'assets/images/battle/obstacle-barricade.png');
        const visual = iconSrc
            ? `<img class="battle-obstacle-image" src="${iconSrc}" alt="${obstacleName}">`
            : `<span class="battle-obstacle-icon">${obstacle?.icon || '■'}</span>`;
        return `
            <div class="battle-obstacle-token" aria-hidden="true">
                ${visual}
            </div>
        `;
    }

    renderSpecialTileMarkup(tile) {
        if (!tile) {
            return '';
        }
        return `
            <div class="battle-special-tile-mark battle-special-tile-${tile.type}" title="${tile.name || ''}" aria-hidden="true">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;
    }

    renderWarningMarkup(warning) {
        if (!warning) {
            return '';
        }
        return `
            <div class="battle-warning-tile-mark" title="${warning.skillName || ''}" aria-hidden="true">
                <span>${Math.max(1, Number(warning.remainingTurns) || 1)}</span>
            </div>
        `;
    }

    async startBattle(dungeonId, sceneId = 'standard_9x9') {
        const dungeon = dungeonManager.getDungeon(dungeonId);
        if (!dungeon) {
            Toast.error('副本不存在');
            eventManager.emit('viewChange', { view: 'dungeon' });
            return;
        }

        const heroes = heroManager.createBattleUnits();
        const battleSetup = dungeon.createBattleSetup();
        const battlefield = battleSetup.battlefield || null;
        const enemies = battleSetup.initialEnemies || [];
        const bossWaves = battleSetup.bossWaves || [];
        const totalEnemyCount = enemies.length + bossWaves.reduce((sum, wave) => sum + (wave.bosses || []).length, 0);
        if (heroes.length === 0) {
            Toast.error('没有可战斗的英雄');
            eventManager.emit('viewChange', { view: 'dungeon' });
            return;
        }
        if (totalEnemyCount === 0) {
            Toast.error('没有敌人');
            eventManager.emit('viewChange', { view: 'dungeon' });
            return;
        }

        this.currentDungeon = dungeon;
        this.isPaused = false;
        this.skipBattleRequested = false;
        this.closePauseModal();
        this.actionQueue = [];
        this.isProcessingAction = false;
        this.actionQueueWaiters = [];
        this.lastUnitPositions.clear();
        this.lastBoardRenderKey = '';
        this.progressTokenMap = new Map();
        this.progressValueMap = new Map();
        this.displayProgressMap = new Map();
        this.hpTrailMap = new Map();
        this.clearHpTrailTimers();
        this.combatTextBurstMap = new Map();
        this.clearBattleEffectTimers();
        this.stopEnvironmentEffect();
        this.inspectedUnitId = null;
        this.inspectedSpecialTile = null;
        this.inspectedObstacle = null;
        this.selectedSkillIndex = null;
        this.selectedBattleItemId = null;
        this.battleSessionId++;
        battleManager.initBattle({
            heroes,
            enemies,
            bossWaves,
            sceneId: dungeon.sceneId || sceneId,
            battlefield,
            environmentEffect: battleSetup.environmentEffect || dungeon.environmentEffect
        });


        battleManager.setDecisionProvider(context => this.requestPlayerAction(context));
        this.renderShell();
        this.startEnvironmentEffect(battleManager.getSnapshot()?.environmentEffect || battleSetup.environmentEffect);
        this.subscribeBattleEvents();
        this.renderBattleState();

        const result = await battleManager.executeBattle();
        if (!this.visible || !result) {
            return;
        }
        await this.onBattleEnd(result, dungeon);
    }

    subscribeBattleEvents() {
        if (this.unsubscribeState) {
            this.unsubscribeState();
        }
        this.unsubscribeState = eventManager.on('battleStateChange', () => {
            if (this.visible) {
                this.requestBattleStateRender();
            }
        });
        // 监听移动事件 - 入队，串行执行
        if (this.moveUnsubscribe) {
            this.moveUnsubscribe();
        }
        this.moveUnsubscribe = eventManager.on('battleUnitMove', (data) => {
            if (this.visible && data.unit && data.position) {
                const oldPos = data.fromPosition || this.lastUnitPositions.get(data.unit.id);
                this.actionQueue.push({ type: 'move', data, oldPos });
                this.processActionQueue();
            }
        });

        // 监听攻击/行动事件 - 入队
        if (this.actionUnsubscribe) {
            this.actionUnsubscribe();
        }
        this.actionUnsubscribe = eventManager.on('battleUnitAction', (data) => {
            if (this.visible && data.attacker) {
                const isAttack = data.actionType === 'attack' || data.actionType === 'skill';
                if (isAttack && data.target) {
                    this.actionQueue.push({ type: 'attack', data });
                    this.processActionQueue();
                } else if (data.actionType === 'item' && data.target) {
                    this.actionQueue.push({ type: 'heal', data });
                    this.processActionQueue();
                } else if ((data.actionType === 'status' || data.actionType === 'status_expire') && data.target) {
                    this.actionQueue.push({ type: 'status', data });
                    this.processActionQueue();
                }
            }
        });
        // 监听死亡事件 - 入队
        if (this.dieUnsubscribe) {
            this.dieUnsubscribe();
        }
        this.dieUnsubscribe = eventManager.on('battleUnitDie', (data) => {
            if (this.visible && data.unit) {
                this.actionQueue.push({ type: 'die', data });
                this.processActionQueue();
            }
        });
    }

    renderShell() {
        this.element.innerHTML = `
            <div class="battle-view battle-grid-view">
                <div id="battle-boss-alert" class="battle-boss-alert" aria-hidden="true" style="position:absolute;inset:0;pointer-events:none;">
                    <div class="battle-boss-alert-banner">领主登场!</div>
                </div>
                  <div class="battle-top-panel">
                      <div class="battle-hud-bar">
                        <button class="btn btn-secondary battle-pause-btn battle-pause-icon-btn" onclick="window.game.ui.battleView.pauseBattle()" aria-label="暂停" title="暂停">II</button>
                          <div class="battle-hud-meta">
                              <div class="battle-hud-kicker">TACTICAL ROUND</div>
                              <div id="battle-turn-meta" class="battle-turn-meta"></div>
                          </div>
                          <div id="battle-countdown-chip" class="battle-countdown-chip" aria-live="polite">待机</div>
                      </div>
                    <div id="battle-progress-track" class="battle-progress-track"></div>
                </div>
                <div class="battle-main-panel" style="position: relative;">
                    <div id="battle-board-container" style="position:relative;min-width:0;min-height:0;width:100%;height:100%;">
                        <div class="battle-board-stage">
                            <div id="battle-board" class="battle-board"></div>
                            <div id="battle-environment-layer" class="battle-environment-layer" aria-hidden="true"></div>
                            <div id="battle-animation-layer" class="battle-animation-layer"></div>
                        </div>
                    </div>
                    <div id="battle-turn-prompt" class="battle-turn-prompt" aria-live="polite" aria-hidden="true"></div>
                    <div class="battle-bottom-panel">
                        <button id="battle-fallen-toggle" class="battle-fallen-toggle is-disabled" onclick="window.game.ui.battleView.toggleFallenTray()" aria-expanded="false" aria-label="&#26242;&#26080;&#38453;&#20129;&#33521;&#38596;">
                            <span class="battle-fallen-toggle-label">&#38453;&#20129;</span>
                            <span class="battle-fallen-toggle-count">0</span>
                        </button>
                        <div id="battle-action-panel" class="battle-action-panel"></div>
                        <div id="battle-detail-panel" class="battle-detail-panel"></div>
                    </div>
                </div>
                <div id="battle-fallen-tray" class="battle-fallen-tray" aria-hidden="true"></div>
            </div>
        `;

        this.animationLayer = this.element.querySelector('#battle-animation-layer');
        this.environmentCanvas = this.element.querySelector('#battle-environment-layer');
        this.environmentParticleCanvas = null;
        const board = this.element.querySelector('#battle-board');
        if (board) {
            board.onclick = (event) => {
                const cell = event.target?.closest?.('.battle-cell');
                if (!cell || !board.contains(cell) || cell.disabled) {
                    return;
                }
                this.handleBoardCellClick(Number(cell.dataset.x), Number(cell.dataset.y));
            };
        }
    }

    normalizeEnvironmentEffect(effect) {
        const rawType = typeof effect === 'object' && effect !== null
            ? (effect.type || effect.id || effect.effect || 'none')
            : effect;
        const type = String(rawType || 'none').trim().toLowerCase().replace(/[\s-]+/g, '_');
        const aliases = {
            poison: 'poison_fog',
            toxic: 'poison_fog',
            toxic_fog: 'poison_fog',
            dust: 'dust_smoke',
            sand: 'dust_smoke',
            storm: 'storm_night',
            stormnight: 'storm_night',
            heavy_rain: 'storm_night',
            lightning_rain: 'storm_night',
            ember: 'ash',
            embers: 'ash',
            cinder: 'ash',
            cinders: 'ash',
            ashes: 'ash',
            black_ash: 'ash'
        };
        const normalized = aliases[type] || type;
        return ['smoke', 'rain', 'snow', 'poison_fog', 'dust_smoke', 'storm_night', 'ash'].includes(normalized) ? normalized : 'none';
    }

    startEnvironmentEffect(effect) {
        this.stopEnvironmentEffect();
        const type = this.normalizeEnvironmentEffect(effect);
        this.environmentEffectType = type;
        if (type === 'none' || !this.environmentCanvas || window.game?.settings?.environmentEffectsDisabled) {
            return;
        }

        const layer = this.environmentCanvas;
        layer.dataset.effect = type;
        layer.classList.add('is-running');
        const view = this.element?.querySelector('.battle-view');
        const stage = this.element?.querySelector('.battle-board-stage');
        const board = this.element?.querySelector('.battle-board');
        if (view) view.dataset.environment = type;
        if (stage) stage.dataset.environment = type;
        if (board) board.dataset.environment = type;
        if (['smoke', 'poison_fog', 'dust_smoke'].includes(type)) {
            layer.innerHTML = '<canvas class="battle-environment-canvas"></canvas>';
            this.environmentParticleCanvas = layer.querySelector('.battle-environment-canvas');
            this.environmentContext = this.environmentParticleCanvas?.getContext?.('2d') || null;
            this.environmentFlashStartX = 0;
            if (this.environmentContext) {
                this.resizeEnvironmentCanvas(true);
                if (window.ResizeObserver) {
                    this.environmentResizeObserver = new ResizeObserver(() => this.resizeEnvironmentCanvas(false));
                    this.environmentResizeObserver.observe(layer);
                }
                this.environmentLastTime = performance.now();
                const tick = (time) => {
                    if (!this.environmentParticleCanvas || !this.environmentContext || this.environmentEffectType !== type) {
                        this.environmentAnimationFrame = null;
                        return;
                    }
                    if (time - this.environmentLastTime < 32) {
                        this.environmentAnimationFrame = requestAnimationFrame(tick);
                        return;
                    }
                    const delta = Math.min(0.045, Math.max(0.001, (time - this.environmentLastTime) / 1000));
                    this.environmentLastTime = time;
                    this.updateEnvironmentParticles(delta);
                    this.drawEnvironmentParticles();
                    this.environmentAnimationFrame = requestAnimationFrame(tick);
                };
                this.environmentAnimationFrame = requestAnimationFrame(tick);
            }
            return;
        }
        layer.innerHTML = this.renderEnvironmentEffectMarkup(type);
        this.environmentParticleCanvas = null;
        this.environmentContext = null;
        this.environmentFlashStartX = 0;
    }

    renderEnvironmentEffectMarkup(type) {
        const randomBetween = (min, max) => min + Math.random() * (max - min);
        const isCompact = Math.min(window.innerWidth || 390, window.innerHeight || 720) <= 430;
        const styleText = (styles) => Object.entries(styles)
            .map(([key, value]) => `${key}:${value}`)
            .join(';');
        const particles = [];

        if (type === 'rain' || type === 'storm_night') {
            const isStorm = type === 'storm_night';
            const count = isStorm ? (isCompact ? 48 : 64) : (isCompact ? 30 : 42);
            for (let i = 0; i < count; i++) {
                const duration = randomBetween(isStorm ? 0.72 : 0.95, isStorm ? 1.35 : 1.8);
                particles.push(`<span class="battle-weather-particle battle-weather-rain" style="${styleText({
                    left: `${randomBetween(-18, 118).toFixed(2)}%`,
                    top: `${randomBetween(-42, 106).toFixed(2)}%`,
                    '--rain-len': `${randomBetween(isStorm ? 30 : 15, isStorm ? 58 : 30).toFixed(1)}px`,
                    '--rain-width': `${randomBetween(isStorm ? 1.05 : 0.65, isStorm ? 1.9 : 1.15).toFixed(2)}px`,
                    '--rain-drift': `${randomBetween(isStorm ? -24 : -14, isStorm ? -10 : -5).toFixed(1)}vw`,
                    '--weather-opacity': randomBetween(isStorm ? 0.38 : 0.2, isStorm ? 0.72 : 0.44).toFixed(2),
                    '--weather-duration': `${duration.toFixed(2)}s`,
                    '--weather-delay': `${(-randomBetween(0, duration)).toFixed(2)}s`
                })}"></span>`);
            }
            if (isStorm) {
                for (let i = 0; i < 2; i++) {
                    const duration = randomBetween(4.8, 7.8);
                    const delay = -randomBetween(0, duration);
                    const left = randomBetween(22, 72);
                    particles.push(`
                        <span class="battle-weather-flash" style="${styleText({
                            '--weather-duration': `${duration.toFixed(2)}s`,
                            '--weather-delay': `${delay.toFixed(2)}s`
                        })}"></span>
                        <svg class="battle-weather-lightning" viewBox="0 0 28 120" preserveAspectRatio="none" style="${styleText({
                            left: `${left.toFixed(1)}%`,
                            '--weather-duration': `${duration.toFixed(2)}s`,
                            '--weather-delay': `${delay.toFixed(2)}s`
                        })}" aria-hidden="true">
                            <polyline points="14,0 22,28 10,48 20,76 7,120"></polyline>
                        </svg>
                    `);
                }
            }
            return particles.join('');
        }

        if (type === 'snow') {
            const count = isCompact ? 24 : 34;
            for (let i = 0; i < count; i++) {
                const duration = randomBetween(5.8, 10.5);
                particles.push(`<span class="battle-weather-particle battle-weather-snow" style="${styleText({
                    left: `${randomBetween(-6, 106).toFixed(2)}%`,
                    top: `${randomBetween(-34, 102).toFixed(2)}%`,
                    '--snow-size': `${randomBetween(2.2, 5.2).toFixed(1)}px`,
                    '--snow-drift-a': `${randomBetween(-5, 5).toFixed(1)}vw`,
                    '--snow-drift-b': `${randomBetween(-8, 8).toFixed(1)}vw`,
                    '--weather-opacity': randomBetween(0.34, 0.72).toFixed(2),
                    '--weather-duration': `${duration.toFixed(2)}s`,
                    '--weather-delay': `${(-randomBetween(0, duration)).toFixed(2)}s`
                })}"></span>`);
            }
            return particles.join('');
        }

        if (type === 'ash') {
            const count = isCompact ? 34 : 52;
            const ashColors = [
                'rgba(18, 18, 16, 0.82)',
                'rgba(39, 37, 34, 0.78)',
                'rgba(66, 61, 54, 0.66)',
                'rgba(96, 88, 76, 0.52)'
            ];
            for (let i = 0; i < count; i++) {
                const duration = randomBetween(5.8, 11.8);
                const isEmber = Math.random() < 0.14;
                const spin = randomBetween(isEmber ? 80 : 140, isEmber ? 240 : 480);
                const opacity = randomBetween(isEmber ? 0.38 : 0.26, isEmber ? 0.72 : 0.58);
                particles.push(`<span class="battle-weather-particle battle-weather-ash ${isEmber ? 'is-ember' : ''}" style="${styleText({
                    left: `${randomBetween(-10, 108).toFixed(2)}%`,
                    top: `${randomBetween(-42, 104).toFixed(2)}%`,
                    '--ash-width': `${randomBetween(isEmber ? 1.5 : 2.1, isEmber ? 3.2 : 5.2).toFixed(1)}px`,
                    '--ash-height': `${randomBetween(isEmber ? 1.5 : 1.1, isEmber ? 3.2 : 3.4).toFixed(1)}px`,
                    '--ash-color': isEmber ? 'rgba(249, 115, 22, 0.86)' : ashColors[Math.floor(randomBetween(0, ashColors.length))],
                    '--ash-drift-a': `${randomBetween(-7, 9).toFixed(1)}vw`,
                    '--ash-drift-b': `${randomBetween(-14, 16).toFixed(1)}vw`,
                    '--ash-rotate': `${randomBetween(0, 360).toFixed(1)}deg`,
                    '--ash-spin-mid': `${(spin * 0.48).toFixed(1)}deg`,
                    '--ash-spin': `${spin.toFixed(1)}deg`,
                    '--weather-opacity': opacity.toFixed(2),
                    '--ash-opacity-mid': (opacity * 0.92).toFixed(2),
                    '--ash-opacity-low': (opacity * 0.72).toFixed(2),
                    '--weather-duration': `${duration.toFixed(2)}s`,
                    '--weather-delay': `${(-randomBetween(0, duration)).toFixed(2)}s`
                })}"></span>`);
            }
            return particles.join('');
        }

        if (['smoke', 'poison_fog', 'dust_smoke'].includes(type)) {
            const count = isCompact ? 10 : 14;
            for (let i = 0; i < count; i++) {
                const duration = randomBetween(8.5, 15.5);
                const alpha = randomBetween(type === 'dust_smoke' ? 0.22 : 0.18, type === 'poison_fog' ? 0.36 : 0.32);
                particles.push(`<span class="battle-weather-particle battle-weather-fog battle-weather-fog-${type}" style="${styleText({
                    left: `${randomBetween(-28, 96).toFixed(2)}%`,
                    top: `${randomBetween(6, 88).toFixed(2)}%`,
                    width: `${randomBetween(34, 76).toFixed(1)}%`,
                    height: `${randomBetween(11, 22).toFixed(1)}%`,
                    '--fog-drift': `${randomBetween(18, 72).toFixed(1)}vw`,
                    '--fog-rise': `${randomBetween(-8, 6).toFixed(1)}vh`,
                    '--fog-scale': randomBetween(1.05, 1.32).toFixed(2),
                    '--fog-alpha': alpha.toFixed(2),
                    '--fog-alpha-low': (alpha * 0.38).toFixed(2),
                    '--weather-duration': `${duration.toFixed(2)}s`,
                    '--weather-delay': `${(-randomBetween(0, duration)).toFixed(2)}s`
                })}"></span>`);
            }
            return particles.join('');
        }

        return '';
    }

    stopEnvironmentEffect() {
        if (this.environmentAnimationFrame) {
            cancelAnimationFrame(this.environmentAnimationFrame);
            this.environmentAnimationFrame = null;
        }
        if (this.environmentResizeObserver) {
            this.environmentResizeObserver.disconnect();
            this.environmentResizeObserver = null;
        }
        if (this.environmentContext && this.environmentBounds.width && this.environmentBounds.height) {
            this.environmentContext.clearRect(0, 0, this.environmentBounds.width, this.environmentBounds.height);
        }
        if (this.environmentCanvas) {
            delete this.environmentCanvas.dataset.effect;
            this.environmentCanvas.classList.remove('is-running');
            this.environmentCanvas.innerHTML = '';
            this.environmentParticleCanvas = null;
        }
        const view = this.element?.querySelector('.battle-view');
        const stage = this.element?.querySelector('.battle-board-stage');
        const board = this.element?.querySelector('.battle-board');
        if (view) delete view.dataset.environment;
        if (stage) delete stage.dataset.environment;
        if (board) delete board.dataset.environment;
        this.environmentParticleCanvas = null;
        this.environmentContext = null;
        this.environmentParticles = [];
        this.environmentEffectType = 'none';
        this.environmentBounds = { width: 0, height: 0 };
        this.environmentFlashAlpha = 0;
        this.environmentFlashCooldown = 0;
        this.environmentFlashStartX = 0;
    }

    resizeEnvironmentCanvas(resetParticles = false) {
        const canvas = this.environmentParticleCanvas;
        if (!canvas || !this.environmentContext) {
            return;
        }
        const rect = canvas.getBoundingClientRect();
        const width = Math.max(1, Math.round(rect.width));
        const height = Math.max(1, Math.round(rect.height));
        const pixelRatio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
        const nextWidth = Math.round(width * pixelRatio);
        const nextHeight = Math.round(height * pixelRatio);
        if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
            canvas.width = nextWidth;
            canvas.height = nextHeight;
            this.environmentContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
            resetParticles = true;
        }
        this.environmentBounds = { width, height };
        if (resetParticles || this.environmentParticles.length === 0) {
            this.resetEnvironmentParticles();
        }
    }

    resetEnvironmentParticles() {
        const { width, height } = this.environmentBounds;
        if (!width || !height || this.environmentEffectType === 'none') {
            this.environmentParticles = [];
            return;
        }
        const areaFactor = Math.max(0.62, Math.min(1.18, (width * height) / (360 * 520)));
        const counts = {
            smoke: Math.round(14 * areaFactor),
            poison_fog: Math.round(16 * areaFactor),
            dust_smoke: Math.round(18 * areaFactor),
            rain: Math.round(34 * areaFactor),
            storm_night: Math.round(62 * areaFactor),
            snow: Math.round(30 * areaFactor)
        };
        const count = counts[this.environmentEffectType] || 0;
        this.environmentFlashAlpha = 0;
        this.environmentFlashCooldown = this.environmentEffectType === 'storm_night'
            ? 1.6 + Math.random() * 2.8
            : 0;
        this.environmentParticles = Array.from({ length: count }, () =>
            this.createEnvironmentParticle(this.environmentEffectType, true)
        );
    }

    createEnvironmentParticle(type, initial = false) {
        const { width, height } = this.environmentBounds;
        const randomBetween = (min, max) => min + Math.random() * (max - min);
        if (type === 'rain' || type === 'storm_night') {
            const isStorm = type === 'storm_night';
            return {
                x: randomBetween(-width * 0.18, width * 1.16),
                y: initial ? randomBetween(-height * 0.12, height * 1.05) : randomBetween(-52, -10),
                length: isStorm ? randomBetween(30, 58) : randomBetween(13, 28),
                speed: isStorm ? randomBetween(560, 900) : randomBetween(330, 520),
                drift: isStorm ? randomBetween(-162, -82) : randomBetween(-82, -38),
                alpha: isStorm ? randomBetween(0.34, 0.7) : randomBetween(0.18, 0.42),
                width: isStorm ? randomBetween(1, 1.9) : randomBetween(0.7, 1.15)
            };
        }
        if (type === 'snow') {
            return {
                x: randomBetween(-20, width + 20),
                y: initial ? randomBetween(-height * 0.08, height * 1.05) : randomBetween(-30, -6),
                radius: randomBetween(0.9, 2.4),
                speed: randomBetween(16, 38),
                drift: randomBetween(-10, 14),
                sway: randomBetween(5, 17),
                phase: randomBetween(0, Math.PI * 2),
                alpha: randomBetween(0.3, 0.68)
            };
        }
        const fogProfiles = {
            smoke: {
                x: [width * 0.04, width * 0.96],
                y: [height * 0.16, height * 1.08],
                freshY: [height * 0.74, height * 1.08],
                radius: [20, 52],
                speed: [8, 20],
                drift: [-10, 10],
                duration: [6.2, 10.5],
                alpha: [0.1, 0.23],
                scale: [0.84, 1.36],
                grow: 6.2
            },
            poison_fog: {
                x: [width * 0.02, width * 0.98],
                y: [height * 0.08, height * 1.05],
                freshY: [height * 0.62, height * 1.08],
                radius: [24, 62],
                speed: [5, 14],
                drift: [-16, 18],
                duration: [7.2, 12.5],
                alpha: [0.1, 0.22],
                scale: [0.92, 1.48],
                grow: 5.4
            },
            dust_smoke: {
                x: [-width * 0.08, width * 0.98],
                y: [height * 0.18, height * 1.04],
                freshY: [height * 0.58, height * 1.02],
                radius: [12, 34],
                speed: [6, 16],
                drift: [18, 58],
                duration: [4.8, 8.2],
                alpha: [0.12, 0.27],
                scale: [0.78, 1.18],
                grow: 4.7
            }
        };
        const profile = fogProfiles[type] || fogProfiles.smoke;
        return {
            x: randomBetween(profile.x[0], profile.x[1]),
            y: initial ? randomBetween(profile.y[0], profile.y[1]) : randomBetween(profile.freshY[0], profile.freshY[1]),
            radius: randomBetween(profile.radius[0], profile.radius[1]),
            speed: randomBetween(profile.speed[0], profile.speed[1]),
            drift: randomBetween(profile.drift[0], profile.drift[1]),
            life: initial ? randomBetween(0, 1) : 0,
            duration: randomBetween(profile.duration[0], profile.duration[1]),
            alpha: randomBetween(profile.alpha[0], profile.alpha[1]),
            scale: randomBetween(profile.scale[0], profile.scale[1]),
            grow: profile.grow,
            lobes: Array.from({ length: 3 }, () => ({
                x: randomBetween(-0.62, 0.62),
                y: randomBetween(-0.34, 0.34),
                radius: randomBetween(0.52, 1.08),
                alpha: randomBetween(0.46, 1)
            }))
        };
    }

    updateEnvironmentParticles(delta) {
        if (!this.environmentParticles.length) {
            return;
        }
        const { width, height } = this.environmentBounds;
        const type = this.environmentEffectType;
        if (type === 'storm_night') {
            this.environmentFlashCooldown -= delta;
            if (this.environmentFlashCooldown <= 0) {
                this.environmentFlashAlpha = 0.62 + Math.random() * 0.26;
                this.environmentFlashStartX = width * (0.22 + Math.random() * 0.46);
                this.environmentFlashCooldown = 2.2 + Math.random() * 4.8;
            }
            this.environmentFlashAlpha = Math.max(0, this.environmentFlashAlpha - delta * 2.8);
        }
        this.environmentParticles = this.environmentParticles.map((particle) => {
            if (type === 'rain' || type === 'storm_night') {
                particle.x += particle.drift * delta;
                particle.y += particle.speed * delta;
                if (particle.y > height + particle.length || particle.x < -80) {
                    return this.createEnvironmentParticle(type);
                }
                return particle;
            }
            if (type === 'snow') {
                particle.phase += delta * 1.8;
                particle.x += (particle.drift + Math.sin(particle.phase) * particle.sway) * delta;
                particle.y += particle.speed * delta;
                if (particle.y > height + 12 || particle.x < -36 || particle.x > width + 36) {
                    return this.createEnvironmentParticle(type);
                }
                return particle;
            }
            particle.life += delta / particle.duration;
            particle.x += particle.drift * delta;
            particle.y -= particle.speed * delta;
            particle.radius += delta * (particle.grow || 5.5);
            if (particle.life >= 1 || particle.y < -particle.radius || particle.x > width + particle.radius) {
                return this.createEnvironmentParticle(type);
            }
            return particle;
        });
    }

    drawEnvironmentParticles() {
        const context = this.environmentContext;
        const { width, height } = this.environmentBounds;
        if (!context || !width || !height) {
            return;
        }
        context.clearRect(0, 0, width, height);
        const type = this.environmentEffectType;
        if (type === 'storm_night') {
            context.save();
            context.fillStyle = 'rgba(4, 10, 24, 0.32)';
            context.fillRect(0, 0, width, height);
            context.restore();
        }
        if (type === 'rain' || type === 'storm_night') {
            context.save();
            context.lineCap = 'round';
            this.environmentParticles.forEach((particle) => {
                context.globalAlpha = particle.alpha;
                context.strokeStyle = type === 'storm_night'
                    ? 'rgba(190, 218, 255, 0.92)'
                    : 'rgba(176, 213, 255, 0.84)';
                context.lineWidth = particle.width;
                context.beginPath();
                context.moveTo(particle.x, particle.y);
                context.lineTo(particle.x + particle.drift * 0.05, particle.y + particle.length);
                context.stroke();
            });
            context.restore();
            if (type === 'storm_night' && this.environmentFlashAlpha > 0) {
                context.save();
                context.globalAlpha = this.environmentFlashAlpha;
                context.fillStyle = 'rgba(210, 230, 255, 0.42)';
                context.fillRect(0, 0, width, height);
                context.strokeStyle = 'rgba(230, 242, 255, 0.82)';
                context.lineWidth = Math.max(1.2, width * 0.006);
                context.beginPath();
                const startX = this.environmentFlashStartX || width * 0.5;
                context.moveTo(startX, 0);
                context.lineTo(startX + width * 0.07, height * 0.18);
                context.lineTo(startX - width * 0.02, height * 0.34);
                context.lineTo(startX + width * 0.1, height * 0.52);
                context.stroke();
                context.restore();
            }
            return;
        }
        if (type === 'snow') {
            context.save();
            this.environmentParticles.forEach((particle) => {
                context.globalAlpha = particle.alpha;
                context.fillStyle = 'rgba(235, 248, 255, 0.94)';
                context.beginPath();
                context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
                context.fill();
            });
            context.restore();
            return;
        }
        context.save();
        if (type === 'poison_fog') {
            context.fillStyle = 'rgba(31, 82, 45, 0.08)';
            context.fillRect(0, 0, width, height);
        } else if (type === 'dust_smoke') {
            context.fillStyle = 'rgba(126, 92, 54, 0.07)';
            context.fillRect(0, 0, width, height);
        }
        const palettes = {
            smoke: [
                [0, '190, 190, 178', 1],
                [0.42, '126, 132, 124', 0.78],
                [1, '126, 132, 124', 0]
            ],
            poison_fog: [
                [0, '126, 218, 92', 0.92],
                [0.46, '44, 132, 57', 0.72],
                [1, '18, 73, 38', 0]
            ],
            dust_smoke: [
                [0, '222, 174, 103', 0.92],
                [0.48, '143, 105, 63', 0.72],
                [1, '96, 72, 48', 0]
            ]
        };
        const palette = palettes[type] || palettes.smoke;
        this.environmentParticles.forEach((particle) => {
            const fade = Math.sin(Math.min(1, particle.life) * Math.PI);
            const radius = Math.max(8, particle.radius * particle.scale);
            const lobes = particle.lobes?.length ? particle.lobes : [{ x: 0, y: 0, radius: 1, alpha: 1 }];
            lobes.forEach((lobe) => {
                const lobeRadius = radius * lobe.radius;
                const x = particle.x + lobe.x * radius;
                const y = particle.y + lobe.y * radius;
                const gradient = context.createRadialGradient(x, y, 0, x, y, lobeRadius);
                palette.forEach(([stop, color, alphaScale]) => {
                    gradient.addColorStop(stop, `rgba(${color}, ${particle.alpha * fade * alphaScale * lobe.alpha})`);
                });
                context.fillStyle = gradient;
                context.fillRect(x - lobeRadius, y - lobeRadius, lobeRadius * 2, lobeRadius * 2);
            });
        });
        context.restore();
    }

    async playBossEntrance(payload = {}) {
        const alert = this.element.querySelector('#battle-boss-alert');
        if (!alert) {
            await new Promise(resolve => setTimeout(resolve, payload.duration || 2000));
            return;
        }
        const text = alert.querySelector('.battle-boss-alert-banner');
        if (text) {
            text.textContent = payload.message || '领主登场!';
        }
        alert.classList.remove('active');
        void alert.offsetWidth;
        alert.classList.add('active');
        await new Promise(resolve => setTimeout(resolve, payload.duration || 2000));
        alert.classList.remove('active');
    }

    requestBattleStateRender() {
        if (!this.visible || this.battleStateRenderFrame) {
            return;
        }
        this.battleStateRenderFrame = requestAnimationFrame(() => {
            this.battleStateRenderFrame = null;
            this.renderBattleState();
        });
    }

    cancelBattleStateRender() {
        if (this.battleStateRenderFrame) {
            cancelAnimationFrame(this.battleStateRenderFrame);
            this.battleStateRenderFrame = null;
        }
    }

    renderBattleState() {

        if (!this.visible) {
            return;
        }
        const snapshot = battleManager.getSnapshot();
        this.syncBattleEffectsDisabledClass();
        this.syncHeroTurnPresentation(snapshot);
        this.renderTurnMeta(snapshot);
        this.syncCurrentActorUnitMarkers(snapshot.currentActorId);
        if (this.isProcessingAction) {
            return;
        }
        this.renderProgress(snapshot);
        // 动画进行中跳过棋盘重建，避免打断浮动元素动画
        this.renderBoardIfNeeded(snapshot);
        this.renderFallenTray(snapshot);
        this.renderActionPanel();
    }

    forceBattleStateRender() {
        if (!this.visible) {
            return;
        }
        this.cancelBattleStateRender();
        const snapshot = battleManager.getSnapshot();
        this.syncBattleEffectsDisabledClass();
        this.syncHeroTurnPresentation(snapshot);
        this.renderTurnMeta(snapshot);
        this.renderProgress(snapshot);
        this.lastBoardRenderKey = '';
        this.renderBoard(snapshot);
        this.renderFallenTray(snapshot);
        this.renderActionPanel();
    }

    getBoardUnitStateKey(unit) {
        if (!unit) {
            return '';
        }
        const effects = (unit.getStatusEffects?.() || []).map(effect => [
            effect.type || '',
            effect.name || '',
            effect.stat || '',
            effect.modifierType || '',
            effect.value ?? '',
            effect.remainingTurns ?? effect.durationTurns ?? ''
        ].join(',')).join('~');
        return [
            unit.id,
            unit.camp,
            unit.rank || '',
            unit.position?.x ?? '',
            unit.position?.y ?? '',
            unit.isAlive?.() ? 1 : 0,
            unit.hp,
            unit.maxHp,
            effects
        ].join(':');
    }

    syncBattleEffectsDisabledClass() {
        const board = this.element.querySelector('#battle-board');
        if (!board) {
            return;
        }
        board.classList.toggle('battle-effects-disabled', Boolean(window.game?.settings?.environmentEffectsDisabled));
    }

    buildBoardRenderKey(snapshot = battleManager.getSnapshot()) {
        if (!snapshot?.scene) {
            return '';
        }
        const environmentType = (!window.game?.settings?.environmentEffectsDisabled && this.environmentEffectType !== 'none')
            ? this.environmentEffectType
            : '';
        const actorId = this.selectionMode ? (this.pendingAction?.context?.actor?.id || '') : '';
        const selectionKey = [
            this.selectionMode || '',
            actorId,
            snapshot.currentActorId || '',
            Number.isFinite(this.selectedSkillIndex) ? this.selectedSkillIndex : '',
            this.selectedBattleItemId || '',
            this.isPaused ? 1 : 0,
            battleManager.isAutoBattleEnabled() ? 1 : 0
        ].join(':');
        const units = [...snapshot.heroes, ...snapshot.enemies]
            .map(unit => this.getBoardUnitStateKey(unit))
            .join('|');
        const obstacles = (snapshot.scene.obstacles || [])
            .map(obstacle => `${obstacle.x},${obstacle.y},${obstacle.id || obstacle.type || ''}`)
            .join('|');
        const specialTiles = (snapshot.scene.specialTiles || [])
            .map(tile => `${tile.x},${tile.y},${tile.type || ''}`)
            .join('|');
        const warnings = (snapshot.specialTileWarnings || [])
            .map(warning => `${warning.id}:${warning.remainingTurns}:${(warning.cells || []).map(cell => `${cell.x},${cell.y}`).join('.')}`)
            .join('|');
        return `${snapshot.scene.width}x${snapshot.scene.height};${environmentType};${selectionKey};${units};${obstacles};${specialTiles};${warnings}`;
    }

    refreshBoardRuntimeState(snapshot = battleManager.getSnapshot()) {
        const board = this.element.querySelector('#battle-board');
        if (!board || !snapshot?.scene) {
            return;
        }
        const currentActorId = battleManager.currentActor?.id || null;
        const playerTurnActorId = this.getPendingHeroTurnActor()?.id || null;
        Array.from(board.children).forEach((cell) => {
            cell.classList.remove('active', 'player-turn-cell', 'boss');
            const x = Number(cell.dataset.x);
            const y = Number(cell.dataset.y);
            const warning = battleManager.getWarningAt({ x, y });
            const existingWarning = cell.querySelector('.battle-warning-tile-mark');
            if (warning) {
                cell.classList.add('warning-tile');
                if (existingWarning) {
                    existingWarning.querySelector('span').textContent = String(Math.max(1, Number(warning.remainingTurns) || 1));
                } else {
                    cell.insertAdjacentHTML('beforeend', this.renderWarningMarkup(warning));
                }
            } else {
                cell.classList.remove('warning-tile');
                existingWarning?.remove();
            }
            const unit = battleManager.getUnitAt({ x, y });
            if (!unit) {
                return;
            }
            cell.classList.toggle('boss', unit.rank === 'boss');
            cell.classList.toggle('active', currentActorId === unit.id);
            cell.classList.toggle('player-turn-cell', playerTurnActorId === unit.id);
            const token = cell.querySelector(`[data-unit-id="${unit.id}"]`);
            token?.classList.toggle('is-current-actor', currentActorId === unit.id);
            if (token?.dataset.wasHidden) {
                token.style.visibility = '';
                delete token.dataset.wasHidden;
            }
        });
        this.syncCurrentActorUnitMarkers(currentActorId);
    }

    syncCurrentActorUnitMarkers(currentActorId = battleManager.currentActor?.id || null) {
        if (!this.element) {
            return;
        }
        const board = this.element.querySelector('#battle-board');
        if (board) {
            board.querySelectorAll('.battle-cell.active').forEach(cell => cell.classList.remove('active'));
            const actor = currentActorId ? battleManager.getAllUnits().find(unit => unit.id === currentActorId && unit.isAlive?.()) : null;
            if (actor?.position) {
                const cell = this.getBoardCellElement(actor.position.x, actor.position.y);
                cell?.classList.add('active');
            }
        }
        this.element.querySelectorAll('.battle-unit-token, .battle-unit-floating').forEach((unitElement) => {
            unitElement.classList.toggle('is-current-actor', Boolean(currentActorId && unitElement.dataset.unitId === currentActorId));
        });
    }

    renderBoardIfNeeded(snapshot = battleManager.getSnapshot()) {
        const board = this.element.querySelector('#battle-board');
        const renderKey = this.buildBoardRenderKey(snapshot);
        if (board?.children.length && renderKey && renderKey === this.lastBoardRenderKey) {
            this.refreshBoardRuntimeState(snapshot);
            return false;
        }
        this.renderBoard(snapshot);
        return true;
    }

    getPendingHeroTurnActor() {
        const actor = battleManager.currentActor;
        const pendingActorId = this.pendingAction?.context?.actor?.id || null;
        if (!this.pendingAction || !actor || actor.camp !== 'hero' || actor.id !== pendingActorId) {
            return null;
        }
        return actor;
    }

    syncHeroTurnPresentation(snapshot = battleManager.getSnapshot()) {
        const actor = this.getPendingHeroTurnActor();
        const promptKey = actor ? `${snapshot?.currentRound || 0}:${actor.id}` : '';
        const stage = this.element.querySelector('.battle-board-stage');
        const panel = this.element.querySelector('#battle-action-panel');
        const progressTrack = this.element.querySelector('#battle-progress-track');
        if (stage) {
            stage.classList.toggle('is-player-turn', Boolean(actor));
        }
        if (panel) {
            panel.classList.toggle('is-player-turn', Boolean(actor));
        }
        if (progressTrack) {
            progressTrack.classList.toggle('is-player-turn', Boolean(actor));
        }
        if (promptKey && promptKey !== this.lastHeroTurnPromptKey) {
            this.showHeroTurnPrompt(actor);
        } else if (!promptKey) {
            this.clearHeroTurnPrompt();
        }
        this.lastHeroTurnPromptKey = promptKey;
    }

    showHeroTurnPrompt(actor) {
        const prompt = this.element.querySelector('#battle-turn-prompt');
        if (!prompt || !actor) {
            return;
        }
        if (this.heroTurnPromptTimer) {
            clearTimeout(this.heroTurnPromptTimer);
            this.heroTurnPromptTimer = null;
        }
        prompt.textContent = `轮到 ${actor.name} 行动`;
        prompt.classList.remove('is-visible');
        prompt.setAttribute('aria-hidden', 'false');
        void prompt.offsetWidth;
        prompt.classList.add('is-visible');
        this.heroTurnPromptTimer = setTimeout(() => {
            prompt.classList.remove('is-visible');
            prompt.setAttribute('aria-hidden', 'true');
            this.heroTurnPromptTimer = null;
        }, 1200);
    }

    clearHeroTurnPrompt() {
        if (this.heroTurnPromptTimer) {
            clearTimeout(this.heroTurnPromptTimer);
            this.heroTurnPromptTimer = null;
        }
        const prompt = this.element.querySelector('#battle-turn-prompt');
        if (prompt) {
            prompt.classList.remove('is-visible');
            prompt.setAttribute('aria-hidden', 'true');
        }
    }

    renderFallenTray(snapshot = battleManager.getSnapshot()) {
        const tray = this.element.querySelector('#battle-fallen-tray');
        const toggle = this.element.querySelector('#battle-fallen-toggle');
        if (!tray || !toggle) {
            return;
        }

        const fallenHeroes = snapshot?.fallenHeroes || [];
        const isReviveMode = this.selectionMode === 'revive-item';
        const hasFallen = fallenHeroes.length > 0;
        const selectedItemId = this.selectedBattleItemId || 'stimulant';
        const usage = battleManager.getBattleItemUsageState(selectedItemId);
        const canRevive = isReviveMode && usage.used < usage.maxUses;
        const isVisible = hasFallen && (this.isFallenTrayOpen || isReviveMode);

        const toggleLabel = isVisible ? '\u6536\u8d77\u9635\u4ea1' : '\u9635\u4ea1';
        const toggleTitle = hasFallen ? `${toggleLabel} ${fallenHeroes.length}` : '\u6682\u65e0\u9635\u4ea1\u82f1\u96c4';
        toggle.disabled = !hasFallen;
        toggle.className = `battle-fallen-toggle ${isVisible ? 'is-active' : ''} ${canRevive ? 'is-revivable' : ''} ${hasFallen ? '' : 'is-disabled'}`.trim();
        toggle.setAttribute('aria-expanded', isVisible ? 'true' : 'false');
        toggle.setAttribute('aria-label', toggleTitle);
        toggle.title = toggleTitle;
        toggle.innerHTML = `
            <span class="battle-fallen-toggle-label">${toggleLabel}</span>
            <span class="battle-fallen-toggle-count">${fallenHeroes.length}</span>
        `;

        if (!isVisible) {
            tray.className = 'battle-fallen-tray';
            tray.setAttribute('aria-hidden', 'true');
            tray.innerHTML = '';
            return;
        }

        tray.className = `battle-fallen-tray is-visible ${isReviveMode ? 'is-revive-mode' : ''}`.trim();
        tray.setAttribute('aria-hidden', 'false');
        tray.innerHTML = `
            <div class="battle-fallen-tray-list">
                ${fallenHeroes.map(hero => `
                    <button class="battle-fallen-tray-item ${canRevive ? 'is-revivable' : ''}" onclick="window.game.ui.battleView.reviveFallenHero('${hero.id}')" ${canRevive ? '' : 'disabled'} title="${canRevive ? `使用强心剂复活 ${hero.name}` : hero.name}">
                        <span class="battle-fallen-tray-avatar">${this.getBattleUnitVisualMarkup(hero, 'progress')}</span>
                        <span class="battle-fallen-tray-name">${hero.name}</span>
                    </button>
                `).join('')}
            </div>
            <div class="battle-fallen-tray-usage">
                <span class="battle-fallen-tray-usage-label">强心剂</span>
                <span class="battle-fallen-tray-usage-value">${usage.used}/${usage.maxUses}</span>
            </div>
        `;
    }

    renderTurnMeta(snapshot) {
        const meta = this.element.querySelector('#battle-turn-meta');
        if (!meta) {
            return;
        }
        const actor = battleManager.currentActor;
        const pendingActorId = this.pendingAction?.context?.actor?.id || null;
        const isHeroTurn = Boolean(this.pendingAction && actor && actor.camp === 'hero' && actor.id === pendingActorId);
        const countdownText = isHeroTurn ? ` · 剩余 ${this.pendingAction.remainingTime}s` : ``;
        if (snapshot.isBossEntrancePlaying) {
            meta.textContent = `第${snapshot.currentRound}行动轮 · 领主登场中...`;
            return;
        }
        meta.textContent = actor
            ? `第${snapshot.currentRound}行动轮 · 当前行动：${actor.name}${countdownText}`
            : `第${snapshot.currentRound}行动轮`;

    }

    updateTurnMetaOnly() {
        if (!this.visible) {
            return;
        }
        this.renderTurnMeta(battleManager.getSnapshot());
    }

    shouldSyncDisplayedProgress(snapshot) {
        if (!snapshot || this.isProcessingAction) {
            return false;
        }
        if (this.displayProgressMap.size === 0) {
            return true;
        }
        return !snapshot.currentActorId;
    }

    syncDisplayedProgress(snapshot, force = false) {
        if (!snapshot || (!force && !this.shouldSyncDisplayedProgress(snapshot))) {
            return;
        }
        const units = [...snapshot.heroes, ...snapshot.enemies].filter(unit => unit.isAlive());
        const nextMap = new Map();
        units.forEach((unit) => {
            nextMap.set(unit.id, this._normalizeProgressValue(unit.progress));
        });
        this.displayProgressMap = nextMap;
    }

    _normalizeProgressValue(value) {
        return Math.min(100, Math.max(0, Number(value) || 0));
    }

    _getProgressTrackLayout(track) {
        const styles = window.getComputedStyle(track);
        const padding = parseFloat(styles.getPropertyValue('--battle-progress-padding')) || 18;
        const tokenSize = parseFloat(styles.getPropertyValue('--battle-progress-token-size')) || 26;
        const trackWidth = track.clientWidth || 0;
        const minLeft = Math.max(0, padding - tokenSize / 2);
        const maxLeft = Math.max(minLeft, trackWidth - padding - tokenSize / 2);

        return {
            minLeft,
            maxLeft,
            range: Math.max(0, maxLeft - minLeft)
        };
    }

    _getProgressTokenLeft(track, progress, layout = null) {
        const normalizedProgress = this._normalizeProgressValue(progress);
        const trackLayout = layout || this._getProgressTrackLayout(track);
        const left = trackLayout.minLeft + trackLayout.range * (normalizedProgress / 100);
        return `${Math.round(left * 100) / 100}px`;
    }

    renderProgress(snapshot) {
        const track = this.element.querySelector('#battle-progress-track');
        if (!track) return;
        this.syncDisplayedProgress(snapshot);
        const units = [...snapshot.heroes, ...snapshot.enemies].filter(unit => unit.isAlive());
        const currentUnitId = battleManager.currentActor?.id || null;
        const playerTurnActorId = this.getPendingHeroTurnActor()?.id || null;

        if (!this.progressTokenMap) this.progressTokenMap = new Map();
        if (!this.progressValueMap) this.progressValueMap = new Map();
        if (!this.displayProgressMap) this.displayProgressMap = new Map();
        if (track.children.length === 0) {
            track.innerHTML = '<div class="battle-progress-scale"><span>0</span><span>100</span></div><div class="battle-progress-line"></div>';
        }

        const currentIds = new Set();
        const trackLayout = this._getProgressTrackLayout(track);

        units.forEach((unit) => {
            currentIds.add(unit.id);
            const newPos = this.displayProgressMap.has(unit.id)
                ? this.displayProgressMap.get(unit.id)
                : this._normalizeProgressValue(unit.progress);
            const newLeft = this._getProgressTokenLeft(track, newPos, trackLayout);
            const newClass = `battle-progress-token ${unit.camp} ${unit.rank || 'normal'} ${currentUnitId === unit.id ? 'active' : ''} ${playerTurnActorId === unit.id ? 'player-turn' : ''}`.trim();


            let token = this.progressTokenMap.get(unit.id);
            if (token && token.parentNode === track) {
                const oldVal = this.progressValueMap.has(unit.id) ? this.progressValueMap.get(unit.id) : 0;

                if (newPos < oldVal) {
                    const distToEnd = 100 - oldVal;
                    const distFromStart = newPos;
                    const duration1 = this._calcProgressDuration(distToEnd);
                    token.style.transitionDuration = `${duration1}ms`;
                    token.style.left = this._getProgressTokenLeft(track, 100, trackLayout);

                    setTimeout(() => {
                        if (token.parentNode !== track) return;
                        token.style.transitionDuration = '0ms';
                        token.style.left = this._getProgressTokenLeft(track, 0, trackLayout);
                        requestAnimationFrame(() => {
                            if (token.parentNode !== track) return;
                            const duration2 = this._calcProgressDuration(distFromStart);
                            token.style.transitionDuration = `${duration2}ms`;
                            token.style.left = newLeft;
                        });
                    }, duration1);
                } else {
                    const distance = newPos - oldVal;
                    const duration = this._calcProgressDuration(distance);
                    token.style.transitionDuration = `${duration}ms`;
                    token.style.left = newLeft;
                }

                token.className = `${newClass} ${unit.portrait ? 'has-portrait' : ''}`.trim();
                this.progressValueMap.set(unit.id, newPos);
            } else {
                token = document.createElement('div');
                token.className = `${newClass} ${unit.portrait ? 'has-portrait' : ''}`.trim();
                token.style.left = this._getProgressTokenLeft(track, 0, trackLayout);
                token.innerHTML = this.getBattleUnitVisualMarkup(unit, 'progress');
                track.appendChild(token);
                this.progressTokenMap.set(unit.id, token);
                this.progressValueMap.set(unit.id, newPos);

                requestAnimationFrame(() => { token.style.left = newLeft; });
            }
        });

        for (const [id, token] of this.progressTokenMap) {
            if (!currentIds.has(id)) {
                if (token.parentNode) token.parentNode.removeChild(token);
                this.progressTokenMap.delete(id);
                this.progressValueMap.delete(id);
                this.displayProgressMap.delete(id);
            }
        }
    }


    /**
     * 计算进度条图标移动动画时长
     * 规则：零距离不动画，其他情况维持原有移动节奏
     */
    _calcProgressDuration(distance) {
        const normalizedDistance = Math.max(0, Number(distance) || 0);
        if (normalizedDistance === 0) return 0;
        if (normalizedDistance <= 10) return 1500;
        return 1500 + (normalizedDistance - 10) * 20;
    }

    getBattleUnitVisualMarkup(unit, variant = 'board') {
        if (unit?.portrait) {
            const className = variant === 'progress'
                ? 'battle-progress-portrait'
                : (variant === 'floating' ? 'battle-float-portrait' : 'battle-unit-portrait');
            return `<img class="${className}" src="${unit.portrait}" alt="${unit.name || 'unit'}">`;
        }
        const className = variant === 'progress'
            ? 'battle-progress-icon'
            : (variant === 'floating' ? 'float-icon' : 'battle-unit-icon');
        return `<div class="${className}">${unit?.icon || '✦'}</div>`;
    }

    getStatusDisplayInfo(effect = {}) {
        const type = effect.type || 'custom';
        const isBuff = (effect.modifierType === 'percent' || effect.modifierType === 'flat')
            ? (Number(effect.value) || 0) > 0
            : !['slow', 'stun', 'silence', 'taunt', 'haze_mark', 'bleed', 'burn'].includes(type);
        switch (type) {
            case 'slow':
                return { icon: '↓', shortName: '减速', className: 'debuff' };
            case 'stun':
                return { icon: '✦', shortName: '眩晕', className: 'control' };
            case 'silence':
                return { icon: '◇', shortName: '沉默', className: 'control' };
            case 'taunt':
                return { icon: '!', shortName: '嘲讽', className: 'control' };
            case 'haze_mark':
                return { icon: '⌖', shortName: '破意', className: 'debuff' };
            case 'black_wall':
                return { icon: '▣', shortName: '铁壁', className: 'buff' };
            case 'battle_guard':
                return { icon: '◆', shortName: '减伤', className: 'buff' };
            case 'bleed':
                return { icon: '🩸', shortName: '流血', className: 'debuff' };
            case 'burn':
                return { icon: '🔥', shortName: '灼烧', className: 'debuff' };
            default:
                return { icon: isBuff ? '↑' : '•', shortName: effect.name || '状态', className: isBuff ? 'buff' : 'debuff' };
        }
    }

    getSpecialTileStatusDisplayInfo(tile) {
        const type = tile?.type || '';
        const config = {
            heal: { icon: '\u6062', shortName: '\u6062\u590d\u5730\u683c', className: 'buff', description: '\u56de\u5408\u5f00\u59cb\uff1a\u6062\u590d\u5df2\u635f\u751f\u547d5%', title: '\u6062\u590d\u5730\u683c\uff1a\u56de\u5408\u5f00\u59cb\u6062\u590d\u5df2\u635f\u5931\u751f\u547d\u76845%' },
            fire: { icon: '\u706b', shortName: '\u706b\u7130\u5730\u683c', className: 'debuff', description: '\u56de\u5408\u5f00\u59cb\uff1a\u635f\u5931\u5f53\u524d\u751f\u547d10%', title: '\u706b\u7130\u5730\u683c\uff1a\u56de\u5408\u5f00\u59cb\u635f\u5931\u5f53\u524d\u751f\u547d\u768410%' },
            swamp: { icon: '\u6cbc', shortName: '\u6cbc\u6cfd\u5730\u683c', className: 'debuff', description: '\u7ad9\u4e0a\u540e\uff1a\u901f\u5ea6\u548c\u79fb\u52a8-30%', title: '\u6cbc\u6cfd\u5730\u683c\uff1a\u901f\u5ea6\u548c\u79fb\u52a8\u8ddd\u79bb\u964d\u4f4e30%' },
            miasma: { icon: '\u7634', shortName: '\u7634\u6c14\u5730\u683c', className: 'debuff', description: '\u7ad9\u4e0a\u540e\uff1a\u9632\u5fa1-50%', title: '\u7634\u6c14\u5730\u683c\uff1a\u9632\u5fa1\u964d\u4f4e50%' }
        };
        return config[type] || null;
    }

    formatUnitDetailStatValue(current, base) {
        const currentValue = Math.max(0, Math.floor(Number(current) || 0));
        const baseValue = Math.max(0, Math.floor(Number(base) || 0));
        return currentValue !== baseValue ? `${currentValue}(\u539f${baseValue})` : `${currentValue}`;
    }

    getUnitDetailStatusRows(unit, statuses = []) {
        const rows = [];
        const tile = battleManager?.getSpecialTileAt?.(unit?.position);
        const tileInfo = tile ? this.getSpecialTileStatusDisplayInfo(tile) : null;
        if (tileInfo) {
            rows.push({
                className: tileInfo.className,
                icon: tileInfo.icon,
                name: tileInfo.shortName,
                description: tileInfo.description || tileInfo.title
            });
        }
        statuses.forEach((effect) => {
            const info = this.getStatusDisplayInfo(effect);
            const stackText = Number(effect.mergedCount) > 1 ? ` \u00b7 ${effect.mergedCount}\u5c42` : '';
            rows.push({
                className: info.className,
                icon: info.icon,
                name: effect.name || info.shortName,
                description: `${this.formatStatusEffectText(effect)}${stackText}`
            });
        });
        return rows;
    }

    getUnitStatusBadgesMarkup(unit, variant = 'board') {
        const effects = unit?.getStatusEffects?.() || [];
        const tile = battleManager?.getSpecialTileAt?.(unit?.position);
        const tileInfo = tile ? this.getSpecialTileStatusDisplayInfo(tile) : null;
        const tileBadge = tileInfo ? {
            ...tileInfo,
            turns: '',
            title: tileInfo.title
        } : null;
        if (!effects.length) {
            if (!tileBadge) {
                return '';
            }
        }
        const buffs = [];
        const debuffs = [];
        if (tileBadge) {
            if (tileBadge.className === 'buff') {
                buffs.push(tileBadge);
            } else {
                debuffs.push(tileBadge);
            }
        }
        effects.forEach((effect) => {
            const info = this.getStatusDisplayInfo(effect);
            const badge = {
                ...info,
                turns: Math.max(1, Number(effect.remainingTurns ?? effect.durationTurns) || 1),
                title: `${effect.name || info.shortName} · 剩余${Math.max(1, Number(effect.remainingTurns ?? effect.durationTurns) || 1)}回合`
            };
            if (info.className === 'buff') {
                buffs.push(badge);
            } else {
                debuffs.push(badge);
            }
        });

        const renderGroup = (items, side) => {
            if (!items.length) {
                return '';
            }
            const visible = items.slice(0, 2);
            const hidden = items.length - visible.length;
            return `
                <div class="battle-status-group ${side}">
                    ${visible.map(item => `
                        <span class="battle-status-badge ${item.className}" title="${item.title}">
                            <span class="battle-status-icon">${item.icon}</span>
                            ${item.turns ? `<span class="battle-status-turn">${item.turns}</span>` : ''}
                        </span>
                    `).join('')}
                    ${hidden > 0 ? `<span class="battle-status-badge extra" title="还有${hidden}个状态">+${hidden}</span>` : ''}
                </div>
            `;
        };

        return `
            <div class="battle-status-strip ${variant}">
                ${renderGroup(buffs, 'buffs')}
                ${renderGroup(debuffs, 'debuffs')}
            </div>
        `;
    }

    getStatusMergeKey(effect = {}) {
        const type = effect.type || 'custom';
        const effectType = effect.effectType || '';
        const stat = effect.stat || '';
        const modifierType = effect.modifierType || '';
        const name = effect.name || '';
        if (effectType === 'stat_modifier' || modifierType) {
            const direction = (Number(effect.value) || 0) >= 0 ? 'up' : 'down';
            return [type, effectType, stat, modifierType, direction].join(':');
        }
        return [type, effectType, stat, name].join(':');
    }

    getMergedStatusEffects(effects = []) {
        const groups = new Map();
        effects.filter(Boolean).forEach((effect) => {
            const key = this.getStatusMergeKey(effect);
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key).push(effect);
        });

        return Array.from(groups.values()).map(group => this.mergeStatusEffectGroup(group)).sort((a, b) => {
            const priority = { control: 0, debuff: 1, buff: 2 };
            const aInfo = this.getStatusDisplayInfo(a);
            const bInfo = this.getStatusDisplayInfo(b);
            const aPriority = priority[aInfo.className] ?? 3;
            const bPriority = priority[bInfo.className] ?? 3;
            if (aPriority !== bPriority) {
                return aPriority - bPriority;
            }
            return (Number(b.remainingTurns) || 0) - (Number(a.remainingTurns) || 0);
        });
    }

    mergeStatusEffectGroup(group = []) {
        const [baseEffect = {}] = group;
        if (group.length <= 1) {
            return { ...baseEffect, mergedCount: 1 };
        }

        const merged = {
            ...baseEffect,
            mergedCount: group.length,
            remainingTurns: Math.max(...group.map(effect => Number(effect.remainingTurns ?? effect.durationTurns) || 0)),
            durationTurns: Math.max(...group.map(effect => Number(effect.durationTurns ?? effect.remainingTurns) || 0))
        };

        ['value', 'attackPercentBonus', 'defensePercentBonus', 'damageReduction', 'damageTakenDebuffBonus'].forEach((key) => {
            const values = group.map(effect => Number(effect[key])).filter(value => Number.isFinite(value));
            if (values.length === group.length && values.length > 0) {
                merged[key] = values.reduce((sum, value) => sum + value, 0);
            }
        });

        return merged;
    }

    formatStatusEffectText(effect = {}) {
        const info = this.getStatusDisplayInfo(effect);
        const turns = Math.max(1, Number(effect.remainingTurns ?? effect.durationTurns) || 1);
        if (effect.type === 'slow') {
            return `${info.shortName} ${Math.round(Math.abs((Number(effect.value) || 0) * 100))}% · ${turns}回合`;
        }
        if (effect.type === 'silence' || effect.type === 'bleed' || effect.type === 'stun') {
            return `${info.shortName} · ${turns}回合`;
        }
        if (effect.type === 'taunt') {
            return effect.sourceName
                ? `${info.shortName} ${effect.sourceName} · ${turns}回合`
                : `${info.shortName} · ${turns}回合`;
        }
        if (effect.type === 'haze_mark') {
            const bonus = Math.round((Number(effect.damageTakenDebuffBonus) || 0) * 100);
            return bonus > 0 ? `${info.shortName} 易伤${bonus}% · ${turns}回合` : `${info.shortName} · ${turns}回合`;
        }
        if (effect.type === 'black_wall') {
            const defenseBonus = Math.round((Number(effect.value) || 0) * 100);
            const reduction = Math.round((Number(effect.damageReduction) || 0) * 1000) / 10;
            const reductionText = reduction > 0 ? ` / 减伤${reduction}%` : '';
            return `${info.shortName} 防御+${defenseBonus}%${reductionText} · ${turns}回合`;
        }
        if (effect.type === 'battle_guard') {
            const reduction = Math.round((Number(effect.damageReduction) || 0) * 100);
            return reduction > 0 ? `${info.shortName} 减伤${reduction}% · ${turns}回合` : `${info.shortName} · ${turns}回合`;
        }
        if (effect.type === 'burn') {
            const stackCount = Math.max(1, Number(effect.maxStacks) || 1) > 1 ? ` · 叠层` : '';
            return `${info.shortName}${stackCount} · ${turns}回合`;
        }
        if ((effect.modifierType === 'percent' || effect.modifierType === 'flat') && Number.isFinite(Number(effect.value))) {
            const sign = (Number(effect.value) || 0) > 0 ? '+' : '';
            const suffix = effect.modifierType === 'flat' ? '' : '%';
            const value = effect.modifierType === 'flat'
                ? Number(effect.value) || 0
                : Math.round((Number(effect.value) || 0) * 100);
            return `${effect.name || info.shortName} ${sign}${value}${suffix} · ${turns}回合`;
        }
        return `${effect.name || info.shortName} · ${turns}回合`;
    }

    getSelectedDetailUnit(actor = null) {
        const inspected = this.inspectedUnitId ? battleManager.findUnitById(this.inspectedUnitId) : null;
        return inspected || actor || null;
    }

    renderUnitDetailPanel(unit) {
        if (!unit) {
            return '<div class="battle-detail-empty">点击棋盘中的单位可以查看状态与属性。</div>';
        }
        const statuses = this.getMergedStatusEffects(unit.getStatusEffects?.() || []);
        const statusRows = this.getUnitDetailStatusRows(unit, statuses);
        const stats = unit.getStats?.() || {};
        const attackText = this.formatUnitDetailStatValue(stats.attack ?? unit._attack, unit._attack);
        const defenseText = this.formatUnitDetailStatValue(stats.defense ?? unit.defense, unit.defense);
        const speedText = this.formatUnitDetailStatValue(stats.effectiveSpeed ?? unit.speed, stats.speed ?? unit.speed);
        const moveText = this.formatUnitDetailStatValue(stats.moveRange ?? unit.moveRange, unit.moveRange);
        return `
            <div class="battle-unit-detail-card">
                <div class="battle-unit-detail-head">
                    <div class="battle-unit-detail-avatar">${this.getBattleUnitVisualMarkup(unit, 'progress')}</div>
                    <div class="battle-unit-detail-meta">
                        <div class="battle-unit-detail-name">${unit.name}</div>
                        <div class="battle-unit-detail-sub">${unit.camp === 'hero' ? '我方单位' : '敌方单位'} · ${HeroConfig?.getProfessionName?.(unit.profession) || unit.profession || '未知职业'}</div>
                        <div class="battle-unit-detail-hp">生命 ${unit.hp}/${unit.maxHp}</div>
                    </div>
                    <div class="battle-unit-detail-stats">
                    <span>攻击:${attackText}</span>
                    <span>防御:${defenseText}</span>
                    <span>速度:${speedText}</span>
                    <span>移动:${moveText}</span>
                    </div>
                </div>
                <div class="battle-unit-detail-section">
                    <div class="battle-unit-detail-section-title">当前状态</div>
                    ${statusRows.length ? `
                        <div class="battle-unit-status-list">
                            ${statusRows.slice(0, 4).map(row => `
                                    <div class="battle-unit-status-row ${row.className}">
                                        <span class="battle-unit-status-icon">${row.icon}</span>
                                        <span class="battle-unit-status-main">${row.name}</span>
                                        <span class="battle-unit-status-desc">${row.description}</span>
                                    </div>
                                `).join('')}
                            ${statusRows.length > 4 ? `<div class="battle-unit-status-more">另有 ${statusRows.length - 4} 项状态</div>` : ''}
                        </div>
                    ` : '<div class="battle-detail-empty compact">当前没有状态效果</div>'}
                </div>
            </div>
        `;
    }

    renderSpecialTileDetailPanel(tile) {
        if (!tile) {
            return '<div class="battle-detail-empty">等待行动中</div>';
        }
        const name = tile.name || battleManager.getSpecialTileTypeLabel(tile.type);
        const description = battleManager.getSpecialTileDescription(tile.type) || '该地格暂无效果说明。';
        return `
            <div class="battle-tile-detail-card battle-tile-detail-${tile.type}">
                <div class="battle-tile-detail-head">
                    <span class="battle-tile-detail-icon">${tile.icon || ''}</span>
                    <div class="battle-tile-detail-name">${name}</div>
                </div>
                <div class="battle-tile-detail-desc">${description}</div>
            </div>
        `;
    }

    renderObstacleDetailPanel(obstacle) {
        if (!obstacle) {
            return '<div class="battle-detail-empty">等待行动中</div>';
        }
        const name = obstacle.name || '障碍物';
        const description = battleManager.getObstacleDescription();
        const iconSrc = this.resolveAssetUrl(obstacle.iconSrc || 'assets/images/battle/obstacle-barricade.png');
        const iconMarkup = iconSrc
            ? `<img class="battle-tile-detail-icon-image" src="${iconSrc}" alt="${name}">`
            : `<span class="battle-tile-detail-icon">${obstacle.icon || '■'}</span>`;
        return `
            <div class="battle-tile-detail-card battle-tile-detail-obstacle">
                <div class="battle-tile-detail-head">
                    ${iconMarkup}
                    <div class="battle-tile-detail-name">${name}</div>
                </div>
                <div class="battle-tile-detail-desc">${description}</div>
            </div>
        `;
    }

    showSpecialTileToast(tile, x, y) {
        const board = this.element?.querySelector?.('#battle-board');
        if (!board || !tile) {
            return;
        }
        const cell = board.querySelector(`.battle-cell[data-x="${x}"][data-y="${y}"]`);
        if (!cell) {
            return;
        }
        const existing = board.querySelector('.battle-tile-toast');
        if (existing) {
            existing.remove();
        }
        const toast = document.createElement('div');
        toast.className = `battle-tile-toast battle-tile-toast-${tile.type}`;
        toast.textContent = tile.name || battleManager.getSpecialTileTypeLabel(tile.type);
        const cellRect = cell.getBoundingClientRect();
        const boardRect = board.getBoundingClientRect();
        toast.style.left = `${cellRect.left - boardRect.left + cellRect.width / 2}px`;
        toast.style.top = `${cellRect.top - boardRect.top - 6}px`;
        board.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('is-visible'));
        clearTimeout(this._specialTileToastTimer);
        this._specialTileToastTimer = setTimeout(() => {
            toast.classList.remove('is-visible');
            setTimeout(() => toast.remove(), 220);
        }, 1500);
    }

    renderBoardUnitMarkup(unit) {
        const isCurrentActor = battleManager.currentActor?.id === unit.id;
        return `
            <div class="battle-unit-token ${unit.camp} ${unit.rank || 'normal'} ${unit.portrait ? 'has-portrait' : ''} ${isCurrentActor ? 'is-current-actor' : ''}" data-unit-id="${unit.id}">
                ${this.getBattleUnitVisualMarkup(unit, 'board')}
                ${this.getUnitStatusBadgesMarkup(unit, 'board')}
                ${this.getUnitHpMarkup(unit, 'board')}
                <div class="battle-unit-mini-text">${unit.hp}/${unit.maxHp}</div>
            </div>
        `;
    }


    renderBoard(snapshot) {
        const board = this.element.querySelector('#battle-board');
        if (!board) {
            return;
        }
        const { width, height } = snapshot.scene;
        this.syncBattleEffectsDisabledClass();
        board.style.gridTemplateColumns = `repeat(${width}, minmax(0, 1fr))`;
        board.style.gridTemplateRows = `repeat(${height}, minmax(0, 1fr))`;
        board.innerHTML = '';
        const fragment = document.createDocumentFragment();

        // 记录所有单位当前位置（用于动画计算）
        this.lastUnitPositions.clear();
        battleManager.getAllUnits().forEach(unit => {
            if (unit.isAlive()) {
                this.lastUnitPositions.set(unit.id, { x: unit.position.x, y: unit.position.y });
            }
        });

        const actor = this.pendingAction?.context?.actor || null;
        const isMoveMode = this.selectionMode === 'move';
        const isTargetMode = this.selectionMode === 'attack' || this.selectionMode === 'skill';
        const boardClickable = Boolean(actor && this.selectionMode && !this.isPaused && !battleManager.isAutoBattleEnabled());
        const moveTargetSet = isMoveMode && actor
            ? new Set(battleManager.getReachableCells(actor).map(position => `${position.x},${position.y}`))
            : new Set();
        const targetPreviewCells = isTargetMode && actor
            ? this.getBoardTargetPreviewCells(actor)
            : [];
        const attackRangeSet = new Set(targetPreviewCells.map(position => `${position.x},${position.y}`));
        const attackTargetIds = isTargetMode && actor
            ? new Set(this.getBoardTargetCandidates(actor).map(target => target.id))
            : new Set();
        const attackTargetCellSet = isTargetMode && actor
            ? new Set(this.getBoardTargetCandidates(actor).map(target => `${target.position.x},${target.position.y}`))
            : new Set();
        const playerTurnActorId = this.getPendingHeroTurnActor()?.id || null;
        const environmentType = (!window.game?.settings?.environmentEffectsDisabled && this.environmentEffectType !== 'none')
            ? this.environmentEffectType
            : '';
        const environmentPulseCells = this.getEnvironmentPulseCells(width, height, environmentType);


        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const cell = document.createElement('button');
                cell.type = 'button';
                cell.className = 'battle-cell';
                cell.dataset.x = String(x);
                cell.dataset.y = String(y);

                const position = { x, y };
                const unit = battleManager.getUnitAt(position);
                const obstacle = battleManager.getObstacleAt(position);
                const specialTile = battleManager.getSpecialTileAt(position);
                const warning = battleManager.getWarningAt(position);
                const cellKey = `${x},${y}`;
                let isInteractiveCell = false;

                if (specialTile && !obstacle) {
                    cell.classList.add('special-tile', `special-tile-${specialTile.type}`);
                    cell.insertAdjacentHTML('beforeend', this.renderSpecialTileMarkup(specialTile));
                }

                if (obstacle) {
                    cell.classList.add('occupied', 'obstacle');
                    cell.innerHTML = this.renderObstacleMarkup(obstacle);
                }

                if (unit) {
                    cell.classList.add('occupied', unit.camp);
                    if (unit.rank === 'boss') {
                        cell.classList.add('boss');
                    }
                    if (battleManager.currentActor?.id === unit.id) {
                        cell.classList.add('active');
                    }
                    if (playerTurnActorId && unit.id === playerTurnActorId) {
                        cell.classList.add('player-turn-cell');
                    }
                    cell.innerHTML = this.renderBoardUnitMarkup(unit);

                }

                if (specialTile && !obstacle && !cell.querySelector('.battle-special-tile-mark')) {
                    cell.insertAdjacentHTML('beforeend', this.renderSpecialTileMarkup(specialTile));
                }

                if (warning) {
                    cell.classList.add('warning-tile');
                    cell.insertAdjacentHTML('beforeend', this.renderWarningMarkup(warning));
                }

                if (boardClickable && isMoveMode && moveTargetSet.has(cellKey)) {
                    cell.classList.add('move-target');
                    isInteractiveCell = true;
                }

                if (boardClickable && isTargetMode && attackRangeSet.has(cellKey)) {
                    cell.classList.add('attack-range');
                }

                if (isTargetMode && attackRangeSet.has(cellKey) && !attackTargetCellSet.has(cellKey)) {
                    cell.classList.add('attack-disabled');
                }

                if (isTargetMode && unit) {
                    if (attackTargetIds.has(unit.id) && attackTargetCellSet.has(cellKey)) {
                        cell.classList.add('attack-target');
                        isInteractiveCell = true;
                    } else {
                        cell.classList.add('attack-disabled');
                    }
                }

                if (isTargetMode && obstacle) {
                    cell.classList.add('attack-disabled');
                }

                const inspectable = Boolean(unit) || Boolean(specialTile) || Boolean(obstacle);
                if (environmentType && !inspectable && !obstacle) {
                    cell.classList.add('environment-cell');
                    if (environmentPulseCells.has(cellKey)) {
                        cell.classList.add('environment-pulse-cell');
                    }
                    cell.classList.add(`environment-${environmentType}`);
                }
                if (inspectable) {
                    cell.classList.add('inspectable');
                }
                cell.disabled = !(boardClickable && isInteractiveCell) && !inspectable;
                fragment.appendChild(cell);
            }
        }
        board.appendChild(fragment);
        this.syncCurrentActorUnitMarkers(battleManager.currentActor?.id || null);
        this.lastBoardRenderKey = this.buildBoardRenderKey(snapshot);
    }

    getBoardTargetPreviewCells(actor) {
        if (!actor) {
            return [];
        }
        if (this.selectionMode === 'skill') {
            const skillIndex = this.selectedSkillIndex;
            if (Number.isFinite(skillIndex)) {
                return battleManager.getSkillRangeCells(actor, skillIndex, { previewRaw: true, ignoreUsable: true });
            }
            const skillRangeSet = new Map();
            battleManager.getUsableSkills(actor).forEach((skill) => {
                battleManager.getSkillRangeCells(actor, skill.index, { previewRaw: true, ignoreUsable: true }).forEach((position) => {
                    skillRangeSet.set(`${position.x},${position.y}`, position);
                });
            });
            return [...skillRangeSet.values()];
        }
        return battleManager.getAttackRangeCells(actor);
    }

    getBoardTargetCandidates(actor) {
        if (!actor) {
            return [];
        }
        if (this.selectionMode === 'skill') {
            if (!Number.isFinite(this.selectedSkillIndex)) {
                return [];
            }
            return battleManager.getSkillTargetCandidates(actor, this.selectedSkillIndex);
        }
        return battleManager.getAttackableTargets(actor);
    }


    renderActionPanel() {
        const panel = this.element.querySelector('#battle-action-panel');
        const detailPanel = this.element.querySelector('#battle-detail-panel');
        if (!panel) {
            return;
        }

        if (this.isPaused) {
            panel.innerHTML = '<div class="battle-action-status">战斗已暂停</div>';
            if (detailPanel) detailPanel.innerHTML = this.renderUnitDetailPanel(this.getSelectedDetailUnit());
            return;
        }

        if (battleManager.isAutoBattleEnabled()) {
            panel.innerHTML = '<div class="battle-action-status">自动战斗中，系统将自动处理本场战斗。</div>';
            if (detailPanel) detailPanel.innerHTML = this.renderUnitDetailPanel(this.getSelectedDetailUnit());
            return;
        }

        const actor = battleManager.currentActor;
        const pendingActorId = this.pendingAction?.context?.actor?.id || null;
        const isHeroTurn = Boolean(this.pendingAction && actor && actor.camp === 'hero' && actor.id === pendingActorId);


        if (!isHeroTurn) {
            // 非英雄行动阶段：显示状态提示，按钮不可用
            const statusText = actor
                ? (actor.camp === 'enemy' ? '敌方行动中...' : '等待回合推进中...')
                : '等待回合推进中...';
              panel.innerHTML = `
                  <div class="battle-action-buttons battle-action-buttons-vertical" style="opacity:0.5;pointer-events:none;">
                      <button class="btn btn-secondary battle-command-btn is-attack" disabled><span class="battle-command-icon">攻击</span></button>
                      <button class="btn btn-secondary battle-command-btn is-move" disabled><span class="battle-command-icon">移动</span></button>
                      <button class="btn btn-secondary battle-command-btn is-defend" disabled><span class="battle-command-icon">防御</span></button>
                      <button class="btn btn-secondary battle-command-btn is-item" disabled><span class="battle-command-icon">物品</span></button>
                      <button class="btn btn-secondary battle-command-btn is-skill" disabled><span class="battle-command-icon">特技</span></button>
                  </div>
              `;
              if (detailPanel) {
                  if (this.inspectedSpecialTile) {
                      detailPanel.innerHTML = this.renderSpecialTileDetailPanel(this.inspectedSpecialTile);
                  } else if (this.inspectedObstacle) {
                      detailPanel.innerHTML = this.renderObstacleDetailPanel(this.inspectedObstacle);
                  } else {
                      const detailUnit = this.getSelectedDetailUnit(actor);
                      detailPanel.innerHTML = detailUnit
                          ? this.renderUnitDetailPanel(detailUnit)
                          : `<div class="battle-detail-empty">${statusText}</div>`;
                  }
              }
              return;
          }

          // 英雄行动阶段：正常渲染可用按钮
          const heroActor = this.pendingAction.context.actor;
          panel.innerHTML = `
              <div class="battle-action-buttons battle-action-buttons-vertical">
                  <button class="btn battle-command-btn is-attack ${this.selectionMode === 'attack' ? 'btn-primary' : 'btn-secondary'}" onclick="window.game.ui.battleView.selectActionMode('attack')" title="攻击"><span class="battle-command-icon">攻击</span></button>
                  <button class="btn battle-command-btn is-move ${this.selectionMode === 'move' ? 'btn-primary' : 'btn-secondary'}" onclick="window.game.ui.battleView.selectActionMode('move')" title="移动"><span class="battle-command-icon">移动</span></button>
                  <button class="btn btn-secondary battle-command-btn is-defend" onclick="window.game.ui.battleView.resolvePendingAction({ type: 'defend' })" title="防御"><span class="battle-command-icon">防御</span></button>
                  <button class="btn battle-command-btn is-item ${this.selectionMode === 'item' ? 'btn-primary' : 'btn-secondary'}" onclick="window.game.ui.battleView.selectActionMode('item')" title="使用物品"><span class="battle-command-icon">物品</span></button>
                  <button class="btn battle-command-btn is-skill ${this.selectionMode === 'skill' ? 'btn-primary' : 'btn-secondary'}" onclick="window.game.ui.battleView.openSkillPanel()" title="使用特技" ${heroActor.skills?.length ? '' : 'disabled'}><span class="battle-command-icon">特技</span></button>
              </div>
              <div class="battle-action-turn-badge">${heroActor.name} 可操作</div>
          `;
          if (detailPanel) {
              detailPanel.innerHTML = this.renderDetailPanel(heroActor);
          }
      }

    renderDetailPanel(actor) {
        if (this.inspectedSpecialTile) {
            return this.renderSpecialTileDetailPanel(this.inspectedSpecialTile);
        }
        if (this.inspectedObstacle) {
            return this.renderObstacleDetailPanel(this.inspectedObstacle);
        }
        if (!actor) {
            return '<div class="battle-detail-empty">等待行动中</div>';
        }
        const inspected = this.getSelectedDetailUnit(actor);

        if (this.selectionMode === 'item') {
            const itemMap = new Map();
            itemManager.getAllItems().forEach(item => {
                if (!['heal', 'revive', 'battle_status', 'max_hp'].includes(item.effect?.type)) {
                    return;
                }
                if (!itemMap.has(item.id)) {
                    itemMap.set(item.id, {
                        ...item,
                        totalCount: itemManager.getItemCount(item.id)
                    });
                }
            });
            const items = Array.from(itemMap.values());
            if (items.length === 0) {
                return '<div class="battle-detail-empty">当前没有可在战斗中使用的战斗物品</div>';
            }
            return `
                <div class="battle-detail-list">
                    ${items.map(item => `
                        <button class="battle-detail-row ${this.selectedBattleItemId === item.id ? 'is-selected' : ''}" onclick="window.game.ui.battleView.useBattleItem('${item.id}', '${actor.id}')">
                            <span class="battle-detail-row-icon">${item.iconSrc ? `<img class="battle-detail-row-image" src="${item.iconSrc}" alt="${item.name}">` : (item.icon || '✦')}</span>
                            <span class="battle-detail-row-main">
                                <span class="battle-detail-row-title">${item.name}</span>
                                <span class="battle-detail-row-sub">${item.description || '战斗道具'}</span>
                            </span>
                            <span class="battle-detail-row-extra">${item.effect?.type === 'revive' ? `${battleManager.getBattleItemUsageState(item.id).used}/${battleManager.getBattleItemUsageState(item.id).maxUses}` : `x${item.totalCount}`}</span>
                        </button>
                    `).join('')}
                </div>
            `;
        }

        if (this.selectionMode === 'skill') {
            const skills = battleManager.getUsableSkills(actor);
            if (!skills.length) {
                return '<div class="battle-detail-empty">当前英雄没有可用特技</div>';
            }
            return `
                <div class="battle-detail-list">
                    ${skills.map(skill => {
                        const targetTypeLabel = skill.targetType === 'self'
                            ? '自身'
                            : (skill.targetType === 'ally' ? '友方' : '敌方');
                        const cooldownLabel = skill.cooldownRemaining > 0
                            ? `冷却 ${skill.cooldownRemaining}/${skill.cooldownTurns}`
                            : `冷却 ${skill.cooldownTurns}`;
                        const hpCostLabel = skill.hpCost > 0 ? `耗血 ${skill.hpCost}` : '无消耗';
                        const selectedClass = this.selectedSkillIndex === skill.index ? 'is-selected' : '';
                        const disabledAttr = skill.canUse ? '' : 'disabled';
                        const disabledLabel = skill.canUse
                            ? (skill.targetType === 'self' ? '点击后立即释放' : '点击后选择目标')
                            : (skill.cooldownRemaining > 0 ? '冷却中' : '条件不足');
                        return `
                            <button class="battle-detail-row ${selectedClass}" onclick="window.game.ui.battleView.selectSkill(${skill.index})" ${disabledAttr}>
                                <span class="battle-detail-row-icon">✦</span>
                                <span class="battle-detail-row-main">
                                    <span class="battle-detail-row-title">${skill.name || `特技 ${skill.index + 1}`}</span>
                                    <span class="battle-detail-row-meta">范围 ${skill.range} · 目标 ${targetTypeLabel} ${skill.targetCount}个 · ${hpCostLabel} · ${cooldownLabel}</span>
                                </span>
                                <span class="battle-detail-row-extra">${disabledLabel}</span>
                            </button>
                        `;
                    }).join('')}
                </div>
            `;
        }

        if (this.selectionMode === 'revive-item') {
            const fallenHeroes = battleManager.getSnapshot()?.fallenHeroes || [];
            if (!fallenHeroes.length) {
                return '<div class="battle-detail-empty">当前没有阵亡英雄</div>';
            }
            return '<div class="battle-detail-empty">请在棋盘上方的阵亡英雄浮层中选择复活目标</div>';
        }
        if (inspected) {
            return this.renderUnitDetailPanel(inspected);
        }

        return '<div class="battle-detail-empty">选择“使用物品”或“使用特技”后，这里会显示可用列表；也可以点击棋盘单位查看状态。</div>';
    }

    startPendingActionTimer() {
        const actor = battleManager.currentActor;
        const pendingActor = this.pendingAction?.context?.actor;
        const isHeroTurn = Boolean(pendingActor && actor && actor.camp === 'hero' && actor.id === pendingActor.id);
        if (!this.pendingAction || this.isPaused || battleManager.isAutoBattleEnabled() || !isHeroTurn) {
            return;
        }
        if (this.pendingAction.timerId) {
            clearInterval(this.pendingAction.timerId);
        }
        this.pendingAction.timerId = setInterval(() => {
            const currentActor = battleManager.currentActor;
            const activePendingActor = this.pendingAction?.context?.actor;
            const shouldStopTimer = !this.pendingAction
                || this.isPaused
                || battleManager.isAutoBattleEnabled()
                || !currentActor
                || !activePendingActor
                || currentActor.camp !== 'hero'
                || currentActor.id !== activePendingActor.id;
            if (shouldStopTimer) {
                if (this.pendingAction?.timerId) {
                    clearInterval(this.pendingAction.timerId);
                    this.pendingAction.timerId = null;
                }
                this.updateTurnMetaOnly();
                return;
            }
            this.pendingAction.remainingTime -= 1;
            if (window.audioManager && typeof window.audioManager.playSFX === 'function') {
                const sfxVolume = Number.isFinite(window.audioManager.sfxVolume) ? window.audioManager.sfxVolume : 0.28;
                window.audioManager.playSFX('battle_countdown_tick', Math.min(0.28, sfxVolume));
            }
            if (this.pendingAction.remainingTime <= 0) {
                this.resolvePendingAction({ type: 'defend', reason: 'timeout' });
                return;
            }
            this.updateTurnMetaOnly();
        }, 1000);
    }


    requestPlayerAction(context) {
        return new Promise(resolve => {
            this.clearPendingAction();
            this.pendingAction = {
                context,
                resolve,
                remainingTime: context.timeout || 25,
                timerId: null
            };
            this.selectionMode = null;
            this.selectedSkillIndex = null;
            this.selectedBattleItemId = null;
            this.isFallenTrayOpen = false;
            this.startPendingActionTimer();
            this.renderBattleState();
        });
    }


    closeItemSelectModal() {
        if (this.itemSelectModal) {
            this.itemSelectModal.close();
            this.itemSelectModal = null;
        }
    }

    clearPendingAction(resolveWith = null) {
        if (this.pendingAction?.timerId) {
            clearInterval(this.pendingAction.timerId);
        }
        this.closeItemSelectModal();
        if (resolveWith && this.pendingAction?.resolve) {
            this.pendingAction.resolve(resolveWith);
        }
        this.pendingAction = null;
        this.selectionMode = null;
        this.selectedSkillIndex = null;
        this.selectedBattleItemId = null;
        this.clearHeroTurnPrompt();
    }

    getEnvironmentPulseCells(width, height, type) {
        if (!type || type === 'none') {
            return new Set();
        }
        const seeds = {
            smoke: 5,
            poison_fog: 7,
            dust_smoke: 9,
            rain: 11,
            storm_night: 13,
            snow: 15,
            ash: 17
        };
        const seed = seeds[type] || 0;
        if (!seed) {
            return new Set();
        }
        const count = Math.max(2, Math.min(6, Math.round((width * height) / 28)));
        const total = Math.max(1, width * height);
        const cells = new Set();
        let state = seed * 9301 + 49297;
        for (let i = 0; i < total && cells.size < count; i++) {
            state = (state * 1103515245 + 12345) & 0x7fffffff;
            const index = state % total;
            cells.add(`${index % width},${Math.floor(index / width)}`);
        }
        return cells;
    }

    resolvePendingAction(action) {
        if (!this.pendingAction || this.isPaused) {
            return;
        }
        const resolver = this.pendingAction.resolve;
        this.clearPendingAction();
        this.isFallenTrayOpen = false;
        this.renderBattleState();
        resolver(action || { type: 'defend' });
    }

    selectActionMode(mode) {
        if (!this.pendingAction || this.isPaused) {
            return;
        }
        if (mode === 'item') {
            this.selectionMode = this.selectionMode === 'item' ? null : 'item';
            this.selectedSkillIndex = null;
            this.selectedBattleItemId = null;
        } else {
            this.selectionMode = this.selectionMode === mode ? null : mode;
            if (mode !== 'skill') {
                this.selectedSkillIndex = null;
            }
            if (mode !== 'revive-item') {
                this.selectedBattleItemId = null;
            }
        }
        if (this.selectionMode !== 'revive-item') {
            this.isFallenTrayOpen = false;
        }
        this.renderBattleState();
    }

    openSkillPanel() {
        if (!this.pendingAction || this.isPaused) {
            return;
        }
        this.selectionMode = this.selectionMode === 'skill' ? null : 'skill';
        if (this.selectionMode === 'skill' && this.selectedSkillIndex === null) {
            const heroActor = this.pendingAction.context.actor;
            const usableSkill = battleManager.getUsableSkills(heroActor).find(skill => skill.canUse);
            this.selectedSkillIndex = usableSkill ? usableSkill.index : null;
        }
        this.isFallenTrayOpen = false;
        this.renderBattleState();
    }

    selectSkill(skillIndex) {
        if (!this.pendingAction || this.isPaused) {
            return;
        }
        const heroActor = this.pendingAction.context.actor;
        if (!battleManager.canActorUseSkill?.(heroActor, skillIndex)) {
            return;
        }
        const skill = heroActor.getSkill?.(skillIndex) || heroActor.skills?.[skillIndex] || null;
        if (skill?.targetType === 'self') {
            this.resolvePendingAction({
                type: 'skill',
                targetId: heroActor.id,
                skillIndex
            });
            return;
        }
        this.selectionMode = 'skill';
        this.selectedSkillIndex = skillIndex;
        this.isFallenTrayOpen = false;
        this.renderBattleState();
    }

    handleBoardCellClick(x, y) {
        const clickedUnit = battleManager.getUnitAt({ x, y });
        const actor = this.pendingAction?.context?.actor;
        if (clickedUnit) {
            this.inspectedUnitId = clickedUnit.id;
            this.inspectedSpecialTile = null;
            this.inspectedObstacle = null;
        } else {
            const obstacle = battleManager.getObstacleAt({ x, y });
            if (obstacle) {
                this.inspectedObstacle = obstacle;
                this.inspectedSpecialTile = null;
                this.inspectedUnitId = null;
                this.showSpecialTileToast({
                    type: 'obstacle',
                    name: obstacle.name || '障碍物'
                }, x, y);
            } else {
                const tile = battleManager.getSpecialTileAt({ x, y });
                if (tile) {
                    this.inspectedSpecialTile = tile;
                    this.inspectedObstacle = null;
                    this.inspectedUnitId = null;
                    this.showSpecialTileToast(tile, x, y);
                }
            }
        }
        if (!this.pendingAction || this.isPaused || battleManager.isAutoBattleEnabled()) {
            this.renderBattleState();
            return;
        }
        if (this.selectionMode === 'move') {
            const canMove = battleManager.getReachableCells(actor).some(position => position.x === x && position.y === y);
            if (canMove) {
                this.resolvePendingAction({ type: 'move', position: { x, y } });
            } else if (clickedUnit) {
                this.renderBattleState();
            }
            return;
        }
        if (this.selectionMode === 'attack' || this.selectionMode === 'skill') {
            const target = clickedUnit;
            const validTargets = this.getBoardTargetCandidates(actor);
            if (target && validTargets.some(unit => unit.id === target.id)) {
                this.resolvePendingAction({
                    type: this.selectionMode,
                    targetId: target.id,
                    skillIndex: this.selectionMode === 'skill' ? this.selectedSkillIndex : undefined
                });
                return;
            }
            this.renderBattleState();
            return;
        }
        this.renderBattleState();
    }

    chooseBattleItem() {
        this.selectActionMode('item');
    }

    toggleFallenTray() {
        const snapshot = battleManager.getSnapshot();
        const fallenHeroes = snapshot?.fallenHeroes || [];
        if (!fallenHeroes.length) {
            this.isFallenTrayOpen = false;
            this.renderFallenTray(snapshot);
            return;
        }
        this.isFallenTrayOpen = !this.isFallenTrayOpen;
        this.renderFallenTray(snapshot);
    }

    useBattleItem(itemId, actorId) {
        if (this.isPaused) {
            return;
        }
        const item = itemManager.getItem(itemId);
        if (!item) {
            return;
        }
        this.closeItemSelectModal();
        if (item.effect?.type === 'revive') {
            this.selectionMode = 'revive-item';
            this.selectedBattleItemId = itemId;
            this.isFallenTrayOpen = true;
            this.renderBattleState();
            return;
        }
        this.resolvePendingAction({ type: 'item', itemId, targetId: actorId });
    }

    reviveFallenHero(heroId) {
        if (!this.pendingAction || this.isPaused || this.selectionMode !== 'revive-item' || !this.selectedBattleItemId) {
            return;
        }
        this.resolvePendingAction({ type: 'item', itemId: this.selectedBattleItemId, targetId: heroId });
    }

    pauseBattle() {
        if (!this.visible || !battleManager.isBattling || this.isPaused) {
            return;
        }
        this.isPaused = true;
        this.selectionMode = null;
        if (this.pendingAction?.timerId) {
            clearInterval(this.pendingAction.timerId);
            this.pendingAction.timerId = null;
        }
        this.closeItemSelectModal();
        this.showPauseModal();
        this.renderBattleState();
    }

    showPauseModal() {
        if (this.pauseModal?.isShown()) {
            return;
        }
        this.pauseModal = new Modal({
            title: '游戏暂停',
            content: '',
            showClose: false,
            buttons: [
                { text: '跳过战斗', className: 'btn-danger', onClick: () => this.skipBattle() },
                { text: '返回战斗', className: 'btn-primary', onClick: () => this.resumeBattle() }
            ]
        });
        this.pauseModal.show();
    }

    closePauseModal() {
        if (!this.pauseModal) {
            return;
        }
        const modal = this.pauseModal;
        this.pauseModal = null;
        modal.close();
    }

    resumeBattle() {
        if (!this.isPaused) {
            return;
        }
        this.isPaused = false;
        this.closePauseModal();
        if (this.pendingAction && battleManager.isAutoBattleEnabled()) {
            const autoAction = battleManager.chooseAutoAction(this.pendingAction.context.actor);
            this.resolvePendingAction(autoAction);
            return;
        }
        if (this.pendingAction) {
            this.startPendingActionTimer();
        }
        this.renderBattleState();
    }

    skipBattle() {
        if (!battleManager.isBattling) {
            return;
        }
        this.skipBattleRequested = true;
        this.isPaused = false;
        this.closePauseModal();
        battleManager.setAutoBattleOverride(true);
        if (this.pendingAction) {
            const autoAction = battleManager.chooseAutoAction(this.pendingAction.context.actor);
            this.resolvePendingAction(autoAction);
            return;
        }
        this.renderBattleState();
    }

    applyAutoBattleSettingChange() {
        if (this.isPaused) {
            this.renderBattleState();
            return;
        }
        if (battleManager.isAutoBattleEnabled() && this.pendingAction) {
            const autoAction = battleManager.chooseAutoAction(this.pendingAction.context.actor);
            this.resolvePendingAction(autoAction);
            return;
        }
        this.renderBattleState();
    }

    applyEnvironmentEffectSettingChange() {
        if (!this.visible) {
            return;
        }
        const snapshot = battleManager.getSnapshot?.();
        if (window.game?.settings?.environmentEffectsDisabled) {
            this.stopEnvironmentEffect();
            this.renderBattleState();
            return;
        }
        this.startEnvironmentEffect(snapshot?.environmentEffect || this.currentDungeon?.environmentEffect);
        this.renderBattleState();
    }

    toggleAutoBattle() {
        window.game.settings.autoBattle = !window.game.settings.autoBattle;
        window.game.save();
        Toast.info(window.game.settings.autoBattle ? '已开启自动战斗' : '已关闭自动战斗');
        this.applyAutoBattleSettingChange();
    }

    async onBattleEnd(result, dungeon) {
        this.isPaused = false;
        this.skipBattleRequested = false;
        this.closePauseModal();
        battleManager.setAutoBattleOverride();
        this.clearPendingAction();
        if (result.victory) {
            const rewardResult = window.game.grantDungeonVictoryRewards(dungeon, result.participants || heroManager.getTeamIds());
            await RewardModal.show({
                title: '战斗胜利',
                rewards: rewardResult.rewardEntries,
                summaryText: '本次副本奖励已全部结算'
            });
            eventManager.emit('viewChange', { view: 'dungeon' });
            return;
        }

        const modal = new Modal({
            title: '作战失败',
            showClose: false,
            className: 'battle-defeat-modal-shell',
            content: `
                <div class="battle-defeat-modal">
                    <div class="battle-defeat-emblem" aria-hidden="true">
                        <span class="battle-defeat-emblem-core">!</span>
                    </div>
                    <div class="battle-defeat-copy">
                        <div class="battle-defeat-kicker">MISSION FAILED</div>
                        <h3>防线已被突破</h3>
                        <p>本次作战未能完成，返回副本页后可以重新调整阵容、站位和装备，再次发起挑战。</p>
                    </div>
                    <div class="battle-defeat-advice">
                        <div>
                            <span>战况</span>
                            <strong>未通关</strong>
                        </div>
                        <div>
                            <span>下一步</span>
                            <strong>整备阵容</strong>
                        </div>
                    </div>
                </div>
            `,
            buttons: [{ text: '返回副本', className: 'btn-primary battle-defeat-modal-action', onClick: () => { modal.close(); eventManager.emit('viewChange', { view: 'dungeon' }); } }]
        });
        modal.show();
    }

    fleeBattle() {
        if (confirm('确定要逃跑吗？')) {
            this.stopBattle();
            eventManager.emit('viewChange', { view: 'dungeon' });
        }
    }

    // ===== 动画队列系统 =====

    /**
     * 串行动作队列处理器
     * 确保前一个动画完全结束后才处理下一个，避免敌方单位同时移动
     */
    async processActionQueue() {
        if (this.isProcessingAction) return;
        this.isProcessingAction = true;
        let renderedAfterTask = false;

        while (this.actionQueue.length > 0 && this.visible) {
            const task = this.actionQueue.shift();
            try {
                switch (task.type) {
                    case 'move':
                        await this.handleUnitMoveAnimation(task.data.unit, task.data.position, task.oldPos);
                        break;
                    case 'attack':
                        await this.handleAttackAnimation(task.data.attacker, task.data.target, task.data);
                        break;
                    case 'heal':
                        await this.handleHealAnimation(task.data);
                        break;
                    case 'status':
                        await this.handleStatusAnimation(task.data);
                        break;
                    case 'die':
                        await this.handleDeathAnimation(task.data.unit);
                        break;
                }
            } catch (e) {
                // 单个动画失败不阻断队列
            }

            if (this.visible) {
                const syncedAfterTask = this.syncBoardAfterActionTask(task);
                if (syncedAfterTask) {
                    renderedAfterTask = true;
                } else {
                    this.renderBoardIfNeeded(battleManager.getSnapshot());
                    renderedAfterTask = true;
                }
            }
        }

        this.isProcessingAction = false;
        if (this.visible) {
            const snapshot = battleManager.getSnapshot();
            if (!renderedAfterTask) {
                this.renderBoardIfNeeded(snapshot);
            }
            this.renderTurnMeta(snapshot);
        }
        this.resolveActionQueueWaiters();
    }

    syncBoardAfterActionTask(task) {
        if (!task) {
            return false;
        }
        if (task.type === 'move') {
            this.syncBoardUnitsAfterAction([task.data?.unit]);
            return true;
        }
        if (task.type === 'attack') {
            const actionEntries = this.getActionEntries(task.data, task.data?.target);
            this.syncBoardUnitsAfterAction([
                task.data?.attacker,
                ...actionEntries.map(entry => entry.unit)
            ]);
            return true;
        }
        if (task.type === 'heal' || task.type === 'status') {
            this.syncBoardUnitsAfterAction([task.data?.target]);
            return true;
        }
        if (task.type === 'die') {
            this.syncBoardUnitsAfterAction([task.data?.unit]);
            return true;
        }
        return false;
    }

    waitForActionQueueIdle() {
        if (!this.visible || (!this.isProcessingAction && this.actionQueue.length === 0)) {
            return Promise.resolve();
        }
        return new Promise(resolve => {
            this.actionQueueWaiters.push(resolve);
        });
    }

    resolveActionQueueWaiters() {
        if (!this.actionQueueWaiters.length) {
            return;
        }
        const waiters = [...this.actionQueueWaiters];
        this.actionQueueWaiters.length = 0;
        waiters.forEach(resolve => resolve());
    }


    /**
     * 获取棋盘格子的屏幕坐标
     */
    getCellScreenPosition(x, y) {
        const board = this.element.querySelector('#battle-board');
        if (!board) return null;
        const snapshot = battleManager.getSnapshot();
        const { width } = snapshot.scene;
        const index = y * width + x;
        if (index < 0 || index >= board.children.length) return null;
        const cell = board.children[index];
        const boardRect = board.getBoundingClientRect();
        const cellRect = cell.getBoundingClientRect();
        return {
            left: cellRect.left - boardRect.left,
            top: cellRect.top - boardRect.top,
            width: cellRect.width,
            height: cellRect.height
        };
    }

    /**
     * 创建浮动单位元素
     */
    getBoardCellElement(x, y) {
        const board = this.element.querySelector('#battle-board');
        if (!board) return null;
        const snapshot = battleManager.getSnapshot();
        const sceneWidth = Math.max(1, Number(snapshot?.scene?.width) || 1);
        const index = y * sceneWidth + x;
        return index >= 0 ? (board.children[index] || null) : null;
    }

    clearEnvironmentCellState(cell) {
        if (!cell) return;
        ['environment-cell', 'environment-pulse-cell', 'environment-smoke', 'environment-poison_fog', 'environment-dust_smoke', 'environment-rain', 'environment-storm_night', 'environment-snow', 'environment-ash']
            .forEach(className => cell.classList.remove(className));
    }

    applyBoardOverlayMarks(cell) {
        if (!cell) return;
        cell.querySelectorAll('.battle-special-tile-mark, .battle-warning-tile-mark').forEach(mark => mark.remove());
        cell.classList.remove('special-tile', 'special-tile-heal', 'special-tile-fire', 'special-tile-swamp', 'special-tile-miasma', 'warning-tile');
        const position = { x: Number(cell.dataset.x), y: Number(cell.dataset.y) };
        const specialTile = battleManager.getSpecialTileAt(position);
        if (specialTile && !cell.classList.contains('obstacle')) {
            cell.classList.add('special-tile', `special-tile-${specialTile.type}`);
            cell.insertAdjacentHTML('beforeend', this.renderSpecialTileMarkup(specialTile));
        }
        const warning = battleManager.getWarningAt(position);
        if (warning) {
            cell.classList.add('warning-tile');
            cell.insertAdjacentHTML('beforeend', this.renderWarningMarkup(warning));
        }
    }

    applyEnvironmentCellState(cell) {
        if (!cell || cell.classList.contains('occupied') || cell.classList.contains('obstacle')) {
            return;
        }
        this.clearEnvironmentCellState(cell);
        const snapshot = battleManager.getSnapshot();
        const environmentType = (!window.game?.settings?.environmentEffectsDisabled && this.environmentEffectType !== 'none')
            ? this.environmentEffectType
            : '';
        if (!environmentType || !snapshot?.scene) {
            return;
        }
        const x = Number(cell.dataset.x);
        const y = Number(cell.dataset.y);
        const pulseCells = this.getEnvironmentPulseCells(snapshot.scene.width, snapshot.scene.height, environmentType);
        cell.classList.add('environment-cell', `environment-${environmentType}`);
        if (pulseCells.has(`${x},${y}`)) {
            cell.classList.add('environment-pulse-cell');
        }
    }

    clearBoardSelectionHighlights() {
        const board = this.element.querySelector('#battle-board');
        if (!board) return;
        board.querySelectorAll('.battle-cell').forEach((cell) => {
            cell.classList.remove('move-target', 'attack-range', 'attack-target', 'attack-disabled');
            cell.disabled = !cell.classList.contains('inspectable');
        });
    }

    clearBoardCellUnitState(cell, unitId) {
        if (!cell) return;
        const token = unitId
            ? cell.querySelector(`[data-unit-id="${unitId}"]`)
            : cell.querySelector('.battle-unit-token');
        if (token) {
            token.remove();
        }
        if (!cell.querySelector('.battle-unit-token')) {
            cell.classList.remove('occupied', 'hero', 'enemy', 'boss', 'active', 'player-turn-cell', 'inspectable');
            if (!cell.classList.contains('obstacle')) {
                const x = Number(cell.dataset.x);
                const y = Number(cell.dataset.y);
                const specialTile = Number.isFinite(x) && Number.isFinite(y)
                    ? battleManager.getSpecialTileAt({ x, y })
                    : null;
                if (specialTile) {
                    cell.classList.add('inspectable');
                    cell.disabled = false;
                } else {
                    cell.disabled = true;
                }
                cell.innerHTML = '';
                this.applyBoardOverlayMarks(cell);
                this.applyEnvironmentCellState(cell);
            }
        }
    }

    syncBoardUnitCell(unit) {
        if (!unit?.position) return;
        const cell = this.getBoardCellElement(unit.position.x, unit.position.y);
        if (!cell) return;
        this.clearEnvironmentCellState(cell);
        if (!unit.isAlive?.()) {
            this.clearBoardCellUnitState(cell, unit.id);
            return;
        }
        cell.classList.add('occupied', unit.camp, 'inspectable');
        cell.classList.remove(unit.camp === 'hero' ? 'enemy' : 'hero');
        cell.classList.toggle('boss', unit.rank === 'boss');
        cell.classList.toggle('active', battleManager.currentActor?.id === unit.id);
        cell.classList.toggle('player-turn-cell', this.getPendingHeroTurnActor()?.id === unit.id);
        cell.disabled = false;
        cell.innerHTML = this.renderBoardUnitMarkup(unit);
        this.applyBoardOverlayMarks(cell);
    }

    syncBoardUnitsAfterAction(units = []) {
        const uniqueUnits = new Map();
        units.filter(Boolean).forEach(unit => uniqueUnits.set(unit.id, unit));
        uniqueUnits.forEach(unit => this.syncBoardUnitCell(unit));
        this.refreshBoardRuntimeState();
        if (this.actionQueue.length === 0) {
            this.lastBoardRenderKey = this.buildBoardRenderKey(battleManager.getSnapshot());
        }
    }

    syncBoardCellsForMove(unit, fromPosition, toPosition) {
        if (!unit || !fromPosition || !toPosition) return;
        this.clearBoardSelectionHighlights();
        const fromCell = this.getBoardCellElement(fromPosition.x, fromPosition.y);
        const toCell = this.getBoardCellElement(toPosition.x, toPosition.y);

        if (fromCell && fromCell !== toCell) {
            this.clearBoardCellUnitState(fromCell, unit.id);
        }

        if (toCell) {
            this.clearEnvironmentCellState(toCell);
            toCell.classList.add('occupied', unit.camp);
            toCell.classList.remove(unit.camp === 'hero' ? 'enemy' : 'hero');
            toCell.classList.toggle('boss', unit.rank === 'boss');
            toCell.classList.add('inspectable');
            toCell.classList.toggle('active', battleManager.currentActor?.id === unit.id);
            toCell.classList.toggle('player-turn-cell', this.getPendingHeroTurnActor()?.id === unit.id);
            toCell.disabled = false;
            if (!toCell.querySelector(`[data-unit-id="${unit.id}"]`)) {
                toCell.innerHTML = this.renderBoardUnitMarkup(unit);
                this.applyBoardOverlayMarks(toCell);
                const token = toCell.querySelector(`[data-unit-id="${unit.id}"]`);
                if (token) {
                    token.style.visibility = 'hidden';
                    token.dataset.wasHidden = 'true';
                }
            }
            this.applyBoardOverlayMarks(toCell);
        }

        this.lastUnitPositions.set(unit.id, { x: toPosition.x, y: toPosition.y });
    }

    createFloatingUnit(unit) {
        const el = document.createElement('div');
        const isCurrentActor = battleManager.currentActor?.id === unit.id;
        el.className = `battle-unit-floating ${unit.camp} ${unit.rank || 'normal'} ${isCurrentActor ? 'is-current-actor' : ''}`.trim();
        el.dataset.unitId = unit.id;
        el.innerHTML = `
            ${this.getBattleUnitVisualMarkup(unit, 'floating')}
            <div class="float-text">${unit.hp}/${unit.maxHp}</div>
        `;
        return el;
    }

    getHpPercentByValue(hp, maxHp) {
        if (!maxHp) {
            return 0;
        }
        return Math.max(0, Math.min(100, hp / maxHp * 100));
    }

    getUnitHpPercent(unit) {
        return this.getHpPercentByValue(unit?.hp || 0, unit?.maxHp || 0);
    }

    getDisplayedHpTrailPercent(unit) {
        if (!unit) {
            return 0;
        }
        return this.hpTrailMap.has(unit.id)
            ? this.hpTrailMap.get(unit.id)
            : this.getUnitHpPercent(unit);
    }

    getUnitHpMarkup(unit, variant = 'board') {
        if (variant === 'board' || variant === 'floating') {
            return '';
        }
        const currentPercent = this.getUnitHpPercent(unit);
        const trailPercent = Math.max(currentPercent, this.getDisplayedHpTrailPercent(unit));
        const prefix = variant === 'floating' ? 'float-hp' : 'battle-unit-mini-hp';
        return `
            <div class="${prefix}">
                <div class="${prefix}-trail" style="width:${trailPercent}%"></div>
                <div class="${prefix}-fill" style="width:${currentPercent}%"></div>
            </div>
        `;
    }

    clearHpTrailTimers() {
        this.hpTrailTimers.forEach(timerId => clearTimeout(timerId));
        this.hpTrailTimers.clear();
    }

    setUnitHpTrail(unitId, percent) {
        this.hpTrailMap.set(unitId, Math.max(0, Math.min(100, Number(percent) || 0)));
    }

    scheduleHpTrailDrop(unit, previousHp, currentHp) {
        if (!unit || !Number.isFinite(previousHp) || !Number.isFinite(currentHp)) {
            return;
        }
        const previousPercent = this.getHpPercentByValue(previousHp, unit.maxHp);
        const currentPercent = this.getHpPercentByValue(currentHp, unit.maxHp);
        const existingTimer = this.hpTrailTimers.get(unit.id);
        if (existingTimer) {
            clearTimeout(existingTimer);
            this.hpTrailTimers.delete(unit.id);
        }
        if (currentPercent >= previousPercent) {
            this.setUnitHpTrail(unit.id, currentPercent);
            return;
        }
        this.setUnitHpTrail(unit.id, previousPercent);
        const timerId = setTimeout(() => {
            this.setUnitHpTrail(unit.id, currentPercent);
            this.hpTrailTimers.delete(unit.id);
            if (this.visible && !this.isProcessingAction) {
                this.renderBoardIfNeeded(battleManager.getSnapshot());
            }
        }, 180);
        this.hpTrailTimers.set(unit.id, timerId);
    }

    getActionEntries(actionData, fallbackTarget) {
        const entries = [];
        const result = actionData?.result || {};
        if (Array.isArray(result.targets) && result.targets.length > 0) {
            result.targets.forEach((entry) => {
                const unit = battleManager.findUnitById(entry.id)
                    || battleManager.getAllUnits().find(candidate => candidate.id === entry.id)
                    || (fallbackTarget?.id === entry.id ? fallbackTarget : null);
                if (unit) {
                    entries.push({ unit, result: entry });
                }
            });
            return entries;
        }
        if (fallbackTarget) {
            entries.push({ unit: fallbackTarget, result });
        }
        return entries;
    }

    getCombatTextOffset(unitId) {
        const current = this.combatTextBurstMap.get(unitId) || 0;
        const next = (current + 1) % 4;
        this.combatTextBurstMap.set(unitId, next);
        return {
            x: ((next % 2 === 0 ? -1 : 1) * (10 + next * 3)),
            y: next * 10
        };
    }

    spawnCombatText(position, text, variant = 'damage') {
        if (!this.animationLayer || !position || !text) {
            return;
        }
        const label = document.createElement('div');
        label.className = `battle-combat-text ${variant}`.trim();
        label.textContent = text;
        label.style.left = `${position.left + position.width / 2}px`;
        label.style.top = `${position.top + Math.max(10, position.height * 0.2)}px`;
        this.animationLayer.appendChild(label);
        setTimeout(() => {
            if (label.parentNode) {
                label.parentNode.removeChild(label);
            }
        }, variant === 'skill-label' ? 900 : 1050);
    }

    scheduleBattleEffect(callback, delay = 0) {
        if (delay <= 0) {
            if (this.visible) {
                callback();
            }
            return null;
        }
        const timerId = setTimeout(() => {
            this.effectTimers.delete(timerId);
            if (this.visible) {
                callback();
            }
        }, delay);
        this.effectTimers.add(timerId);
        return timerId;
    }

    clearBattleEffectTimers() {
        if (!this.effectTimers) {
            this.effectTimers = new Set();
            return;
        }
        this.effectTimers.forEach(timerId => clearTimeout(timerId));
        this.effectTimers.clear();
    }

    getEffectCenter(position) {
        return {
            x: position.left + position.width / 2,
            y: position.top + position.height / 2
        };
    }

    spawnBattleEffect(className, position, options = {}) {
        if (!this.animationLayer || !position) {
            return null;
        }
        const effect = document.createElement('div');
        effect.className = `battle-effect ${className}`.trim();
        if (options.isCritical) {
            effect.classList.add('is-critical');
        }
        if (options.isRevive) {
            effect.classList.add('is-revive');
        }

        const center = this.getEffectCenter(position);
        const left = Number.isFinite(Number(options.left)) ? Number(options.left) : center.x;
        const top = Number.isFinite(Number(options.top)) ? Number(options.top) : center.y;
        effect.style.left = `${left}px`;
        effect.style.top = `${top}px`;

        if (Number.isFinite(Number(options.width))) {
            effect.style.width = `${Number(options.width)}px`;
        }
        if (Number.isFinite(Number(options.height))) {
            effect.style.height = `${Number(options.height)}px`;
        }
        if (Number.isFinite(Number(options.angle))) {
            effect.style.setProperty('--effect-angle', `${Number(options.angle)}deg`);
        }
        if (Number.isFinite(Number(options.scale))) {
            effect.style.setProperty('--effect-scale', `${Number(options.scale)}`);
        }
        if (options.html) {
            effect.innerHTML = options.html;
        }

        this.animationLayer.appendChild(effect);
        this.scheduleBattleEffect(() => {
            if (effect.parentNode) {
                effect.parentNode.removeChild(effect);
            }
        }, Number(options.duration) || 900);
        return effect;
    }

    spawnAttackTrail(fromPosition, toPosition, options = {}) {
        this.scheduleBattleEffect(() => {
            if (!fromPosition || !toPosition) {
                return;
            }
            const from = this.getEffectCenter(fromPosition);
            const to = this.getEffectCenter(toPosition);
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < 4) {
                return;
            }
            this.spawnBattleEffect('battle-attack-trail', fromPosition, {
                left: from.x,
                top: from.y,
                width: Math.max(24, distance),
                height: options.isCritical ? 8 : 6,
                angle: Math.atan2(dy, dx) * 180 / Math.PI,
                duration: options.isCritical ? 620 : 520,
                isCritical: options.isCritical
            });
        }, Number(options.delay) || 0);
    }

    spawnImpactEffect(position, options = {}) {
        this.scheduleBattleEffect(() => {
            const size = options.isCritical ? 78 : 54;
            this.spawnBattleEffect('battle-hit-spark', position, {
                width: size,
                height: size,
                angle: Number(options.angle) || 0,
                duration: options.isCritical ? 780 : 620,
                isCritical: options.isCritical
            });
            if (options.shake !== false) {
                this.triggerBattleShake(options.isCritical ? 'critical' : 'hit');
            }
        }, Number(options.delay) || 0);
    }

    spawnHealEffect(position, options = {}) {
        this.scheduleBattleEffect(() => {
            const count = options.isRevive ? 7 : 5;
            const motes = Array.from({ length: count }, (_, index) => `<span style="--mote-index:${index}"></span>`).join('');
            this.spawnBattleEffect('battle-heal-burst', position, {
                width: options.isRevive ? 74 : 62,
                height: options.isRevive ? 74 : 62,
                duration: options.isRevive ? 980 : 860,
                isRevive: options.isRevive,
                html: motes
            });
        }, Number(options.delay) || 0);
    }

    triggerBattleShake(kind = 'hit') {
        const stage = this.element.querySelector('.battle-board-stage');
        if (!stage) {
            return;
        }
        const className = kind === 'critical' ? 'battle-shake-critical' : 'battle-shake-hit';
        stage.classList.remove('battle-shake-hit', 'battle-shake-critical');
        void stage.offsetWidth;
        stage.classList.add(className);
        this.scheduleBattleEffect(() => {
            stage.classList.remove(className);
        }, kind === 'critical' ? 420 : 260);
    }

    spawnSkillLabel(position, skillName) {
        if (!skillName) {
            return;
        }
        this.spawnCombatText({
            left: position.left,
            top: Math.max(0, position.top - 18),
            width: position.width,
            height: 0
        }, skillName, 'skill-label');
    }

    spawnTriggerLabel(position, triggerName) {
        if (!triggerName) {
            return;
        }
        this.spawnCombatText({
            left: position.left,
            top: Math.max(0, position.top - 18),
            width: position.width,
            height: 0
        }, triggerName, 'skill-label');
    }

    applyActionEntryFeedback(entries, targetFloats = []) {
        entries.forEach((entry) => {
            const { unit, result } = entry;
            const targetFloat = targetFloats.find(item => item.entry?.unit?.id === unit.id);
            const position = targetFloat?.position || this.getCellScreenPosition(unit.position.x, unit.position.y);
            if (!position || !result) {
                return;
            }
            const offset = this.getCombatTextOffset(unit.id);
            const textPosition = {
                ...position,
                left: position.left + offset.x,
                top: Math.max(0, position.top - offset.y)
            };
            if (result.hit === false) {
                this.spawnCombatText(textPosition, 'MISS', 'miss');
                return;
            }
            if (Number(result.heal) > 0) {
                const previousHp = Math.max(0, unit.hp - Number(result.heal));
                this.setUnitHpTrail(unit.id, this.getHpPercentByValue(previousHp, unit.maxHp));
                this.spawnHealEffect(position, { delay: 60, isRevive: result.effect?.type === 'revive' });
                this.spawnCombatText(textPosition, `+${result.heal}`, 'heal');
                return;
            }
            if (Number(result.damage) > 0) {
                const previousHp = Math.min(unit.maxHp, unit.hp + Number(result.damage));
                this.scheduleHpTrailDrop(unit, previousHp, unit.hp);
                this.spawnImpactEffect(position, { delay: 120, isCritical: result.isCritical });
                this.spawnCombatText(textPosition, `-${result.damage}`, result.isCritical ? 'crit' : 'damage');
            }
            if (Array.isArray(result.appliedEffects) && result.appliedEffects.length > 0) {
                result.appliedEffects.forEach((effect, index) => {
                    this.spawnCombatText({
                        ...textPosition,
                        left: textPosition.left + index * 8,
                        top: Math.max(0, textPosition.top - 12 - index * 4)
                    }, effect.name || this.getStatusDisplayInfo(effect).shortName, 'status-label');
                });
            }
        });
    }


    /**
     * 处理单位移动动画
     */
    handleUnitMoveAnimation(unit, newPosition, oldPos) {
        return new Promise((resolve) => {
            if (!oldPos) { resolve(); return; }
            if (oldPos.x === newPosition.x && oldPos.y === newPosition.y) { resolve(); return; }

            const fromCoord = this.getCellScreenPosition(oldPos.x, oldPos.y);
            const toCoord = this.getCellScreenPosition(newPosition.x, newPosition.y);
            if (!fromCoord || !toCoord) {
                this.syncBoardCellsForMove(unit, oldPos, newPosition);
                resolve();
                return;
            }

            this.syncBoardCellsForMove(unit, oldPos, newPosition);

            const floatingEl = this.createFloatingUnit(unit);
            floatingEl.style.left = `${fromCoord.left}px`;
            floatingEl.style.top = `${fromCoord.top}px`;
            floatingEl.style.width = `${fromCoord.width}px`;
            floatingEl.style.height = `${fromCoord.height}px`;
            floatingEl.style.setProperty('--move-x', '0px');
            floatingEl.style.setProperty('--move-y', '0px');

            if (this.animationLayer) {
                this.animationLayer.appendChild(floatingEl);
            }

            const startMove = () => {
                if (!floatingEl.isConnected) {
                    return;
                }
                floatingEl.classList.add('battle-unit-moving');
                floatingEl.style.setProperty('--move-x', `${toCoord.left - fromCoord.left}px`);
                floatingEl.style.setProperty('--move-y', `${toCoord.top - fromCoord.top}px`);
            };

            floatingEl.getBoundingClientRect();
            requestAnimationFrame(() => requestAnimationFrame(startMove));

            setTimeout(() => {
                if (floatingEl.parentNode) {
                    floatingEl.parentNode.removeChild(floatingEl);
                }
                resolve();
            }, 390);

        });
    }

    /**
     * 处理攻击冲撞+受击动画
     */
    async handleAttackAnimation(attacker, target, actionData) {
        const attackerPos = this.getCellScreenPosition(attacker.position.x, attacker.position.y);
        if (!attackerPos) return;

        const actionEntries = this.getActionEntries(actionData, target);
        const primaryEntry = actionEntries[0] || null;
        const primaryTarget = primaryEntry?.unit || target;
        const targetPos = primaryTarget ? this.getCellScreenPosition(primaryTarget.position.x, primaryTarget.position.y) : null;
        const skillName = actionData?.result?.skillName || primaryEntry?.result?.skillName || null;
        const triggerName = actionData?.result?.triggerName || primaryEntry?.result?.triggerName || null;
        const pureHealAction = actionEntries.length > 0 && actionEntries.every(entry => Number(entry.result?.heal) > 0 && !entry.result?.damage);

        if (actionData?.actionType === 'skill' && skillName) {
            this.spawnSkillLabel(attackerPos, skillName);
        } else if (triggerName) {
            this.spawnTriggerLabel(attackerPos, triggerName);
        }

        this.hideUnitInBoard(attacker.id);

        const attackerFloat = this.createFloatingUnit(attacker);
        attackerFloat.style.left = `${attackerPos.left}px`;
        attackerFloat.style.top = `${attackerPos.top}px`;
        attackerFloat.style.width = `${attackerPos.width}px`;
        attackerFloat.style.height = `${attackerPos.height}px`;

        if (!pureHealAction && targetPos) {
            const dx = targetPos.left - attackerPos.left;
            const dy = targetPos.top - attackerPos.top;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const lungeDist = Math.max(Math.min(distance * 0.55, 45), 15);
            const lungeX = distance > 1 ? (dx / distance) * lungeDist : 0;
            const lungeY = distance > 1 ? (dy / distance) * lungeDist : 0;
            attackerFloat.style.setProperty('--lunge-x', `${lungeX}px`);
            attackerFloat.style.setProperty('--lunge-y', `${lungeY}px`);
        }

        const targetFloats = [];
        const uniqueTargetIds = new Set();
        actionEntries.forEach((entry) => {
            if (!entry?.unit || uniqueTargetIds.has(entry.unit.id)) {
                return;
            }
            uniqueTargetIds.add(entry.unit.id);
            const entryPos = this.getCellScreenPosition(entry.unit.position.x, entry.unit.position.y);
            if (!entryPos) {
                return;
            }
            this.hideUnitInBoard(entry.unit.id);
            const targetFloat = this.createFloatingUnit(entry.unit);
            targetFloat.style.left = `${entryPos.left}px`;
            targetFloat.style.top = `${entryPos.top}px`;
            targetFloat.style.width = `${entryPos.width}px`;
            targetFloat.style.height = `${entryPos.height}px`;
            targetFloats.push({ element: targetFloat, position: entryPos, entry });
        });

        if (this.animationLayer) {
            this.animationLayer.appendChild(attackerFloat);
            targetFloats.forEach(({ element }) => this.animationLayer.appendChild(element));
        }

        requestAnimationFrame(() => {
            if (pureHealAction) {
                attackerFloat.classList.add('battle-unit-casting');
                targetFloats.forEach(({ element }) => element.classList.add('battle-unit-heal'));
            } else {
                attackerFloat.classList.add('battle-unit-attacking');
                targetFloats.forEach(({ position, entry }, index) => {
                    const result = entry?.result || {};
                    if (result.hit === false || !(Number(result.damage) > 0)) {
                        return;
                    }
                    this.spawnAttackTrail(attackerPos, position, {
                        delay: 35 + Math.min(index * 70, 180),
                        isCritical: result.isCritical
                    });
                });
                setTimeout(() => {
                    targetFloats.forEach(({ element, entry }) => {
                        element.classList.add(entry?.result?.isCritical ? 'battle-unit-hit-critical' : 'battle-unit-hit');
                    });
                }, 95);
            }
        });

        this.applyActionEntryFeedback(actionEntries, targetFloats);

        if (Number(actionData?.result?.selfHeal) > 0) {
            this.spawnHealEffect(attackerPos, { delay: 120 });
            this.spawnCombatText({
                left: attackerPos.left + 8,
                top: Math.max(0, attackerPos.top - 8),
                width: attackerPos.width,
                height: attackerPos.height
            }, `+${actionData.result.selfHeal}`, 'heal');
        }
        if (Number(actionData?.result?.hpCost) > 0) {
            this.spawnCombatText({
                left: attackerPos.left - 8,
                top: Math.max(0, attackerPos.top + 12),
                width: attackerPos.width,
                height: attackerPos.height
            }, `-${actionData.result.hpCost}生命`, 'status-damage');
        }

        await new Promise(resolve => setTimeout(resolve, pureHealAction ? 1080 : 1220));

        [attackerFloat, ...targetFloats.map(({ element }) => element)].forEach(el => {
            if (el.parentNode) el.parentNode.removeChild(el);
        });
    }


    /**
     * 治疗动画（较温和的效果）
     */
    async handleHealAnimation(actionData) {
        const target = actionData?.target;
        if (!target) return;
        const targetPos = this.getCellScreenPosition(target.position.x, target.position.y);
        if (!targetPos) return;

        this.hideUnitInBoard(target.id);

        const targetFloat = this.createFloatingUnit(target);
        targetFloat.style.left = `${targetPos.left}px`;
        targetFloat.style.top = `${targetPos.top}px`;
        targetFloat.style.width = `${targetPos.width}px`;
        targetFloat.style.height = `${targetPos.height}px`;

        if (this.animationLayer) {
            this.animationLayer.appendChild(targetFloat);
        }

        const effect = actionData?.result?.effect || {};
        const healValue = Number(effect.value) || 0;
        if (healValue > 0) {
            this.setUnitHpTrail(target.id, this.getHpPercentByValue(Math.max(0, target.hp - healValue), target.maxHp));
            this.spawnHealEffect(targetPos, { delay: 40, isRevive: effect.type === 'revive' });
            this.spawnCombatText(targetPos, effect.type === 'revive' ? `复活 +${healValue}` : `+${healValue}`, effect.type === 'revive' ? 'revive' : 'heal');
        }

        targetFloat.style.transition = 'filter 0.3s ease';
        requestAnimationFrame(() => {
            targetFloat.style.filter = 'brightness(1.4) saturate(1.2)';
            targetFloat.classList.add('battle-unit-heal');
            setTimeout(() => {
                targetFloat.style.filter = 'brightness(1)';
            }, 250);
        });

        await new Promise(resolve => setTimeout(resolve, 1150));  // 350ms动画 + 800ms间隔

        if (targetFloat.parentNode) {
            targetFloat.parentNode.removeChild(targetFloat);
        }

    }

    async handleStatusAnimation(actionData) {
        const target = actionData?.target;
        if (!target) {
            return;
        }
        const targetPos = this.getCellScreenPosition(target.position.x, target.position.y);
        if (!targetPos) {
            return;
        }
        if (actionData.actionType === 'status') {
            const damage = Number(actionData?.result?.damage) || 0;
            const heal = Number(actionData?.result?.heal) || 0;
            const appliedEffects = Array.isArray(actionData?.result?.appliedEffects) ? actionData.result.appliedEffects : [];
            if (heal > 0) {
                this.spawnHealEffect(targetPos, { delay: 40 });
                this.spawnCombatText(targetPos, `+${heal}`, 'heal');
            } else if (damage > 0) {
                const statusName = actionData?.result?.statusName || '状态';
                this.spawnImpactEffect(targetPos, { delay: 80, shake: false });
                this.spawnCombatText(targetPos, `${statusName} -${damage}`, 'status-damage');
            } else if (appliedEffects.length > 0) {
                appliedEffects.forEach((effect, index) => {
                    this.spawnCombatText({
                        ...targetPos,
                        left: targetPos.left + index * 8,
                        top: targetPos.top - index * 6
                    }, effect.name || '状态', 'status-label');
                });
            } else {
                const statusName = actionData?.result?.statusName || '状态';
                this.spawnCombatText(targetPos, statusName, 'status-label');
            }
        } else if (actionData.actionType === 'status_expire') {
            const expiredEffects = Array.isArray(actionData?.result?.expiredEffects) ? actionData.result.expiredEffects : [];
            expiredEffects.forEach((effect, index) => {
                this.spawnCombatText({
                    ...targetPos,
                    left: targetPos.left + index * 8,
                    top: targetPos.top - index * 6
                }, `${effect.name || '状态'}结束`, 'status-expire');
            });
        }
        await new Promise(resolve => setTimeout(resolve, 650));
    }

    /**
     * 死亡动画
     */
    handleDeathAnimation(unit) {
        return new Promise((resolve) => {
            const pos = this.getCellScreenPosition(unit.position.x, unit.position.y);
            if (!pos) { resolve(); return; }

            this.hideUnitInBoard(unit.id);

            const deathFloat = this.createFloatingUnit(unit);
            deathFloat.style.left = `${pos.left}px`;
            deathFloat.style.top = `${pos.top}px`;
            deathFloat.style.width = `${pos.width}px`;
            deathFloat.style.height = `${pos.height}px`;

            if (this.animationLayer) {
                this.animationLayer.appendChild(deathFloat);
            }

            requestAnimationFrame(() => {
                deathFloat.classList.add('battle-unit-dying');
            });

            // 死亡动画520ms + 间隔800ms
            setTimeout(() => {
                if (deathFloat.parentNode) {
                    deathFloat.parentNode.removeChild(deathFloat);
                }
                resolve();
            }, 1320);
        });
    }

    /**
     * 隐藏棋盘中指定单位的显示
     */
    hideUnitInBoard(unitId) {
        const board = this.element.querySelector('#battle-board');
        if (!board) return;
        const token = board.querySelector(`[data-unit-id="${unitId}"]`);
        if (token) {
            token.style.visibility = 'hidden';
            token.dataset.wasHidden = 'true';
        }
    }

    /**
     * 显示棋盘中指定单位
     */
    showUnitInBoard(unitId) {
        const board = this.element.querySelector('#battle-board');
        if (!board) return;
        const token = board.querySelector(`[data-unit-id="${unitId}"]`);
        if (token) {
            token.style.visibility = '';
            delete token.dataset.wasHidden;
        }
    }


    stopBattle() {
        this.isPaused = false;
        this.skipBattleRequested = false;
        this.closePauseModal();
        this.cancelBattleStateRender();
        battleManager.setAutoBattleOverride();
        this.clearPendingAction({ type: 'defend', reason: 'cancelled' });
        if (this.unsubscribeState) {
            this.unsubscribeState();
            this.unsubscribeState = null;
        }
        // 清理动画相关监听
        if (this.moveUnsubscribe) {
            this.moveUnsubscribe();
            this.moveUnsubscribe = null;
        }
        if (this.actionUnsubscribe) {
            this.actionUnsubscribe();
            this.actionUnsubscribe = null;
        }
        if (this.dieUnsubscribe) {
            this.dieUnsubscribe();
            this.dieUnsubscribe = null;
        }
        this.lastUnitPositions.clear();
        this.lastBoardRenderKey = '';
        this.animationLayer = null;
        this.actionQueue = [];
        this.isProcessingAction = false;
        this.clearHpTrailTimers();
        this.clearBattleEffectTimers();
        this.stopEnvironmentEffect();
        this.environmentCanvas = null;
        this.resolveActionQueueWaiters();
        this.actionQueueWaiters = [];
        this.progressTokenMap = new Map();
        this.progressValueMap = new Map();
        this.displayProgressMap = new Map();
        this.hpTrailMap = new Map();
        this.combatTextBurstMap = new Map();
        this.inspectedUnitId = null;
        this.inspectedSpecialTile = null;
        this.inspectedObstacle = null;
        battleManager.reset();

        this.currentDungeon = null;
    }
}

const battleView = new BattleView();
window.battleView = battleView;
