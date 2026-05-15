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
        this.reloadFromConfig();
        this.completedDungeons = saveData?.completedDungeons || {};
        this.stars = saveData?.stars || {};
    }

    reloadFromConfig() {
        this.dungeons = DungeonConfig.getAllDungeons().map(config => new Dungeon(config));
        return this.getAllDungeons();
    }

    getDungeon(dungeonId) {
        const currentDungeon = this.dungeons.find(dungeon => dungeon.id === dungeonId);
        if (currentDungeon) {
            return currentDungeon;
        }

        const config = DungeonConfig.getDungeonConfig(dungeonId);
        if (!config) {
            return null;
        }

        const nextDungeon = new Dungeon(config);
        this.dungeons.push(nextDungeon);
        return nextDungeon;
    }

    getAllDungeons() {
        return [...this.dungeons];
    }

    getDungeonsByLevel(playerLevel) {
        return [...this.dungeons];
    }

    getMonsterCompendium(playerLevel) {
        const grouped = {
            normal: [],
            elite: [],
            boss: []
        };
        const entryMap = new Map();

        this.dungeons.forEach((dungeon) => {
            const dungeonUnlocked = dungeon.canEnter(playerLevel);
            dungeon.getAllEnemyEntries().forEach((enemyEntry) => {
                const enemyConfig = DungeonConfig.getEnemyConfig(enemyEntry.id);
                if (!enemyConfig) {
                    return;
                }
                const entryRank = DungeonConfig.getEnemyEntryRank(enemyEntry, enemyConfig);
                const existing = entryMap.get(enemyEntry.id) || {
                    id: enemyEntry.id,
                    name: enemyConfig.name,
                    icon: enemyConfig.icon,
                    portrait: enemyConfig.portrait || null,
                    rank: entryRank,
                    description: enemyConfig.description || '',
                    skills: enemyConfig.skills ? enemyConfig.skills.map(skill => ({ ...skill })) : [],
                    skill: enemyConfig.skill ? { ...enemyConfig.skill } : null,
                    unlockLevel: dungeon.level,
                    dungeons: []
                };
                existing.unlockLevel = Math.min(existing.unlockLevel, dungeon.level);
                existing.dungeons.push({
                    id: dungeon.id,
                    name: dungeon.name,
                    level: dungeon.level,
                    unlocked: dungeonUnlocked,
                    count: Number(enemyEntry.count) || 0,
                    sourceType: enemyEntry.sourceType || 'initial',
                    rank: entryRank,
                    stats: DungeonConfig.resolveEnemyEntryStats(enemyEntry, dungeon.level)
                });
                entryMap.set(enemyEntry.id, existing);
            });
        });

        [...entryMap.values()]
            .sort((a, b) => a.unlockLevel - b.unlockLevel || a.name.localeCompare(b.name, 'zh-Hans-CN'))
            .forEach((entry) => {
                const unlocked = playerLevel >= entry.unlockLevel;
                const availableDungeons = unlocked
                    ? entry.dungeons.filter(item => item.unlocked)
                    : entry.dungeons;
                const previewLevel = availableDungeons.reduce((minLevel, item) => Math.min(minLevel, item.level), Infinity);
                const normalizedPreviewLevel = Number.isFinite(previewLevel) ? previewLevel : entry.unlockLevel;
                const previewDungeon = availableDungeons
                    .slice()
                    .sort((a, b) => a.level - b.level)[0] || null;
                const previewRank = previewDungeon?.rank || entry.rank || 'normal';
                const fullEntry = {
                    ...entry,
                    unlocked,
                    previewLevel: normalizedPreviewLevel,
                    stats: previewDungeon?.stats || DungeonConfig.calculateEnemyStats(entry.id, normalizedPreviewLevel),
                    rank: previewRank,
                    rankLabel: DungeonConfig.getEnemyRankLabel(previewRank),
                    dungeons: availableDungeons.sort((a, b) => a.level - b.level)
                };
                const bucket = grouped[fullEntry.rank] || grouped.normal;
                bucket.push(fullEntry);
            });

        return grouped;
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
