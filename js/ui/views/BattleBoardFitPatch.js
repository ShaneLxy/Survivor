(function() {
    if (typeof BattleView === 'undefined' || !window.battleView) {
        return;
    }

    const originalRenderBoard = BattleView.prototype.renderBoard;
    BattleView.prototype.renderBoard = function(snapshot) {
        originalRenderBoard.call(this, snapshot);

        const board = this.element.querySelector('#battle-board');
        const container = this.element.querySelector('#battle-board-container');
        if (!board || !container || !snapshot?.scene) {
            return;
        }

        const width = Number(snapshot.scene.width) || 1;
        const height = Number(snapshot.scene.height) || 1;
        const styles = window.getComputedStyle(board);
        const gap = parseFloat(styles.gap) || 0;
        const paddingLeft = parseFloat(styles.paddingLeft) || 0;
        const paddingRight = parseFloat(styles.paddingRight) || 0;
        const paddingTop = parseFloat(styles.paddingTop) || 0;
        const paddingBottom = parseFloat(styles.paddingBottom) || 0;

        const availableWidth = Math.max(0, container.clientWidth - paddingLeft - paddingRight - gap * (width - 1));
        const availableHeight = Math.max(0, container.clientHeight - paddingTop - paddingBottom - gap * (height - 1));
        const cellSize = Math.max(18, Math.floor(Math.min(availableWidth / width, availableHeight / height)));

        const finalWidth = cellSize * width + gap * (width - 1) + paddingLeft + paddingRight;
        const finalHeight = cellSize * height + gap * (height - 1) + paddingTop + paddingBottom;

        board.style.width = `${finalWidth}px`;
        board.style.height = `${finalHeight}px`;
        board.style.maxWidth = '100%';
        board.style.maxHeight = '100%';
        board.style.margin = '0 auto';
    };
})();
