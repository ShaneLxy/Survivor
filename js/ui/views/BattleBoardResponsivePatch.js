(function() {
    if (typeof BattleView === 'undefined' || !window.battleView) {
        return;
    }

    BattleView.prototype.syncBoardOverlayFrame = function() {
        const board = this.element?.querySelector('#battle-board');
        const container = this.element?.querySelector('#battle-board-container');
        const animationLayer = this.element?.querySelector('#battle-animation-layer');
        if (!board || !container || !animationLayer) {
            return null;
        }

        const containerRect = container.getBoundingClientRect();
        const boardRect = board.getBoundingClientRect();
        const left = Math.max(0, boardRect.left - containerRect.left);
        const top = Math.max(0, boardRect.top - containerRect.top);

        const nextLeft = `${left}px`;
        const nextTop = `${top}px`;
        const nextWidth = `${boardRect.width}px`;
        const nextHeight = `${boardRect.height}px`;
        if (animationLayer.style.left !== nextLeft) animationLayer.style.left = nextLeft;
        if (animationLayer.style.top !== nextTop) animationLayer.style.top = nextTop;
        if (animationLayer.style.width !== nextWidth) animationLayer.style.width = nextWidth;
        if (animationLayer.style.height !== nextHeight) animationLayer.style.height = nextHeight;

        return { board, container, animationLayer, boardRect };
    };

    BattleView.prototype.resetBattleBottomPanelFill = function() {
        const view = this.element?.querySelector('.battle-grid-view');
        if (view) {
            view.style.setProperty('--battle-bottom-panel-extra-height', '0px');
        }
        const bottomPanel = this.element?.querySelector('.battle-bottom-panel');
        if (bottomPanel) {
            bottomPanel.style.minHeight = '';
            bottomPanel.style.height = '';
            bottomPanel.style.maxHeight = '';
        }
    };

    BattleView.prototype.getBattleMainAvailableHeight = function() {
        const view = this.element?.querySelector('.battle-grid-view');
        const topPanel = this.element?.querySelector('.battle-top-panel');
        if (!view) {
            return 0;
        }
        const styles = window.getComputedStyle(view);
        const gap = parseFloat(styles.rowGap || styles.gap) || 0;
        const paddingTop = parseFloat(styles.paddingTop) || 0;
        const paddingBottom = parseFloat(styles.paddingBottom) || 0;
        const topHeight = topPanel?.getBoundingClientRect?.().height || 0;
        return Math.max(0, view.clientHeight - paddingTop - paddingBottom - topHeight - gap);
    };

    BattleView.prototype.syncBattleMainPanelHeight = function() {
        const mainPanel = this.element?.querySelector('.battle-main-panel');
        const height = Math.floor(this.getBattleMainAvailableHeight?.() || 0);
        if (!mainPanel || height <= 0) {
            return height;
        }
        const nextHeight = `${height}px`;
        if (mainPanel.style.height !== nextHeight) {
            mainPanel.style.height = nextHeight;
            mainPanel.style.minHeight = nextHeight;
            mainPanel.style.maxHeight = nextHeight;
            this.battleBoardLayoutDirty = true;
        }
        return height;
    };

    BattleView.prototype.syncBattleViewHeight = function() {
        const view = this.element?.querySelector('.battle-grid-view');
        if (!view || !this.element) {
            return;
        }
        const appHeight = document.getElementById('app')?.getBoundingClientRect?.().height || 0;
        const viewportHeight = window.visualViewport?.height || window.innerHeight || 0;
        const height = Math.floor(Math.max(appHeight, viewportHeight, this.element.clientHeight || this.element.getBoundingClientRect().height || 0));
        if (height > 0) {
            const nextHeight = `${height}px`;
            if (view.style.height !== nextHeight) {
                view.style.setProperty('--battle-view-height', nextHeight);
                view.style.height = nextHeight;
                view.style.minHeight = nextHeight;
                this.element.style.height = nextHeight;
                this.element.style.minHeight = nextHeight;
                this.battleBoardLayoutDirty = true;
            }
        }
    };

    BattleView.prototype.fillBattleBottomPanel = function(boardHeight) {
        const view = this.element?.querySelector('.battle-grid-view');
        const container = this.element?.querySelector('#battle-board-container');
        const mainPanel = this.element?.querySelector('.battle-main-panel');
        const bottomPanel = this.element?.querySelector('.battle-bottom-panel');
        if (!view || !container || !mainPanel) {
            return;
        }

        const height = Number(boardHeight) || 0;
        const mainStyles = window.getComputedStyle(mainPanel);
        const gap = parseFloat(mainStyles.rowGap || mainStyles.gap) || 0;
        const baseHeight = parseFloat(window.getComputedStyle(view).getPropertyValue('--battle-bottom-panel-base-height')) || 146;
        const mainAvailableHeight = Math.max(this.getBattleMainAvailableHeight?.() || 0, mainPanel.clientHeight || 0);
        const availableHeight = Math.max(0, mainAvailableHeight - height - gap);
        const targetHeight = Math.max(baseHeight, Math.floor(availableHeight));
        const extraHeight = Math.max(0, targetHeight - baseHeight);
        const nextExtraHeight = `${extraHeight > 2 ? extraHeight : 0}px`;
        if (view.style.getPropertyValue('--battle-bottom-panel-extra-height') !== nextExtraHeight) {
            view.style.setProperty('--battle-bottom-panel-extra-height', nextExtraHeight);
        }
        if (bottomPanel) {
            const nextMinHeight = `${targetHeight}px`;
            if (bottomPanel.style.minHeight !== nextMinHeight) {
                bottomPanel.style.minHeight = nextMinHeight;
                bottomPanel.style.height = nextMinHeight;
                bottomPanel.style.maxHeight = nextMinHeight;
            }
        }
    };

    const originalRenderBoard = BattleView.prototype.renderBoard;
    BattleView.prototype.renderBoard = function(snapshot) {
        this.syncBattleViewHeight();
        this.syncBattleMainPanelHeight();
        originalRenderBoard.call(this, snapshot);
        this.syncBattleMainPanelHeight();

        const board = this.element?.querySelector('#battle-board');
        const container = this.element?.querySelector('#battle-board-container');
        if (!board || !container || !snapshot?.scene) {
            return;
        }

        const width = Math.max(1, Number(snapshot.scene.width) || 1);
        const height = Math.max(1, Number(snapshot.scene.height) || 1);
        const view = this.element?.querySelector('.battle-grid-view');
        const mainPanel = this.element?.querySelector('.battle-main-panel');
        const layoutKey = [
            width,
            height,
            Math.floor(view?.clientWidth || 0),
            Math.floor(view?.clientHeight || 0),
            Math.floor(mainPanel?.clientHeight || 0),
            Math.floor(container.clientWidth || 0)
        ].join(':');

        if (!this.battleBoardLayoutDirty && this.battleBoardLayoutCache?.key === layoutKey) {
            this.syncBoardOverlayFrame();
            return;
        }

        this.battleBoardLayoutDirty = false;
        this.resetBattleBottomPanelFill();

        const styles = window.getComputedStyle(board);
        const gap = parseFloat(styles.gap) || 0;
        const paddingX = (parseFloat(styles.paddingLeft) || 0) + (parseFloat(styles.paddingRight) || 0);
        const paddingY = (parseFloat(styles.paddingTop) || 0) + (parseFloat(styles.paddingBottom) || 0);

        const availableWidth = Math.max(0, container.clientWidth - paddingX - gap * (width - 1));
        const availableHeight = Math.max(0, container.clientHeight - paddingY - gap * (height - 1));
        const cellSize = Math.max(16, Math.floor(Math.min(availableWidth / width, availableHeight / height)));
        const finalWidth = cellSize * width + gap * (width - 1) + paddingX;
        const finalHeight = cellSize * height + gap * (height - 1) + paddingY;

        board.style.flex = '0 0 auto';
        board.style.width = `${finalWidth}px`;
        board.style.height = `${finalHeight}px`;
        board.style.maxWidth = `${finalWidth}px`;
        board.style.maxHeight = `${finalHeight}px`;
        board.style.margin = '0 auto';

        this.battleBoardLayoutCache = { key: layoutKey, finalWidth, finalHeight };
        this.fillBattleBottomPanel(finalHeight);
        this.syncBoardOverlayFrame();
    };

    BattleView.prototype.getCellScreenPosition = function(x, y) {
        const board = this.element?.querySelector('#battle-board');
        if (!board) {
            return null;
        }

        const snapshot = battleManager.getSnapshot();
        const sceneWidth = Math.max(1, Number(snapshot?.scene?.width) || 1);
        const index = y * sceneWidth + x;
        const cell = board.children[index];
        if (index < 0 || !cell) {
            return null;
        }

        const frame = this.syncBoardOverlayFrame();
        const animationLayer = frame?.animationLayer || this.element.querySelector('#battle-animation-layer');
        if (!animationLayer) {
            return null;
        }

        const cellRect = cell.getBoundingClientRect();
        const layerRect = animationLayer.getBoundingClientRect();
        return {
            left: cellRect.left - layerRect.left,
            top: cellRect.top - layerRect.top,
            width: cellRect.width,
            height: cellRect.height
        };
    };

    const originalRenderShell = BattleView.prototype.renderShell;
    BattleView.prototype.renderShell = function() {
        this.battleBoardLayoutDirty = true;
        this.battleBoardLayoutCache = null;
        originalRenderShell.call(this);
        this.syncBoardOverlayFrame();
        this.syncBattleViewHeight();
        requestAnimationFrame(() => {
            this.syncBattleViewHeight();
            const snapshot = battleManager.getSnapshot();
            if (snapshot?.scene && this.visible) {
                this.renderBoard(snapshot);
            }
        });
        setTimeout(() => {
            this.syncBattleViewHeight();
            const snapshot = battleManager.getSnapshot();
            if (snapshot?.scene && this.visible) {
                this.renderBoard(snapshot);
            }
        }, 80);
    };

    window.addEventListener('resize', () => {
        const battleView = window.game?.ui?.battleView;
        if (!battleView?.visible) {
            return;
        }
        battleView.battleBoardLayoutDirty = true;
        battleView.battleBoardLayoutCache = null;
        battleView.syncBattleViewHeight?.();
        const snapshot = battleManager.getSnapshot();
        if (snapshot?.scene) {
            battleView.renderBoard(snapshot);
        } else {
            battleView.syncBoardOverlayFrame();
        }
    });
    window.visualViewport?.addEventListener('resize', () => {
        const battleView = window.game?.ui?.battleView;
        if (!battleView?.visible) {
            return;
        }
        battleView.battleBoardLayoutDirty = true;
        battleView.battleBoardLayoutCache = null;
        battleView.syncBattleViewHeight?.();
        const snapshot = battleManager.getSnapshot();
        if (snapshot?.scene) {
            battleView.renderBoard(snapshot);
        }
    }, { passive: true });
})();
