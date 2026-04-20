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

        animationLayer.style.left = `${left}px`;
        animationLayer.style.top = `${top}px`;
        animationLayer.style.width = `${boardRect.width}px`;
        animationLayer.style.height = `${boardRect.height}px`;

        return { board, container, animationLayer, boardRect };
    };

    const originalRenderBoard = BattleView.prototype.renderBoard;
    BattleView.prototype.renderBoard = function(snapshot) {
        originalRenderBoard.call(this, snapshot);

        const board = this.element?.querySelector('#battle-board');
        const container = this.element?.querySelector('#battle-board-container');
        if (!board || !container || !snapshot?.scene) {
            return;
        }

        const width = Math.max(1, Number(snapshot.scene.width) || 1);
        const height = Math.max(1, Number(snapshot.scene.height) || 1);
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

        this.syncBoardOverlayFrame();
    };

    BattleView.prototype.getCellScreenPosition = function(x, y) {
        const board = this.element?.querySelector('#battle-board');
        if (!board) {
            return null;
        }

        const cells = board.querySelectorAll('.battle-cell');
        if (!cells.length) {
            return null;
        }

        const snapshot = battleManager.getSnapshot();
        const sceneWidth = Math.max(1, Number(snapshot?.scene?.width) || 1);
        const index = y * sceneWidth + x;
        if (index < 0 || index >= cells.length) {
            return null;
        }

        const frame = this.syncBoardOverlayFrame();
        const animationLayer = frame?.animationLayer || this.element.querySelector('#battle-animation-layer');
        if (!animationLayer) {
            return null;
        }

        const cellRect = cells[index].getBoundingClientRect();
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
        originalRenderShell.call(this);
        this.syncBoardOverlayFrame();
    };

    window.addEventListener('resize', () => {
        const battleView = window.game?.ui?.battleView;
        if (!battleView?.visible) {
            return;
        }
        const snapshot = battleManager.getSnapshot();
        if (snapshot?.scene) {
            battleView.renderBoard(snapshot);
        } else {
            battleView.syncBoardOverlayFrame();
        }
    });
})();
