/**
 * 底部Tab导航栏
 */
class TabBar {
    constructor() {
        this.element = document.getElementById('tab-bar');
        this.activeTab = 'shelter';
        this.tabs = [
            { id: 'shelter', name: '避难所', icon: '🏠' },
            { id: 'hero', name: '英雄', icon: '⚔️' },
            { id: 'dungeon', name: '副本', icon: '🏰' },
            { id: 'backpack', name: '背包', icon: '🎒' },
            { id: 'shop', name: '商城', icon: '🛒' },
            { id: 'checkin', name: '签到', icon: '📅' }
        ];

        this.init();
    }

    /**
     * 初始化
     */
    init() {
        this.create();
        this.setupEvents();
    }

    /**
     * 创建Tab栏
     */
    create() {
        this.element.innerHTML = '';

        this.tabs.forEach(tab => {
            const tabBtn = document.createElement('button');
            tabBtn.className = 'tab-item';
            tabBtn.dataset.tab = tab.id;

            const icon = document.createElement('div');
            icon.className = 'tab-icon';
            icon.textContent = tab.icon;
            tabBtn.appendChild(icon);

            const label = document.createElement('div');
            label.className = 'tab-label';
            label.textContent = tab.name;
            tabBtn.appendChild(label);

            tabBtn.addEventListener('click', () => this.switchTab(tab.id));

            this.element.appendChild(tabBtn);
        });

        this.updateActive();
    }

    /**
     * 设置事件
     */
    setupEvents() {
        eventManager.on('tabSwitch', (tabId) => {
            this.switchTab(tabId);
        });
    }

    /**
     * 切换Tab
     * @param {string} tabId - Tab ID
     */
    switchTab(tabId) {
        if (this.activeTab === tabId) return;

        this.activeTab = tabId;
        this.updateActive();

        // 发送Tab切换事件
        eventManager.emit('viewChange', { view: tabId });

        // 播放音效
        audioManager.playSFX('tab_click');
    }

    /**
     * 更新Tab选中状态
     */
    updateActive() {
        const tabButtons = this.element.querySelectorAll('.tab-item');
        tabButtons.forEach(btn => {
            if (btn.dataset.tab === this.activeTab) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    /**
     * 获取当前Tab
     * @returns {string}
     */
    getActiveTab() {
        return this.activeTab;
    }
}

// 导出单例
const tabBar = new TabBar();

// 暴露到全局
window.tabBar = tabBar;
