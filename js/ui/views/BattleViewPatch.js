(function() {
    if (typeof BattleView === 'undefined' || !window.battleView) {
        return;
    }

    BattleView.prototype.getBattleBackground = function() {
        const dungeonId = this.currentDungeon?.id;
        const chapter = (window.DungeonChapterConfig || []).find((entry) => {
            const dungeonIds = Array.isArray(entry?.dungeonIds) ? entry.dungeonIds : [];
            return dungeonId && dungeonIds.includes(dungeonId);
        });
        const background = chapter?.battleBackground || chapter?.background || this.currentDungeon?.battleBackground || window.GameSceneBackgrounds?.battle?.src || '';
        return this.resolveAssetUrl?.(background) || background;
    };

    const originalRenderShell = BattleView.prototype.renderShell;
    BattleView.prototype.renderShell = function() {
        originalRenderShell.call(this);
        const view = this.element.querySelector('.battle-view');
        const stage = this.element.querySelector('.battle-board-stage');
        const board = this.element.querySelector('.battle-board');
        const background = this.getBattleBackground();
        if (view && background) {
            view.classList.add('battle-view-themed');
            view.style.setProperty('--battle-bg-image', `url('${background}')`);
            view.dataset.battleBackground = background;
        }
        if (stage && background) {
            const image = document.createElement('img');
            image.className = 'battle-background-image';
            image.alt = '';
            image.decoding = 'async';
            image.loading = 'eager';
            image.addEventListener('load', () => {
                stage.classList.add('is-background-loaded');
                stage.classList.remove('is-background-missing');
            }, { once: true });
            image.addEventListener('error', () => {
                stage.classList.add('is-background-missing');
                stage.classList.remove('is-background-loaded');
            }, { once: true });
            image.src = background;
            stage.insertBefore(image, stage.firstChild);
        }
        [stage, board].forEach((element) => {
            if (!element || !background) {
                return;
            }
            element.classList.add('battle-themed-surface');
            element.style.setProperty('--battle-bg-image', `url('${background}')`);
        });
    };

    BattleView.prototype.waitWhilePaused = async function() {
        while (this.isPaused && this.visible && battleManager.isBattling) {
            await Utils.delay(100);
        }
    };

    const originalPauseBattle = BattleView.prototype.pauseBattle;
    BattleView.prototype.pauseBattle = function() {
        originalPauseBattle.call(this);
    };

    BattleView.prototype.getPauseAutoBattleLabel = function() {
        return battleManager.isAutoBattleEnabled() ? '关闭自动战斗' : '启动自动战斗';
    };

    BattleView.prototype.refreshPauseModalAutoButton = function() {
        const autoCard = this.pauseModal?.overlay?.querySelector('.battle-pause-btn-card.btn-auto');
        if (!autoCard) {
            return;
        }
        const isAutoAllowed = battleManager.isAutoBattleAllowed();
        const isAutoEnabled = battleManager.isAutoBattleEnabled();
        autoCard.classList.toggle('is-active', isAutoEnabled);
        autoCard.classList.toggle('is-disabled', !isAutoAllowed);
        const descEl = autoCard.querySelector('.battle-pause-btn-desc');
        if (descEl) {
            if (!isAutoAllowed) {
                descEl.textContent = '需解锁卓越特权';
            } else {
                descEl.textContent = isAutoEnabled ? '已开启 · 点击关闭' : '已关闭 · 点击开启';
            }
        }
    };

    BattleView.prototype.showPauseModal = function() {
        if (this.pauseModal?.isShown()) {
            return;
        }

        const dungeon = this.currentDungeon;
        const dialogues = dungeon ? (dungeon.storyDialogues || dungeon.story?.dialogues || null) : null;
        const hasStoryDialogues = dialogues && Array.isArray(dialogues) && dialogues.length > 0;
        const isAutoAllowed = battleManager.isAutoBattleAllowed();
        const isAutoEnabled = battleManager.isAutoBattleEnabled();

        // SVG图标定义
        const icons = {
            // 书本图标 - 回顾剧情
            story: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                <line x1="8" y1="7" x2="16" y2="7"></line>
                <line x1="8" y1="11" x2="14" y2="11"></line>
            </svg>`,
            // 机器人头部图标 - 自动战斗
            auto: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="2" x2="12" y2="5"></line>
                <circle cx="12" cy="2" r="1" fill="currentColor"></circle>
                <rect x="4" y="7" width="16" height="13" rx="2"></rect>
                <circle cx="9" cy="13" r="1.3" fill="currentColor" stroke="none"></circle>
                <circle cx="15" cy="13" r="1.3" fill="currentColor" stroke="none"></circle>
                <line x1="9" y1="17" x2="15" y2="17"></line>
            </svg>`,
            // 退出图标
            exit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>`,
            // 播放图标 - 返回战斗
            resume: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="6 4 20 12 6 20 6 4"></polygon>
            </svg>`
        };

        // 创建自定义按钮HTML
        const buttonsHTML = [];

        // 回顾剧情按钮（如果有剧情）
        if (hasStoryDialogues) {
            buttonsHTML.push(`
                <div class="battle-pause-btn-card btn-story" data-action="review-story">
                    <div class="battle-pause-btn-icon">${icons.story}</div>
                    <div class="battle-pause-btn-text">
                        <div class="battle-pause-btn-title">回顾剧情</div>
                        <div class="battle-pause-btn-desc">重新观看本关卡的剧情对话</div>
                    </div>
                </div>
            `);
        }

        // 自动战斗切换按钮（开启时常亮，关闭时熄灭；未解锁卓越特权时灰显）
        const autoDescText = !isAutoAllowed
            ? '需解锁卓越特权'
            : (isAutoEnabled ? '已开启 · 点击关闭' : '已关闭 · 点击开启');
        const autoExtraClass = `${isAutoEnabled ? ' is-active' : ''}${isAutoAllowed ? '' : ' is-disabled'}`;
        buttonsHTML.push(`
            <div class="battle-pause-btn-card btn-auto${autoExtraClass}" data-action="toggle-auto">
                <div class="battle-pause-btn-icon">${icons.auto}</div>
                <div class="battle-pause-btn-text">
                    <div class="battle-pause-btn-title">自动战斗</div>
                    <div class="battle-pause-btn-desc">${autoDescText}</div>
                </div>
            </div>
        `);

        // 退出战斗按钮
        buttonsHTML.push(`
            <div class="battle-pause-btn-card btn-skip" data-action="exit-battle">
                <div class="battle-pause-btn-icon">${icons.exit}</div>
                <div class="battle-pause-btn-text">
                    <div class="battle-pause-btn-title">退出战斗</div>
                    <div class="battle-pause-btn-desc">放弃战斗，不会获得奖励</div>
                </div>
            </div>
        `);

        // 返回战斗按钮
        buttonsHTML.push(`
            <div class="battle-pause-btn-card btn-resume" data-action="resume-battle">
                <div class="battle-pause-btn-icon">${icons.resume}</div>
                <div class="battle-pause-btn-text">
                    <div class="battle-pause-btn-title">返回战斗</div>
                    <div class="battle-pause-btn-desc">继续当前战斗</div>
                </div>
            </div>
        `);

        const content = document.createElement('div');
        content.innerHTML = buttonsHTML.join('');

        // 绑定点击事件
        const self = this;
        content.querySelectorAll('.battle-pause-btn-card').forEach(card => {
            card.addEventListener('click', () => {
                const action = card.dataset.action;
                if (action === 'review-story') {
                    self.reviewStory();
                } else if (action === 'toggle-auto') {
                    self.togglePauseAutoBattle();
                } else if (action === 'exit-battle') {
                    self.exitBattleFromPause();
                } else if (action === 'resume-battle') {
                    self.resumeBattle();
                }
            });
        });

        this.pauseModal = new Modal({
            title: '游戏暂停',
            content: content,
            showClose: false,
            className: 'battle-pause-modal',
            buttons: []
        });
        this.pauseModal.show();
    };

    BattleView.prototype.togglePauseAutoBattle = function() {
        if (!battleManager.isAutoBattleAllowed()) {
            Toast.info('需解锁卓越特权才能使用自动战斗');
            return;
        }
        battleManager.setAutoBattleOverride(!battleManager.isAutoBattleEnabled());
        this.refreshPauseModalAutoButton();
        this.renderBattleState();
    };

    BattleView.prototype.exitBattleFromPause = function() {
        this.isPaused = false;
        this.closePauseModal();
        this.stopBattle();
        eventManager.emit('viewChange', { view: 'dungeon' });
        Toast.info('已退出战斗，本次不会获得奖励。');
    };

    BattleView.prototype.skipBattle = function() {
        this.togglePauseAutoBattle();
    };
})();

(function() {
    if (typeof BattleManager === 'undefined' || !window.battleManager) {
        return;
    }

    const originalResolveActionForActor = BattleManager.prototype.resolveActionForActor;
    BattleManager.prototype.resolveActionForActor = async function(actor) {
        if (window.battleView?.waitWhilePaused) {
            await window.battleView.waitWhilePaused();
        }
        return originalResolveActionForActor.call(this, actor);
    };

    const originalExecuteAction = BattleManager.prototype.executeAction;
    BattleManager.prototype.executeAction = async function(actor, action) {
        if (window.battleView?.waitWhilePaused) {
            await window.battleView.waitWhilePaused();
        }
        return originalExecuteAction.call(this, actor, action);
    };
})();
