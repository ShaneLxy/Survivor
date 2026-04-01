/**
 * 游戏主入口
 */
class Game {
    constructor() {
        this.player = {
            level: 1,
            exp: 0,
            energy: 100,
            maxEnergy: 100,
            gold: 100
        };
        this.settings = {
            skipBattle: false
        };
        this.ui = {
            topBar: topBar,
            tabBar: tabBar,
            itemGrid: itemGrid,
            shelterView: shelterView,
            heroView: heroView,
            dungeonView: dungeonView,
            battleView: battleView,
            gachaView: gachaView,
            backpackView: backpackView,
            shopView: shopView,
            checkinView: checkinView
        };
        this.currentView = 'shelter';
    }

    /**
     * 初始化游戏
     */
    async init() {
        console.log('游戏初始化中...');

        // 初始化音频
        audioManager.init();

    // 加载存档
        const saveData = saveManager.load();
        console.log('[Game.init] saveData:', saveData);
        if (saveData) {
            console.log('[Game.init] Loading from save');
            this.loadFromSave(saveData);
        } else {
            console.log('[Game.init] No save, init new game');
            this.initNewGame();
        }

        // 收集离线产出
        this.collectOfflineRewards();

        // 初始化UI
        this.initUI();

        // 启动自动保存
        saveManager.init();

        // 绑定全局事件
        this.bindEvents();

        console.log('游戏初始化完成!');
    }

    /**
     * 加载存档
     * @param {Object} saveData - 存档数据
     */
    loadFromSave(saveData) {
        const data = saveData.data;

        // 加载玩家数据
        if (data.player) {
            this.player = { ...this.player, ...data.player };
        }

        // 加载设置
        if (data.settings) {
            this.settings = { ...this.settings, ...data.settings };
        }

        // 初始化管理器
        heroManager.init(data.heroData);
        shelterManager.init(data.shelterData);
        dungeonManager.init(data.dungeonData);
        itemManager.init(data.itemData);
        gachaManager.init(data.gachaData);
        checkinManager.init(data.checkinData);

        console.log('存档加载完成');
    }

    /**
     * 初始化新游戏
     */
    initNewGame() {
        // 初始化管理器
        heroManager.init(null);
        shelterManager.init(null);
        dungeonManager.init(null);
        itemManager.init(null);
        gachaManager.init(null);
        checkinManager.init(null);

        console.log('新游戏初始化完成');
    }

    /**
     * 收集离线奖励
     */
    collectOfflineRewards() {
        const offlineSeconds = saveManager.calculateOfflineTime();
        if (offlineSeconds > 60) {
            const production = shelterManager.calculateOfflineProduction(offlineSeconds);
            let message = `离线${Utils.formatTime(offlineSeconds)}`;

            if (production && Object.keys(production).length > 0) {
                const rewards = Object.entries(production)
                    .filter(([_, amount]) => amount > 0)
                    .map(([type, amount]) => `${type}:${amount}`)
                    .join(', ');

                if (rewards) {
                    for (const [type, amount] of Object.entries(production)) {
                        if (amount > 0) {
                            shelterManager.addResource(type, amount);
                        }
                    }
                    message += `\n获得产出: ${rewards}`;
                }
            }

            Toast.success(message, 5000);
        }
    }

    /**
     * 初始化UI
     */
    initUI() {
        // 更新顶部状态栏
        this.ui.topBar.updateAll(this.player);

        // 显示默认视图
        this.switchView('shelter');

        // 刷新道具网格
        this.ui.itemGrid.refresh();
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 视图切换
        eventManager.on('viewChange', (data) => {
            this.switchView(data.view);
        });

        // 进入战斗
        eventManager.on('enterBattle', async (data) => {
            await this.ui.battleView.startBattle(data.dungeonId);
        });

        // 英雄添加
        eventManager.on('heroAdd', (hero) => {
            this.ui.heroView.refresh();
        });

        // 英雄升级
        eventManager.on('heroLevelUp', (hero) => {
            Toast.success(`${hero.name}升级到Lv.${hero.level}`);
            this.ui.heroView.refresh();
        });

        // 建筑升级
        eventManager.on('buildingUpgrade', (building) => {
            this.ui.shelterView.refresh();
            this.ui.itemGrid.refresh();
        });

        // 资源更新
        eventManager.on('resourceUpdate', (data) => {
            if (data.type === 'gold') {
                this.player.gold = shelterManager.getResource('gold');
            }
        });

        // 地牢完成
        eventManager.on('dungeonComplete', (data) => {
            this.ui.dungeonView.refresh();
            this.checkLevelUp();
        });

        // 自动保存
        eventManager.on('autoSave', (data) => {
            console.log('自动保存完成', new Date(data.timestamp).toLocaleString());
        });
    }

