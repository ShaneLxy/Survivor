/**
 * 存档管理器 - 单例模式
 */
class SaveManager {
    constructor() {
        if (SaveManager.instance) {
            return SaveManager.instance;
        }
        this.baseSaveKey = 'survivor_game_save';
        this.autoSaveInterval = 30000;
        this.autoSaveTimer = null;
        SaveManager.instance = this;
    }

    /**
     * 获取当前用户的存档 key（账号隔离）
     */
    getSaveKey() {
        const user = authService?.getCurrentUser?.();
        const userId = user?.id || user?.account || 'guest';
        return `${this.baseSaveKey}_${userId}`;
    }

    init() {
        this.startAutoSave();
    }

    startAutoSave() {
        this.stopAutoSave();
        this.autoSaveTimer = setInterval(() => this.autoSave(), this.autoSaveInterval);
    }

    stopAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
    }

    autoSave() {
        this.save();
        eventManager.emit('autoSave', { timestamp: Date.now() });
    }

    save(gameData = null) {
        try {
            const data = gameData || this.collectGameData();
            const saveData = {
                version: '2.0.0',
                timestamp: Date.now(),
                data
            };
            localStorage.setItem(this.getSaveKey(), JSON.stringify(saveData));
            eventManager.emit('save', saveData);
            return true;
        } catch (error) {
            console.error('保存失败:', error);
            eventManager.emit('saveError', { error });
            return false;
        }
    }

    load() {
        try {
            const saveString = localStorage.getItem(this.getSaveKey());
            if (!saveString) return null;
            const saveData = JSON.parse(saveString);
            eventManager.emit('load', saveData);
            return saveData;
        } catch (error) {
            console.error('加载失败:', error);
            eventManager.emit('loadError', { error });
            return null;
        }
    }

    delete() {
        try {
            localStorage.removeItem(this.getSaveKey());
            eventManager.emit('deleteSave');
            return true;
        } catch (error) {
            console.error('删除存档失败:', error);
            return false;
        }
    }

    hasSave() {
        return localStorage.getItem(this.getSaveKey()) !== null;
    }

    getSaveInfo() {
        try {
            const saveString = localStorage.getItem(this.getSaveKey());
            if (!saveString) return null;
            const saveData = JSON.parse(saveString);
            return {
                version: saveData.version,
                timestamp: saveData.timestamp,
                date: new Date(saveData.timestamp).toLocaleString('zh-CN')
            };
        } catch (error) {
            return null;
        }
    }

    collectGameData() {
        if (window.game && typeof window.game.getSaveData === 'function') {
            return window.game.getSaveData();
        }
        return {
            player: {
                level: window.game?.player?.level || 1,
                exp: window.game?.player?.exp || 0,
                energy: window.game?.player?.energy || 100,
                maxEnergy: window.game?.player?.maxEnergy || 100,
                gold: window.game?.player?.gold || 0,
                nickname: window.game?.player?.nickname || '幸存者'
            },
            settings: {
                autoBattle: window.game?.settings?.autoBattle || false,
                muted: window.game?.settings?.muted || false
            },
            heroData: window.heroManager?.getSaveData?.() || null,
            shelterData: window.shelterManager?.getSaveData?.() || null,
            dungeonData: window.dungeonManager?.getSaveData?.() || null,
            itemData: window.itemManager?.getSaveData?.() || null,
            gachaData: window.gachaManager?.getSaveData?.() || null,
            checkinData: window.checkinManager?.getSaveData?.() || null,
            lastSaveTime: Date.now()
        };
    }

    calculateOfflineTime() {
        const saveData = this.load();
        if (!saveData || !saveData.data?.lastSaveTime) {
            return 0;
        }
        return Math.floor((Date.now() - saveData.data.lastSaveTime) / 1000);
    }
}

const saveManager = new SaveManager();
window.saveManager = saveManager;
