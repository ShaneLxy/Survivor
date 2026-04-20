/**
 * 底部 Tab 导航栏
 */
class TabBar {
    constructor() {
        this.element = document.getElementById('tab-bar');
        this.activeTab = 'shelter';
        this.disabled = false;
        this.tabs = [
            { id: 'shelter', name: '避难所', icon: '🏕' },
            { id: 'hero', name: '英雄', icon: '⚔️' },
            { id: 'recruit', name: '招募', icon: '🎲' },
            { id: 'dungeon', name: '副本', icon: '🗺' },
            { id: 'shop', name: '商城', icon: '🛍' },
            { id: 'checkin', name: '签到', icon: '📅' }
        ];
        this.init();
    }

    init() {
        this.create();
        this.setupEvents();
    }

    create() {
        this.element.innerHTML = '';
        this.tabs.forEach(tab => {
            const tabBtn = document.createElement('button');
            tabBtn.className = 'tab-item';
            tabBtn.dataset.tab = tab.id;
            tabBtn.type = 'button';
            tabBtn.innerHTML = `
                <div class="tab-icon">${tab.icon}</div>
                <div class="tab-label">${tab.name}</div>
            `;
            tabBtn.addEventListener('click', () => this.switchTab(tab.id));
            this.element.appendChild(tabBtn);
        });
        this.updateActive();
    }

    setupEvents() {
        eventManager.on('tabSwitch', tabId => this.switchTab(tabId));
    }

    setDisabled(disabled) {
        this.disabled = Boolean(disabled);
        this.element.classList.toggle('is-disabled', this.disabled);
        this.element.querySelectorAll('.tab-item').forEach(btn => {
            btn.disabled = this.disabled;
        });
    }

    switchTab(tabId) {
        if (this.disabled || this.activeTab === tabId) return;
        this.activeTab = tabId;
        this.updateActive();
        eventManager.emit('viewChange', { view: tabId });
        audioManager.playSFX('tab_click');
    }

    updateActive() {
        this.element.querySelectorAll('.tab-item').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === this.activeTab);
            btn.disabled = this.disabled;
        });
    }

    getActiveTab() {
        return this.activeTab;
    }
}

const tabBar = new TabBar();
window.tabBar = tabBar;