    /**
     * 切换视图
     * @param {string} viewId - 视图ID
     */
    switchView(viewId) {
        // 隐藏当前视图
        this.hideCurrentView();

        // 显示新视图
        this.showView(viewId);

        // 更新Tab
        this.ui.tabBar.activeTab = viewId;
        this.ui.tabBar.updateActive();

        this.currentView = viewId;

        console.log('切换到视图:', viewId);
    }

    /**
     * 隐藏当前视图
     */
    hideCurrentView() {
        switch (this.currentView) {
            case 'shelter':
                this.ui.shelterView.hide();
                break;
            case 'hero':
                this.ui.heroView.hide();
                break;
            case 'dungeon':
                this.ui.dungeonView.hide();
                break;
            case 'battle':
                this.ui.battleView.hide();
                break;
            case 'gacha':
                this.ui.gachaView.hide();
                break;
            case 'backpack':
                this.ui.backpackView.hide();
                break;
            case 'shop':
                this.ui.shopView.hide();
                break;
            case 'checkin':
                this.ui.checkinView.hide();
                break;
        }
    }

    /**
     * 显示视图
     * @param {string} viewId - 视图ID
     */
    showView(viewId) {
        switch (viewId) {
            case 'shelter':
                this.ui.shelterView.show();
                break;
            case 'hero':
                this.ui.heroView.show();
                break;
            case 'dungeon':
                this.ui.dungeonView.show();
                break;
            case 'battle':
                this.ui.battleView.show();
                break;
            case 'gacha':
                this.ui.gachaView.show();
                break;
            case 'backpack':
                this.ui.backpackView.show();
                break;
            case 'shop':
                this.ui.shopView.show();
                break;
            case 'checkin':
                this.ui.checkinView.show();
                break;
        }
    }

    /**
     * 检查升级
     */
    checkLevelUp() {
        const expRequired = GameConfig.getExpRequired(this.player.level);
        if (this.player.exp >= expRequired) {
            this.levelUp();
        }
    }

    /**
     * 玩家升级
     */
    levelUp() {
        const expRequired = GameConfig.getExpRequired(this.player.level);

        while (this.player.exp >= expRequired) {
            this.player.exp -= expRequired;
            this.player.level++;

            // 升级奖励
            this.player.maxEnergy += 10;
            this.player.energy = this.player.maxEnergy;

            Toast.success(`恭喜升级到Lv.${this.player.level}!`);
        }

        // 更新UI
        this.ui.topBar.updateAll(this.player);
        eventManager.emit('playerUpdate', this.player);

        // 保存游戏
        saveManager.save();
    }

    /**
     * 保存游戏
     */
    save() {
        const saveData = {
            player: this.player,
            settings: this.settings,
            heroData: heroManager.getSaveData(),
            shelterData: shelterManager.getSaveData(),
            dungeonData: dungeonManager.getSaveData(),
            itemData: itemManager.getSaveData(),
            gachaData: gachaManager.getSaveData(),
            checkinData: checkinManager.getSaveData()
        };

        return saveManager.save(saveData);
    }

    /**
     * 删除存档
     */
    deleteSave() {
        if (confirm('确定要删除存档吗?此操作不可恢复!')) {
            saveManager.delete();
            location.reload();
        }
    }
}

// 创建游戏实例并启动
window.game = new Game();

// DOM加载完成后启动
document.addEventListener('DOMContentLoaded', () => {
    window.game.init();
});

// 页面关闭前保存
window.addEventListener('beforeunload', () => {
    window.game.save();
});
