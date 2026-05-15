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
            muted: false,
            environmentEffectsDisabled: false
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
        this.initialMailData = null;
        this.gameReady = false; // 游戏是否已经完成初始化
        this.loadingOverlay = null;
        this.loadingOverlayHideTimer = null;
    }

    resolveAssetUrl(path) {
        return window.VersionManager?.getVersionedAssetUrl?.(path) || path;
    }

    async init() {
        // 初始化一开始就盖上登录页，避免先闪出游戏主界面
        loginView.show();
        window.VersionManager?.bootstrap?.();
        await window.versionCheckService?.check?.();
        loginView.render?.();

        audioManager.init();
        audioManager.playSceneBgm('login');
        if (window.UnitCatalogLoader?.load) {
            await window.UnitCatalogLoader.load();
        }
        await window.GmCatalogSync?.load?.();

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

        this.showGameLoadingOverlay({
            title: '\u6b63\u5728\u8fdb\u5165\u4e91\u5883',
            message: '\u540c\u6b65\u8d26\u53f7\u5b58\u6863',
            progress: 12
        });

        try {
            const localSave = saveManager.load();
            this.updateGameLoadingOverlay('\u62c9\u53d6\u4e91\u7aef\u5b58\u6863', 26);
            const resolvedSave = await saveSyncService.resolveInitialSave(localSave);

            this.updateGameLoadingOverlay('\u521d\u59cb\u5316\u73a9\u5bb6\u6570\u636e', 48);
            if (resolvedSave?.data) {
                this.loadFromSave(resolvedSave);
            } else {
                this.initNewGame();
            }

            audioManager.setMuted(this.settings.muted);
            this.updateGameLoadingOverlay('\u6574\u7406\u79bb\u7ebf\u6536\u76ca', 64);
            await this.collectOfflineRewards();

            this.updateGameLoadingOverlay('\u6e32\u67d3\u907f\u96be\u6240\u754c\u9762', 78);
            this.initUI();
            mailManager.init(this.initialMailData || null);

            this.updateGameLoadingOverlay('\u66f4\u65b0\u90ae\u4ef6\u4e0e\u4efb\u52a1', 90);
            await mailManager.refresh({ silent: true });
            mailManager.startAutoRefresh();
            saveManager.init();
            this.bindEvents();
            eventManager.emit('authChange', { loggedIn: authService.isLoggedIn(), user: authService.getCurrentUser() });

            this.gameReady = true;
            this.updateGameLoadingOverlay('\u51c6\u5907\u5b8c\u6210', 100);
            this.hideGameLoadingOverlay(360);
        } catch (error) {
            console.error('[Game] login initialization failed:', error);
            Toast.error('\u8fdb\u5165\u6e38\u620f\u5931\u8d25\uff0c\u8bf7\u91cd\u65b0\u767b\u5f55');
            this.hideGameLoadingOverlay(0);
            loginView.show();
        }
    }

    showGameLoadingOverlay(options = {}) {
        clearTimeout(this.loadingOverlayHideTimer);
        let overlay = document.getElementById('game-loading-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'game-loading-overlay';
            overlay.innerHTML = `
                <div class="game-loading-backdrop">
                    <div class="game-loading-grid"></div>
                    <div class="game-loading-glow game-loading-glow-a"></div>
                    <div class="game-loading-glow game-loading-glow-b"></div>
                </div>
                <div class="game-loading-panel">
                    <div class="game-loading-mark">&#20113;&#22659;</div>
                    <div class="game-loading-copy">
                        <div class="game-loading-title"></div>
                        <div class="game-loading-message"></div>
                    </div>
                    <div class="game-loading-progress">
                        <div class="game-loading-fill"></div>
                    </div>
                    <div class="game-loading-percent">0%</div>
                </div>
            `;
            document.body.appendChild(overlay);
        }
        this.loadingOverlay = overlay;
        overlay.classList.remove('is-leaving');
        overlay.classList.add('is-visible');
        this.updateGameLoadingOverlay(options.message || '\u52a0\u8f7d\u4e2d', options.progress || 0, options.title || '\u6b63\u5728\u8fdb\u5165\u4e91\u5883');
    }

    updateGameLoadingOverlay(message, progress = 0, title = null) {
        const overlay = this.loadingOverlay || document.getElementById('game-loading-overlay');
        if (!overlay) return;
        const nextProgress = Math.max(0, Math.min(100, Number(progress) || 0));
        const titleEl = overlay.querySelector('.game-loading-title');
        const messageEl = overlay.querySelector('.game-loading-message');
        const fillEl = overlay.querySelector('.game-loading-fill');
        const percentEl = overlay.querySelector('.game-loading-percent');
        if (title && titleEl) titleEl.textContent = title;
        if (messageEl) messageEl.textContent = message || '\u52a0\u8f7d\u4e2d';
        if (fillEl) fillEl.style.width = `${nextProgress}%`;
        if (percentEl) percentEl.textContent = `${Math.round(nextProgress)}%`;
    }

    hideGameLoadingOverlay(delay = 260) {
        const overlay = this.loadingOverlay || document.getElementById('game-loading-overlay');
        if (!overlay) return;
        clearTimeout(this.loadingOverlayHideTimer);
        this.loadingOverlayHideTimer = setTimeout(() => {
            overlay.classList.add('is-leaving');
            overlay.classList.remove('is-visible');
            setTimeout(() => {
                if (overlay.parentNode && overlay.classList.contains('is-leaving')) {
                    overlay.remove();
                    if (this.loadingOverlay === overlay) {
                        this.loadingOverlay = null;
                    }
                }
            }, 360);
        }, Math.max(0, Number(delay) || 0));
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
                muted: Boolean(data.settings.muted),
                environmentEffectsDisabled: Boolean(data.settings.environmentEffectsDisabled)
            };
        }

        heroManager.init(data.heroData);
        shelterManager.init(data.shelterData);
        dungeonManager.init(data.dungeonData);
        itemManager.init(data.itemData);
        gachaManager.init(data.gachaData);
        checkinManager.init(data.checkinData);
        this.initialMailData = data.mailData || null;
        mailManager.init(this.initialMailData);
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
        this.settings = { autoBattle: false, muted: false, environmentEffectsDisabled: false };

        heroManager.init(null);
        shelterManager.init(null);
        dungeonManager.init(null);
        itemManager.init(null);
        gachaManager.init(null);
        checkinManager.init(null);
        this.initialMailData = null;
        mailManager.init(null);
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
            this.ui.tabBar.element.style.display = '';
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
        audioManager.playSceneBgm(viewId);
    }

    applyViewMode(viewId) {
        const appElement = document.getElementById('app');
        const topBarElement = document.getElementById('top-bar');
        const tabBarElement = document.getElementById('tab-bar');
        const itemSectionElement = document.getElementById('item-section');
        const isBattleMode = viewId === 'battle';
        const isRecruitMode = viewId === 'recruit';
        const hideItemSection = isBattleMode || isRecruitMode || viewId === 'task' || viewId === 'checkin';
        const isHeroMode = viewId === 'hero';
        if (appElement) {
            appElement.classList.toggle('battle-mode', isBattleMode);
            appElement.classList.toggle('recruit-mode', isRecruitMode);
            appElement.classList.toggle('hero-mode', isHeroMode);
        }
        if (topBarElement) {
            topBarElement.style.display = isBattleMode ? 'none' : '';
        }
        if (tabBarElement) {
            tabBarElement.style.display = isBattleMode ? 'none' : '';
        }
        if (itemSectionElement) {
            itemSectionElement.style.display = hideItemSection ? 'none' : '';
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
                iconSrc: this.resolveAssetUrl('assets/images/rewards/player-exp.png'),
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
                iconSrc: this.resolveAssetUrl('assets/images/rewards/hero-exp.png'),
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
            } else if (ItemConfig.getItemConfig(item.id)?.type === 'fragment') {
                const heroConfigId = ItemConfig.getItemConfig(item.id)?.fragmentHeroId || String(item.id || '').replace(/_fragment$/, '');
                rewardEntries.push(RewardModal.createFragmentReward(heroConfigId, item.count || 1));
            } else {
                rewardEntries.push(RewardModal.createItemReward(item.id, item.count || 1));
            }
        });
        return rewardEntries;
    }

    grantDungeonVictoryRewards(dungeon, participantHeroIds) {
        const rewards = dungeon.calculateRewards(this.player.level);
        const overflowAttachments = [];
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
            } else if (ItemConfig.getItemConfig(item.id)?.type === 'fragment') {
                const heroConfigId = ItemConfig.getItemConfig(item.id)?.fragmentHeroId || String(item.id || '').replace(/_fragment$/, '');
                heroManager.addFragments(heroConfigId, item.count || 1);
            } else {
                const count = Math.max(1, Number(item.count) || 1);
                const addableCount = itemManager.getAddableItemCount(item.id, count);
                if (addableCount > 0) {
                    itemManager.addItem(item.id, addableCount);
                }
                if (addableCount < count) {
                    overflowAttachments.push({
                        type: 'item',
                        id: item.id,
                        amount: count - addableCount
                    });
                }
            }
        });

        if (overflowAttachments.length > 0) {
            mailManager.createSystemMail?.({
                title: '副本奖励补发',
                body: '背包容量达到上限，未能直接放入背包的副本奖励已转入邮件。',
                attachments: overflowAttachments
            });
        }

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
            mailData: mailManager.getSaveData?.() || null,
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

