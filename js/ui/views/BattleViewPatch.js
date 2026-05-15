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
        const autoButton = this.pauseModal?.overlay?.querySelector('.battle-pause-auto-btn');
        if (autoButton) {
            autoButton.textContent = this.getPauseAutoBattleLabel();
        }
    };

    BattleView.prototype.showPauseModal = function() {
        if (this.pauseModal?.isShown()) {
            return;
        }
        this.pauseModal = new Modal({
            title: '游戏暂停',
            content: '<div class="battle-pause-tip">暂停后可切换自动战斗、直接退出或返回战斗。</div>',
            showClose: false,
            buttons: [
                {
                    text: this.getPauseAutoBattleLabel(),
                    className: 'btn-danger battle-pause-auto-btn',
                    onClick: () => this.togglePauseAutoBattle()
                },
                {
                    text: '退出战斗',
                    className: 'btn-secondary',
                    onClick: () => this.exitBattleFromPause()
                },
                {
                    text: '返回战斗',
                    className: 'btn-primary',
                    onClick: () => this.resumeBattle()
                }
            ]
        });
        this.pauseModal.show();
    };

    BattleView.prototype.togglePauseAutoBattle = function() {
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
