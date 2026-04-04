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
    }

    show() {
        this.visible = true;
    }

    hide() {
        this.visible = false;
        this.stopBattle();
        this.element.innerHTML = '';
    }

    async startBattle(dungeonId, sceneId = 'standard_9x9') {
        const dungeon = dungeonManager.getDungeon(dungeonId);
        if (!dungeon) {
            Toast.error('副本不存在');
            eventManager.emit('viewChange', { view: 'dungeon' });
            return;
        }

        const heroes = heroManager.createBattleUnits();
        const enemies = dungeon.createEnemies(window.game.player.level);
        if (heroes.length === 0) {
            Toast.error('没有可战斗的英雄');
            eventManager.emit('viewChange', { view: 'dungeon' });
            return;
        }
        if (enemies.length === 0) {
            Toast.error('没有敌人');
            eventManager.emit('viewChange', { view: 'dungeon' });
            return;
        }

        this.currentDungeon = dungeon;
        this.isPaused = false;
        this.skipBattleRequested = false;
        this.closePauseModal();
        this.battleSessionId++;
        battleManager.initBattle({ heroes, enemies, sceneId: dungeon.sceneId || sceneId });
        battleManager.setDecisionProvider(context => this.requestPlayerAction(context));
        this.renderShell();
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
                this.renderBattleState();
            }
        });
    }

    renderShell() {
        this.element.innerHTML = `
            <div class="battle-view battle-grid-view">
                <div class="battle-top-panel">
                    <div class="battle-top-row">
                        <button class="btn btn-secondary battle-pause-btn" onclick="window.game.ui.battleView.pauseBattle()">⏸</button>
                        <div id="battle-turn-meta" class="battle-turn-meta"></div>
                    </div>
                    <div id="battle-progress-track" class="battle-progress-track"></div>
                </div>
                <div class="battle-main-panel">
                    <div id="battle-board" class="battle-board"></div>
                    <div id="battle-action-panel" class="battle-action-panel"></div>
                </div>
            </div>
        `;
    }

    renderBattleState() {
        if (!this.visible) {
            return;
        }
        const snapshot = battleManager.getSnapshot();
        this.renderTurnMeta(snapshot);
        this.renderProgress(snapshot);
        this.renderBoard(snapshot);
        this.renderActionPanel();
    }

    renderTurnMeta(snapshot) {
        const meta = this.element.querySelector('#battle-turn-meta');
        if (!meta) {
            return;
        }
        const actor = battleManager.currentActor;
        const countdownText = this.pendingAction ? ` · 剩余 ${this.pendingAction.remainingTime}s` : '';
        meta.textContent = actor
            ? `第 ${snapshot.currentRound} 回合 · 当前行动：“${actor.name}”${countdownText}`
            : `第 ${snapshot.currentRound} 回合`;
    }

    updateTurnMetaOnly() {
        if (!this.visible) {
            return;
        }
        this.renderTurnMeta(battleManager.getSnapshot());
    }


    renderProgress(snapshot) {
        const track = this.element.querySelector('#battle-progress-track');
        if (!track) {
            return;
        }
        const units = [...snapshot.heroes, ...snapshot.enemies].filter(unit => unit.isAlive());
        track.innerHTML = '<div class="battle-progress-scale"><span>0</span><span>100</span></div><div class="battle-progress-line"></div>';
        units.forEach(unit => {
            const token = document.createElement('div');
            token.className = `battle-progress-token ${unit.camp} ${battleManager.currentActor?.id === unit.id ? 'active' : ''}`;
            token.style.left = `calc(${Math.min(100, Math.max(0, unit.progress))}% - 13px)`;
            token.innerHTML = `<span>${unit.icon}</span>`;
            track.appendChild(token);
        });
    }

    renderBoard(snapshot) {
        const board = this.element.querySelector('#battle-board');
        if (!board) {
            return;
        }
        const { width, height } = snapshot.scene;
        board.style.gridTemplateColumns = `repeat(${width}, minmax(0, 1fr))`;
        board.style.gridTemplateRows = `repeat(${height}, minmax(0, 1fr))`;
        board.innerHTML = '';

        const actor = this.pendingAction?.context?.actor || null;
        const isMoveMode = this.selectionMode === 'move';
        const isTargetMode = this.selectionMode === 'attack' || this.selectionMode === 'skill';
        const boardClickable = Boolean(actor && this.selectionMode && !this.isPaused && !battleManager.isAutoBattleEnabled());
        const moveTargetSet = isMoveMode && actor
            ? new Set(battleManager.getReachableCells(actor).map(position => `${position.x},${position.y}`))
            : new Set();
        const attackTargetIds = isTargetMode && actor
            ? new Set(battleManager.getAttackableTargets(actor).map(target => target.id))
            : new Set();

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const cell = document.createElement('button');
                cell.type = 'button';
                cell.className = 'battle-cell';
                cell.dataset.x = String(x);
                cell.dataset.y = String(y);
                cell.addEventListener('click', () => this.handleBoardCellClick(x, y));

                const unit = battleManager.getUnitAt({ x, y });
                const cellKey = `${x},${y}`;
                let isInteractiveCell = false;

                if (unit) {
                    cell.classList.add('occupied', unit.camp);
                    if (battleManager.currentActor?.id === unit.id) {
                        cell.classList.add('active');
                    }
                    cell.innerHTML = `
                        <div class="battle-unit-token ${unit.camp}">
                            <div class="battle-unit-icon">${unit.icon}</div>
                            <div class="battle-unit-mini-hp"><div style="width:${Math.max(0, unit.hp / unit.maxHp * 100)}%"></div></div>
                            <div class="battle-unit-mini-text">${unit.hp}/${unit.maxHp}</div>
                        </div>
                    `;
                }

                if (boardClickable && isMoveMode && moveTargetSet.has(cellKey)) {
                    cell.classList.add('move-target');
                    isInteractiveCell = true;
                }

                if (isTargetMode && unit) {
                    if (attackTargetIds.has(unit.id)) {
                        cell.classList.add('attack-target');
                        isInteractiveCell = true;
                    } else {
                        cell.classList.add('attack-disabled');
                    }
                }

                cell.disabled = !(boardClickable && isInteractiveCell);
                board.appendChild(cell);
            }
        }
    }


    renderActionPanel() {
        const panel = this.element.querySelector('#battle-action-panel');
        if (!panel) {
            return;
        }

        if (this.isPaused) {
            panel.innerHTML = '<div class="battle-action-status">战斗已暂停</div>';
            return;
        }

        if (battleManager.isAutoBattleEnabled()) {
            panel.innerHTML = '<div class="battle-action-status">自动战斗中，系统将自动处理本场战斗。</div>';
            return;
        }

        if (!this.pendingAction) {
            panel.innerHTML = '<div class="battle-action-status">等待回合推进中...</div>';
            return;
        }

        const actor = this.pendingAction.context.actor;
        panel.innerHTML = `
            <div class="battle-action-buttons">
                <button class="btn ${this.selectionMode === 'attack' ? 'btn-primary' : 'btn-secondary'}" onclick="window.game.ui.battleView.selectActionMode('attack')">攻击</button>
                <button class="btn ${this.selectionMode === 'move' ? 'btn-primary' : 'btn-secondary'}" onclick="window.game.ui.battleView.selectActionMode('move')">移动</button>
                <button class="btn btn-secondary" onclick="window.game.ui.battleView.resolvePendingAction({ type: 'defend' })">防御</button>
                <button class="btn btn-secondary" onclick="window.game.ui.battleView.chooseBattleItem()">使用道具</button>
                <button class="btn ${this.selectionMode === 'skill' ? 'btn-primary' : 'btn-secondary'}" onclick="window.game.ui.battleView.selectActionMode('skill')" ${actor.skill ? '' : 'disabled'}>使用技能</button>
            </div>
            <div class="battle-action-tip">${this.getSelectionTip()}</div>
        `;
    }

    getSelectionTip() {
        switch (this.selectionMode) {
            case 'move':
                return '点击左侧高亮格子移动。';
            case 'attack':
                return '点击左侧高亮敌人攻击。';
            case 'skill':
                return '点击左侧高亮敌人释放技能。';
            default:
                return '请选择本回合行动。';
        }
    }

    startPendingActionTimer() {
        if (!this.pendingAction || this.isPaused || battleManager.isAutoBattleEnabled()) {
            return;
        }
        if (this.pendingAction.timerId) {
            clearInterval(this.pendingAction.timerId);
        }
        this.pendingAction.timerId = setInterval(() => {
            if (!this.pendingAction || this.isPaused) {
                return;
            }
            this.pendingAction.remainingTime -= 1;
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
                remainingTime: context.timeout || 10,
                timerId: null
            };
            this.selectionMode = null;
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
    }

    resolvePendingAction(action) {
        if (!this.pendingAction || this.isPaused) {
            return;
        }
        const resolver = this.pendingAction.resolve;
        this.clearPendingAction();
        this.renderBattleState();
        resolver(action || { type: 'defend' });
    }

    selectActionMode(mode) {
        if (!this.pendingAction || this.isPaused) {
            return;
        }
        this.selectionMode = this.selectionMode === mode ? null : mode;
        this.renderBattleState();
    }

    handleBoardCellClick(x, y) {
        if (!this.pendingAction || this.isPaused || battleManager.isAutoBattleEnabled()) {
            return;
        }
        const actor = this.pendingAction.context.actor;
        if (this.selectionMode === 'move') {
            const canMove = battleManager.getReachableCells(actor).some(position => position.x === x && position.y === y);
            if (canMove) {
                this.resolvePendingAction({ type: 'move', position: { x, y } });
            }
            return;
        }
        if (this.selectionMode === 'attack' || this.selectionMode === 'skill') {
            const target = battleManager.getUnitAt({ x, y });
            if (target && target.camp !== actor.camp && actor.distanceTo(target) <= actor.attackRange) {
                this.resolvePendingAction({ type: this.selectionMode, targetId: target.id });
            }
        }
    }

    chooseBattleItem() {
        if (!this.pendingAction || this.isPaused) {
            return;
        }
        const actor = this.pendingAction.context.actor;
        const items = itemManager.getAllItems().filter(item => item.effect?.type === 'heal');
        if (items.length === 0) {
            Toast.info('当前没有可在战斗中使用的恢复道具');
            return;
        }

        let content = '<div style="display:flex;flex-direction:column;gap:10px;">';
        items.forEach(item => {
            content += `
                <div class="card" style="padding:12px;display:flex;justify-content:space-between;align-items:center;gap:10px;">
                    <div>
                        <div style="font-weight:bold;">${item.icon} ${item.name} x${item.count}</div>
                        <div style="font-size:12px;color:#a0a0a0;">${item.description}</div>
                    </div>
                    <button class="btn btn-primary btn-small" onclick="window.game.ui.battleView.useBattleItem('${item.id}', '${actor.id}')">使用</button>
                </div>
            `;
        });
        content += '</div>';

        const modal = new Modal({
            title: '选择道具',
            content,
            buttons: [{ text: '关闭', className: 'btn-secondary', onClick: () => modal.close() }]
        });
        this.itemSelectModal = modal;
        modal.show();
    }

    useBattleItem(itemId, actorId) {
        if (this.isPaused) {
            return;
        }
        this.closeItemSelectModal();
        this.resolvePendingAction({ type: 'item', itemId, targetId: actorId });
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
            title: '战斗失败',
            content: `
                <div style="text-align:center;">
                    <div style="font-size:64px;margin-bottom:15px;">💀</div>
                    <p>再接再厉！</p>
                </div>
            `,
            buttons: [{ text: '确定', className: 'btn-primary', onClick: () => { modal.close(); eventManager.emit('viewChange', { view: 'dungeon' }); } }]
        });
        modal.show();
    }

    fleeBattle() {
        if (confirm('确定要逃跑吗?')) {
            this.stopBattle();
            eventManager.emit('viewChange', { view: 'dungeon' });
        }
    }

    stopBattle() {
        this.isPaused = false;
        this.skipBattleRequested = false;
        this.closePauseModal();
        battleManager.setAutoBattleOverride();
        this.clearPendingAction({ type: 'defend', reason: 'cancelled' });
        if (this.unsubscribeState) {
            this.unsubscribeState();
            this.unsubscribeState = null;
        }
        battleManager.reset();
        this.currentDungeon = null;
    }
}

const battleView = new BattleView();
window.battleView = battleView;
