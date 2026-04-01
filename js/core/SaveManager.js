/**
 * 存档管理器 - 单例模式
 * 负责游戏数据的保存和加载
 */
class SaveManager {
    constructor() {
        if (SaveManager.instance) {
            return SaveManager.instance;
        }
        this.saveKey = 'survivor_game_save';
        this.autoSaveInterval = 30000; // 30秒自动保存
        this.autoSaveTimer = null;
        SaveManager.instance = this;
    }

    /**
     * 初始化
     */
    init() {
        this.startAutoSave();
    }

    /**
     * 开始自动保存
     */
    startAutoSave() {
        this.stopAutoSave();
        this.autoSaveTimer = setInterval(() => {
            this.autoSave();
        }, this.autoSaveInterval);
    }

    /**
     * 停止自动保存
     */
    stopAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
    }

    /**
     * 自动保存
     */
    autoSave() {
        this.save();
        eventManager.emit('autoSave', { timestamp: Date.now() });
    }

    /**
     * 保存游戏数据
     * @param {Object} gameData - 游戏数据
     */
    save(gameData = null) {
        try {
            const data = gameData || this.collectGameData();
            const saveData = {
                version: '1.0.0',
                timestamp: Date.now(),
                data: data
            };
            localStorage.setItem(this.saveKey, JSON.stringify(saveData));
            eventManager.emit('save', saveData);
            return true;
        } catch (error) {
            console.error('保存失败:', error);
            eventManager.emit('saveError', { error });
            return false;
        }
    }

    /**
     * 加载游戏数据
     * @returns {Object|null} 游戏数据
     */
    load() {
        try {
            const saveString = localStorage.getItem(this.saveKey);
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

    /**
     * 删除存档
     */
    delete() {
        try {
            localStorage.removeItem(this.saveKey);
            eventManager.emit('deleteSave');
            return true;
        } catch (error) {
            console.error('删除存档失败:', error);
            return false;
        }
    }

    /**
     * 检查是否存在存档
     * @returns {boolean}
     */
    hasSave() {
        return localStorage.getItem(this.saveKey) !== null;
    }

    /**
     * 获取存档信息
     * @returns {Object|null}
     */
    getSaveInfo() {
        try {
            const saveString = localStorage.getItem(this.saveKey);
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

    /**
     * 收集游戏数据
     * @returns {Object}
     */
    collectGameData() {
        // 由游戏主逻辑调用,收集所有需要保存的数据
        return {
            player: {
                level: window.game?.player?.level || 1,
                exp: window.game?.player?.exp || 0,
                energy: window.game?.player?.energy || 100,
                maxEnergy: window.game?.player?.maxEnergy || 100,
                gold: window.game?.player?.gold || 0
            },
            settings: {
                skipBattle: window.game?.settings?.skipBattle || false
            },
            // 离线时间记录
            lastSaveTime: Date.now()
        };
    }

    /**
     * 计算离线时间
     * @returns {number} 离线秒数
     */
    calculateOfflineTime() {
        const saveData = this.load();
        if (!saveData || !saveData.data.lastSaveTime) {
            return 0;
        }
        return Math.floor((Date.now() - saveData.data.lastSaveTime) / 1000);
    }
}

// 导出单例
const saveManager = new SaveManager();

// 暴露到全局
window.saveManager = saveManager;
