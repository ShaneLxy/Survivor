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
        // 进度条展示缓存：仅在单位行动结束后同步到UI
        this.progressTokenMap = new Map();
        this.progressValueMap = new Map();
        this.displayProgressMap = new Map();

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
        const battleSetup = dungeon.createBattleSetup();
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
        this.progressTokenMap = new Map();
        this.progressValueMap = new Map();
        this.displayProgressMap = new Map();
        this.battleSessionId++;
        battleManager.initBattle({ heroes, enemies, bossWaves, sceneId: dungeon.sceneId || sceneId });


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
                <div id="battle-boss-alert" class="battle-boss-alert" aria-hidden="true">
                    <div class="battle-boss-alert-banner">领主登场!</div>
                </div>
                <div class="battle-top-panel">
                    <div class="battle-top-row">
                        <button class="btn btn-secondary battle-pause-btn" onclick="window.game.ui.battleView.pauseBattle()">⏸</button>
                        <div id="battle-turn-meta" class="battle-turn-meta"></div>
                    </div>
                    <div id="battle-progress-track" class="battle-progress-track"></div>
                </div>
                <div class="battle-main-panel" style="position: relative;">
                    <div id="battle-board-container" style="position:relative;flex:1;min-width:0;min-height:0;">
                        <div id="battle-board" class="battle-board"></div>
                        <div id="battle-animation-layer" class="battle-animation-layer"></div>
                    </div>
                    <div id="battle-action-panel" class="battle-action-panel"></div>
                </div>
            </div>
        `;

        this.animationLayer = this.element.querySelector('#battle-animation-layer');
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

    renderBattleState() {

        if (!this.visible) {
            return;
        }
        const snapshot = battleManager.getSnapshot();
        this.renderTurnMeta(snapshot);
        this.renderProgress(snapshot);
        // 动画进行中跳过棋盘重建，避免打断浮动元素动画
        if (!this.isProcessingAction) {
            this.renderBoard(snapshot);
        }
        this.renderActionPanel();
    }

    renderTurnMeta(snapshot) {
        const meta = this.element.querySelector('#battle-turn-meta');
        if (!meta) {
            return;
        }
        const actor = battleManager.currentActor;
        const pendingActorId = this.pendingAction?.context?.actor?.id || null;
        const isHeroTurn = Boolean(this.pendingAction && actor && actor.camp === 'hero' && actor.id === pendingActorId);
        const countdownText = isHeroTurn ? ` · 剩余 ${this.pendingAction.remainingTime}s` : '';
        if (snapshot.isBossEntrancePlaying) {
            meta.textContent = `第 ${snapshot.currentRound} 回合 · 领主登场中...`;
            return;
        }
        meta.textContent = actor
            ? `第 ${snapshot.currentRound} 回合 · 当前行动："${actor.name}"${countdownText}`
            : `第 ${snapshot.currentRound} 回合`;

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

    _getProgressTokenLeft(track, progress) {
        const normalizedProgress = this._normalizeProgressValue(progress);
        const layout = this._getProgressTrackLayout(track);
        const left = layout.minLeft + layout.range * (normalizedProgress / 100);
        return `${Math.round(left * 100) / 100}px`;
    }

    renderProgress(snapshot) {
        const track = this.element.querySelector('#battle-progress-track');
        if (!track) return;
        this.syncDisplayedProgress(snapshot);
        const units = [...snapshot.heroes, ...snapshot.enemies].filter(unit => unit.isAlive());
        const currentUnitId = battleManager.currentActor?.id || null;

        if (!this.progressTokenMap) this.progressTokenMap = new Map();
        if (!this.progressValueMap) this.progressValueMap = new Map();
        if (!this.displayProgressMap) this.displayProgressMap = new Map();
        if (track.children.length === 0) {
            track.innerHTML = '<div class="battle-progress-scale"><span>0</span><span>100</span></div><div class="battle-progress-line"></div>';
        }

        const currentIds = new Set();

        units.forEach((unit) => {
            currentIds.add(unit.id);
            const newPos = this.displayProgressMap.has(unit.id)
                ? this.displayProgressMap.get(unit.id)
                : this._normalizeProgressValue(unit.progress);
            const newLeft = this._getProgressTokenLeft(track, newPos);
            const newClass = `battle-progress-token ${unit.camp} ${unit.rank || 'normal'} ${currentUnitId === unit.id ? 'active' : ''}`.trim();


            let token = this.progressTokenMap.get(unit.id);
            if (token && token.parentNode === track) {
                const oldVal = this.progressValueMap.has(unit.id) ? this.progressValueMap.get(unit.id) : 0;

                if (newPos < oldVal) {
                    const distToEnd = 100 - oldVal;
                    const distFromStart = newPos;
                    const duration1 = this._calcProgressDuration(distToEnd);
                    token.style.transitionDuration = `${duration1}ms`;
                    token.style.left = this._getProgressTokenLeft(track, 100);

                    setTimeout(() => {
                        if (token.parentNode !== track) return;
                        token.style.transitionDuration = '0ms';
                        token.style.left = this._getProgressTokenLeft(track, 0);
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

                token.className = newClass;
                this.progressValueMap.set(unit.id, newPos);
            } else {
                token = document.createElement('div');
                token.className = newClass;
                token.style.left = this._getProgressTokenLeft(track, 0);
                token.innerHTML = `<span>${unit.icon}</span>`;
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


    renderBoard(snapshot) {
        const board = this.element.querySelector('#battle-board');
        if (!board) {
            return;
        }
        const { width, height } = snapshot.scene;
        board.style.gridTemplateColumns = `repeat(${width}, minmax(0, 1fr))`;
        board.style.gridTemplateRows = `repeat(${height}, minmax(0, 1fr))`;
        board.innerHTML = '';

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
        const attackRangeSet = isTargetMode && actor
            ? new Set(battleManager.getAttackRangeCells(actor).map(position => `${position.x},${position.y}`))
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
                        <div class="battle-unit-token ${unit.camp} ${unit.rank || 'normal'}" data-unit-id="${unit.id}">
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

                if (boardClickable && isTargetMode && attackRangeSet.has(cellKey)) {
                    cell.classList.add('attack-range');
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

        const actor = battleManager.currentActor;
        const pendingActorId = this.pendingAction?.context?.actor?.id || null;
        const isHeroTurn = Boolean(this.pendingAction && actor && actor.camp === 'hero' && actor.id === pendingActorId);


        if (!isHeroTurn) {
            // 非英雄行动阶段：显示状态提示，按钮不可用
            const statusText = actor
                ? (actor.camp === 'enemy' ? '敌方行动中...' : '等待回合推进中...')
                : '等待回合推进中...';
            panel.innerHTML = `
                <div class="battle-action-buttons" style="opacity:0.5;pointer-events:none;">
                    <button class="btn btn-secondary" disabled>攻击</button>
                    <button class="btn btn-secondary" disabled>移动</button>
                    <button class="btn btn-secondary" disabled>防御</button>
                    <button class="btn btn-secondary" disabled>使用道具</button>
                    <button class="btn btn-secondary" disabled>使用技能</button>
                </div>
                <div class="battle-action-tip" style="color:#888;">${statusText}</div>
            `;
            return;
        }

        // 英雄行动阶段：正常渲染可用按钮
        const heroActor = this.pendingAction.context.actor;
        panel.innerHTML = `
            <div class="battle-action-buttons">
                <button class="btn ${this.selectionMode === 'attack' ? 'btn-primary' : 'btn-secondary'}" onclick="window.game.ui.battleView.selectActionMode('attack')">攻击</button>
                <button class="btn ${this.selectionMode === 'move' ? 'btn-primary' : 'btn-secondary'}" onclick="window.game.ui.battleView.selectActionMode('move')">移动</button>
                <button class="btn btn-secondary" onclick="window.game.ui.battleView.resolvePendingAction({ type: 'defend' })">防御</button>
                <button class="btn btn-secondary" onclick="window.game.ui.battleView.chooseBattleItem()">使用道具</button>
                <button class="btn ${this.selectionMode === 'skill' ? 'btn-primary' : 'btn-secondary'}" onclick="window.game.ui.battleView.selectActionMode('skill')" ${heroActor.skill ? '' : 'disabled'}>使用技能</button>
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
                remainingTime: context.timeout || 15,
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

    // ===== 动画队列系统 =====

    /**
     * 串行动作队列处理器
     * 确保前一个动画完全结束后才处理下一个，避免敌方单位同时移动
     */
    async processActionQueue() {
        if (this.isProcessingAction) return;
        this.isProcessingAction = true;

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
                        await this.handleHealAnimation(task.data.attacker, task.data.target);
                        break;
                    case 'die':
                        await this.handleDeathAnimation(task.data.unit);
                        break;
                }
            } catch (e) {
                // 单个动画失败不阻断队列
            }

            if (this.visible) {
                this.renderBoard(battleManager.getSnapshot());
            }
        }

        this.isProcessingAction = false;
        if (this.visible) {
            const snapshot = battleManager.getSnapshot();
            this.renderBoard(snapshot);
            this.renderTurnMeta(snapshot);
        }
        this.resolveActionQueueWaiters();
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
        const cells = board.querySelectorAll('.battle-cell');
        if (cells.length === 0) return null;
        const snapshot = battleManager.getSnapshot();
        const { width } = snapshot.scene;
        const index = y * width + x;
        if (index < 0 || index >= cells.length) return null;
        const cell = cells[index];
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
    createFloatingUnit(unit) {
        const el = document.createElement('div');
        el.className = `battle-unit-floating ${unit.camp} ${unit.rank || 'normal'}`.trim();
        el.dataset.unitId = unit.id;
        el.innerHTML = `
            <div class="float-icon">${unit.icon}</div>
            <div class="float-hp"><div style="width:${Math.max(0, unit.hp / unit.maxHp * 100)}%"></div></div>
            <div class="float-text">${unit.hp}/${unit.maxHp}</div>
        `;
        return el;
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
            if (!fromCoord || !toCoord) { resolve(); return; }

            this.hideUnitInBoard(unit.id);

            const floatingEl = this.createFloatingUnit(unit);
            floatingEl.style.left = `${fromCoord.left}px`;
            floatingEl.style.top = `${fromCoord.top}px`;
            floatingEl.style.width = `${fromCoord.width}px`;
            floatingEl.style.height = `${fromCoord.height}px`;

            if (this.animationLayer) {
                this.animationLayer.appendChild(floatingEl);
            }

            requestAnimationFrame(() => {
                floatingEl.style.left = `${toCoord.left}px`;
                floatingEl.style.top = `${toCoord.top}px`;
            });

            // 动画320ms + 间隔800ms
            setTimeout(() => {
                if (floatingEl.parentNode) {
                    floatingEl.parentNode.removeChild(floatingEl);
                }
                resolve();
            }, 1120);

        });
    }

    /**
     * 处理攻击冲撞+受击动画
     */
    async handleAttackAnimation(attacker, target, actionData) {
        const attackerPos = this.getCellScreenPosition(attacker.position.x, attacker.position.y);
        const targetPos = this.getCellScreenPosition(target.position.x, target.position.y);
        if (!attackerPos || !targetPos) return;

        // 计算冲刺方向和距离
        const dx = targetPos.left - attackerPos.left;
        const dy = targetPos.top - attackerPos.top;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const lungeDist = Math.max(Math.min(distance * 0.55, 45), 15);
        const lungeX = distance > 1 ? (dx / distance) * lungeDist : 0;
        const lungeY = distance > 1 ? (dy / distance) * lungeDist : 0;

        // 隐藏原始单位
        this.hideUnitInBoard(attacker.id);

        // 创建攻击者浮动元素
        const attackerFloat = this.createFloatingUnit(attacker);
        attackerFloat.style.left = `${attackerPos.left}px`;
        attackerFloat.style.top = `${attackerPos.top}px`;
        attackerFloat.style.width = `${attackerPos.width}px`;
        attackerFloat.style.height = `${attackerPos.height}px`;
        attackerFloat.style.setProperty('--lunge-x', `${lungeX}px`);
        attackerFloat.style.setProperty('--lunge-y', `${lungeY}px`);

        // 隐藏被攻击者
        this.hideUnitInBoard(target.id);

        // 创建被击者浮动元素
        const targetFloat = this.createFloatingUnit(target);
        targetFloat.style.left = `${targetPos.left}px`;
        targetFloat.style.top = `${targetPos.top}px`;
        targetFloat.style.width = `${targetPos.width}px`;
        targetFloat.style.height = `${targetPos.height}px`;

        if (this.animationLayer) {
            this.animationLayer.appendChild(attackerFloat);
            this.animationLayer.appendChild(targetFloat);
        }

        // 攻击者冲撞动画
        requestAnimationFrame(() => {
            attackerFloat.classList.add('battle-unit-attacking');
            // 被击者在冲撞到达时触发受击效果（延迟约100ms）
            setTimeout(() => {
                targetFloat.classList.add('battle-unit-hit');
            }, 95);
        });

        // 等待动画完成 + 行动间隔
        await new Promise(resolve => setTimeout(resolve, 1220));  // 420ms动画 + 800ms间隔

        // 清理
        [attackerFloat, targetFloat].forEach(el => {
            if (el.parentNode) el.parentNode.removeChild(el);
        });
    }


    /**
     * 治疗动画（较温和的效果）
     */
    async handleHealAnimation(actor, target) {
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

        // 绿色闪烁表示治疗
        targetFloat.style.transition = 'filter 0.3s ease';
        requestAnimationFrame(() => {
            targetFloat.style.filter = 'brightness(1.4) saturate(1.2)';
            setTimeout(() => {
                targetFloat.style.filter = 'brightness(1)';
            }, 250);
        });

        await new Promise(resolve => setTimeout(resolve, 1150));  // 350ms动画 + 800ms间隔

        if (targetFloat.parentNode) {
            targetFloat.parentNode.removeChild(targetFloat);
        }

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
        this.animationLayer = null;
        this.actionQueue = [];
        this.isProcessingAction = false;
        this.resolveActionQueueWaiters();
        this.actionQueueWaiters = [];
        this.progressTokenMap = new Map();
        this.progressValueMap = new Map();
        this.displayProgressMap = new Map();
        battleManager.reset();

        this.currentDungeon = null;
    }
}

const battleView = new BattleView();
window.battleView = battleView;
