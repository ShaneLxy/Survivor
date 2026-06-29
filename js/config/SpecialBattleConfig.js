const SpecialBattleConfig = {
    escortMissionPrefix: 'escort_',

    getEscortMissions() {
        const gmMissions = this.getConfiguredEscortMissions();
        if (gmMissions.length) {
            return gmMissions;
        }
        const chapters = Array.isArray(window.DungeonChapterConfig) ? window.DungeonChapterConfig : [];
        return chapters
            .map((chapter, index) => this.buildChapterEscortMission(chapter, index))
            .filter(Boolean);
    },

    getEscortMission(missionId) {
        return this.getEscortMissions().find((mission) => mission.id === missionId) || null;
    },

    getConfiguredEscortMissions() {
        const missions = window.GmSpecialBattleSync?.getMissions?.()
            || window.__SURVIVOR_GM_SPECIAL_BATTLES__?.escortMissions
            || [];
        return Array.isArray(missions) ? missions.map((mission) => this.normalizeMission(mission)).filter(Boolean) : [];
    },

    normalizeMission(mission) {
        if (!mission?.id || !mission?.chapterId) {
            return null;
        }
        return {
            ...mission,
            id: String(mission.id).trim(),
            chapterId: String(mission.chapterId).trim(),
            chapterIndex: Math.max(1, Number(mission.chapterIndex || mission.chapterNumber || 1) || 1),
            name: String(mission.name || '资源护送战').trim() || '资源护送战',
            subtitle: String(mission.subtitle || '').trim(),
            description: String(mission.description || '').trim(),
            background: String(mission.background || '').trim(),
            unlockAfterDungeonId: String(mission.unlockAfterDungeonId || '').trim(),
            recommendedLevel: Math.max(1, Number(mission.recommendedLevel) || 1),
            energyCost: Math.max(1, Number(mission.energyCost) || 1),
            fixedRewardRatio: Math.max(0, Math.min(1, Number(mission.fixedRewardRatio ?? 0.6) || 0.6)),
            durabilityRewardRatio: Math.max(0, Math.min(1, Number(mission.durabilityRewardRatio ?? 0.4) || 0.4)),
            baseRewards: this.normalizeBaseRewards(mission.baseRewards),
            cartTemplate: this.normalizeCartTemplate(mission.cartTemplate),
            segments: (Array.isArray(mission.segments) ? mission.segments : []).map((segment, index) => this.normalizeSegment(segment, mission.id, index)).filter(Boolean)
        };
    },

    normalizeBaseRewards(baseRewards) {
        return Object.fromEntries(
            Object.entries(baseRewards && typeof baseRewards === 'object' ? baseRewards : {})
                .map(([id, amount]) => [String(id || '').trim(), Math.max(0, Math.floor(Number(amount) || 0))])
                .filter(([id, amount]) => id && amount > 0)
        );
    },

    normalizeCartTemplate(cartTemplate) {
        const entry = cartTemplate && typeof cartTemplate === 'object' ? cartTemplate : {};
        return {
            name: String(entry.name || '补给车').trim() || '补给车',
            icon: String(entry.icon || '车').trim() || '车',
            portrait: String(entry.portrait || 'assets/images/battle/car.png').trim() || 'assets/images/battle/car.png',
            hp: Math.max(1, Number(entry.hp) || 1),
            attack: Math.max(1, Number(entry.attack) || 1),
            defense: Math.max(0, Number(entry.defense) || 0),
            speed: Math.max(1, Number(entry.speed) || 1),
            attackRange: Math.max(1, Number(entry.attackRange) || 1),
            moveRange: Math.max(1, Number(entry.moveRange) || 1)
        };
    },

    normalizeSegment(segment, missionId, index) {
        const entry = segment && typeof segment === 'object' ? segment : {};
        const battlefield = entry.battlefield && typeof entry.battlefield === 'object' ? entry.battlefield : {};
        return {
            ...entry,
            id: String(entry.id || `${missionId}_segment_${index + 1}`).trim(),
            index: Math.max(1, Number(entry.index) || index + 1),
            sourceDungeonId: String(entry.sourceDungeonId || '').trim(),
            name: String(entry.name || `第${index + 1}段`).trim() || `第${index + 1}段`,
            description: String(entry.description || '').trim(),
            battlefield: {
                cols: Math.max(1, Number(battlefield.cols || battlefield.width || 7) || 7),
                rows: Math.max(1, Number(battlefield.rows || battlefield.height || 10) || 10),
                actionTimeout: Math.max(1, Number(battlefield.actionTimeout || 25) || 25),
                heroSpawn: {
                    positions: this.normalizeCoordinateList(battlefield.heroSpawn?.positions)
                },
                enemySpawn: {
                    positions: this.normalizeCoordinateList(battlefield.enemySpawn?.positions)
                },
                obstacles: this.normalizeCoordinateList(battlefield.obstacles),
                specialTiles: this.normalizeSpecialTiles(battlefield.specialTiles)
            },
            route: this.normalizeCoordinateList(entry.route),
            goalPosition: this.normalizeSingleCoordinate(entry.goalPosition),
            environmentEffect: String(entry.environmentEffect || '').trim(),
            storyDialogues: Array.isArray(entry.storyDialogues) ? entry.storyDialogues : [],
            initialEnemies: Array.isArray(entry.initialEnemies) ? entry.initialEnemies.map((enemy) => this.normalizeEnemyEntry(enemy)).filter(Boolean) : [],
            reinforcementEnemies: Array.isArray(entry.reinforcementEnemies) ? entry.reinforcementEnemies.map((enemy) => this.normalizeEnemyEntry(enemy)).filter(Boolean) : [],
            bossWaves: Array.isArray(entry.bossWaves) ? entry.bossWaves.map((wave, waveIndex) => this.normalizeBossWave(wave, missionId, index, waveIndex)).filter(Boolean) : []
        };
    },

    normalizeBossWave(wave, missionId, segmentIndex, waveIndex) {
        const entry = wave && typeof wave === 'object' ? wave : {};
        const bosses = Array.isArray(entry.bosses) ? entry.bosses.map((boss) => this.normalizeEnemyEntry(boss)).filter(Boolean) : [];
        if (!bosses.length) {
            return null;
        }
        return {
            id: String(entry.id || `${missionId}_segment_${segmentIndex + 1}_boss_wave_${waveIndex + 1}`).trim(),
            spawnRound: Math.max(1, Number(entry.spawnRound) || 12),
            spawnOnClearBeforeRound: entry.spawnOnClearBeforeRound !== false,
            bosses
        };
    },

    normalizeEnemyEntry(enemy) {
        if (!enemy?.id) {
            return null;
        }
        const next = {
            id: String(enemy.id).trim(),
            rank: String(enemy.rank || 'normal').trim() || 'normal',
            count: Math.max(1, Number(enemy.count) || 1),
            duty: String(enemy.duty || enemy.sourceType || 'escort_cart').trim() || 'escort_cart'
        };
        const positions = this.normalizeCoordinateList(enemy.positions || enemy.spawnPositions);
        if (positions.length) {
            next.positions = positions;
        }
        const skillIds = (Array.isArray(enemy.skillIds) ? enemy.skillIds : [])
            .map((skillId) => String(skillId || '').trim())
            .filter(Boolean);
        if (skillIds.length) {
            next.skillIds = skillIds;
        }
        if (enemy.multiplier !== undefined && enemy.multiplier !== '') {
            next.multiplier = Math.max(0.1, Number(enemy.multiplier) || 1);
        }
        const stats = this.normalizeNumericObject(enemy.stats);
        if (Object.keys(stats).length) {
            next.stats = stats;
        }
        const overrideStats = this.normalizeNumericObject(enemy.overrideStats);
        if (Object.keys(overrideStats).length) {
            next.overrideStats = overrideStats;
        }
        return next;
    },

    normalizeNumericObject(source) {
        if (!source || typeof source !== 'object') {
            return {};
        }
        return Object.fromEntries(
            Object.entries(source)
                .map(([key, raw]) => [key, Number(raw)])
                .filter(([, raw]) => Number.isFinite(raw))
        );
    },

    normalizeSingleCoordinate(value) {
        return this.normalizeCoordinateList(value ? [value] : [])[0] || null;
    },

    normalizeCoordinateList(list) {
        return (Array.isArray(list) ? list : [])
            .map((point) => {
                if (Array.isArray(point)) {
                    return [Math.max(1, Number(point[0]) || 1), Math.max(1, Number(point[1]) || 1)];
                }
                if (point && typeof point === 'object') {
                    return [
                        Math.max(1, Number(point.row ?? point.y ?? 1) || 1),
                        Math.max(1, Number(point.col ?? point.x ?? 1) || 1)
                    ];
                }
                return null;
            })
            .filter(Boolean);
    },

    normalizeSpecialTiles(value) {
        const list = Array.isArray(value)
            ? value
            : (value && typeof value === 'object' ? Object.entries(value).map(([type, positions]) => ({ type, positions })) : []);
        return list
            .map((entry) => {
                const type = String(entry?.type || entry?.kind || entry?.effect || '').trim();
                const positions = this.normalizeCoordinateList(entry?.positions || entry?.coords || entry?.cells || []);
                if (!type || !positions.length) {
                    return null;
                }
                return { type, positions };
            })
            .filter(Boolean);
    },

    buildChapterEscortMission(chapter, index = 0) {
        if (!chapter?.id) {
            return null;
        }

        const dungeonIds = Array.isArray(chapter.dungeonIds) ? chapter.dungeonIds.filter(Boolean) : [];
        const sourceDungeons = dungeonIds.map((dungeonId) => dungeonManager.getDungeon(dungeonId)).filter(Boolean);
        if (sourceDungeons.length === 0) {
            return null;
        }
        if (!sourceDungeons.some((dungeon) => Array.isArray(dungeon?.initialEnemies) && dungeon.initialEnemies.length > 0)) {
            return null;
        }

        const chapterIndex = Math.max(1, Number(chapter.index || chapter.chapterNumber || index + 1) || index + 1);
        const missionId = `${this.escortMissionPrefix}${chapter.id}`;
        const recommendedLevel = sourceDungeons.reduce((maxLevel, dungeon) => Math.max(maxLevel, Number(dungeon?.level) || 1), 1);
        const energyCost = Math.max(
            12,
            sourceDungeons.reduce((maxCost, dungeon) => Math.max(maxCost, Number(dungeon?.energyCost) || 0), 0) + 6
        );

        return {
            id: missionId,
            type: 'escort',
            chapterId: chapter.id,
            chapterIndex,
            name: '资源护送战',
            subtitle: chapter.name || `第${chapterIndex}章`,
            description: chapter.description || '护送补给车穿越战区，载具耐久越高，最终资源结算越完整。',
            background: chapter.battleBackground || chapter.background || '',
            unlockAfterDungeonId: dungeonIds[dungeonIds.length - 1] || '',
            recommendedLevel,
            energyCost,
            fixedRewardRatio: 0.6,
            durabilityRewardRatio: 0.4,
            baseRewards: this.buildEscortBaseRewards(chapterIndex, recommendedLevel, sourceDungeons.length),
            cartTemplate: {
                name: '补给车',
                icon: '车',
                portrait: 'assets/images/battle/car.png',
                hp: 720 + chapterIndex * 220 + recommendedLevel * 40,
                attack: 1,
                defense: 24 + chapterIndex * 4,
                speed: 6,
                attackRange: 1,
                moveRange: 1
            },
            segments: sourceDungeons.map((dungeon, segmentIndex) => ({
                id: `${missionId}_segment_${segmentIndex + 1}`,
                index: segmentIndex + 1,
                sourceDungeonId: dungeon.id,
                name: dungeon.name || `第${segmentIndex + 1}段`,
                description: dungeon.description || ''
            }))
        };
    },

    buildEscortBaseRewards(chapterIndex, recommendedLevel, segmentCount) {
        const base = Math.max(1, Number(chapterIndex) || 1);
        const level = Math.max(1, Number(recommendedLevel) || 1);
        const segments = Math.max(1, Number(segmentCount) || 1);
        const rewards = {
            gold: 180 + base * 110 + level * 24,
            wood: 36 + base * 16 + segments * 8,
            stone: 28 + base * 14 + segments * 7,
            meat: 30 + base * 15 + segments * 9
        };

        if (base >= 2) {
            rewards.iron_ore = 10 + base * 6 + segments * 4;
        }

        return Object.fromEntries(
            Object.entries(rewards).filter(([, amount]) => Math.max(0, Math.floor(Number(amount) || 0)) > 0)
        );
    }
};

window.SpecialBattleConfig = SpecialBattleConfig;
