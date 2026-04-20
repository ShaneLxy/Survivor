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
            gold: 1000,
            diamond: 0,
            nickname: '幸存者',
            avatarHeroConfigId: null
        };

        this.settings = {
            autoBattle: false,
            muted: false
        };

        this.ui = {
            topBar,
            tabBar,
            itemGrid,
            shelterView,
            heroView,
            dungeonView,
            battleView,
            gachaView,
            backpackView,
            shopView,
            checkinView,
            loginView
        };
        this.currentView = null;
        this.gameReady = false; // 游戏是否已经完成初始化
    }

    async init() {
        // 初始化一开始就盖上登录页，避免先闪出游戏主界面
        loginView.show();
        window.VersionManager?.bootstrap?.();
        await window.versionCheckService?.check?.();
        loginView.render?.();

        audioManager.init();
        if (window.UnitCatalogLoader?.load) {
            await window.UnitCatalogLoader.load();
        }

        // 强制每次打开都重新登录：清除本地登录状态
        authService.logout();

        // 初始化 HttpClient（设置 API 基地址等）
        await authService.init();
        // 始终显示登录页，不自动跳转
        loginView.show();

        // 监听登录成功事件
        eventManager.on('loginSuccess', () => this.onLoginSuccess());
    }

    /**
     * 登录成功后的回调：加载存档并渲染游戏界面
     */
    async onLoginSuccess() {
        if (this.gameReady) return; // 防止重复初始化

        const localSave = saveManager.load();
        const resolvedSave = await saveSyncService.resolveInitialSave(localSave);
        if (resolvedSave?.data) {
            this.loadFromSave(resolvedSave);
        } else {
            this.initNewGame();
        }

        audioManager.setMuted(this.settings.muted);
        await this.collectOfflineRewards();
        this.initUI();
        mailManager.init(null);
        await mailManager.refresh({ silent: true });
        mailManager.startAutoRefresh();
        saveManager.init();
        this.bindEvents();
        eventManager.emit('authChange', { loggedIn: authService.isLoggedIn(), user: authService.getCurrentUser() });

        this.gameReady = true;
    }

    applyLegacyMigrations() {
        const legacyWater = shelterManager.consumeLegacyWaterMigration();
        if (legacyWater > 0) {
            itemManager.addItem('exp_potion', legacyWater);
        }
        this.player.gold = shelterManager.getResource('gold');
        this.player.diamond = shelterManager.getResource('diamond');
    }

    recalculatePlayerMaxEnergy(options = {}) {
        const levelBonus = Math.max(0, (Number(this.player.level) || 1) - 1) * 10;
        const shelterBonus = Math.max(0, Number(shelterManager.getShelterEnergyBonus?.() || 0));
        const nextMaxEnergy = GameConfig.player.maxEnergy + levelBonus + shelterBonus;
        this.player.maxEnergy = nextMaxEnergy;

        if (options.fillToMax) {
            this.player.energy = nextMaxEnergy;
        } else {
            this.player.energy = Math.min(Number(this.player.energy) || 0, nextMaxEnergy);
        }

        eventManager.emit('playerUpdate', {
            level: this.player.level,
            energy: this.player.energy,
            maxEnergy: this.player.maxEnergy
        });
    }

    loadFromSave(saveData) {
        const data = saveData.data || {};
        if (data.player) {
            this.player = { ...this.player, ...data.player };
        }
        if (data.settings) {
            this.settings = {
                ...this.settings,
                autoBattle: Boolean(data.settings.autoBattle),
                muted: Boolean(data.settings.muted)
            };
        }

        heroManager.init(data.heroData);
        shelterManager.init(data.shelterData);
        dungeonManager.init(data.dungeonData);
        itemManager.init(data.itemData);
        gachaManager.init(data.gachaData);
        checkinManager.init(data.checkinData);
        this.applyLegacyMigrations();
        this.recalculatePlayerMaxEnergy();
    }

    initNewGame() {
        this.player = {
            level: GameConfig.player.initialLevel,
            exp: GameConfig.player.initialExp,
            energy: GameConfig.player.initialEnergy,
            maxEnergy: GameConfig.player.maxEnergy,
            gold: GameConfig.player.initialGold,
            diamond: 0,
            nickname: '幸存者',
            avatarHeroConfigId: null
        };
        this.settings = { autoBattle: false, muted: false };

        heroManager.init(null);
        shelterManager.init(null);
        dungeonManager.init(null);
        itemManager.init(null);
        gachaManager.init(null);
        checkinManager.init(null);
        this.applyLegacyMigrations();
        this.recalculatePlayerMaxEnergy({ fillToMax: true });
    }

    async collectOfflineRewards() {
        const offlineSeconds = saveManager.calculateOfflineTime();
        if (offlineSeconds <= 60) {
            return;
        }

        const production = shelterManager.calculateOfflineProduction(offlineSeconds);
        const rewardEntries = [];

        Object.entries(production?.resources || {}).forEach(([type, amount]) => {
            if (amount > 0) {
                shelterManager.addResource(type, amount);
                rewardEntries.push(RewardModal.createResourceReward(type, amount));
            }
        });
        Object.entries(production?.items || {}).forEach(([itemId, amount]) => {
            if (amount > 0) {
                itemManager.addItem(itemId, amount);
                rewardEntries.push(RewardModal.createItemReward(itemId, amount));
            }
        });

        if (rewardEntries.length > 0) {
            this.player.gold = shelterManager.getResource('gold');
            this.player.diamond = shelterManager.getResource('diamond');
            await RewardModal.show({
                title: '离线收益',
                rewards: rewardEntries,
                summaryText: `离线时长：${Utils.formatTime(offlineSeconds)}`
            });
        }
    }

    initUI() {
        this.ui.topBar.updateAll(this.player);

        // 显示底部导航栏（可能被 handleLogout 隐藏过）
        if (this.ui?.tabBar?.element) {
            this.ui.tabBar.element.style.display = 'flex';
        }

        if (this.ui?.itemGrid) {
            this.ui.itemGrid.currentTab = 'shelter';
            this.ui.itemGrid.inventoryCategory = 'item';
        }

        this.switchView('shelter');
        this.ui.itemGrid.refresh();
    }

    refreshRuntimeUI() {
        this.player.gold = shelterManager.getResource('gold');
        this.player.diamond = shelterManager.getResource('diamond');
        this.ui.topBar.updateAll(this.player);
        this.ui.itemGrid.refresh();
        this.ui.shelterView.refresh();
        this.ui.heroView.refresh();
        this.ui.dungeonView.refresh();
        this.ui.gachaView.refresh();
        this.ui.shopView.refresh();
        this.ui.checkinView.refresh();
    }

    bindEvents() {
        eventManager.on('viewChange', data => this.switchView(data.view));
        eventManager.on('enterBattle', async data => {
            this.switchView('battle');
            await this.ui.battleView.startBattle(data.dungeonId, data.sceneId || 'standard_9x9');
        });
        eventManager.on('heroAdd', () => this.ui.heroView.refresh());
        eventManager.on('heroLevelUp', hero => {
            Toast.success(`${hero.name}升级到 Lv.${hero.level}`);
            this.ui.heroView.refresh();
        });
        eventManager.on('buildingUpgrade', () => {
            this.ui.shelterView.refresh();
            this.ui.itemGrid.refresh();
        });
        eventManager.on('resourceUpdate', data => {
            if (data.type === 'gold') {
                this.player.gold = shelterManager.getResource('gold');
            }
            if (data.type === 'diamond') {
                this.player.diamond = shelterManager.getResource('diamond');
            }
        });
        eventManager.on('dungeonComplete', () => {
            this.ui.dungeonView.refresh();
        });
        eventManager.on('autoSave', data => {
            console.log('自动保存完成', new Date(data.timestamp).toLocaleString());
        });
        eventManager.on('save', saveWrapper => {
            saveSyncService.queueSync(saveWrapper);
        });
        eventManager.on('authChange', () => {
            this.ui.topBar.refreshAccountStatus?.();
        });
    }

    switchView(viewId) {
        this.hideCurrentView();
        this.showView(viewId);
        if (['shelter', 'hero', 'recruit', 'dungeon', 'shop', 'checkin'].includes(viewId)) {
            this.ui.tabBar.activeTab = viewId;
            this.ui.tabBar.updateActive();
        }
        this.currentView = viewId;
        this.applyViewMode(viewId);
    }

    applyViewMode(viewId) {
        const appElement = document.getElementById('app');
        const topBarElement = document.getElementById('top-bar');
        const tabBarElement = document.getElementById('tab-bar');
        const itemSectionElement = document.getElementById('item-section');
        const isBattleMode = viewId === 'battle';
        if (appElement) {
            appElement.classList.toggle('battle-mode', isBattleMode);
        }
        if (topBarElement) {
            topBarElement.style.display = 'flex';
        }
        if (tabBarElement) {
            tabBarElement.style.display = isBattleMode ? 'none' : 'flex';
        }
        if (itemSectionElement) {
            itemSectionElement.style.display = isBattleMode ? 'none' : '';
        }
        if (this.ui?.tabBar?.setDisabled) {
            this.ui.tabBar.setDisabled(isBattleMode);
        }
    }

    hideCurrentView() {
        switch (this.currentView) {
            case 'shelter':
                this.ui.shelterView.hide();
                break;
            case 'hero':
                this.ui.heroView.hide();
                break;
            case 'recruit':
                this.ui.gachaView.hide();
                break;
            case 'dungeon':
                this.ui.dungeonView.hide();
                break;
            case 'battle':
                this.ui.battleView.hide();
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

    showView(viewId) {
        switch (viewId) {
            case 'shelter':
                this.ui.shelterView.show();
                break;
            case 'hero':
                this.ui.heroView.show();
                break;
            case 'recruit':
                this.ui.gachaView.show();
                break;
            case 'dungeon':
                this.ui.dungeonView.show();
                break;
            case 'battle':
                this.ui.battleView.show();
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
            default:
                this.ui.shelterView.show();
                this.currentView = null;
        }
    }

    checkLevelUp() {
        let leveled = false;
        while (this.player.exp >= GameConfig.getExpRequired(this.player.level)) {
            const expRequired = GameConfig.getExpRequired(this.player.level);
            this.player.exp -= expRequired;
            this.player.level++;
            Toast.success(`恭喜升级到 Lv.${this.player.level}!`);
            leveled = true;
        }
        if (leveled) {
            this.recalculatePlayerMaxEnergy({ fillToMax: true });
            this.ui.topBar.updateAll(this.player);
            eventManager.emit('playerUpdate', this.player);
        }
        return leveled;
    }

    buildBattleRewardEntries(rewards, heroExpSummary = null) {
        const rewardEntries = [];
        if (rewards?.gold) {
            rewardEntries.push(RewardModal.createResourceReward('gold', rewards.gold));
        }
        if (rewards?.exp) {
            rewardEntries.push(RewardModal.createVirtualReward({
                id: 'player_exp',
                name: '玩家经验',
                icon: '✨',
                count: rewards.exp,
                rarity: 'rare',
                detailTypeLabel: '成长奖励',
                description: '用于提升玩家等级',
                detailExtra: [`本次获得 ${rewards.exp} 点玩家经验`]
            }));
        }
        if (heroExpSummary?.expPerHero > 0) {
            rewardEntries.push(RewardModal.createVirtualReward({
                id: 'hero_exp',
                name: '英雄经验',
                icon: '📘',
                count: heroExpSummary.expPerHero,
                rarity: 'rare',
                detailTypeLabel: '成长奖励',
                description: '所有符合等级条件的参战英雄均可获得该经验值',
                detailExtra: [
                    `获得经验英雄：${heroExpSummary.awarded.length} 名`,
                    `每名英雄获得：${heroExpSummary.expPerHero}`,
                    `总计分配：${heroExpSummary.totalExp}`,
                    ...(heroExpSummary.blocked.length > 0 ? [`未获得经验：${heroExpSummary.blocked.map(hero => hero.name).join("、")}（已达到玩家等级上限）`] : [])
                ]
            }));
        }
        (rewards?.items || []).forEach(item => {
            if (shelterManager.isResourceType(item.id)) {
                rewardEntries.push(RewardModal.createResourceReward(item.id, item.count || 1));
            } else {
                rewardEntries.push(RewardModal.createItemReward(item.id, item.count || 1));
            }
        });
        return rewardEntries;
    }

    grantDungeonVictoryRewards(dungeon, participantHeroIds) {
        const rewards = dungeon.calculateRewards(this.player.level);
        if (rewards?.gold) {
            shelterManager.addResource('gold', Number(rewards.gold) || 0);
        }
        if (rewards?.exp) {
            this.player.exp += Number(rewards.exp) || 0;
        }
        this.checkLevelUp();

        const difficulty = Number(dungeon?.level) || 1;
        const heroExpReward = (Number(rewards?.exp) || 20) * difficulty;
        const heroExpSummary = heroManager.distributeBattleExp(participantHeroIds, heroExpReward, this.player.level);

        (rewards?.items || []).forEach(item => {
            if (!item?.id) {
                return;
            }
            if (shelterManager.isResourceType(item.id)) {
                shelterManager.addResource(item.id, item.count || 1);
            } else {
                itemManager.addItem(item.id, item.count || 1);
            }
        });

        dungeonManager.completeDungeon(dungeon.id, 3);
        this.refreshRuntimeUI();
        this.save();

        return {
            rewards,
            heroExpSummary,
            rewardEntries: this.buildBattleRewardEntries(rewards, heroExpSummary)
        };
    }

    getSaveData() {
        return {
            player: { ...this.player },
            settings: { ...this.settings },
            heroData: heroManager.getSaveData(),
            shelterData: shelterManager.getSaveData(),
            dungeonData: dungeonManager.getSaveData(),
            itemData: itemManager.getSaveData(),
            gachaData: gachaManager.getSaveData(),
            checkinData: checkinManager.getSaveData(),
            lastSaveTime: Date.now()
        };
    }

    save() {
        return saveManager.save(this.getSaveData());
    }

    /**
     * 处理退出登录：重置游戏状态并跳转到登录页
     */
    handleLogout() {
        this.gameReady = false;
        saveManager.stopAutoSave?.();
        mailManager.stopAutoRefresh?.();
        Modal.closeAll();
        this.hideCurrentView();
        if (this.ui?.itemGrid) {
            this.ui.itemGrid.currentTab = 'shelter';
            this.ui.itemGrid.inventoryCategory = 'item';
        }
        if (this.ui?.tabBar?.element) {
            this.ui.tabBar.element.style.display = 'none';
        }
        loginView.show();
        Toast.success('已退出登录');
    }

    handleSessionExpired(message = '账号已在别处登录，请重新登录') {
        this.gameReady = false;
        saveManager.stopAutoSave?.();
        mailManager.stopAutoRefresh?.();
        Modal.closeAll();
        this.hideCurrentView();
        if (this.ui?.itemGrid) {
            this.ui.itemGrid.currentTab = 'shelter';
            this.ui.itemGrid.inventoryCategory = 'item';
            this.ui.itemGrid.refresh();
        }
        if (this.ui?.tabBar?.element) {
            this.ui.tabBar.element.style.display = 'none';
        }
        loginView.show();
        loginView.showSessionNotice?.(message);
    }

    async deleteSave() {
        if (!confirm('确定要删除存档吗？此操作不可恢复')) {
            return;
        }
        saveManager.delete();
        if (authService.isLoggedIn()) {
            try {
                await SaveApi.deleteSave();
            } catch (error) {
                console.warn('[Game] delete remote save failed:', error);
            }
        }
        location.reload();
    }
}

window.game = new Game();

document.addEventListener('DOMContentLoaded', () => {
    window.game.init();
});

window.addEventListener('beforeunload', () => {
    window.game.save();
});

