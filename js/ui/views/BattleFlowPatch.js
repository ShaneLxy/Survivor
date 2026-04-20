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
        const countdownText = isHeroTurn ? ` · 剩余 ${this.pendingAction.remainingTime}s` : '';
        if (snapshot.isBossEntrancePlaying) {
            meta.textContent = `${this.getRoundLabel(snapshot.currentRound)} · 领主登场中...`;
            return;
        }
        meta.textContent = actor
            ? `${this.getRoundLabel(snapshot.currentRound)} · 当前行动: ${actor.name}${countdownText}`
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
            title: '战斗失败',
            showClose: false,
            content: `
                <div style="text-align:center;">
                    <div style="font-size:64px;margin-bottom:15px;">💥</div>
                    <p>本次作战失败，返回副本后可以继续调整阵容。</p>
                </div>
            `,
            buttons: [{
                text: '确定',
                className: 'btn-primary',
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
