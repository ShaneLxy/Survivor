(function() {
    if (typeof BattleView === 'undefined' || !window.battleView) {
        return;
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    }

    function formatNumber(value) {
        return `${Math.max(0, Math.floor(Number(value) || 0))}`;
    }

    function formatPercent(value) {
        return `${(Math.max(0, Number(value) || 0) * 100).toFixed(1)}%`;
    }

    function getHeroShortName(value) {
        const name = String(value ?? '').trim();
        if (!name) {
            return '';
        }
        const parts = name.split('-');
        if (parts.length < 2) {
            return name;
        }
        const shortName = parts[parts.length - 1].trim();
        return shortName || name;
    }

    BattleView.prototype.getRoundLabel = function(round) {
        return `第 ${Math.max(0, Number(round) || 0)} 行动轮`;
    };

    BattleView.prototype.getBattleStatsSummary = function(result = null) {
        return result?.battleStats
            || battleManager.getBattleStatsSummary?.()
            || battleManager.getSnapshot?.()?.battleStats
            || { totals: { damage: 0, heal: 0, takenDamage: 0 }, entries: [], mvpHeroId: null };
    };

    BattleView.prototype.waitForBattleOverlayRelease = function() {
        if (!this._battleOverlayReleasePromise) {
            return Promise.resolve();
        }
        return this._battleOverlayReleasePromise;
    };

    BattleView.prototype.holdBattleOverlay = function() {
        if (this._battleOverlayReleasePromise) {
            return;
        }
        this._battleOverlayReleasePromise = new Promise((resolve) => {
            this._battleOverlayReleaseResolver = resolve;
        });
    };

    BattleView.prototype.releaseBattleOverlay = function() {
        if (typeof this._battleOverlayReleaseResolver === 'function') {
            this._battleOverlayReleaseResolver();
        }
        this._battleOverlayReleaseResolver = null;
        this._battleOverlayReleasePromise = null;
    };

    BattleView.prototype.forceCloseBattleStatsModal = function() {
        if (this.battleStatsModal?.isShown?.()) {
            this.battleStatsModal.close();
        }
        this.battleStatsModal = null;
        this.releaseBattleOverlay();
    };

    BattleView.prototype.renderBattleStatsRows = function(summary) {
        const entries = Array.isArray(summary?.entries) ? summary.entries : [];
        if (entries.length <= 0) {
            return `
                <div class="battle-stats-empty">
                    <div class="battle-stats-empty-title">暂无可用战报</div>
                    <div class="battle-stats-empty-text">当前战斗尚未产生有效统计数据。</div>
                </div>
            `;
        }
        return entries.map((entry) => {
            const unit = entry?.unit || {
                id: entry?.heroId || '',
                name: entry?.name || '英雄',
                icon: (entry?.name || '战').slice(0, 1)
            };
            const fullName = entry?.name || unit.name || entry?.heroId || '英雄';
            const name = escapeHtml(getHeroShortName(fullName));
            return `
                <div class="battle-stats-row ${entry?.isMvp ? 'is-mvp' : ''}">
                    <div class="battle-stats-hero">
                        <div class="battle-stats-avatar">${this.getBattleUnitVisualMarkup(unit, 'progress')}</div>
                        <div class="battle-stats-hero-meta">
                            <div class="battle-stats-hero-name">${name}</div>
                            ${entry?.isMvp ? '<div class="battle-stats-hero-badge">MVP</div>' : ''}
                        </div>
                    </div>
                    <div class="battle-stats-metrics">
                        <div class="battle-stats-metric">
                            <span>输出</span>
                            <strong>${formatNumber(entry?.damage)}</strong>
                            <em>${formatPercent(entry?.damageShare)}</em>
                        </div>
                        <div class="battle-stats-metric">
                            <span>治疗</span>
                            <strong>${formatNumber(entry?.heal)}</strong>
                            <em>${formatPercent(entry?.healShare)}</em>
                        </div>
                        <div class="battle-stats-metric">
                            <span>承伤</span>
                            <strong>${formatNumber(entry?.takenDamage)}</strong>
                            <em>${formatPercent(entry?.takenDamageShare)}</em>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    };

    BattleView.prototype.getBattleStatsMvpEntry = function(summary) {
        const entries = Array.isArray(summary?.entries) ? summary.entries : [];
        return entries.find((entry) => entry?.isMvp) || entries[0] || null;
    };

    BattleView.prototype.playBattleStatsMvpVoice = function(summary) {
        const entry = this.getBattleStatsMvpEntry(summary);
        const hero = entry?.unit || heroManager?.getHero?.(entry?.heroId) || null;
        if (!hero) {
            return null;
        }
        return window.audioManager?.playHeroVoiceCue?.(hero, 'mvp', {
            priority: 5,
            interrupt: true
        }) || null;
    };

    BattleView.prototype.getBattleStatsMvpPortraitMarkup = function(summary) {
        const entry = this.getBattleStatsMvpEntry(summary);
        if (!entry) {
            return '';
        }
        const ownedHero = heroManager?.getHero?.(entry.heroId) || null;
        const heroConfig = ownedHero?.configId
            ? HeroConfig.getHeroConfig(ownedHero.configId)
            : null;
        const portrait = heroConfig?.portrait
            || ownedHero?.portrait
            || heroConfig?.cardPortrait
            || ownedHero?.cardPortrait
            || entry?.unit?.portrait
            || null;
        const src = portrait ? this.resolveAssetUrl(portrait) : '';
        const fullName = entry?.name || heroConfig?.name || ownedHero?.name || 'MVP';
        const name = escapeHtml(fullName);
        const altName = escapeHtml(fullName);
        return `
            <div class="battle-stats-mvp-portrait-shell" aria-hidden="true">
                <div class="battle-stats-mvp-portrait-frame">
                    ${src
                        ? `<img class="battle-stats-mvp-portrait" src="${src}" alt="${altName}" loading="eager" decoding="async" draggable="false">`
                        : `<div class="battle-stats-mvp-portrait-fallback">${name.slice(0, 1)}</div>`}
                </div>
                <div class="battle-stats-mvp-chip">
                    <span>MVP</span>
                    <strong>${name}</strong>
                </div>
            </div>
        `;
    };

    BattleView.prototype.buildBattleStatsModalContent = function(summary, options = {}) {
        return `
            <div class="battle-stats-modal">
                ${options?.final ? this.getBattleStatsMvpPortraitMarkup(summary) : ''}
                <div class="battle-stats-table">
                    <div class="battle-stats-table-body">
                        ${this.renderBattleStatsRows(summary)}
                    </div>
                </div>
            </div>
        `;
    };

    BattleView.prototype.bindBattleStatsTabs = function() {
        // 战报弹窗已简化为仅明细表格，Tab 切换逻辑不再需要，保留空函数以防外部误调
    };

    BattleView.prototype.openBattleStatsModal = function(options = {}) {
        if (this.battleStatsModal?.isShown?.()) {
            return this._battleStatsModalPromise || Promise.resolve();
        }
        const final = Boolean(options?.final);
        const summary = this.getBattleStatsSummary(options?.result);
        const shouldPauseBattle = !final && !this.isPaused;
        if (!final) {
            this.holdBattleOverlay();
            this.isPaused = true;
            if (this.pendingAction?.timerId) {
                clearInterval(this.pendingAction.timerId);
                this.pendingAction.timerId = null;
            }
            this.closeItemSelectModal();
            this.renderBattleState();
        }

        this._battleStatsModalPromise = new Promise((resolve) => {
            let closed = false;
            const finishClose = () => {
                if (closed) {
                    return;
                }
                closed = true;
                this.battleStatsModal = null;
                this._battleStatsModalPromise = null;
                if (!final) {
                    this.releaseBattleOverlay();
                    if (shouldPauseBattle && this.visible) {
                        this.isPaused = false;
                        if (this.pendingAction && battleManager.isAutoBattleEnabled()) {
                            const autoAction = battleManager.chooseAutoAction(this.pendingAction.context.actor);
                            this.resolvePendingAction(autoAction);
                            resolve();
                            return;
                        }
                        if (this.pendingAction) {
                            this.startPendingActionTimer();
                        }
                        this.renderBattleState();
                    } else if (this.visible) {
                        this.renderBattleState();
                    }
                }
                resolve();
            };

            const buttonText = final
                ? (options?.result?.victory ? '继续结算' : '继续')
                : '继续战斗';
            const modal = new Modal({
                title: final ? (options?.result?.victory ? '战斗结算' : '作战结算') : '实时战报',
                showClose: !final,
                className: 'battle-stats-modal-shell',
                content: this.buildBattleStatsModalContent(summary, options),
                buttons: [{
                    text: buttonText,
                    className: 'btn-primary battle-stats-modal-action',
                    onClick: () => modal.close()
                }],
                onClose: finishClose
            });
            this.battleStatsModal = modal;
            modal.show();
            this.bindBattleStatsTabs(modal);
            if (final) {
                this.playBattleStatsMvpVoice(summary);
            }
        });

        return this._battleStatsModalPromise;
    };

    const originalStopBattle = BattleView.prototype.stopBattle;
    BattleView.prototype.stopBattle = function() {
        this.forceCloseBattleStatsModal();
        return originalStopBattle.apply(this, arguments);
    };

    const originalRenderShell = BattleView.prototype.renderShell;
    BattleView.prototype.renderShell = function() {
        originalRenderShell.call(this);
        const alert = this.element.querySelector('#battle-boss-alert');
        if (alert) {
            alert.style.position = 'absolute';
            alert.style.inset = '0';
            alert.style.pointerEvents = 'none';
        }
        const hudBar = this.element.querySelector('.battle-hud-bar');
        const pauseButton = hudBar?.querySelector('.battle-pause-btn');
        if (hudBar) {
            hudBar.classList.add('has-stats-btn');
        }
        if (hudBar && pauseButton && !hudBar.querySelector('#battle-stats-btn')) {
            const statsButton = document.createElement('button');
            statsButton.type = 'button';
            statsButton.id = 'battle-stats-btn';
            statsButton.className = 'btn btn-secondary battle-stats-btn battle-pause-icon-btn';
            statsButton.textContent = '报';
            statsButton.setAttribute('aria-label', '战报');
            statsButton.title = '战报';
            statsButton.addEventListener('click', () => {
                this.openBattleStatsModal({ final: false });
            });
            hudBar.insertBefore(statsButton, pauseButton.nextSibling);
        }
    };

    BattleView.prototype.renderTurnMeta = function(snapshot) {
        const meta = this.element.querySelector('#battle-turn-meta');
        if (!meta) {
            return;
        }
        const actor = battleManager.currentActor;
        const pendingActorId = this.pendingAction?.context?.actor?.id || null;
        const isHeroTurn = Boolean(this.pendingAction && actor && actor.camp === 'hero' && actor.id === pendingActorId);
        const countdownChip = this.element.querySelector('#battle-countdown-chip');
        if (countdownChip) {
            const remaining = Math.max(0, Number(this.pendingAction?.remainingTime) || 0);
            countdownChip.textContent = isHeroTurn
                ? `${remaining}s`
                : (actor?.camp === 'enemy' ? '敌方' : '待机');
            countdownChip.classList.toggle('is-warning', isHeroTurn && remaining <= 5);
            countdownChip.classList.toggle('is-enemy', Boolean(actor && actor.camp === 'enemy'));
        }
        if (snapshot.isBossEntrancePlaying) {
            meta.textContent = `${this.getRoundLabel(snapshot.currentRound)} · 领主登场中...`;
            return;
        }
        meta.textContent = actor
            ? `${this.getRoundLabel(snapshot.currentRound)} · 当前行动: ${actor.name}`
            : this.getRoundLabel(snapshot.currentRound);
    };

    BattleView.prototype.onBattleEnd = async function(result, dungeon) {
        this.isPaused = false;
        this.skipBattleRequested = false;
        this.closePauseModal();
        battleManager.setAutoBattleOverride();
        this.clearPendingAction();
        this.forceCloseBattleStatsModal();
        Modal.closeAll();

        await this.openBattleStatsModal({
            final: true,
            result
        });

        if (result.victory) {
            const rewardResult = window.game.grantDungeonVictoryRewards(dungeon, result.participants || heroManager.getTeamIds());
            saveSyncService.uploadCurrentSave?.({ force: true });
            await RewardModal.show({
                title: '战斗胜利',
                rewards: rewardResult.rewardEntries,
                summaryText: '本次副本奖励已全部结算'
            });
            eventManager.emit('viewChange', { view: 'dungeon' });
            return;
        }

        let exited = false;
        const exitToDungeon = () => {
            if (exited) {
                return;
            }
            exited = true;
            this.stopBattle();
            eventManager.emit('viewChange', { view: 'dungeon' });
        };

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
            buttons: [{
                text: '返回副本',
                className: 'btn-primary battle-defeat-modal-action',
                onClick: () => {
                    modal.close();
                    exitToDungeon();
                }
            }],
            onClose: exitToDungeon
        });
        modal.show();
    };
})();
