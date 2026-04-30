(function() {
    if (!window.tabBar) {
        return;
    }

    const hasTaskTab = window.tabBar.tabs.some((tab) => tab.id === 'task');
    if (!hasTaskTab) {
        window.tabBar.tabs.splice(5, 0, { id: 'task', name: '任务', icon: '✓' });
        window.tabBar.create();
    }
})();
