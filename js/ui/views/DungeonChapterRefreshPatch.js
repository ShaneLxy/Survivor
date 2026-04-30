(function() {
    if (typeof DungeonView === 'undefined' || !window.dungeonView) {
        return;
    }

    DungeonView.prototype.getChapters = function() {
        return (window.DungeonChapterConfig || [])
            .map((chapter) => ({
                ...chapter,
                dungeons: (chapter.dungeonIds || []).map((id) => dungeonManager.getDungeon(id)).filter(Boolean)
            }))
            .filter((chapter) => chapter.dungeons.length > 0);
    };

    DungeonView.prototype.ensureSelectedChapter = function(chapters) {
        if (!Array.isArray(chapters) || chapters.length === 0) {
            this.selectedChapterId = null;
            return null;
        }
        const current = chapters.find((chapter) => chapter.id === this.selectedChapterId);
        if (current) {
            return current;
        }
        this.selectedChapterId = chapters[0].id;
        return chapters[0];
    };

    DungeonView.prototype.getLatestAccessibleChapter = function(chapters) {
        if (!Array.isArray(chapters) || chapters.length === 0) {
            return null;
        }

        let latestChapter = chapters[0];
        for (const chapter of chapters) {
            const accessibility = this.getChapterAccessibility(chapter.id);
            if (!accessibility.accessible) {
                break;
            }
            latestChapter = chapter;
        }
        return latestChapter;
    };

    const originalShow = DungeonView.prototype.show;
    DungeonView.prototype.show = function() {
        const chapters = this.getChapters();
        const latestChapter = this.getLatestAccessibleChapter(chapters);
        this.selectedChapterId = latestChapter?.id || null;
        return originalShow.call(this);
    };

    DungeonView.prototype.switchChapterByOffset = function(offset) {
        const chapters = this.getChapters();
        const currentIndex = chapters.findIndex((chapter) => chapter.id === this.selectedChapterId);
        const safeIndex = currentIndex < 0 ? 0 : currentIndex;
        const nextIndex = Math.max(0, Math.min(chapters.length - 1, safeIndex + offset));
        this.selectedChapterId = chapters[nextIndex]?.id || this.selectedChapterId;
        this.render();
    };

    DungeonView.prototype.getChapterIndex = function(chapterId) {
        return this.getChapters().findIndex((chapter) => chapter.id === chapterId);
    };

    DungeonView.prototype.switchChapterTo = function(chapterId) {
        const chapter = this.getChapters().find((entry) => entry.id === chapterId);
        if (!chapter || chapter.id === this.selectedChapterId) {
            return;
        }
        this.selectedChapterId = chapter.id;
        this.render();
    };

    DungeonView.prototype.getAdjacentChapter = function(offset) {
        const chapters = this.getChapters();
        const currentIndex = chapters.findIndex((chapter) => chapter.id === this.selectedChapterId);
        return chapters[(currentIndex < 0 ? 0 : currentIndex) + offset] || null;
    };

    DungeonView.prototype.getChapterAccessibility = function(chapterId) {
        const chapters = this.getChapters();
        const chapterIndex = chapters.findIndex((entry) => entry.id === chapterId);
        if (chapterIndex <= 0) {
            return { accessible: true, message: '' };
        }
        const previousChapter = chapters[chapterIndex - 1];
        const unlocked = previousChapter.dungeons.every((dungeon) => dungeonManager.isCompleted(dungeon.id));
        return {
            accessible: unlocked,
            message: unlocked ? '' : '前一个章节存在关卡未挑战成功'
        };
    };

    DungeonView.prototype.getDungeonAccessibility = function(dungeonId) {
        const chapter = this.getChapters().find((entry) => (entry.dungeons || []).some((dungeon) => dungeon.id === dungeonId));
        if (!chapter) {
            return { accessible: true, message: '' };
        }
        return this.getChapterAccessibility(chapter.id);
    };

    DungeonView.prototype.getChapterProgressSummary = function(chapters) {
        const safeChapters = Array.isArray(chapters) ? chapters : [];
        const unlockedChapters = safeChapters.filter((chapter) => this.getChapterAccessibility(chapter.id).accessible);
        const allStages = safeChapters.flatMap((chapter) => chapter.dungeons || []);
        const clearedStages = allStages.filter((dungeon) => dungeonManager.isCompleted(dungeon.id));

        return {
            unlockedChapterCount: unlockedChapters.length,
            chapterCount: safeChapters.length,
            clearedStageCount: clearedStages.length,
            stageCount: allStages.length
        };
    };

    DungeonView.prototype.getRewardChipIcon = function(rewardLine) {
        if (rewardLine.startsWith('金币')) {
            return 'G';
        }
        if (rewardLine.startsWith('经验')) {
            return 'XP';
        }
        return '◇';
    };

    DungeonView.prototype.getRewardChipMarkup = function(rewardLine) {
        return `
            <span class="dungeon-reward-chip">
                <i aria-hidden="true">${this.getRewardChipIcon(rewardLine)}</i>
                <strong>${rewardLine}</strong>
            </span>
        `;
    };

    DungeonView.prototype.getChapterTacticalSummary = function(chapter) {
        const stages = chapter?.dungeons || [];
        const clearedStages = stages.filter((stage) => dungeonManager.isCompleted(stage.id));
        const primaryStage = stages[0] || null;
        const levels = stages.map((stage) => stage.level).filter((level) => Number.isFinite(level));
        const minLevel = levels.length ? Math.min(...levels) : 1;
        const maxLevel = levels.length ? Math.max(...levels) : minLevel;
        const rewards = primaryStage && typeof this.getDungeonRewardPreview === 'function'
            ? this.getDungeonRewardPreview(primaryStage).slice(0, 3)
            : [];
        const enemyCount = stages.reduce((sum, stage) => sum + stage.getInfo().enemyCount, 0);
        const stageCount = stages.length || 0;
        const clearedStageCount = clearedStages.length;

        return {
            stageCount,
            clearedStageCount,
            completionRatio: stageCount > 0 ? Math.round((clearedStageCount / stageCount) * 100) : 0,
            primaryStage,
            rewards,
            minLevel,
            maxLevel,
            enemyCount,
            levelLabel: minLevel === maxLevel ? `Lv.${minLevel}` : `Lv.${minLevel}-${maxLevel}`
        };
    };

    DungeonView.prototype.getChapterStatus = function(chapter, accessibility) {
        const statusAccessibility = accessibility || this.getChapterAccessibility(chapter.id);
        const summary = this.getChapterTacticalSummary(chapter);

        if (!statusAccessibility.accessible) {
            return { key: 'locked', className: 'is-locked', label: '封锁中', action: '前置未完成' };
        }
        if (summary.stageCount > 0 && summary.clearedStageCount >= summary.stageCount) {
            return { key: 'cleared', className: 'is-cleared', label: '已清剿', action: '复盘档案' };
        }
        if (summary.clearedStageCount > 0) {
            return { key: 'progress', className: 'is-progress', label: '推进中', action: '继续推进' };
        }
        return { key: 'ready', className: 'is-ready', label: '可探索', action: '打开作战档案' };
    };

    DungeonView.prototype.getChapterRouteMarkup = function(chapters, selectedChapterId) {
        return `
            <div class="dungeon-chapter-route" aria-hidden="true">
                ${chapters.map((chapter) => {
                    const accessibility = this.getChapterAccessibility(chapter.id);
                    const status = this.getChapterStatus(chapter, accessibility);
                    const activeClass = chapter.id === selectedChapterId ? 'is-active' : '';
                    return `<span class="dungeon-chapter-route-node ${status.className} ${activeClass}"></span>`;
                }).join('')}
            </div>
        `;
    };

    DungeonView.prototype.openChapterStageModal = function(chapterId) {
        const chapter = this.getChapters().find((entry) => entry.id === chapterId);
        if (!chapter) {
            Toast.error('章节不存在');
            return;
        }
        const accessibility = this.getChapterAccessibility(chapterId);
        if (!accessibility.accessible) {
            Toast.error(accessibility.message);
            return;
        }
        this.selectedStageId = chapter.dungeons[0]?.id || null;
        const modal = new Modal({
            className: 'chapter-stage-modal-shell',
            title: `${chapter.index}. ${chapter.name}`,
            content: this.getChapterStageModalContent(chapter),
            buttons: [{ text: '关闭', className: 'btn-secondary', onClick: () => modal.close() }]
        });
        this.chapterStageModal = modal;
        modal.show();
    };

    DungeonView.prototype.refreshChapterStageModal = function(chapter) {
        if (!this.chapterStageModal?.isShown()) {
            return;
        }
        this.chapterStageModal.setContent(this.getChapterStageModalContent(chapter));
    };

    DungeonView.prototype.selectStage = function(chapterId, dungeonId) {
        this.selectedStageId = dungeonId;
        const chapter = this.getChapters().find((entry) => entry.id === chapterId);
        if (chapter) {
            this.refreshChapterStageModal(chapter);
        }
    };

    DungeonView.prototype.bindChapterCarouselInteractions = function() {
        const carousel = this.element.querySelector('.dungeon-chapter-carousel');
        if (!carousel) {
            return;
        }

        let startX = 0;
        let startY = 0;
        let deltaX = 0;
        let deltaY = 0;
        let tracking = false;

        const reset = () => {
            startX = 0;
            startY = 0;
            deltaX = 0;
            deltaY = 0;
            tracking = false;
        };

        const getTouchPoint = (event) => {
            const point = event.changedTouches?.[0] || event.touches?.[0];
            return point ? { x: point.clientX, y: point.clientY } : null;
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
                return;
            }

            const chapters = this.getChapters();
            if (chapters.length <= 1) {
                return;
            }

            const currentIndex = this.getChapterIndex(this.selectedChapterId);
            const safeIndex = currentIndex < 0 ? 0 : currentIndex;
            const stepWidth = Math.max(48, carousel.clientWidth * 0.22);
            const rawSteps = Math.max(1, Math.round(absX / stepWidth));

            if (swipeX < 0) {
                const availableNext = chapters.length - 1 - safeIndex;
                const steps = Math.min(rawSteps, availableNext);
                if (steps > 0) {
                    this.switchChapterByOffset(steps);
                }
                return;
            }

            const availablePrev = safeIndex;
            const steps = Math.min(rawSteps, availablePrev);
            if (steps > 0) {
                this.switchChapterByOffset(-steps);
            }
        };

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
        }, { passive: true });

        carousel.addEventListener('touchend', () => {
            handleSwipe();
        }, { passive: true });

        carousel.addEventListener('touchcancel', () => {
            reset();
        }, { passive: true });
    };

    DungeonView.prototype.getChapterStageModalContent = function(chapter) {
        const stages = chapter.dungeons || [];
        const activeStage = stages.find((stage) => stage.id === this.selectedStageId) || stages[0];
        if (!activeStage) {
            return '<div class="shelter-empty">暂无关卡</div>';
        }

        const rewardPreview = this.getDungeonRewardPreview(activeStage);
        const enemyPreview = this.getDungeonEnemyPreview(activeStage);
        const canSweep = dungeonManager.canSweep(activeStage.id);
        const stageCompleted = dungeonManager.isCompleted(activeStage.id);
        const stars = dungeonManager.getStars(activeStage.id);
        const actionLabel = stageCompleted ? '再次挑战' : '开始挑战';
        const stageCountClass = `chapter-stage-count-${Math.max(1, Math.min(stages.length, 5))}`;

        return `
            <div class="chapter-stage-layout">
                <div class="chapter-stage-list chapter-stage-list-horizontal ${stageCountClass}">
                    ${stages.map((stage, index) => `
                        <button class="chapter-stage-item ${activeStage.id === stage.id ? 'is-active' : ''} ${dungeonManager.isCompleted(stage.id) ? 'is-completed' : 'is-pending'}"
                            onclick="window.game.ui.dungeonView.selectStage('${chapter.id}', '${stage.id}')">
                            <span class="chapter-stage-item-index">关卡 ${index + 1}</span>
                            <span>${dungeonManager.isCompleted(stage.id) ? '已清剿' : `Lv.${stage.level}`}</span>
                        </button>
                    `).join('')}
                </div>
                <div class="chapter-stage-detail">
                    <div class="chapter-stage-detail-heading">
                        <div>
                            <div class="chapter-stage-detail-kicker">OPERATION FILE</div>
                            <div class="chapter-stage-detail-title">${activeStage.name}</div>
                        </div>
                        <div class="chapter-stage-status ${stageCompleted ? 'is-completed' : 'is-pending'}">
                            <span>${stageCompleted ? '已清剿' : '待挑战'}</span>
                            <strong>${stageCompleted ? `${stars}星` : `Lv.${activeStage.level}`}</strong>
                        </div>
                    </div>
                    <div class="chapter-stage-detail-desc">${activeStage.description || '危险仍在蔓延，整备完成后再深入。'}</div>
                    <div class="chapter-stage-tactical-grid">
                        <div>
                            <span>体力消耗</span>
                            <strong>${activeStage.energyCost}</strong>
                        </div>
                        <div>
                            <span>敌方单位</span>
                            <strong>${activeStage.getInfo().enemyCount}</strong>
                        </div>
                        <div>
                            <span>推荐等级</span>
                            <strong>Lv.${activeStage.level}</strong>
                        </div>
                    </div>
                    <div class="chapter-stage-detail-section">
                        <div class="chapter-stage-detail-label">敌人预览</div>
                        <div class="dungeon-enemy-preview-row">
                            ${enemyPreview.map((enemy) => `
                                <button type="button" class="dungeon-enemy-chip" onclick="window.game.ui.dungeonView.openMonsterDetail('${enemy.id}')">
                                    <span>${enemy.icon}</span>
                                    <strong>${enemy.name}</strong>
                                </button>
                            `).join('')}
                        </div>
                    </div>
                    <div class="chapter-stage-detail-section">
                        <div class="chapter-stage-detail-label">掉落预览</div>
                        <div class="dungeon-reward-preview-row">
                            ${rewardPreview.map((reward) => this.getRewardChipMarkup(reward)).join('')}
                        </div>
                    </div>
                    <div class="chapter-stage-detail-actions">
                        <button class="btn btn-primary chapter-stage-primary-action" onclick="window.game.ui.dungeonView.enterDungeon('${activeStage.id}')">${actionLabel}</button>
                        <button class="btn ${canSweep ? 'btn-success' : 'btn-secondary'}" ${canSweep ? '' : 'disabled'} onclick="window.game.ui.dungeonView.sweepDungeon('${activeStage.id}')">扫荡</button>
                    </div>
                </div>
            </div>
        `;
    };

    DungeonView.prototype.render = function() {
        this.codexCache = dungeonManager.getMonsterCompendium(window.game.player.level);
        const chapters = this.getChapters();
        const selectedChapter = this.ensureSelectedChapter(chapters);
        const prevChapter = this.getAdjacentChapter(-1);
        const nextChapter = this.getAdjacentChapter(1);
        const stageCount = selectedChapter?.dungeons?.length || 0;
        const background = selectedChapter?.background || window.GameSceneBackgrounds?.dungeon?.src || '';
        const chapterAccessibility = selectedChapter ? this.getChapterAccessibility(selectedChapter.id) : { accessible: true, message: '' };
        const chapterSummary = selectedChapter ? this.getChapterTacticalSummary(selectedChapter) : null;
        const chapterStatus = selectedChapter ? this.getChapterStatus(selectedChapter, chapterAccessibility) : null;
        const prevChapterStatus = prevChapter ? this.getChapterStatus(prevChapter) : null;
        const nextChapterStatus = nextChapter ? this.getChapterStatus(nextChapter) : null;
        const progressSummary = this.getChapterProgressSummary(chapters);
        const headerSubtitle = selectedChapter && chapterSummary
            ? `第${selectedChapter.index}章 · ${selectedChapter.name} · ${chapterSummary.clearedStageCount}/${chapterSummary.stageCount} 已清剿`
            : '左右切换章节，查看本章节关卡详情。';

        this.element.innerHTML = `
            <div class="scene-view dungeon-view dungeon-view-chapter" style="--chapter-bg:url('${background}')">
                <div class="scene-view-backdrop dungeon-scene-backdrop dungeon-chapter-backdrop">
                    <div class="dungeon-chapter-image" style="background-image:url('${background}')"></div>
                    <div class="scene-backdrop-glow scene-backdrop-glow-a"></div>
                    <div class="scene-backdrop-glow scene-backdrop-glow-b"></div>
                </div>
                <div class="scene-view-overlay dungeon-clear-overlay"></div>
                <div class="scene-view-content dungeon-chapter-content">
                    <div class="dungeon-header-bar dungeon-header-bar-patched">
                        <div class="dungeon-stage-heading-group">
                            <div class="dungeon-stage-kicker">DUNGEON</div>
                            <h2 class="dungeon-title">副本章节</h2>
                            <div class="dungeon-subtitle">${headerSubtitle}</div>
                        </div>
                        <div class="dungeon-stage-stats">
                            <div class="dungeon-stage-stat">
                                <span>章节</span>
                                <strong>${progressSummary.unlockedChapterCount}/${progressSummary.chapterCount}</strong>
                            </div>
                            <div class="dungeon-stage-stat">
                                <span>通关</span>
                                <strong>${progressSummary.clearedStageCount}/${progressSummary.stageCount}</strong>
                            </div>
                            ${chapterSummary ? `
                                <div class="dungeon-stage-stat dungeon-stage-stat-current">
                                    <span>当前</span>
                                    <strong>${chapterSummary.clearedStageCount}/${chapterSummary.stageCount}</strong>
                                </div>
                            ` : ''}
                        </div>
                        <button class="btn btn-secondary dungeon-codex-btn" onclick="window.game.ui.dungeonView.openMonsterCodexModal()" title="怪物图鉴" aria-label="怪物图鉴">图鉴</button>
                    </div>
                    <div class="dungeon-chapter-carousel">
                        ${this.getChapterRouteMarkup(chapters, selectedChapter?.id)}
                        <button class="dungeon-chapter-arrow ${prevChapter ? '' : 'is-hidden'}" ${prevChapter ? `onclick="window.game.ui.dungeonView.switchChapterByOffset(-1)"` : ''}>&lsaquo;</button>
                        <button type="button" class="dungeon-chapter-peek left ${prevChapter ? '' : 'is-hidden'} ${prevChapterStatus?.className || ''}" ${prevChapter ? `onclick="window.game.ui.dungeonView.switchChapterTo('${prevChapter.id}')"` : 'disabled'}>
                            ${prevChapter ? `<span>第${prevChapter.index}章 · ${prevChapterStatus.label}</span><strong>${prevChapter.name}</strong>` : ''}
                        </button>
                        ${selectedChapter ? `
                            <button type="button" class="dungeon-chapter-card card ${chapterStatus.className}" onclick="window.game.ui.dungeonView.openChapterStageModal('${selectedChapter.id}')">
                                <div class="dungeon-chapter-status-badge">${chapterStatus.label}</div>
                                <div class="dungeon-chapter-card-head">
                                    <div>
                                        <div class="dungeon-chapter-card-kicker">第${selectedChapter.index}章 · 作战档案</div>
                                        <div class="dungeon-chapter-card-title">${selectedChapter.name}</div>
                                    </div>
                                    <div class="dungeon-chapter-threat">
                                        <span>威胁</span>
                                        <strong>${chapterSummary.levelLabel}</strong>
                                    </div>
                                </div>
                                <div class="dungeon-chapter-card-desc">${selectedChapter.description}</div>
                                <div class="dungeon-chapter-progress">
                                    <div class="dungeon-chapter-progress-copy">
                                        <span>清剿进度</span>
                                        <strong>${chapterSummary.clearedStageCount}/${chapterSummary.stageCount}</strong>
                                    </div>
                                    <div class="dungeon-chapter-progress-track">
                                        <i style="width:${chapterSummary.completionRatio}%"></i>
                                    </div>
                                </div>
                                <div class="dungeon-chapter-dossier">
                                    <div>
                                        <span>关卡</span>
                                        <strong>${stageCount}</strong>
                                    </div>
                                    <div>
                                        <span>敌方</span>
                                        <strong>${chapterSummary.enemyCount}</strong>
                                    </div>
                                    <div>
                                        <span>推荐</span>
                                        <strong>${chapterSummary.levelLabel}</strong>
                                    </div>
                                </div>
                                <div class="dungeon-chapter-reward-strip">
                                    ${chapterSummary.rewards.map((reward) => this.getRewardChipMarkup(reward)).join('')}
                                </div>
                                <div class="dungeon-chapter-action-row">
                                    <span>${chapterStatus.action}</span>
                                    <strong>${chapterAccessibility.accessible ? '查看关卡' : '需要清剿前章'}</strong>
                                </div>
                                ${chapterAccessibility.accessible ? '' : `<div class="dungeon-chapter-lock-overlay"><span>${chapterAccessibility.message}</span></div>`}
                            </button>
                        ` : '<div class="shelter-empty">暂无章节</div>'}
                        <button type="button" class="dungeon-chapter-peek right ${nextChapter ? '' : 'is-hidden'} ${nextChapterStatus?.className || ''}" ${nextChapter ? `onclick="window.game.ui.dungeonView.switchChapterTo('${nextChapter.id}')"` : 'disabled'}>
                            ${nextChapter ? `<span>第${nextChapter.index}章 · ${nextChapterStatus.label}</span><strong>${nextChapter.name}</strong>` : ''}
                        </button>
                        <button class="dungeon-chapter-arrow ${nextChapter ? '' : 'is-hidden'}" ${nextChapter ? `onclick="window.game.ui.dungeonView.switchChapterByOffset(1)"` : ''}>&rsaquo;</button>
                    </div>
                </div>
            </div>
        `;
        this.bindChapterCarouselInteractions();
        this.refreshMonsterCodexModal();
    };
})();
