/**
 * 地牢管理器 - 单例模式
 */
class DungeonManager {
    constructor() {
        if (DungeonManager.instance) {
            return DungeonManager.instance;
        }
        this.dungeons = [];
        this.completedDungeons = {};
        this.stars = {};
        DungeonManager.instance = this;
    }

    /**
     * 初始化
     */
    init(saveData) {
        const allDungeons = DungeonConfig.getAllDungeons();
        this.dungeons = allDungeons.map(config => new Dungeon(config));

        if (saveData) {
            this.completedDungeons = saveData.completedDungeons || {};
            this.stars = saveData.stars || {};
        } else {
            this.completedDungeons = {};
            this.stars = {};
        }
    }

    /**
     * 获取地牢
     * @param {string} dungeonId - 地牢ID
     * @returns {Dungeon|null}
     */
    getDungeon(dungeonId) {
        return this.dungeons.find(d => d.id === dungeonId);
    }

    /**
     * 获取所有地牢
     * @returns {Array<Dungeon>}
     */
    getAllDungeons() {
        return this.dungeons;
    }

    /**
     * 根据等级获取可进入的地牢
     * @param {number} playerLevel - 玩家等级
     * @returns {Array<Dungeon>}
     */
    getDungeonsByLevel(playerLevel) {
        return this.dungeons.filter(d => d.canEnter(playerLevel));
    }

    /**
     * 检查地牢是否完成
     * @param {string} dungeonId - 地牢ID
     * @returns {boolean}
     */
    isCompleted(dungeonId) {
        return !!this.completedDungeons[dungeonId];
    }

    /**
     * 获取地牢星级
     * @param {string} dungeonId - 地牢ID
     * @returns {number}
     */
    getStars(dungeonId) {
        return this.stars[dungeonId] || 0;
    }

    /**
     * 完成地牢
     * @param {string} dungeonId - 地牢ID
     * @param {number} stars - 星级
     */
    completeDungeon(dungeonId, stars = 3) {
        this.completedDungeons[dungeonId] = true;
        const currentStars = this.stars[dungeonId] || 0;
        this.stars[dungeonId] = Math.max(currentStars, stars);

        eventManager.emit('dungeonComplete', { dungeonId, stars });
    }

    /**
     * 获取完成进度
     * @returns {Object}
     */
    getProgress() {
        const total = this.dungeons.length;
        const completed = Object.keys(this.completedDungeons).length;
        const totalStars = Object.values(this.stars).reduce((sum, s) => sum + s, 0);
        const maxStars = total * 3;

        return {
            total,
            completed,
            percent: (completed / total * 100).toFixed(1),
            totalStars,
            maxStars
        };
    }

    /**
     * 获取保存数据
     * @returns {Object}
     */
    getSaveData() {
        return {
            completedDungeons: this.completedDungeons,
            stars: this.stars
        };
    }
}

// 导出单例
const dungeonManager = new DungeonManager();

// 暴露到全局
window.dungeonManager = dungeonManager;
