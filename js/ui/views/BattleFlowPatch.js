(function() {
    if (typeof BattleView === 'undefined' || !window.battleView) {
        return;
    }

    BattleView.prototype.getRoundLabel = function(round) {
        return `第 ${Math.max(0, Number(round) || 0)} 行动轮`;
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

        if (result.victory) {
            Modal.closeAll();
            const rewardResult = window.game.grantDungeonVictoryRewards(dungeon, result.participants || heroManager.getTeamIds());
            await RewardModal.show({
                title: '战斗胜利',
                rewards: rewardResult.rewardEntries,
                summaryText: '本次副本奖励已全部结算'
            });
            eventManager.emit('viewChange', { view: 'dungeon' });
            return;
        }

        Modal.closeAll();
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
