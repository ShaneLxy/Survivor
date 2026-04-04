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

    init(saveData) {
        this.dungeons = DungeonConfig.getAllDungeons().map(config => new Dungeon(config));
        this.completedDungeons = saveData?.completedDungeons || {};
        this.stars = saveData?.stars || {};
    }

    getDungeon(dungeonId) {
        return this.dungeons.find(dungeon => dungeon.id === dungeonId) || null;
    }

    getAllDungeons() {
        return [...this.dungeons];
    }

    getDungeonsByLevel(playerLevel) {
        return this.dungeons.filter(dungeon => dungeon.canEnter(playerLevel));
    }

    isCompleted(dungeonId) {
        return !!this.completedDungeons[dungeonId];
    }

    canSweep(dungeonId) {
        return this.isCompleted(dungeonId);
    }

    getStars(dungeonId) {
        return this.stars[dungeonId] || 0;
    }

    completeDungeon(dungeonId, stars = 3) {
        this.completedDungeons[dungeonId] = true;
        const currentStars = this.stars[dungeonId] || 0;
        this.stars[dungeonId] = Math.max(currentStars, stars);
        eventManager.emit('dungeonComplete', { dungeonId, stars });
    }

    getProgress() {
        const total = this.dungeons.length;
        const completed = Object.keys(this.completedDungeons).length;
        const totalStars = Object.values(this.stars).reduce((sum, value) => sum + value, 0);
        const maxStars = total * 3;
        return {
            total,
            completed,
            percent: total > 0 ? (completed / total * 100).toFixed(1) : '0.0',
            totalStars,
            maxStars
        };
    }

    getSaveData() {
        return {
            completedDungeons: { ...this.completedDungeons },
            stars: { ...this.stars }
        };
    }
}

const dungeonManager = new DungeonManager();
window.dungeonManager = dungeonManager;
