(function() {
    function cloneValue(value) {
        if (Array.isArray(value)) {
            return value.map(cloneValue);
        }
        if (value && typeof value === 'object') {
            return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, cloneValue(inner)]));
        }
        return value;
    }

    function getEscortStateStore() {
        if (!window.game) {
            return null;
        }
        if (!window.game.specialBattleState) {
            window.game.specialBattleState = {
                currentEscortRun: null,
                completedSegmentIds: {}
            };
        }
        return window.game.specialBattleState;
    }

    function isEscortSegmentCompleted(segmentId) {
        const store = getEscortStateStore();
        return Boolean(store?.completedSegmentIds?.[segmentId]);
    }

    function markEscortSegmentCompleted(segmentId) {
        const store = getEscortStateStore();
        if (!store || !segmentId) {
            return;
        }
        store.completedSegmentIds = store.completedSegmentIds || {};
        store.completedSegmentIds[segmentId] = true;
    }

    function getStoryBackground(view, currentDungeon, sourceDungeon, mission) {
        const background = mission?.background
            || sourceDungeon?.battleBackground
            || sourceDungeon?.background
            || currentDungeon?.battleBackground
            || window.GameSceneBackgrounds?.battle?.src
            || '';
        const resolved = typeof view?.resolveAssetUrl === 'function' ? view.resolveAssetUrl(background) : background;
        if (!resolved) {
            return '';
        }
        return /^(?:https?:|data:|blob:|\/)/i.test(resolved)
            ? resolved
            : `/${String(resolved).replace(/^\.\//, '')}`;
    }

    function playStoryDialogue(dialogues, onComplete, options = {}) {
        if (!window.StoryDialogue) {
            onComplete();
            return;
        }
        new StoryDialogue(dialogues, {
            typingSpeed: 60,
            backgroundImage: options.backgroundImage || '',
            segmentCharLimit: 50,
            onComplete,
            onSkip: onComplete
        });
    }

    function buildEscortCartUnit(runState) {
        const cartTemplate = runState?.mission?.cartTemplate || {};
        const maxHp = Math.max(1, Number(runState?.cartMaxHp || cartTemplate.hp || 1200) || 1200);
        const hp = Math.max(1, Math.min(maxHp, Number(runState?.cartHp || maxHp) || maxHp));
        const stats = {
            hp: maxHp,
            attack: Math.max(1, Number(cartTemplate.attack || 1) || 1),
            attackCoefficient: 1,
            defense: Math.max(0, Number(cartTemplate.defense || 0) || 0),
            speed: Math.max(1, Number(cartTemplate.speed || 6) || 6),
            crit: 0,
            antiCrit: 0,
            defensePen: 0,
            accuracy: 0,
            dodge: 0,
            attackRange: Math.max(1, Number(cartTemplate.attackRange || 1) || 1),
            moveRange: Math.max(1, Number(cartTemplate.moveRange || 1) || 1)
        };
        const unit = new BattleUnit({
            id: runState.cartUnitId || `escort_cart_${runState.mission.id}`,
            configId: 'escort_cart',
            name: cartTemplate.name || '补给车',
            icon: cartTemplate.icon || '车',
            type: 'escort_cart',
            camp: 'hero',
            profession: 'defender',
            rank: 'escort',
            description: '护送目标',
            baseStats: stats,
            skills: []
        });
        unit.hp = hp;
        unit.maxHp = maxHp;
        unit.portrait = cartTemplate.portrait || 'assets/images/battle/car.png';
        unit.isEscortCart = true;
        unit.escortMissionId = runState?.mission?.id || '';
        unit.escortRole = 'cart';
        return unit;
    }

    function normalizePosition(position) {
        if (Array.isArray(position)) {
            return {
                x: Number(position[1]) - 1,
                y: Number(position[0]) - 1
            };
        }
        if (position && typeof position === 'object') {
            if (position.row !== undefined || position.col !== undefined) {
                return {
                    x: Number(position.col) - 1,
                    y: Number(position.row) - 1
                };
            }
            if (position.x !== undefined || position.y !== undefined) {
                return {
                    x: Number(position.x),
                    y: Number(position.y)
                };
            }
        }
        return null;
    }

    function normalizePositionList(list) {
        return (Array.isArray(list) ? list : []).map((entry) => normalizePosition(entry)).filter(Boolean);
    }

    function cloneBattlefield(battlefield) {
        if (!battlefield || typeof battlefield !== 'object') {
            return null;
        }
        return {
            ...cloneValue(battlefield),
            heroSpawn: {
                ...(battlefield.heroSpawn || {}),
                positions: Array.isArray(battlefield.heroSpawn?.positions) ? battlefield.heroSpawn.positions.map((position) => cloneValue(position)) : []
            },
            enemySpawn: {
                ...(battlefield.enemySpawn || {}),
                positions: Array.isArray(battlefield.enemySpawn?.positions) ? battlefield.enemySpawn.positions.map((position) => cloneValue(position)) : []
            },
            obstacles: Array.isArray(battlefield.obstacles) ? battlefield.obstacles.map((entry) => cloneValue(entry)) : [],
            specialTiles: Array.isArray(battlefield.specialTiles) ? battlefield.specialTiles.map((entry) => cloneValue(entry)) : []
        };
    }

    function buildEnemyUnitsFromEntries(entries, stageLevel) {
        return (Array.isArray(entries) ? entries : []).flatMap((entry) => {
            const config = DungeonConfig.getEnemyConfig(entry?.id);
            if (!config) {
                return [];
            }
            const count = Math.max(1, Number(entry.count) || 1);
            return Array.from({ length: count }, (_, unitIndex) => {
                const stats = DungeonConfig.resolveEnemyEntryStats(entry, stageLevel);
                const skills = DungeonConfig.resolveEnemyEntrySkills(entry, config);
                const unit = new BattleUnit({
                    id: Utils.generateId(),
                    configId: entry.id,
                    name: entry.name || config.name,
                    icon: config.icon,
                    portrait: entry.portrait || config.portrait || null,
                    type: 'enemy',
                    camp: 'enemy',
                    rank: DungeonConfig.getEnemyEntryRank(entry, config),
                    description: entry.description || config.description || '',
                    skills,
                    skill: skills[0] || null,
                    passiveEffects: Array.isArray(config.passiveEffects) ? config.passiveEffects.map((effect) => ({ ...effect })) : [],
                    basicAttackEffects: Array.isArray(config.basicAttackEffects) ? config.basicAttackEffects.map((effect) => ({ ...effect })) : [],
                    reactiveEffects: Array.isArray(config.reactiveEffects) ? config.reactiveEffects.map((effect) => ({ ...effect })) : [],
                    baseStats: stats
                });
                const spawnPositions = Array.isArray(entry.positions || entry.spawnPositions) ? (entry.positions || entry.spawnPositions) : [];
                const preferredSpawn = normalizePosition(spawnPositions[unitIndex] || spawnPositions[0]);
                if (preferredSpawn) {
                    unit.preferredSpawnPosition = { ...preferredSpawn };
                }
                unit.escortDuty = String(entry.duty || entry.sourceType || 'escort_cart').trim() || 'escort_cart';
                return unit;
            });
        });
    }

    function getEscortEnemyDuty(actor) {
        return String(actor?.escortDuty || actor?.sourceType || 'escort_cart').trim() || 'escort_cart';
    }

    function cloneEscortEnemyEntry(entry) {
        return cloneValue(entry || {});
    }

    function buildEscortReinforcementUnit(entry, stageLevel) {
        return buildEnemyUnitsFromEntries([cloneEscortEnemyEntry(entry)], stageLevel)[0] || null;
    }

    function buildBossWavesFromEntries(waves, stageLevel) {
        return (Array.isArray(waves) ? waves : []).map((wave, index) => {
            const bosses = buildEnemyUnitsFromEntries(wave?.bosses || [], stageLevel);
            if (!bosses.length) {
                return null;
            }
            return {
                id: wave?.id || `escort_boss_wave_${index + 1}`,
                spawnRound: Math.max(1, Number(wave?.spawnRound) || 12),
                spawnOnClearBeforeRound: wave?.spawnOnClearBeforeRound !== false,
                bosses
            };
        }).filter(Boolean);
    }

    function buildEscortSegmentBattlefield(segmentIndex) {
        const safeIndex = Math.max(0, Number(segmentIndex) || 0);
        if (safeIndex === 0) {
            return {
                rows: 10,
                cols: 7,
                actionTimeout: 25,
                heroSpawn: {
                    positions: [
                        [10, 2],
                        [10, 6],
                        [9, 2],
                        [9, 6]
                    ]
                },
                enemySpawn: {
                    positions: [
                        [2, 2],
                        [2, 4],
                        [2, 6],
                        [1, 3],
                        [1, 5]
                    ]
                },
                obstacles: [
                    [4, 1],
                    [4, 7],
                    [6, 2],
                    [6, 6]
                ],
                specialTiles: [
                    { type: 'fire', positions: [[5, 3], [5, 5]] },
                    { type: 'heal', positions: [[8, 2], [8, 6]] }
                ]
            };
        }

        if (safeIndex === 1) {
            return {
                rows: 10,
                cols: 7,
                actionTimeout: 25,
                heroSpawn: {
                    positions: [
                        [10, 2],
                        [10, 6],
                        [9, 2],
                        [9, 6]
                    ]
                },
                enemySpawn: {
                    positions: [
                        [2, 1],
                        [2, 3],
                        [2, 5],
                        [2, 7],
                        [1, 4]
                    ]
                },
                obstacles: [
                    [4, 3],
                    [4, 5],
                    [7, 2],
                    [7, 6]
                ],
                specialTiles: [
                    { type: 'miasma', positions: [[5, 2], [5, 6]] },
                    { type: 'heal', positions: [[8, 4]] }
                ]
            };
        }

        return {
            rows: 10,
            cols: 7,
            actionTimeout: 25,
            heroSpawn: {
                positions: [
                    [10, 2],
                    [10, 6],
                    [9, 2],
                    [9, 6]
                ]
            },
            enemySpawn: {
                positions: [
                    [2, 2],
                    [2, 4],
                    [2, 6],
                    [1, 3],
                    [1, 5]
                ]
            },
            obstacles: [
                [4, 2],
                [4, 6],
                [6, 2]
            ],
            specialTiles: [
                { type: 'fire', positions: [[5, 4]] },
                { type: 'swamp', positions: [[7, 3], [7, 5]] }
            ]
        };
    }

    function buildEscortPathForBattlefield(battlefield) {
        const rows = Math.max(1, Number(battlefield?.rows || battlefield?.height || 10) || 10);
        const routeCol = 4;
        const path = [];
        for (let row = rows; row >= 1; row -= 1) {
            path.push({ row, col: routeCol });
        }
        return path;
    }

    function buildEscortEnemyEntries(sourceDungeon, segmentIndex) {
        const dungeon = sourceDungeon || null;
        const initialEntries = Array.isArray(dungeon?.initialEnemies) ? dungeon.initialEnemies : [];
        const bossEntries = Array.isArray(dungeon?.bossWaves)
            ? dungeon.bossWaves.flatMap((wave) => Array.isArray(wave?.bosses) ? wave.bosses : [])
            : [];
        const sourceEntries = [...initialEntries, ...bossEntries].filter(Boolean);
        if (sourceEntries.length > 0) {
            return sourceEntries.map((entry) => ({
                ...cloneValue(entry),
                count: Math.max(1, Number(entry.count) || 1),
                sourceType: entry.sourceType || 'escort'
            }));
        }

        const fallbackSets = [
            [
                { id: 'enemy_raider', count: 2 },
                { id: 'enemy_hunter', count: 1 }
            ],
            [
                { id: 'enemy_raider', count: 2 },
                { id: 'enemy_slaughterer', count: 1 },
                { id: 'enemy_hunter', count: 1 }
            ],
            [
                { id: 'enemy_slaughterer', count: 2 },
                { id: 'enemy_hunter', count: 2 }
            ]
        ];
        return fallbackSets[Math.min(segmentIndex, fallbackSets.length - 1)].map((entry) => ({ ...entry }));
    }

    function buildEscortSegmentSetup(runState) {
        const mission = runState?.mission;
        const segmentIndex = Math.max(0, Number(runState?.currentSegmentIndex) || 0);
        const segment = mission?.segments?.[segmentIndex] || null;
        if (!mission || !segment) {
            return null;
        }

        const sourceDungeon = segment.sourceDungeonId ? dungeonManager.getDungeon(segment.sourceDungeonId) : null;
        const battlefield = cloneBattlefield(segment.battlefield) || buildEscortSegmentBattlefield(segmentIndex);
        const routeSource = normalizePositionList(segment.route);
        const route = (routeSource.length ? routeSource : buildEscortPathForBattlefield(battlefield)).map((position, index) => ({
            ...position,
            id: `${segment.id}_route_${index + 1}`
        }));
        const goalPosition = normalizePosition(segment.goalPosition) || normalizePosition(route[route.length - 1]);
        const lastRoutePosition = normalizePosition(route[route.length - 1]);
        if (goalPosition && (!lastRoutePosition || lastRoutePosition.x !== goalPosition.x || lastRoutePosition.y !== goalPosition.y)) {
            route.push({
                ...goalPosition,
                id: `${segment.id}_goal`
            });
        }
        const initialCartPosition = normalizePosition(route[0]);
        const currentCartPosition = normalizePosition(initialCartPosition);
        const stageLevel = Number(sourceDungeon?.level) || Number(mission.recommendedLevel) || 1;
        const hasConfiguredInitialEnemies = Array.isArray(segment.initialEnemies);
        const initialEnemyEntries = hasConfiguredInitialEnemies
            ? segment.initialEnemies
            : buildEscortEnemyEntries(sourceDungeon, segmentIndex);
        const bossWaveEntries = Array.isArray(segment.bossWaves)
            ? segment.bossWaves
            : [];
        const enemyUnits = buildEnemyUnitsFromEntries(initialEnemyEntries, stageLevel);
        const bossWaves = buildBossWavesFromEntries(bossWaveEntries, stageLevel);

        const battleSetup = {
            environmentEffect: segment.environmentEffect || sourceDungeon?.environmentEffect || 'none',
            battlefield,
            initialEnemies: enemyUnits,
            bossWaves,
            reinforcementEnemyEntries: (Array.isArray(segment.reinforcementEnemies) && segment.reinforcementEnemies.length > 0
                ? segment.reinforcementEnemies
                : initialEnemyEntries
            ).map((entry) => cloneEscortEnemyEntry(entry)),
            baseEnemyCount: enemyUnits.length,
            maxExtraEnemies: 5,
            reinforcementIntervalRounds: 4
        };

        return {
            mission,
            segment,
            sourceDungeon,
            battleSetup,
            route,
            initialCartPosition,
            currentCartPosition,
            goalPosition
        };
    }

    function persistEscortHeroes(units) {
        const store = getEscortStateStore();
        const runState = store?.currentEscortRun;
        if (!runState || !Array.isArray(units)) {
            return;
        }
        runState.heroStates = units
            .filter((unit) => unit && !unit.isEscortCart)
            .map((unit) => ({
                id: unit.id,
                hp: Math.max(0, Number(unit.hp) || 0),
                maxHp: Math.max(1, Number(unit.maxHp) || 1),
                baseMaxHp: Math.max(1, Number(unit.baseMaxHp || unit.maxHp) || 1),
                progress: Math.max(0, Number(unit.progress) || 0),
                shield: Math.max(0, Number(unit.shield) || 0),
                maxShield: Math.max(0, Number(unit.maxShield) || 0),
                shieldRemainingTurns: Math.max(0, Number(unit.shieldRemainingTurns) || 0),
                defendBonus: Math.max(0, Number(unit.defendBonus) || 0),
                statusEffects: Array.isArray(unit.statusEffects) ? unit.statusEffects.map((effect) => cloneValue(effect)) : [],
                passiveState: cloneValue(unit.passiveState || {}),
                skillStates: Array.isArray(unit.skillStates) ? unit.skillStates.map((state) => cloneValue(state)) : []
            }));
    }

    function applyPersistedHeroStates(units, heroStates) {
        const stateMap = new Map((Array.isArray(heroStates) ? heroStates : []).map((state) => [state.id, state]));
        units.forEach((unit) => {
            if (!unit || unit.isEscortCart) {
                return;
            }
            const state = stateMap.get(unit.id);
            if (!state) {
                return;
            }
            unit.baseMaxHp = Math.max(1, Number(state.baseMaxHp || unit.baseMaxHp || unit.maxHp) || 1);
            unit.maxHp = Math.max(1, Number(state.maxHp || unit.maxHp) || 1);
            unit.hp = Math.max(0, Math.min(unit.maxHp, Number(state.hp) || unit.hp));
            unit.progress = Math.max(0, Number(state.progress) || 0);
            unit.shield = Math.max(0, Number(state.shield) || 0);
            unit.maxShield = Math.max(0, Number(state.maxShield) || unit.shield);
            unit.shieldRemainingTurns = Math.max(0, Number(state.shieldRemainingTurns) || 0);
            unit.defendBonus = Math.max(0, Number(state.defendBonus) || 0);
            unit.statusEffects = Array.isArray(state.statusEffects) ? state.statusEffects.map((effect) => cloneValue(effect)) : [];
            unit.passiveState = cloneValue(state.passiveState || {});
            if (Array.isArray(unit.skillStates) && Array.isArray(state.skillStates)) {
                unit.skillStates.forEach((skillState, index) => {
                    if (!state.skillStates[index]) {
                        return;
                    }
                    Object.assign(skillState, cloneValue(state.skillStates[index]));
                });
            }
        });
    }

    function clearEscortRunState() {
        const store = getEscortStateStore();
        if (store) {
            store.currentEscortRun = null;
        }
    }

    function getEscortMissionUnlockState(mission) {
        if (!mission) {
            return { unlocked: false, message: '特殊战配置不存在' };
        }
        if (!mission.unlockAfterDungeonId) {
            return { unlocked: true, message: '' };
        }
        const unlocked = dungeonManager.isCompleted(mission.unlockAfterDungeonId);
        return {
            unlocked,
            message: unlocked ? '' : '需先通关本章节主线后解锁'
        };
    }

    function formatEscortRewardPreview(baseRewards) {
        return Object.entries(baseRewards || {})
            .map(([resourceId, amount]) => {
                const info = shelterManager.getResourceInfo(resourceId);
                return `${info?.name || resourceId} ${Math.max(0, Math.floor(Number(amount) || 0))}`;
            })
            .filter(Boolean);
    }

    if (typeof DungeonView !== 'undefined' && window.dungeonView) {
        DungeonView.prototype.getSpecialBattleMode = function() {
            return this.specialBattleMode === 'special' ? 'special' : 'main';
        };

        DungeonView.prototype.setSpecialBattleMode = function(mode) {
            const nextMode = mode === 'special' ? 'special' : 'main';
            if (this.specialBattleMode === nextMode) {
                return;
            }
            this.specialBattleMode = nextMode;
            this.render();
        };

        DungeonView.prototype.getEscortMissionsByChapter = function() {
            const missions = window.SpecialBattleConfig?.getEscortMissions?.() || [];
            return missions.reduce((map, mission) => {
                if (!mission?.chapterId) {
                    return map;
                }
                if (!map.has(mission.chapterId)) {
                    map.set(mission.chapterId, []);
                }
                map.get(mission.chapterId).push(mission);
                return map;
            }, new Map());
        };

        DungeonView.prototype.renderSpecialBattleModeSwitch = function() {
            const currentMode = this.getSpecialBattleMode();
            return `
                <div class="dungeon-mode-switch">
                    <button type="button" class="dungeon-mode-switch-btn ${currentMode === 'main' ? 'is-active' : ''}" onclick="window.game.ui.dungeonView.setSpecialBattleMode('main')">主线副本</button>
                    <button type="button" class="dungeon-mode-switch-btn ${currentMode === 'special' ? 'is-active' : ''}" onclick="window.game.ui.dungeonView.setSpecialBattleMode('special')">特殊战</button>
                </div>
            `;
        };

        DungeonView.prototype.renderSpecialBattlePanel = function() {
            const missionsByChapter = this.getEscortMissionsByChapter();
            const chapters = this.getChapters();
            const groups = chapters
                .map((chapter) => ({
                    chapter,
                    missions: missionsByChapter.get(chapter.id) || []
                }))
                .filter((group) => group.missions.length > 0);

            if (groups.length === 0) {
                return '<div class="shelter-empty">暂无特殊战</div>';
            }

            return `
                <div class="escort-mission-list">
                    ${groups.map((group) => {
                        const chapter = group.chapter;
                        return `
                            <section class="escort-mission-group">
                                <div class="escort-mission-group-head">
                                    <div class="escort-mission-group-kicker">SPECIAL OPERATION</div>
                                    <div class="escort-mission-group-title">第${chapter.index || chapter.chapterNumber || ''}章 · ${chapter.name || '未命名章节'}</div>
                                </div>
                                <div class="escort-mission-group-body">
                                    ${group.missions.map((mission) => this.renderEscortMissionCard(mission)).join('')}
                                </div>
                            </section>
                        `;
                    }).join('')}
                </div>
            `;
        };

        DungeonView.prototype.renderEscortMissionCard = function(mission) {
            const unlockState = getEscortMissionUnlockState(mission);
            const rewardPreview = formatEscortRewardPreview(mission.baseRewards).slice(0, 4);
            return `
                <div class="escort-mission-card ${unlockState.unlocked ? '' : 'is-locked'}">
                    <div class="escort-mission-card-top">
                        <div>
                            <div class="escort-mission-card-kicker">资源护送战</div>
                            <div class="escort-mission-card-title">${mission.subtitle || mission.name}</div>
                        </div>
                        <div class="escort-mission-card-badge">${unlockState.unlocked ? '已解锁' : '未解锁'}</div>
                    </div>
                    <div class="escort-mission-card-desc">${mission.description || ''}</div>
                    <div class="escort-mission-card-grid">
                        <div><span>推荐等级</span><strong>Lv.${Math.max(1, Number(mission.recommendedLevel) || 1)}</strong></div>
                        <div><span>体力消耗</span><strong>${Math.max(1, Number(mission.energyCost) || 1)}</strong></div>
                        <div><span>地图段数</span><strong>${Math.max(1, mission.segments?.length || 1)}</strong></div>
                        <div><span>结算规则</span><strong>耐久修正</strong></div>
                    </div>
                    <div class="escort-mission-card-rewards">
                        ${rewardPreview.map((line) => `<span class="dungeon-reward-chip escort-reward-chip"><strong>${line}</strong></span>`).join('')}
                    </div>
                    <div class="escort-mission-card-actions">
                        <button type="button" class="btn btn-primary" ${unlockState.unlocked ? `onclick="window.game.ui.dungeonView.enterEscortMission('${mission.id}')"` : 'disabled'}>${unlockState.unlocked ? '开始护送' : '尚未解锁'}</button>
                        ${unlockState.unlocked ? '' : `<span class="escort-mission-lock-text">${unlockState.message}</span>`}
                    </div>
                </div>
            `;
        };

        const originalConsumeEnergyForDungeon = DungeonView.prototype.consumeEnergyForDungeon;
        DungeonView.prototype.consumeEnergyForSpecialBattle = function(energyCost) {
            const safeCost = Math.max(0, Number(energyCost) || 0);
            if (safeCost <= 0) {
                return true;
            }
            window.game.settleEnergyRecovery?.();
            if (window.game.player.energy < safeCost) {
                Toast.error(`体力不足，需要 ${safeCost}`);
                return false;
            }
            window.game.player.energy -= safeCost;
            eventManager.emit('playerUpdate', {
                energy: window.game.player.energy,
                maxEnergy: window.game.player.maxEnergy
            });
            return true;
        };

        DungeonView.prototype.enterEscortMission = function(missionId) {
            const mission = window.SpecialBattleConfig?.getEscortMission?.(missionId) || null;
            if (!mission) {
                Toast.error('特殊战不存在');
                return;
            }
            const unlockState = getEscortMissionUnlockState(mission);
            if (!unlockState.unlocked) {
                Toast.error(unlockState.message || '该特殊战尚未解锁');
                return;
            }
            if (heroManager.getTeam().length === 0) {
                Toast.error('请先配置参战英雄');
                return;
            }
            if (!this.consumeEnergyForSpecialBattle(mission.energyCost)) {
                return;
            }

            const store = getEscortStateStore();
            if (store) {
                store.currentEscortRun = {
                    mission: cloneValue(mission),
                    missionId: mission.id,
                    currentSegmentIndex: 0,
                    cartUnitId: `escort_cart_${mission.id}`,
                    cartMaxHp: Math.max(1, Number(mission?.cartTemplate?.hp) || 1),
                    cartHp: Math.max(1, Number(mission?.cartTemplate?.hp) || 1),
                    cartPosition: null,
                    heroStates: null,
                    participantHeroIds: heroManager.getTeamIds(),
                    completedSegmentIds: []
                };
            }

            this.chapterStageModal = null;
            this.codexModal = null;
            Modal.closeAll();
            window.game.save();
            saveSyncService.uploadCurrentSave?.({ force: true });
            eventManager.emit('enterEscortBattle', { missionId: mission.id });
        };

        DungeonView.prototype.consumeEnergyForDungeon = function(dungeon) {
            return originalConsumeEnergyForDungeon.call(this, dungeon);
        };
    }

    if (typeof DungeonView !== 'undefined' && window.dungeonView) {
        const originalRender = DungeonView.prototype.render;
        DungeonView.prototype.render = function() {
            originalRender.call(this);
            const header = this.element.querySelector('.dungeon-header-bar-patched');
            const content = this.element.querySelector('.dungeon-chapter-carousel');
            if (!header || !content || typeof this.getSpecialBattleMode !== 'function') {
                return;
            }
            const headingGroup = header.querySelector('.dungeon-stage-heading-group');
            const stageStats = header.querySelector('.dungeon-stage-stats');
            if (headingGroup && !header.querySelector('.dungeon-header-info')) {
                const infoGroup = document.createElement('div');
                infoGroup.className = 'dungeon-header-info';
                header.insertBefore(infoGroup, headingGroup);
                infoGroup.appendChild(headingGroup);
                if (stageStats) {
                    infoGroup.appendChild(stageStats);
                }
            }
            if (!header.querySelector('.dungeon-mode-switch')) {
                header.insertAdjacentHTML('beforeend', this.renderSpecialBattleModeSwitch());
            }
            header.classList.add('has-dungeon-mode-switch');
            header.classList.toggle('is-special-battle-mode', this.getSpecialBattleMode() === 'special');
            if (this.getSpecialBattleMode() !== 'special') {
                return;
            }
            content.outerHTML = this.renderSpecialBattlePanel();
        };
    }

    if (typeof DungeonView !== 'undefined' && window.dungeonView) {
        function toAbsoluteAssetPath(path) {
            const text = String(path || '').trim();
            if (!text || /^(?:https?:|data:|blob:|\/)/i.test(text)) {
                return text;
            }
            return '/' + text.replace(/^\.\//, '');
        }

        DungeonView.prototype.getSpecialBattleChapterEntries = function() {
            const missionsByChapter = this.getEscortMissionsByChapter();
            return this.getChapters()
                .map((chapter) => {
                    const missions = missionsByChapter.get(chapter.id) || [];
                    if (!missions.length) {
                        return null;
                    }
                    return {
                        chapter,
                        missions,
                        primaryMission: missions[0]
                    };
                })
                .filter(Boolean);
        };

        DungeonView.prototype.ensureSelectedSpecialBattleChapter = function(entries) {
            const safeEntries = Array.isArray(entries) ? entries : [];
            if (!safeEntries.length) {
                this.selectedSpecialBattleChapterId = null;
                return null;
            }

            const current = safeEntries.find((entry) => entry.chapter.id === this.selectedSpecialBattleChapterId);
            if (current) {
                return current;
            }

            let fallback = safeEntries[0];
            for (const entry of safeEntries) {
                if (!getEscortMissionUnlockState(entry.primaryMission).unlocked) {
                    break;
                }
                fallback = entry;
            }

            this.selectedSpecialBattleChapterId = fallback.chapter.id;
            return fallback;
        };

        DungeonView.prototype.getSelectedSpecialBattleChapterIndex = function(entries) {
            const safeEntries = Array.isArray(entries) ? entries : [];
            const currentIndex = safeEntries.findIndex((entry) => entry.chapter.id === this.selectedSpecialBattleChapterId);
            return currentIndex < 0 ? 0 : currentIndex;
        };

        DungeonView.prototype.getSpecialBattleChapterBackground = function(entry) {
            const chapter = entry?.chapter || null;
            const mission = entry?.primaryMission || null;
            return toAbsoluteAssetPath(mission?.background || chapter?.battleBackground || chapter?.background || window.GameSceneBackgrounds?.dungeon?.src || '');
        };

        DungeonView.prototype.syncSpecialBattleChapterBackground = function(entry = null) {
            const selectedEntry = entry || this.ensureSelectedSpecialBattleChapter(this.getSpecialBattleChapterEntries());
            const background = this.getSpecialBattleChapterBackground(selectedEntry);
            const view = this.element?.querySelector('.dungeon-view');
            if (view && background) {
                view.style.setProperty('--chapter-bg', `url('${background}')`);
            }
            const image = this.element?.querySelector('.dungeon-chapter-image');
            if (image && background) {
                image.style.backgroundImage = `url('${background}')`;
            }
        };

        DungeonView.prototype.switchSpecialBattleChapterByOffset = function(offset) {
            const entries = this.getSpecialBattleChapterEntries();
            const currentIndex = this.getSelectedSpecialBattleChapterIndex(entries);
            const nextIndex = Math.max(0, Math.min(entries.length - 1, currentIndex + offset));
            this.selectedSpecialBattleChapterId = entries[nextIndex]?.chapter?.id || this.selectedSpecialBattleChapterId;
            this.render();
        };

        DungeonView.prototype.switchSpecialBattleChapterTo = function(chapterId) {
            const entry = this.getSpecialBattleChapterEntries().find((item) => item.chapter.id === chapterId);
            if (!entry || entry.chapter.id === this.selectedSpecialBattleChapterId) {
                return;
            }
            this.selectedSpecialBattleChapterId = entry.chapter.id;
            this.render();
        };

        DungeonView.prototype.getSpecialBattleRewardChipMarkup = function(rewardLine) {
            if (typeof this.getRewardChipMarkup === 'function') {
                return this.getRewardChipMarkup(rewardLine);
            }
            return `<span class="dungeon-reward-chip"><strong>${rewardLine}</strong></span>`;
        };

        DungeonView.prototype.getSpecialBattleSlideMarkup = function(entry, isActive) {
            const chapter = entry.chapter;
            const mission = entry.primaryMission;
            const unlockState = getEscortMissionUnlockState(mission);
            const chapterIndex = chapter.index || chapter.chapterNumber || mission.chapterIndex || '?';
            const clickHandler = isActive
                ? `window.game.ui.dungeonView.openSpecialBattleModal('${chapter.id}')`
                : `window.game.ui.dungeonView.switchSpecialBattleChapterTo('${chapter.id}')`;
            const background = this.getSpecialBattleChapterBackground(entry);
            const statusClass = unlockState.unlocked ? 'is-ready' : 'is-locked';
            const statusLabel = unlockState.unlocked ? '已解锁' : '未解锁';

            return `
                <button type="button" class="dungeon-chapter-slide ${isActive ? 'is-active' : ''}" data-special-chapter-id="${chapter.id}" onclick="${clickHandler}">
                    <div class="dungeon-chapter-card card ${statusClass}" style="--chapter-card-bg:url('${background}')">
                        <div class="dungeon-chapter-card-head">
                            <div class="dungeon-chapter-card-kicker-row">
                                <div class="dungeon-chapter-card-kicker">第${chapterIndex}章 · 特殊战</div>
                                <div class="dungeon-chapter-status-badge">${statusLabel}</div>
                            </div>
                            <div class="dungeon-chapter-card-title">${mission.name}</div>
                        </div>
                        <div class="dungeon-chapter-card-desc">${mission.subtitle || chapter.name || '资源护送战'}</div>
                        <div class="dungeon-chapter-action-row">
                            <span>${isActive ? '点击查看护送简报' : '点击切换章节'}</span>
                            <strong>${unlockState.unlocked ? '资源护送战' : (unlockState.message || '需先完成主线')}</strong>
                        </div>
                        ${!unlockState.unlocked ? `
                            <div class="dungeon-chapter-lock-overlay">
                                <span>${unlockState.message || '该特殊战尚未解锁'}</span>
                            </div>
                        ` : ''}
                    </div>
                </button>
            `;
        };

        DungeonView.prototype.getSpecialBattleModalContent = function(entry) {
            const chapter = entry.chapter;
            const mission = entry.primaryMission;
            const unlockState = getEscortMissionUnlockState(mission);
            const rewardPreview = formatEscortRewardPreview(mission.baseRewards);
            const chapterIndex = chapter.index || chapter.chapterNumber || mission.chapterIndex || '?';
            const segmentText = (mission.segments || [])
                .map((segment, index) => `第${index + 1}段 · ${segment.name || '未命名路段'}`);
            const actionButton = unlockState.unlocked
                ? `<button class="btn btn-primary chapter-stage-primary-action" onclick="window.game.ui.dungeonView.startSpecialBattleFromModal('${mission.id}')">开始护送</button>`
                : '<button class="btn btn-secondary chapter-stage-primary-action" disabled>尚未解锁</button>';

            return `
                <div class="chapter-stage-layout">
                    <div class="chapter-stage-detail">
                        <div class="chapter-stage-detail-heading">
                            <div class="chapter-stage-heading-main">
                                <div class="chapter-stage-detail-kicker">SPECIAL OPERATION</div>
                                <div class="chapter-stage-detail-title">${mission.name}</div>
                            </div>
                            <div class="chapter-stage-status ${unlockState.unlocked ? 'is-pending' : ''}">
                                <span>${unlockState.unlocked ? '已解锁' : '未解锁'}</span>
                                <strong>第${chapterIndex}章</strong>
                            </div>
                        </div>
                        <div class="chapter-stage-detail-desc">${mission.description || '护送补给车穿越战区，载具耐久越高，最终资源结算越完整。'}</div>
                        <div class="chapter-stage-tactical-grid">
                            <div>
                                <span>体力消耗</span>
                                <strong>${Math.max(1, Number(mission.energyCost) || 1)}</strong>
                            </div>
                            <div>
                                <span>奖励结算</span>
                                <strong>${Math.round((Number(mission.fixedRewardRatio) || 0) * 100)}%固定 + ${Math.round((Number(mission.durabilityRewardRatio) || 0) * 100)}%耐久</strong>
                            </div>
                        </div>
                        <div class="chapter-stage-preview-block">
                            <div class="chapter-stage-detail-label">护送路段</div>
                            <div class="chapter-stage-detail-meta">
                                ${segmentText.map((text) => `<span>${text}</span>`).join('')}
                            </div>
                        </div>
                        <div class="chapter-stage-preview-block">
                            <div class="chapter-stage-detail-label-row">
                                <div class="chapter-stage-detail-label">奖励预览</div>
                                ${unlockState.unlocked ? '' : `<div class="chapter-stage-detail-label">${unlockState.message || '需先完成前置章节主线'}</div>`}
                            </div>
                            <div class="dungeon-reward-preview-row">
                                ${rewardPreview.map((reward) => this.getSpecialBattleRewardChipMarkup(reward)).join('')}
                            </div>
                        </div>
                        <div class="chapter-stage-detail-actions">
                            ${actionButton}
                            <button class="btn btn-secondary" onclick="window.game.ui.dungeonView.closeSpecialBattleModal()">关闭</button>
                        </div>
                    </div>
                </div>
            `;
        };

        DungeonView.prototype.openSpecialBattleModal = function(chapterId) {
            const entry = this.getSpecialBattleChapterEntries().find((item) => item.chapter.id === chapterId);
            if (!entry) {
                Toast.error('特殊战不存在');
                return;
            }

            this.selectedSpecialBattleChapterId = chapterId;
            if (this.specialBattleModal?.isShown()) {
                this.specialBattleModal.close();
                this.specialBattleModal = null;
            }

            let modal = null;
            modal = new Modal({
                className: 'chapter-stage-modal-shell special-battle-modal-shell',
                title: `${entry.chapter.name || '特殊战'} · ${entry.primaryMission.name}`,
                content: this.getSpecialBattleModalContent(entry),
                buttons: [],
                onClose: () => {
                    if (this.specialBattleModal === modal) {
                        this.specialBattleModal = null;
                    }
                }
            });
            this.specialBattleModal = modal;
            modal.show();
        };

        DungeonView.prototype.closeSpecialBattleModal = function() {
            if (this.specialBattleModal?.isShown()) {
                this.specialBattleModal.close();
            }
            this.specialBattleModal = null;
        };

        DungeonView.prototype.startSpecialBattleFromModal = function(missionId) {
            this.closeSpecialBattleModal();
            this.enterEscortMission(missionId);
        };

        DungeonView.prototype.renderSpecialBattlePanel = function() {
            const entries = this.getSpecialBattleChapterEntries();
            const selectedEntry = this.ensureSelectedSpecialBattleChapter(entries);
            if (!selectedEntry) {
                return '<div class="shelter-empty">暂无特殊战</div>';
            }

            const selectedIndex = this.getSelectedSpecialBattleChapterIndex(entries);
            const prevEntry = entries[selectedIndex - 1] || null;
            const nextEntry = entries[selectedIndex + 1] || null;

            return `
                <div class="dungeon-chapter-carousel special-battle-carousel">
                    <button class="dungeon-chapter-arrow ${prevEntry ? '' : 'is-hidden'}" ${prevEntry ? `onclick="window.game.ui.dungeonView.switchSpecialBattleChapterByOffset(-1)"` : ''}>&lsaquo;</button>
                    <div class="dungeon-chapter-viewport">
                        <div class="dungeon-chapter-track" data-selected-index="${selectedIndex}">
                            ${entries.map((entry) => this.getSpecialBattleSlideMarkup(entry, entry.chapter.id === selectedEntry.chapter.id)).join('')}
                        </div>
                    </div>
                    <button class="dungeon-chapter-arrow ${nextEntry ? '' : 'is-hidden'}" ${nextEntry ? `onclick="window.game.ui.dungeonView.switchSpecialBattleChapterByOffset(1)"` : ''}>&rsaquo;</button>
                </div>
            `;
        };

        DungeonView.prototype.bindSpecialBattleCarouselInteractions = function() {
            const carousel = this.element.querySelector('.special-battle-carousel');
            const viewport = carousel?.querySelector('.dungeon-chapter-viewport');
            const track = carousel?.querySelector('.dungeon-chapter-track');
            if (!carousel || !viewport || !track) {
                return;
            }

            const entries = this.getSpecialBattleChapterEntries();
            const currentIndex = this.getSelectedSpecialBattleChapterIndex(entries);
            const activeSlide = track.querySelector('.dungeon-chapter-slide.is-active');
            const trackStyles = window.getComputedStyle(track);
            const gap = Number.parseFloat(trackStyles.columnGap || trackStyles.gap || '0') || 0;
            const slideWidth = activeSlide?.getBoundingClientRect().width || viewport.clientWidth;
            const slideSpan = slideWidth + gap;

            if (!entries.length || !slideSpan) {
                return;
            }

            let startX = 0;
            let startY = 0;
            let deltaX = 0;
            let deltaY = 0;
            let tracking = false;
            let suppressClick = false;

            const getBaseTranslate = (selectedIndex) => ((viewport.clientWidth - slideWidth) / 2) - (selectedIndex * slideSpan);
            const clampDragOffset = (offset) => {
                if ((currentIndex <= 0 && offset > 0) || (currentIndex >= entries.length - 1 && offset < 0)) {
                    return offset * 0.24;
                }
                return offset;
            };
            const setTrackPosition = (selectedIndex, dragOffset = 0, animate = false) => {
                track.classList.toggle('is-animating', animate);
                track.style.transform = `translate3d(${getBaseTranslate(selectedIndex) + dragOffset}px, 0, 0)`;
            };
            const clearAnimatingState = () => window.setTimeout(() => track.classList.remove('is-animating'), 320);
            const reset = () => {
                startX = 0;
                startY = 0;
                deltaX = 0;
                deltaY = 0;
                tracking = false;
                carousel.classList.remove('is-dragging');
            };
            const getTouchPoint = (event) => {
                const point = event.changedTouches?.[0] || event.touches?.[0];
                return point ? { x: point.clientX, y: point.clientY } : null;
            };
            const commitSwipe = (steps) => {
                if (!steps) {
                    setTrackPosition(currentIndex, 0, true);
                    clearAnimatingState();
                    return;
                }

                const nextIndex = Math.max(0, Math.min(entries.length - 1, currentIndex + steps));
                if (nextIndex === currentIndex) {
                    setTrackPosition(currentIndex, 0, true);
                    clearAnimatingState();
                    return;
                }

                setTrackPosition(nextIndex, 0, true);
                window.setTimeout(() => {
                    track.classList.remove('is-animating');
                    this.selectedSpecialBattleChapterId = entries[nextIndex]?.chapter?.id || this.selectedSpecialBattleChapterId;
                    this.render();
                }, 320);
            };
            const handleSwipe = () => {
                if (!tracking) {
                    return;
                }

                const absX = Math.abs(deltaX);
                const absY = Math.abs(deltaY);
                const swipeX = deltaX;
                reset();

                if (absX < 36 || absX <= absY) {
                    setTrackPosition(currentIndex, 0, true);
                    clearAnimatingState();
                    return;
                }

                const stepWidth = Math.max(72, slideSpan * 0.58);
                const rawSteps = Math.max(1, Math.round(absX / stepWidth));

                if (swipeX < 0) {
                    const availableNext = entries.length - 1 - currentIndex;
                    commitSwipe(Math.min(rawSteps, availableNext));
                    return;
                }

                const availablePrev = currentIndex;
                const steps = Math.min(rawSteps, availablePrev);
                commitSwipe(steps > 0 ? -steps : 0);
            };

            setTrackPosition(currentIndex, 0, false);

            carousel.addEventListener('touchstart', (event) => {
                const point = getTouchPoint(event);
                if (!point) {
                    return;
                }
                startX = point.x;
                startY = point.y;
                deltaX = 0;
                deltaY = 0;
                tracking = true;
                suppressClick = false;
                track.classList.remove('is-animating');
            }, { passive: true });

            carousel.addEventListener('touchmove', (event) => {
                if (!tracking) {
                    return;
                }
                const point = getTouchPoint(event);
                if (!point) {
                    return;
                }

                deltaX = point.x - startX;
                deltaY = point.y - startY;

                if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 8) {
                    suppressClick = true;
                    carousel.classList.add('is-dragging');
                    setTrackPosition(currentIndex, clampDragOffset(deltaX), false);
                }
            }, { passive: true });

            carousel.addEventListener('touchend', () => {
                handleSwipe();
            }, { passive: true });

            carousel.addEventListener('touchcancel', () => {
                setTrackPosition(currentIndex, 0, true);
                clearAnimatingState();
                reset();
            }, { passive: true });

            carousel.addEventListener('click', (event) => {
                if (!suppressClick) {
                    return;
                }
                event.preventDefault();
                event.stopPropagation();
                suppressClick = false;
            }, true);
        };

        const specialBattleRender = DungeonView.prototype.render;
        DungeonView.prototype.render = function() {
            specialBattleRender.call(this);
            if (this.getSpecialBattleMode?.() !== 'special') {
                return;
            }
            this.syncSpecialBattleChapterBackground?.();
            this.bindSpecialBattleCarouselInteractions();
        };
    }

    if (typeof BattleManager !== 'undefined' && window.battleManager) {
        const originalInitBattle = BattleManager.prototype.initBattle;
        BattleManager.prototype.initBattle = function(config) {
            const result = originalInitBattle.call(this, config);
            const escortConfig = config?.escortMission || null;
            if (escortConfig) {
                this.escortMission = cloneValue(escortConfig);
                this.escortCartId = escortConfig.cartUnitId || '';
                this.escortRoute = Array.isArray(escortConfig.route) ? escortConfig.route.map((entry) => ({ ...entry })) : [];
                this.escortGoalPosition = escortConfig.goalPosition ? { ...escortConfig.goalPosition } : null;
                this.escortMissionId = escortConfig.missionId || '';
                this.escortSegmentId = escortConfig.segmentId || '';
                this.escortCurrentSegmentIndex = Math.max(0, Number(escortConfig.segmentIndex) || 0);
                this.escortBaseEnemyCount = Math.max(0, Number(escortConfig.baseEnemyCount) || 0);
                this.escortReinforcementLevel = 0;
                this.escortMaxExtraEnemies = Math.max(0, Number(escortConfig.maxExtraEnemies) || 0);
                this.escortCartActionCount = 0;
                this.escortReinforcementIntervalRounds = Math.max(1, Number(escortConfig.reinforcementIntervalRounds) || 4);
                this.escortReinforcementEntries = Array.isArray(escortConfig.reinforcementEnemyEntries)
                    ? escortConfig.reinforcementEnemyEntries.map((entry) => cloneEscortEnemyEntry(entry))
                    : [];
                this.escortStageLevel = Math.max(1, Number(escortConfig.stageLevel) || 1);
                this.escortRespawnDelayRounds = 2;
                this.escortPendingRespawns = [];
            } else {
                this.escortMission = null;
                this.escortCartId = '';
                this.escortRoute = [];
                this.escortGoalPosition = null;
                this.escortMissionId = '';
                this.escortSegmentId = '';
                this.escortCurrentSegmentIndex = 0;
                this.escortBaseEnemyCount = 0;
                this.escortReinforcementLevel = 0;
                this.escortMaxExtraEnemies = 0;
                this.escortCartActionCount = 0;
                this.escortReinforcementIntervalRounds = 4;
                this.escortReinforcementEntries = [];
                this.escortStageLevel = 1;
                this.escortRespawnDelayRounds = 2;
                this.escortPendingRespawns = [];
            }
            return result;
        };

        const originalGetAllUnits = BattleManager.prototype.getAllUnits;
        BattleManager.prototype.getAllUnits = function() {
            return originalGetAllUnits.call(this);
        };

        BattleManager.prototype.getEscortCart = function() {
            if (!this.escortCartId) {
                return null;
            }
            return this.heroes.find((unit) => unit?.id === this.escortCartId) || null;
        };

        BattleManager.prototype.isEscortMissionActive = function() {
            return Boolean(this.escortMission && this.getEscortCart());
        };

        BattleManager.prototype.getEscortGoalPosition = function() {
            return this.escortGoalPosition ? { ...this.escortGoalPosition } : null;
        };

        BattleManager.prototype.getEscortCurrentEnemyTargetCount = function() {
            if (!this.isEscortMissionActive()) {
                return 0;
            }
            const baseCount = Math.max(0, Number(this.escortBaseEnemyCount) || 0);
            const extraCap = Math.max(0, Number(this.escortMaxExtraEnemies) || 0);
            const level = Math.max(0, Number(this.escortReinforcementLevel) || 0);
            return baseCount + Math.min(extraCap, level);
        };

        BattleManager.prototype.recordEscortCartAction = function() {
            if (!this.isEscortMissionActive()) {
                return 0;
            }
            this.escortCartActionCount = Math.max(0, Number(this.escortCartActionCount) || 0) + 1;
            this.maybeAdvanceEscortReinforcementLevel();
            return this.escortCartActionCount;
        };

        BattleManager.prototype.maybeAdvanceEscortReinforcementLevel = function() {
            if (!this.isEscortMissionActive()) {
                return false;
            }
            const interval = Math.max(1, Number(this.escortReinforcementIntervalRounds) || 4);
            const maxExtra = Math.max(0, Number(this.escortMaxExtraEnemies) || 0);
            if (maxExtra <= 0) {
                return false;
            }
            const elapsed = Math.max(0, Number(this.escortCartActionCount) || 0);
            const nextLevel = Math.min(maxExtra, Math.floor(elapsed / interval));
            if (nextLevel <= this.escortReinforcementLevel) {
                return false;
            }
            this.escortReinforcementLevel = nextLevel;
            this.addLog('control', `敌军增援压力提升，当前额外敌人数上限 +${this.escortReinforcementLevel}`);
            return true;
        };

        const originalProcessDefeatedUnit = BattleManager.prototype.processDefeatedUnit;
        BattleManager.prototype.processDefeatedUnit = function(unit, context = {}) {
            const handled = originalProcessDefeatedUnit.call(this, unit, context);
            if (handled && this.isEscortMissionActive?.() && unit?.camp === 'enemy') {
                if (!Array.isArray(this.escortPendingRespawns)) {
                    this.escortPendingRespawns = [];
                }
                const delay = Math.max(0, Number(this.escortRespawnDelayRounds) || 2);
                this.escortPendingRespawns.push({
                    readyEscortActionCount: Math.max(0, Number(this.escortCartActionCount) || 0) + delay
                });
            }
            return handled;
        };

        BattleManager.prototype.spawnEscortReinforcementsIfNeeded = function() {
            if (!this.isEscortMissionActive()) {
                return false;
            }
            const entries = Array.isArray(this.escortReinforcementEntries) ? this.escortReinforcementEntries : [];
            if (!entries.length) {
                return false;
            }
            const targetCount = this.getEscortCurrentEnemyTargetCount();
            const livingEnemies = this.enemies.filter((unit) => unit && unit.isAlive());
            const missingCount = Math.max(0, targetCount - livingEnemies.length);
            if (missingCount <= 0) {
                return false;
            }
            const pendingRespawns = Array.isArray(this.escortPendingRespawns) ? this.escortPendingRespawns : [];
            const elapsed = Math.max(0, Number(this.escortCartActionCount) || 0);
            const isRespawnReady = (item) => {
                if (Number.isFinite(Number(item?.readyEscortActionCount))) {
                    return Number(item.readyEscortActionCount) <= elapsed;
                }
                return (Number(item?.readyRound) || 0) <= this.currentRound;
            };
            const readyRespawns = pendingRespawns.filter(isRespawnReady).length;
            const delayedRespawns = pendingRespawns.length - readyRespawns;
            const immediateMissingCount = Math.max(0, missingCount - delayedRespawns);
            const spawnCount = Math.min(missingCount, immediateMissingCount + readyRespawns);
            if (spawnCount <= 0) {
                return false;
            }
            const spawnedUnits = [];
            for (let index = 0; index < spawnCount; index++) {
                const entry = entries[Math.floor(Math.random() * entries.length)];
                const unit = buildEscortReinforcementUnit(entry, this.escortStageLevel);
                if (unit) {
                    spawnedUnits.push(unit);
                }
            }
            if (!spawnedUnits.length) {
                return false;
            }
            this.placeSpawnedUnits(spawnedUnits, this.scene.enemySpawn, true);
            const placedUnits = spawnedUnits.filter((unit) => unit?.position && unit.isAlive?.());
            const unplacedUnits = spawnedUnits.filter((unit) => !unit?.position);
            if (unplacedUnits.length > 0) {
                this.enemies = this.enemies.filter((unit) => !unplacedUnits.includes(unit));
            }
            if (!placedUnits.length) {
                return false;
            }
            let consumedReady = Math.min(placedUnits.length, readyRespawns);
            this.escortPendingRespawns = pendingRespawns.filter((item) => {
                const isReady = isRespawnReady(item);
                if (isReady && consumedReady > 0) {
                    consumedReady--;
                    return false;
                }
                return true;
            });
            const names = placedUnits.map((unit) => unit.name).join('、');
            this.addLog('enemy', `敌军增援抵达：${names}`);
            this.emitStateChange();
            return true;
        };

        BattleManager.prototype.getEscortRouteIndexForPosition = function(position) {
            if (!position || !Array.isArray(this.escortRoute)) {
                return -1;
            }
            return this.escortRoute.findIndex((entry) => {
                const normalized = normalizePosition(entry);
                return normalized && normalized.x === position.x && normalized.y === position.y;
            });
        };

        BattleManager.prototype.getNextEscortRoutePosition = function() {
            const cart = this.getEscortCart();
            if (!cart || !Array.isArray(this.escortRoute) || this.escortRoute.length === 0) {
                return null;
            }
            const currentIndex = this.getEscortRouteIndexForPosition(cart.position);
            if (currentIndex < 0) {
                const firstPosition = normalizePosition(this.escortRoute[0]);
                return firstPosition ? { ...firstPosition } : null;
            }
            const nextEntry = this.escortRoute[currentIndex + 1] || null;
            const nextPosition = normalizePosition(nextEntry);
            return nextPosition ? { ...nextPosition } : null;
        };

        BattleManager.prototype.isEscortRouteCell = function(position) {
            return this.getEscortRouteIndexForPosition(position) >= 0;
        };

        BattleManager.prototype.canEscortCartAdvance = function() {
            const cart = this.getEscortCart();
            const nextPosition = this.getNextEscortRoutePosition();
            if (!cart || !nextPosition) {
                return false;
            }
            const occupant = this.getUnitAt(nextPosition, cart.id);
            return !occupant && !this.isObstacleAt(nextPosition);
        };

        BattleManager.prototype.executeEscortCartAction = async function(actor) {
            this.recordEscortCartAction();
            const nextPosition = this.getNextEscortRoutePosition();
            if (!nextPosition) {
                this.addLog('control', `${actor.name} 已抵达终点区域`);
                eventManager.emit('battleUnitAction', {
                    attacker: actor,
                    target: actor,
                    damage: 0,
                    actionType: 'defend',
                    result: { escortHold: true }
                });
                this.emitStateChange();
                return;
            }
            if (!this.canEscortCartAdvance()) {
                this.addLog('control', `${actor.name} 前方受阻，本回合未能推进`);
                eventManager.emit('battleUnitAction', {
                    attacker: actor,
                    target: actor,
                    damage: 0,
                    actionType: 'defend',
                    result: { escortBlocked: true }
                });
                this.emitStateChange();
                return;
            }
            const fromPosition = { x: actor.position.x, y: actor.position.y };
            actor.setPosition(nextPosition);
            this.handleTerrainPositionChange(actor, fromPosition, nextPosition);
            this.addLog('move', `${actor.name} 向终点推进到 (${nextPosition.x + 1}, ${nextPosition.y + 1})`);
            eventManager.emit('battleUnitMove', {
                unit: actor,
                fromPosition,
                position: nextPosition,
                toPosition: nextPosition
            });
            await this.waitForActionPresentation();
            this.emitStateChange();
        };

        const originalResolveActionForActor = BattleManager.prototype.resolveActionForActor;
        BattleManager.prototype.resolveActionForActor = async function(actor) {
            if (actor?.isEscortCart) {
                return { type: 'escort_move' };
            }
            return originalResolveActionForActor.call(this, actor);
        };

        const originalExecuteAction = BattleManager.prototype.executeAction;
        BattleManager.prototype.executeAction = async function(actor, action) {
            if (actor?.isEscortCart || action?.type === 'escort_move') {
                await this.executeEscortCartAction(actor);
                return;
            }
            return originalExecuteAction.call(this, actor, action);
        };

        const originalChooseTarget = BattleManager.prototype.chooseTarget;
        BattleManager.prototype.chooseTarget = function(actor) {
            const chosen = originalChooseTarget.call(this, actor);
            if (actor?.camp !== 'enemy' || !this.isEscortMissionActive()) {
                return chosen;
            }
            const duty = getEscortEnemyDuty(actor);
            const cart = this.getEscortCart();
            if (!cart?.isAlive?.() || !cart.isAlive() || !this.isCellTargetable(actor, cart.position, actor.attackRange)) {
                return chosen;
            }
            if (duty === 'escort_cart') {
                return cart;
            }
            const bestRangeTarget = chosen;
            if (!bestRangeTarget) {
                return duty === 'intercept' ? cart : chosen;
            }
            const canKillBest = bestRangeTarget.hp <= Math.max(1, actor.getEffectiveAttack?.() || actor._attack || 1);
            if (canKillBest) {
                return bestRangeTarget;
            }
            if (duty === 'chase') {
                return bestRangeTarget;
            }
            const bestDistance = actor.distanceTo(bestRangeTarget);
            const cartDistance = actor.distanceTo(cart);
            if (cartDistance <= bestDistance + 1) {
                return cart;
            }
            return chosen;
        };

        const originalChooseSkillAction = BattleManager.prototype.chooseSkillAction;
        BattleManager.prototype.chooseSkillAction = function(actor) {
            if (actor?.camp === 'enemy' && this.isEscortMissionActive()) {
                const cart = this.getEscortCart();
                const usable = this.getUsableSkills(actor).filter((skill) => skill.canUse);
                const duty = getEscortEnemyDuty(actor);
                if (cart?.isAlive?.() && cart.isAlive()) {
                    let best = null;
                    usable.forEach((skill) => {
                        const candidates = this.getSkillTargetCandidates(actor, skill.index);
                        candidates.forEach((target) => {
                            const score = this.scoreSkillAction(actor, skill, target);
                            const adjusted = target.id === cart.id
                                ? score + (duty === 'escort_cart' ? 30 : 12)
                                : score + (duty === 'chase' ? 10 : 0);
                            if (best === null || adjusted > best.score) {
                                best = {
                                    type: 'skill',
                                    targetId: target.id,
                                    skillIndex: skill.index,
                                    score: adjusted
                                };
                            }
                        });
                    });
                    if (best && best.score > 0) {
                        return {
                            type: best.type,
                            targetId: best.targetId,
                            skillIndex: best.skillIndex
                        };
                    }
                }
            }
            return originalChooseSkillAction.call(this, actor);
        };

        const originalChooseBestMove = BattleManager.prototype.chooseBestMove;
        BattleManager.prototype.chooseBestMove = function(actor) {
            const moveCell = originalChooseBestMove.call(this, actor);
            if (actor?.camp !== 'enemy' || !this.isEscortMissionActive()) {
                return moveCell;
            }
            const duty = getEscortEnemyDuty(actor);
            const cart = this.getEscortCart();
            if (!cart?.isAlive?.() || !cart.isAlive()) {
                return moveCell;
            }
            if (duty === 'chase') {
                return moveCell;
            }
            const reachableCells = this.getReachableCells(actor);
            if (reachableCells.length === 0) {
                return moveCell;
            }
            const currentDistanceToCart = this.getPathDistance(actor.position, cart.position, actor);
            const cartPressureMove = reachableCells
                .map((cell) => ({
                    cell,
                    distance: this.getPathDistance(cell, cart.position, actor)
                }))
                .filter((entry) => Number.isFinite(entry.distance))
                .sort((a, b) => a.distance - b.distance)[0];
            if (!cartPressureMove) {
                return moveCell;
            }
            if (duty === 'escort_cart') {
                return cartPressureMove.cell;
            }
            if (!moveCell) {
                return cartPressureMove.cell;
            }
            const originalDistance = this.getPathDistance(moveCell, cart.position, actor);
            if (!Number.isFinite(originalDistance)) {
                return cartPressureMove.cell;
            }
            if (currentDistanceToCart - cartPressureMove.distance >= 1 && cartPressureMove.distance <= originalDistance + 1) {
                return cartPressureMove.cell;
            }
            return moveCell;
        };

        const originalGetFallenHeroes = BattleManager.prototype.getFallenHeroes;
        BattleManager.prototype.getFallenHeroes = function() {
            return originalGetFallenHeroes.call(this).filter((unit) => !unit?.isEscortCart);
        };

        const originalSetupBattleStats = BattleManager.prototype.setupBattleStats;
        BattleManager.prototype.setupBattleStats = function() {
            originalSetupBattleStats.call(this);
            if (!this.isEscortMissionActive() || !this.battleStats?.heroEntries) {
                return;
            }
            const cartId = this.escortCartId;
            if (!cartId) {
                return;
            }
            delete this.battleStats.heroEntries[cartId];
            if (Array.isArray(this.battleStats.heroOrder)) {
                this.battleStats.heroOrder = this.battleStats.heroOrder.filter((heroId) => heroId !== cartId);
            }
        };

        const originalIsHeroBattleStatsUnit = BattleManager.prototype.isHeroBattleStatsUnit;
        BattleManager.prototype.isHeroBattleStatsUnit = function(unit) {
            if (unit?.isEscortCart) {
                return false;
            }
            return originalIsHeroBattleStatsUnit.call(this, unit);
        };

        const originalCheckBattleEnd = BattleManager.prototype.checkBattleEnd;
        BattleManager.prototype.checkBattleEnd = function() {
            if (this.escortMission || this.escortCartId) {
                const cart = this.getEscortCart();
                const livingCombatHeroes = this.heroes.filter((unit) => unit && unit.isAlive() && !unit.isEscortCart);
                const livingEnemies = this.enemies.filter((unit) => unit && unit.isAlive());
                const goal = this.escortGoalPosition ? { ...this.escortGoalPosition } : null;
                const cartAtGoal = Boolean(cart && goal && cart.position.x === goal.x && cart.position.y === goal.y);
                if (!cart || !cart.isAlive()) {
                    this.result = {
                        victory: false,
                        reason: 'escort_cart_destroyed',
                        isEscortMission: true,
                        escortMissionId: this.escortMissionId,
                        escortSegmentId: this.escortSegmentId,
                        participants: this.heroes.filter((unit) => !unit?.isEscortCart).map((unit) => unit.id),
                        survivors: livingCombatHeroes.map((unit) => unit.id),
                        cartHp: 0,
                        cartMaxHp: cart?.maxHp || Math.max(1, Number(this.escortMission?.cartMaxHp) || 1)
                    };
                    this.isBattling = false;
                    this.finalizeBattleStats(this.result);
                    this.addLog('result', '护送失败，补给车已被摧毁');
                    eventManager.emit('battleEnd', this.result);
                    return true;
                }
                if (cartAtGoal) {
                    this.result = {
                        victory: true,
                        reason: livingEnemies.length > 0 ? 'escort_reached_goal' : 'escort_cleared',
                        isEscortMission: true,
                        escortMissionId: this.escortMissionId,
                        escortSegmentId: this.escortSegmentId,
                        participants: this.heroes.filter((unit) => !unit?.isEscortCart).map((unit) => unit.id),
                        survivors: livingCombatHeroes.map((unit) => unit.id),
                        cartHp: cart.hp,
                        cartMaxHp: cart.maxHp
                    };
                    this.isBattling = false;
                    this.finalizeBattleStats(this.result);
                    this.addLog('result', '护送成功，补给车已抵达终点');
                    eventManager.emit('battleEnd', this.result);
                    return true;
                }
                if (livingCombatHeroes.length <= 0) {
                    this.result = {
                        victory: false,
                        reason: 'escort_team_defeated',
                        isEscortMission: true,
                        escortMissionId: this.escortMissionId,
                        escortSegmentId: this.escortSegmentId,
                        participants: this.heroes.filter((unit) => !unit?.isEscortCart).map((unit) => unit.id),
                        survivors: [],
                        cartHp: cart.hp,
                        cartMaxHp: cart.maxHp
                    };
                    this.isBattling = false;
                    this.finalizeBattleStats(this.result);
                    this.addLog('result', '护送失败，护卫队已全灭');
                    eventManager.emit('battleEnd', this.result);
                    return true;
                }
                return false;
            }
            return originalCheckBattleEnd.call(this);
        };

        const originalGetSnapshot = BattleManager.prototype.getSnapshot;
        BattleManager.prototype.getSnapshot = function() {
            const snapshot = originalGetSnapshot.call(this);
            if (this.isEscortMissionActive()) {
                const cart = this.getEscortCart();
                snapshot.escortMission = {
                    missionId: this.escortMissionId,
                    segmentId: this.escortSegmentId,
                    segmentIndex: this.escortCurrentSegmentIndex,
                    route: Array.isArray(this.escortRoute) ? this.escortRoute.map((entry) => ({ ...entry })) : [],
                    goalPosition: this.escortGoalPosition ? { ...this.escortGoalPosition } : null,
                    cartId: this.escortCartId,
                    cartHp: cart?.hp || 0,
                    cartMaxHp: cart?.maxHp || 0,
                    cartActionCount: Math.max(0, Number(this.escortCartActionCount) || 0),
                    baseEnemyCount: Math.max(0, Number(this.escortBaseEnemyCount) || 0),
                    reinforcementLevel: Math.max(0, Number(this.escortReinforcementLevel) || 0),
                    currentEnemyTargetCount: this.getEscortCurrentEnemyTargetCount(),
                    maxExtraEnemies: Math.max(0, Number(this.escortMaxExtraEnemies) || 0)
                };
            }
            return snapshot;
        };

        const originalReset = BattleManager.prototype.reset;
        BattleManager.prototype.reset = function() {
            this.escortMission = null;
            this.escortCartId = '';
            this.escortRoute = [];
            this.escortGoalPosition = null;
            this.escortMissionId = '';
            this.escortSegmentId = '';
            this.escortCurrentSegmentIndex = 0;
            this.escortBaseEnemyCount = 0;
            this.escortReinforcementLevel = 0;
            this.escortMaxExtraEnemies = 0;
            this.escortCartActionCount = 0;
            this.escortReinforcementIntervalRounds = 4;
            this.escortReinforcementEntries = [];
            this.escortStageLevel = 1;
            this.escortRespawnDelayRounds = 2;
            this.escortPendingRespawns = [];
            return originalReset.call(this);
        };

        const originalExecuteBattle = BattleManager.prototype.executeBattle;
        BattleManager.prototype.executeBattle = async function() {
            if (!this.isEscortMissionActive()) {
                return originalExecuteBattle.call(this);
            }

            while (this.isBattling && this.currentRound < this.maxRounds) {
                const queue = this.advanceProgress();
                if (queue.length === 0) {
                    break;
                }
                this.currentRound++;
                this.addLog('round', `第 ${this.currentRound} 回合`);
                this.processTerrainRoundStart();
                this.maybeAdvanceEscortReinforcementLevel();
                this.spawnEscortReinforcementsIfNeeded();
                this.emitStateChange();
                await this.checkAndSpawnBossWaves('roundStart');
                if (this.checkBattleEnd()) {
                    return this.result;
                }

                for (const actor of queue) {
                    if (!this.isBattling || !actor.isAlive()) {
                        continue;
                    }
                    actor.resetTurnState();
                    this.updateFocusedStationaryTurnStart(actor);
                    this.currentActor = actor;
                    this.emitStateChange();
                    this.triggerHeroVoice(actor, 'turnStart', {
                        priority: 1,
                        interrupt: false,
                        cooldownMs: 1200
                    });
                    const passiveTurnStartEvents = this.processHeroPassiveTurnStart(actor);
                    const formationEvents = this.processFormationTurnStart(actor);
                    const warningEvents = this.processWarningSkillTurnStart(actor);
                    const specialTileEvents = this.getSpecialTileTriggerEffects(actor).map((effect) => {
                        if (effect.type === 'damage') {
                            const damage = actor.takeStatusDamage(effect.damage, true);
                            return { type: 'special_tile_damage', damage, ...effect };
                        }
                        if (effect.type === 'heal') {
                            const heal = actor.heal(effect.heal);
                            return { type: 'special_tile_heal', heal, ...effect };
                        }
                        return null;
                    }).filter(Boolean);
                    const turnStartResult = actor.processTurnStartEffects?.() || { preventedAction: false, events: [] };
                    if (passiveTurnStartEvents.length > 0 || formationEvents.length > 0 || warningEvents.length > 0 || specialTileEvents.length > 0) {
                        turnStartResult.events = [
                            ...passiveTurnStartEvents,
                            ...formationEvents,
                            ...warningEvents,
                            ...specialTileEvents,
                            ...(Array.isArray(turnStartResult.events) ? turnStartResult.events : [])
                        ];
                        turnStartResult.preventedAction = turnStartResult.preventedAction || warningEvents.length > 0;
                    }
                    if (turnStartResult.events?.length) {
                        this.handleTurnStartEffects(actor, turnStartResult);
                        await this.waitForActionPresentation();
                    }
                    if (!this.isBattling || !actor.isAlive()) {
                        actor.progress = 0;
                        this.currentActor = null;
                        this.emitStateChange();
                        await this.checkAndSpawnBossWaves('actionEnd');
                        if (this.checkBattleEnd()) {
                            return this.result;
                        }
                        continue;
                    }
                    if (turnStartResult.preventedAction) {
                        const expiredEffects = this.getUniqueExpiredEffects(actor.processTurnEndEffects?.() || []);
                        if (expiredEffects.length > 0) {
                            eventManager.emit('battleUnitAction', {
                                attacker: actor,
                                target: actor,
                                damage: 0,
                                actionType: 'status_expire',
                                result: { expiredEffects }
                            });
                        }
                        actor.progress = 0;
                        this.currentActor = null;
                        this.emitStateChange();
                        await this.checkAndSpawnBossWaves('actionEnd');
                        if (this.checkBattleEnd()) {
                            return this.result;
                        }
                        continue;
                    }
                    const action = await this.resolveActionForActor(actor);
                    if (!this.isBattling) {
                        break;
                    }
                    await this.executeAction(actor, action);
                    await this.waitForActionPresentation();
                    const expiredEffects = this.getUniqueExpiredEffects(actor.processTurnEndEffects?.() || []);
                    if (expiredEffects.length > 0) {
                        eventManager.emit('battleUnitAction', {
                            attacker: actor,
                            target: actor,
                            damage: 0,
                            actionType: 'status_expire',
                            result: { expiredEffects }
                        });
                        await this.waitForActionPresentation();
                    }

                    while (actor.passiveState?.extraActionPending && actor.isAlive() && this.isBattling) {
                        const extraState = this.getExtraActionOnKillState(actor);
                        if (!extraState || extraState.usedThisTurn <= 0) {
                            actor.passiveState.extraActionPending = false;
                            break;
                        }
                        actor.passiveState.extraActionPending = false;
                        const extraAction = await this.resolveActionForActor(actor);
                        if (!this.isBattling) break;
                        const extraAttackTarget = extraAction?.type === 'attack'
                            ? extraAction
                            : { type: 'attack', targetId: extraAction?.targetId || this.getOpponents(actor)[0]?.id || '', forcedByTaunt: extraAction?.forcedByTaunt, forcedByCharm: extraAction?.forcedByCharm };
                        if (extraState.critGuaranteed !== undefined) {
                            extraAttackTarget._critGuaranteed = extraState.critGuaranteed;
                        }
                        await this.executeAction(actor, extraAttackTarget);
                        await this.waitForActionPresentation();
                        const extraExpiredEffects = this.getUniqueExpiredEffects(actor.processTurnEndEffects?.() || []);
                        if (extraExpiredEffects.length > 0) {
                            eventManager.emit('battleUnitAction', {
                                attacker: actor,
                                target: actor,
                                damage: 0,
                                actionType: 'status_expire',
                                result: { expiredEffects: extraExpiredEffects }
                            });
                            await this.waitForActionPresentation();
                        }
                        if (this.checkBattleEnd()) return this.result;
                        if (actor.passiveState.extraActionPending === undefined) {
                            actor.passiveState.extraActionPending = false;
                        }
                    }
                    this.resetExtraActionState(actor);
                    actor.progress = 0;
                    this.currentActor = null;
                    this.spawnEscortReinforcementsIfNeeded();
                    this.emitStateChange();
                    await this.checkAndSpawnBossWaves('actionEnd');
                    if (this.checkBattleEnd()) {
                        return this.result;
                    }
                }
            }

            if (!this.result) {
                this.result = {
                    victory: false,
                    reason: 'max_rounds',
                    participants: this.heroes.map(unit => unit.id),
                    survivors: this.heroes.filter(unit => unit.isAlive()).map(unit => unit.id)
                };
                this.isBattling = false;
                this.finalizeBattleStats(this.result);
                this.addLog('result', '战斗超时，自动判定失败');
                eventManager.emit('battleEnd', this.result);
            }
            return this.result;
        };
    }

    if (typeof BattleView !== 'undefined' && window.battleView) {
        BattleView.prototype.buildEscortHeroUnits = function(runState) {
            const units = heroManager.createBattleUnits();
            applyPersistedHeroStates(units, runState?.heroStates);
            return units;
        };

        BattleView.prototype.prepareEscortSegmentContext = function(runState) {
            const setup = buildEscortSegmentSetup(runState);
            if (!setup) {
                return null;
            }
            const route = setup.route;
            const goalPosition = setup.goalPosition ? { ...setup.goalPosition } : normalizePosition(route[route.length - 1]);
            const cartUnit = buildEscortCartUnit(runState);
            const cartStart = setup.currentCartPosition || setup.initialCartPosition || normalizePosition(route[0]);
            if (cartStart) {
                cartUnit.preferredSpawnPosition = { ...cartStart };
            }
            const heroes = this.buildEscortHeroUnits(runState);
            heroes.push(cartUnit);
            return {
                ...setup,
                heroes,
                cartUnit,
                route,
                goalPosition
            };
        };

        BattleView.prototype.startEscortMission = async function(missionId, options = {}) {
            const useTransitionLoading = Boolean(options.transitionLoading);
            const transitionStartedAt = Date.now();
            const transitionMinMs = Math.max(0, Number(options.transitionMinMs) || 760);
            if (useTransitionLoading) {
                window.game?.showBattleLoadingOverlay?.('读取下一段路线', 8);
            }
            const store = getEscortStateStore();
            const runState = store?.currentEscortRun;
            if (!runState || runState.missionId !== missionId) {
                if (useTransitionLoading) {
                    window.game?.hideBattleLoadingOverlay?.(0);
                }
                Toast.error('护送战数据不存在');
                eventManager.emit('viewChange', { view: 'dungeon' });
                return;
            }

            const context = this.prepareEscortSegmentContext(runState);
            if (!context) {
                if (useTransitionLoading) {
                    window.game?.hideBattleLoadingOverlay?.(0);
                }
                Toast.error('护送战配置异常');
                clearEscortRunState();
                eventManager.emit('viewChange', { view: 'dungeon' });
                return;
            }

            if (useTransitionLoading) {
                window.game?.updateBattleLoadingOverlay?.('整理护送队列', 18);
            }

            this.currentDungeon = {
                id: context.segment.id,
                name: `${runState.mission.subtitle || runState.mission.name} - ${context.segment.name}`,
                sceneId: 'standard_9x9',
                environmentEffect: context.sourceDungeon?.environmentEffect || context.battleSetup.environmentEffect || 'none',
                battleBackground: runState.mission.background || context.sourceDungeon?.battleBackground || context.sourceDungeon?.background || '',
                storyDialogues: Array.isArray(context.segment.storyDialogues) ? context.segment.storyDialogues : null,
                getInfo: () => ({
                    id: context.segment.id,
                    name: context.segment.name,
                    level: runState.mission.recommendedLevel || 1,
                    enemyCount: context.battleSetup.initialEnemies.length,
                    energyCost: runState.mission.energyCost || 0
                })
            };

            this.isPaused = false;
            this.skipBattleRequested = false;
            this.closePauseModal();
            this.actionQueue = [];
            this.dyingUnitIds?.clear?.();
            this.playedDeathUnitIds?.clear?.();
            this.isProcessingAction = false;
            this.actionQueueWaiters = [];
            this.lastUnitPositions.clear();
            this.lastBoardRenderKey = '';
            this.progressTokenMap = new Map();
            this.progressValueMap = new Map();
            this.displayProgressMap = new Map();
            this.clearProgressAnimationTimers();
            this.progressRenderCacheKey = '';
            this.hpTrailMap = new Map();
            this.clearHpTrailTimers();
            this.combatTextBurstMap = new Map();
            this.clearBattleEffectTimers();
            this.stopEnvironmentEffect();
            this.resetTerrainLayer();
            this.inspectedUnitId = null;
            this.inspectedSpecialTile = null;
            this.inspectedObstacle = null;
            this.selectedSkillIndex = null;
            this.selectedBattleItemId = null;
            this.boardUnitElements.clear();
            this.battleSessionId++;

            const preloadDungeon = {
                sceneId: 'standard_9x9',
                environmentEffect: context.battleSetup.environmentEffect
            };
            if (useTransitionLoading) {
                window.game?.updateBattleLoadingOverlay?.('准备下一张地图资源', 28);
            }

            const storyDialogues = Array.isArray(this.currentDungeon.storyDialogues) && this.currentDungeon.storyDialogues.length > 0
                ? this.currentDungeon.storyDialogues
                : null;
            if (storyDialogues && !isEscortSegmentCompleted(context.segment.id)) {
                if (useTransitionLoading) {
                    window.game?.updateBattleLoadingOverlay?.('接入剧情通讯', 38);
                    await Utils.delay(120);
                    window.game?.hideBattleLoadingOverlay?.(0);
                }
                const backgroundImage = getStoryBackground(this, this.currentDungeon, context.sourceDungeon, runState.mission);
                const backgroundStyle = backgroundImage
                    ? ` style="--battle-bg-image:url(&quot;${backgroundImage}&quot;)"`
                    : '';
                this.show();
                this.element.innerHTML = `
                    <div class="scene-view battle-view battle-view-themed battle-story-preview"${backgroundStyle}>
                        <div class="battle-loading-placeholder">
                            <div class="battle-loading-text">准备战斗...</div>
                        </div>
                    </div>
                `;
                await new Promise((resolve) => {
                    playStoryDialogue(storyDialogues, resolve, { backgroundImage });
                });
                if (useTransitionLoading) {
                    window.game?.showBattleLoadingOverlay?.('加载战场资源', 42);
                }
            }

            await this.preloadBattleAssets(
                preloadDungeon,
                context.heroes,
                context.battleSetup.initialEnemies,
                context.battleSetup.bossWaves || [],
                context.battleSetup.battlefield
            );
            if (useTransitionLoading) {
                window.game?.updateBattleLoadingOverlay?.('部署作战单位', 72);
            }

            battleManager.initBattle({
                heroes: context.heroes,
                enemies: context.battleSetup.initialEnemies,
                bossWaves: context.battleSetup.bossWaves || [],
                sceneId: 'standard_9x9',
                battlefield: context.battleSetup.battlefield,
                environmentEffect: context.battleSetup.environmentEffect,
                escortMission: {
                    missionId: runState.mission.id,
                    segmentId: context.segment.id,
                    segmentIndex: runState.currentSegmentIndex,
                    cartUnitId: context.cartUnit.id,
                    route: context.route.map((entry) => normalizePosition(entry)).filter(Boolean),
                    goalPosition: context.goalPosition ? { ...context.goalPosition } : null,
                    baseEnemyCount: Math.max(0, Number(context.battleSetup.baseEnemyCount) || 0),
                    maxExtraEnemies: Math.max(0, Number(context.battleSetup.maxExtraEnemies) || 0),
                    reinforcementIntervalRounds: Math.max(1, Number(context.battleSetup.reinforcementIntervalRounds) || 4),
                    reinforcementEnemyEntries: Array.isArray(context.battleSetup.reinforcementEnemyEntries)
                        ? context.battleSetup.reinforcementEnemyEntries.map((entry) => cloneEscortEnemyEntry(entry))
                        : [],
                    stageLevel: Math.max(1, Number(context.sourceDungeon?.level) || Number(runState.mission.recommendedLevel) || 1)
                }
            });

            battleManager.setDecisionProvider((decisionContext) => this.requestPlayerAction(decisionContext));
            this.renderShell();
            this.startEnvironmentEffect(battleManager.getSnapshot()?.environmentEffect || context.battleSetup.environmentEffect);
            this.subscribeBattleEvents();
            this.renderBattleState();
            if (useTransitionLoading) {
                window.game?.updateBattleLoadingOverlay?.('生成战场画面', 92);
            }
            await this.waitForNextPaint();
            if (useTransitionLoading) {
                const elapsed = Date.now() - transitionStartedAt;
                if (elapsed < transitionMinMs) {
                    await Utils.delay(transitionMinMs - elapsed);
                }
                window.game?.updateBattleLoadingOverlay?.('准备继续护送', 100);
                window.game?.hideBattleLoadingOverlay?.(160);
            }
            await Utils.delay(260);

            const result = await battleManager.executeBattle();
            if (!this.visible || !result) {
                return;
            }
            await this.onBattleEnd(result, this.currentDungeon);
        };
    }

    if (typeof Game !== 'undefined' && window.game) {
        const originalBindEvents = Game.prototype.bindEvents;
        Game.prototype.bindEvents = function() {
            originalBindEvents.call(this);
            if (this.__escortBattleEventsBound) {
                return;
            }
            this.__escortBattleEventsBound = true;
            eventManager.on('enterEscortBattle', async (data) => {
                saveSyncService.setBattleActive?.(true);
                this.switchView('battle');
                await this.ui.battleView.startEscortMission(data.missionId);
            });
        };

        Game.prototype.calculateEscortRewards = function(mission, durabilityRatio) {
            const safeRatio = Utils.clamp(Number(durabilityRatio) || 0, 0, 1);
            const fixedRatio = Utils.clamp(Number(mission?.fixedRewardRatio ?? 0.6) || 0.6, 0, 1);
            const durabilityWeight = Utils.clamp(Number(mission?.durabilityRewardRatio ?? 0.4) || 0.4, 0, 1);
            const rewardRatio = fixedRatio + durabilityWeight * safeRatio;
            const rewards = {};
            Object.entries(mission?.baseRewards || {}).forEach(([resourceId, amount]) => {
                rewards[resourceId] = Math.max(1, Math.floor((Number(amount) || 0) * rewardRatio));
            });
            return rewards;
        };

        Game.prototype.buildEscortRewardEntries = function(rewards = {}) {
            return Object.entries(rewards).map(([resourceId, amount]) => RewardModal.createResourceReward(resourceId, amount));
        };

        Game.prototype.grantEscortMissionRewards = function(mission, durabilityRatio) {
            const rewards = this.calculateEscortRewards(mission, durabilityRatio);
            Object.entries(rewards).forEach(([resourceId, amount]) => {
                if (shelterManager.isResourceType(resourceId)) {
                    shelterManager.addResource(resourceId, amount);
                }
            });
            this.player.gold = shelterManager.getResource('gold');
            this.player.diamond = shelterManager.getResource('diamond');
            this.refreshRuntimeUI();
            this.save({ force: true });
            return {
                rewards,
                rewardEntries: this.buildEscortRewardEntries(rewards)
            };
        };
    }

    if (typeof BattleView !== 'undefined' && window.battleView) {
        const originalOnBattleEnd = BattleView.prototype.onBattleEnd;
        BattleView.prototype.onBattleEnd = async function(result, dungeon) {
            if (!result?.isEscortMission) {
                return originalOnBattleEnd.call(this, result, dungeon);
            }

            this.isPaused = false;
            this.skipBattleRequested = false;
            this.closePauseModal();
            battleManager.setAutoBattleOverride();
            this.clearPendingAction();
            this.forceCloseBattleStatsModal?.();
            Modal.closeAll();

            const store = getEscortStateStore();
            const runState = store?.currentEscortRun;
            const cart = battleManager.getEscortCart?.();
            if (runState && cart) {
                runState.cartHp = Math.max(0, Number(cart.hp) || 0);
                runState.cartMaxHp = Math.max(1, Number(cart.maxHp) || runState.cartMaxHp || 1);
                runState.cartPosition = cart.position ? { ...cart.position } : runState.cartPosition;
                persistEscortHeroes(battleManager.heroes || []);
            }

            if (!runState) {
                clearEscortRunState();
                this.stopBattle();
                eventManager.emit('viewChange', { view: 'dungeon' });
                return;
            }

            if (!result.victory) {
                await this.openBattleStatsModal({
                    final: true,
                    result
                });
                clearEscortRunState();
                let exited = false;
                const exitToDungeon = () => {
                    if (exited) {
                        return;
                    }
                    exited = true;
                    this.stopBattle();
                    eventManager.emit('viewChange', { view: 'dungeon' });
                };
                const modal = new Modal({
                    title: '护送失败',
                    showClose: false,
                    className: 'battle-defeat-modal-shell',
                    content: `
                        <div class="battle-defeat-modal">
                            <div class="battle-defeat-copy">
                                <div class="battle-defeat-kicker">ESCORT FAILED</div>
                                <h3>补给车未能安全抵达</h3>
                                <p>本次资源护送战失败，请重新调整护卫阵容与站位后再尝试。</p>
                            </div>
                        </div>
                    `,
                    buttons: [{
                        text: '返回副本',
                        className: 'btn-primary battle-defeat-modal-action',
                        onClick: () => {
                            modal.close();
                            exitToDungeon();
                        }
                    }],
                    onClose: exitToDungeon
                });
                modal.show();
                return;
            }

            runState.completedSegmentIds = Array.isArray(runState.completedSegmentIds) ? runState.completedSegmentIds : [];
            if (runState.mission?.segments?.[runState.currentSegmentIndex]?.id) {
                const completedSegmentId = runState.mission.segments[runState.currentSegmentIndex].id;
                runState.completedSegmentIds.push(completedSegmentId);
                markEscortSegmentCompleted(completedSegmentId);
            }

            const hasNextSegment = runState.currentSegmentIndex + 1 < (runState.mission?.segments?.length || 0);
            if (hasNextSegment) {
                runState.currentSegmentIndex += 1;
                await new Promise((resolve) => {
                    let resolved = false;
                    const finish = () => {
                        if (resolved) {
                            return;
                        }
                        resolved = true;
                        resolve();
                    };
                    const modal = new Modal({
                        title: '护送推进',
                        showClose: false,
                        className: 'battle-stats-modal-shell',
                        content: `
                            <div class="battle-stats-modal">
                                <div class="battle-stats-empty">
                                    <div class="battle-stats-empty-title">已抵达中继点</div>
                                    <div class="battle-stats-empty-text">补给车继续前往下一张地图，当前耐久 ${runState.cartHp}/${runState.cartMaxHp}</div>
                                </div>
                            </div>
                        `,
                        buttons: [{
                            text: '继续护送',
                            className: 'btn-primary battle-stats-modal-action',
                            onClick: () => {
                                modal.close();
                                finish();
                            }
                        }],
                        onClose: finish
                    });
                    modal.show();
                });
                window.game?.showBattleLoadingOverlay?.('准备切换地图', 4);
                this.stopBattle();
                await Utils.delay(80);
                this.show();
                await this.startEscortMission(runState.missionId, {
                    transitionLoading: true,
                    transitionMinMs: 820
                });
                return;
            }

            await this.openBattleStatsModal({
                final: true,
                result
            });
            const durabilityRatio = runState.cartMaxHp > 0 ? runState.cartHp / runState.cartMaxHp : 0;
            const rewardResult = window.game.grantEscortMissionRewards(runState.mission, durabilityRatio);
            saveSyncService.uploadCurrentSave?.({ force: true });
            const durabilityPercent = Math.round(Utils.clamp(durabilityRatio, 0, 1) * 100);
            clearEscortRunState();
            await RewardModal.show({
                title: '护送完成',
                rewards: rewardResult.rewardEntries,
                summaryText: `补给车剩余耐久 ${durabilityPercent}% ，已按耐久比例结算本次资源奖励`
            });
            this.stopBattle();
            eventManager.emit('viewChange', { view: 'dungeon' });
        };

        DungeonView.prototype.renderSpecialBattleModeSwitch = function() {
            const currentMode = this.getSpecialBattleMode();
            return `
                <div class="dungeon-mode-switch">
                    <button type="button" class="dungeon-mode-switch-btn ${currentMode === 'main' ? 'is-active' : ''}" onclick="window.game.ui.dungeonView.setSpecialBattleMode('main')">主线副本</button>
                    <button type="button" class="dungeon-mode-switch-btn ${currentMode === 'special' ? 'is-active' : ''}" onclick="window.game.ui.dungeonView.setSpecialBattleMode('special')">资源护送</button>
                </div>
            `;
        };

        DungeonView.prototype.getSpecialBattleSlideMarkup = function(entry, isActive) {
            const chapter = entry.chapter;
            const mission = entry.primaryMission;
            const unlockState = getEscortMissionUnlockState(mission);
            const chapterIndex = chapter.index || chapter.chapterNumber || mission.chapterIndex || '?';
            const clickHandler = isActive
                ? `window.game.ui.dungeonView.openSpecialBattleModal('${chapter.id}')`
                : `window.game.ui.dungeonView.switchSpecialBattleChapterTo('${chapter.id}')`;
            const background = this.getSpecialBattleChapterBackground(entry);
            const statusClass = unlockState.unlocked ? 'is-ready' : 'is-locked';
            const statusLabel = unlockState.unlocked ? '已解锁' : '未解锁';
            const title = mission.subtitle || chapter.name || mission.name || `第${chapterIndex}章`;
            const description = mission.description || '护送补给车穿越战区';
            const recommendedLevel = Math.max(1, Number(mission.recommendedLevel) || 1);

            return `
                <button type="button" class="dungeon-chapter-slide ${isActive ? 'is-active' : ''}" data-special-chapter-id="${chapter.id}" onclick="${clickHandler}">
                    <div class="dungeon-chapter-card card ${statusClass}" style="--chapter-card-bg:url('${background}')">
                        <div class="dungeon-chapter-card-head">
                            <div class="dungeon-chapter-card-kicker-row">
                                <div class="dungeon-chapter-card-kicker">第${chapterIndex}章 · 资源护送</div>
                                <div class="dungeon-chapter-status-badge">${statusLabel}</div>
                            </div>
                            <div class="dungeon-chapter-card-title">${title}</div>
                        </div>
                        <div class="dungeon-chapter-card-desc">${description}</div>
                        <div class="dungeon-chapter-card-meta">
                            <span>推荐等级 Lv.${recommendedLevel}</span>
                        </div>
                        <div class="dungeon-chapter-action-row">
                            <span>${isActive ? '点击查看护送简报' : '点击切换章节'}</span>
                            <strong>${unlockState.unlocked ? '资源护送' : (unlockState.message || '需先完成主线')}</strong>
                        </div>
                        ${!unlockState.unlocked ? `
                            <div class="dungeon-chapter-lock-overlay">
                                <span>${unlockState.message || '该特殊战尚未解锁'}</span>
                            </div>
                        ` : ''}
                    </div>
                </button>
            `;
        };

        DungeonView.prototype.getSpecialBattleModalContent = function(entry) {
            const chapter = entry.chapter;
            const mission = entry.primaryMission;
            const unlockState = getEscortMissionUnlockState(mission);
            const rewardPreview = formatEscortRewardPreview(mission.baseRewards);
            const chapterIndex = chapter.index || chapter.chapterNumber || mission.chapterIndex || '?';
            const segmentText = (mission.segments || [])
                .map((segment, index) => `第${index + 1}段 · ${segment.name || '未命名路段'}`);
            const actionButton = unlockState.unlocked
                ? `<button class="btn btn-primary chapter-stage-primary-action" onclick="window.game.ui.dungeonView.startSpecialBattleFromModal('${mission.id}')">开始护送</button>`
                : '<button class="btn btn-secondary chapter-stage-primary-action" disabled>尚未解锁</button>';
            const title = mission.subtitle || chapter.name || mission.name || `第${chapterIndex}章`;

            return `
                <div class="chapter-stage-layout">
                    <div class="chapter-stage-detail special-battle-detail">
                        <div class="chapter-stage-detail-heading">
                            <div class="chapter-stage-heading-main">
                                <div class="chapter-stage-detail-kicker">RESOURCE ESCORT</div>
                                <div class="chapter-stage-detail-title">${title}</div>
                            </div>
                            <div class="chapter-stage-status ${unlockState.unlocked ? 'is-pending' : ''}">
                                <span>${unlockState.unlocked ? '已解锁' : '未解锁'}</span>
                                <strong>第${chapterIndex}章</strong>
                            </div>
                        </div>
                        <div class="chapter-stage-detail-desc">${mission.description || '护送补给车穿越战区，载具耐久越高，最终资源结算越完整。'}</div>
                        <div class="chapter-stage-tactical-grid special-battle-tactical-grid">
                            <div>
                                <span>体力消耗</span>
                                <strong>${Math.max(1, Number(mission.energyCost) || 1)}</strong>
                            </div>
                            <div>
                                <span>推荐等级</span>
                                <strong>Lv.${Math.max(1, Number(mission.recommendedLevel) || 1)}</strong>
                            </div>
                        </div>
                        <div class="chapter-stage-preview-block special-battle-preview-block">
                            <div class="chapter-stage-detail-label">护送路段</div>
                            <div class="chapter-stage-detail-meta">
                                ${segmentText.map((text) => `<span>${text}</span>`).join('')}
                            </div>
                        </div>
                        <div class="chapter-stage-preview-block special-battle-preview-block">
                            <div class="chapter-stage-detail-label-row">
                                <div class="chapter-stage-detail-label">奖励预览</div>
                                ${unlockState.unlocked ? '' : `<div class="chapter-stage-detail-label">${unlockState.message || '需先完成前置章节主线'}</div>`}
                            </div>
                            <div class="dungeon-reward-preview-row special-battle-reward-preview-row">
                                ${rewardPreview.map((reward) => this.getSpecialBattleRewardChipMarkup(reward)).join('')}
                            </div>
                        </div>
                        <div class="chapter-stage-detail-actions">
                            ${actionButton}
                            <button class="btn btn-secondary" onclick="window.game.ui.dungeonView.closeSpecialBattleModal()">关闭</button>
                        </div>
                    </div>
                </div>
            `;
        };
    }
})();
