(function() {
    if (typeof Game === 'undefined' || !window.game) {
        return;
    }

    const syncUiRefs = function(game) {
        game.ui = {
            ...game.ui,
            topBar: window.topBar,
            tabBar: window.tabBar,
            shelterView: window.shelterView,
            taskView: window.taskView
        };
    };

    syncUiRefs(window.game);

    Game.prototype.collectOfflineRewards = async function() {
        return Promise.resolve();
    };

    const originalLoadFromSave = Game.prototype.loadFromSave;
    Game.prototype.loadFromSave = function(saveData) {
        originalLoadFromSave.call(this, saveData);
        taskManager.init(saveData?.data?.taskData || null);
        syncUiRefs(this);
    };

    const originalInitNewGame = Game.prototype.initNewGame;
    Game.prototype.initNewGame = function() {
        originalInitNewGame.call(this);
        taskManager.init(null);
        syncUiRefs(this);
    };

    const originalGetSaveData = Game.prototype.getSaveData;
    Game.prototype.getSaveData = function() {
        const data = originalGetSaveData.call(this);
        return {
            ...data,
            taskData: taskManager.getSaveData()
        };
    };

    const originalRefreshRuntimeUI = Game.prototype.refreshRuntimeUI;
    Game.prototype.refreshRuntimeUI = function() {
        originalRefreshRuntimeUI.call(this);
        this.ui.taskView?.refresh?.();
    };

    const originalHideCurrentView = Game.prototype.hideCurrentView;
    Game.prototype.hideCurrentView = function() {
        if (this.currentView === 'task') {
            this.ui.taskView?.hide?.();
            return;
        }
        originalHideCurrentView.call(this);
    };

    const originalShowView = Game.prototype.showView;
    Game.prototype.showView = function(viewId) {
        if (viewId === 'task') {
            this.ui.taskView?.show?.();
            return;
        }
        originalShowView.call(this, viewId);
    };

    const originalSwitchView = Game.prototype.switchView;
    Game.prototype.switchView = function(viewId) {
        originalSwitchView.call(this, viewId);
        if (viewId === 'task') {
            this.ui.tabBar.activeTab = viewId;
            this.ui.tabBar.updateActive();
            this.currentView = viewId;
            this.applyViewMode(viewId);
        }
    };

    const originalOnLoginSuccess = Game.prototype.onLoginSuccess;
    Game.prototype.onLoginSuccess = async function() {
        await originalOnLoginSuccess.call(this);
        if (!this.gameReady) {
            return;
        }
        syncUiRefs(this);
        taskManager.record('login');
        this.ui.taskView?.refresh?.();
    };
})();
