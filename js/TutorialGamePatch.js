(function() {
    if (typeof Game === 'undefined' || !window.game || !window.tutorialManager) {
        return;
    }

    const originalOnLoginSuccess = Game.prototype.onLoginSuccess;
    Game.prototype.onLoginSuccess = async function() {
        await originalOnLoginSuccess.call(this);
        if (tutorialManager.shouldAutoStart()) {
            setTimeout(() => tutorialManager.start(), 280);
        }
    };
})();
