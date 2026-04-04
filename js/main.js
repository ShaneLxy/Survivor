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
            nickname: '幸存者'
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
            checkinView
        };
        this.currentView = 'shelter';
    }

    async init() {
        audioManager.init();
        const saveData = saveManager.load();
        if (saveData?.data) {
            this.loadFromSave(saveData);
        } else {
            this.initNewGame();
        }

        audioManager.setMuted(this.settings.muted);
        await this.collectOfflineRewards();
        this.initUI();
        saveManager.init();
        this.bindEvents();
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
        this.player.gold = shelterManager.getResource('gold');
    }

    initNewGame() {
        this.player = {
            level: GameConfig.player.initialLevel,
            exp: GameConfig.player.initialExp,
            energy: GameConfig.player.initialEnergy,
            maxEnergy: GameConfig.player.maxEnergy,
            gold: GameConfig.player.initialGold,
            nickname: '幸存者'
        };
        this.settings = { autoBattle: false, muted: false };

        heroManager.init(null);
        shelterManager.init(null);
        dungeonManager.init(null);
        itemManager.init(null);
        gachaManager.init(null);
        checkinManager.init(null);
        this.player.gold = shelterManager.getResource('gold');
    }

    async collectOfflineRewards() {
        const offlineSeconds = saveManager.calculateOfflineTime();
        if (offlineSeconds <= 60) {
            return;
        }

        const production = shelterManager.calculateOfflineProduction(offlineSeconds);
        const rewardEntries = [];
        if (production && Object.keys(production).length > 0) {
            for (const [type, amount] of Object.entries(production)) {
                if (amount > 0) {
                    shelterManager.addResource(type, amount);
                    rewardEntries.push(RewardModal.createResourceReward(type, amount));
                }
            }
        }

        if (rewardEntries.length > 0) {
            this.player.gold = shelterManager.getResource('gold');
            await RewardModal.show({
                title: '离线收益',
                rewards: rewardEntries,
                summaryText: `离线时长：${Utils.formatTime(offlineSeconds)}`
            });
        }
    }

    initUI() {
        this.ui.topBar.updateAll(this.player);
        this.switchView('shelter');
        this.ui.itemGrid.refresh();
    }

    bindEvents() {
        eventManager.on('viewChange', data => this.switchView(data.view));
        eventManager.on('enterBattle', async data => {
            this.switchView('battle');
            await this.ui.battleView.startBattle(data.dungeonId, data.sceneId || 'standard_9x9');
        });
        eventManager.on('heroAdd', () => this.ui.heroView.refresh());
        eventManager.on('heroLevelUp', hero => {
            Toast.success(`${hero.name}升级到Lv.${hero.level}`);
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
        });
        eventManager.on('dungeonComplete', () => {
            this.ui.dungeonView.refresh();
        });
        eventManager.on('autoSave', data => {
            console.log('自动保存完成', new Date(data.timestamp).toLocaleString());
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
        const isBattleMode = viewId === 'battle';
        if (appElement) {
            appElement.classList.toggle('battle-mode', isBattleMode);
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
                this.currentView = 'shelter';
        }
    }

    checkLevelUp() {
        let leveled = false;
        while (this.player.exp >= GameConfig.getExpRequired(this.player.level)) {
            const expRequired = GameConfig.getExpRequired(this.player.level);
            this.player.exp -= expRequired;
            this.player.level++;
            this.player.maxEnergy += 10;
            this.player.energy = this.player.maxEnergy;
            Toast.success(`恭喜升级到Lv.${this.player.level}!`);
            leveled = true;
        }
        if (leveled) {
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
                    ...(heroExpSummary.blocked.length > 0 ? [`未获得经验：${heroExpSummary.blocked.map(hero => hero.name).join('、')}（已达到玩家等级上限）`] : [])
                ]
            }));
        }
        (rewards?.items || []).forEach(item => {
            rewardEntries.push(RewardModal.createItemReward(item.id, item.count || 1));
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
            if (item?.id) {
                itemManager.addItem(item.id, item.count || 1);
            }
        });

        dungeonManager.completeDungeon(dungeon.id, 3);
        this.ui.topBar.updateAll(this.player);
        this.ui.itemGrid.refresh();
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

    deleteSave() {
        if (confirm('确定要删除存档吗?此操作不可恢复!')) {
            saveManager.delete();
            location.reload();
        }
    }
}

window.game = new Game();

document.addEventListener('DOMContentLoaded', () => {
    window.game.init();
});

window.addEventListener('beforeunload', () => {
    window.game.save();
});
