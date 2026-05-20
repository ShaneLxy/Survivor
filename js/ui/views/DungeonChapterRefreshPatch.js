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

    DungeonView.prototype.getSelectedChapterIndex = function(chapters) {
        const safeChapters = Array.isArray(chapters) ? chapters : [];
        const currentIndex = safeChapters.findIndex((chapter) => chapter.id === this.selectedChapterId);
        return currentIndex < 0 ? 0 : currentIndex;
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
            message: unlocked ? '' : '前一章节存在未完成关卡'
        };
    };

    DungeonView.prototype.getDungeonAccessibility = function(dungeonId) {
        const chapter = this.getChapters().find((entry) => (entry.dungeons || []).some((dungeon) => dungeon.id === dungeonId));
        if (!chapter) {
            return { accessible: true, message: '' };
        }
        const chapterAccessibility = this.getChapterAccessibility(chapter.id);
        if (!chapterAccessibility.accessible) {
            return chapterAccessibility;
        }
        return this.getStageAccessibility(chapter.id, dungeonId);
    };

    DungeonView.prototype.getStageAccessibility = function(chapterId, dungeonId) {
        const chapter = this.getChapters().find((entry) => entry.id === chapterId);
        if (!chapter) {
            return { accessible: true, message: '' };
        }

        const stages = chapter.dungeons || [];
        const stageIndex = stages.findIndex((stage) => stage.id === dungeonId);
        if (stageIndex <= 0) {
            return { accessible: true, message: '' };
        }

        const previousStage = stages[stageIndex - 1];
        const accessible = !!previousStage && dungeonManager.isCompleted(previousStage.id);
        return {
            accessible,
            message: accessible ? '' : `请先通关第 ${stageIndex} 关`
        };
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
        return '•';
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
            return { key: 'locked', className: 'is-locked', label: '未解锁', action: '前置章节未完成' };
        }
        if (summary.stageCount > 0 && summary.clearedStageCount >= summary.stageCount) {
            return { key: 'cleared', className: 'is-cleared', label: '已清剿', action: '复盘作战档案' };
        }
        if (summary.clearedStageCount > 0) {
            return { key: 'progress', className: 'is-progress', label: '推进中', action: '继续推进' };
        }
        return { key: 'ready', className: 'is-ready', label: '可探索', action: '打开作战档案' };
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

        const stages = chapter.dungeons || [];
        const firstAccessibleStage = stages.find((stage) => this.getStageAccessibility(chapter.id, stage.id).accessible);
        this.selectedStageId = firstAccessibleStage?.id || stages[0]?.id || null;
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
        const accessibility = this.getStageAccessibility(chapterId, dungeonId);
        if (!accessibility.accessible) {
            Toast.info(accessibility.message);
            return;
        }
        this.selectedStageId = dungeonId;
        const chapter = this.getChapters().find((entry) => entry.id === chapterId);
        if (chapter) {
            this.refreshChapterStageModal(chapter);
        }
    };

    DungeonView.prototype.bindChapterCarouselInteractions = function() {
        const carousel = this.element.querySelector('.dungeon-chapter-carousel');
        const viewport = carousel?.querySelector('.dungeon-chapter-viewport');
        const track = carousel?.querySelector('.dungeon-chapter-track');
        if (!carousel || !viewport || !track) {
            return;
        }

        const chapters = this.getChapters();
        const currentIndex = this.getSelectedChapterIndex(chapters);
        const activeSlide = track.querySelector('.dungeon-chapter-slide.is-active');
        const trackStyles = window.getComputedStyle(track);
        const gap = Number.parseFloat(trackStyles.columnGap || trackStyles.gap || '0') || 0;
        const slideWidth = activeSlide?.getBoundingClientRect().width || viewport.clientWidth;
        const slideSpan = slideWidth + gap;

        if (!chapters.length || !slideSpan) {
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
            if ((currentIndex <= 0 && offset > 0) || (currentIndex >= chapters.length - 1 && offset < 0)) {
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

            const nextIndex = Math.max(0, Math.min(chapters.length - 1, currentIndex + steps));
            if (nextIndex === currentIndex) {
                setTrackPosition(currentIndex, 0, true);
                clearAnimatingState();
                return;
            }

            setTrackPosition(nextIndex, 0, true);
            window.setTimeout(() => {
                track.classList.remove('is-animating');
                this.selectedChapterId = chapters[nextIndex]?.id || this.selectedChapterId;
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
                const availableNext = chapters.length - 1 - currentIndex;
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

    DungeonView.prototype.getChapterSlideMarkup = function(chapter, isActive) {
        const chapterAccessibility = this.getChapterAccessibility(chapter.id);
        const chapterSummary = this.getChapterTacticalSummary(chapter);
        const chapterStatus = this.getChapterStatus(chapter, chapterAccessibility);
        const chapterStageCount = chapter?.dungeons?.length || 0;
        const clickHandler = chapterAccessibility.accessible && isActive
            ? `window.game.ui.dungeonView.openChapterStageModal('${chapter.id}')`
            : `window.game.ui.dungeonView.switchChapterTo('${chapter.id}')`;
        const chapterBackground = chapter?.background || '';

        return `
            <button type="button" class="dungeon-chapter-slide ${isActive ? 'is-active' : ''}" data-chapter-id="${chapter.id}" onclick="${clickHandler}">
                <div class="dungeon-chapter-card card ${chapterStatus.className}" style="--chapter-card-bg:url('${chapterBackground}')">
                    <div class="dungeon-chapter-card-head">
                        <div class="dungeon-chapter-card-kicker-row">
                            <div class="dungeon-chapter-card-kicker">第${chapter.index}章 · 作战档案</div>
                            <div class="dungeon-chapter-status-badge">${chapterStatus.label}</div>
                        </div>
                        <div class="dungeon-chapter-card-title">${chapter.name}</div>
                    </div>
                    <div class="dungeon-chapter-card-desc">${chapter.description}</div>
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
                            <strong>${chapterStageCount}</strong>
                        </div>
                        <div>
                            <span>推荐</span>
                            <strong>${chapterSummary.levelLabel}</strong>
                        </div>
                    </div>
                    <div class="dungeon-chapter-action-row">
                        <span>${chapterStatus.action}</span>
                        <strong>${chapterAccessibility.accessible ? '查看关卡' : '需要清剿前章'}</strong>
                    </div>
                    ${chapterAccessibility.accessible ? '' : `<div class="dungeon-chapter-lock-overlay"><span>${chapterAccessibility.message}</span></div>`}
                </div>
            </button>
        `;
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
                    ${stages.map((stage, index) => {
                        const stageAccessibility = this.getStageAccessibility(chapter.id, stage.id);
                        const stateClass = !stageAccessibility.accessible
                            ? 'is-locked'
                            : (dungeonManager.isCompleted(stage.id) ? 'is-completed' : 'is-pending');
                        const label = !stageAccessibility.accessible
                            ? '未解锁'
                            : (dungeonManager.isCompleted(stage.id) ? '已清剿' : `Lv.${stage.level}`);
                        return `
                        <button class="chapter-stage-item ${activeStage.id === stage.id ? 'is-active' : ''} ${stateClass}"
                            ${stageAccessibility.accessible ? `onclick="window.game.ui.dungeonView.selectStage('${chapter.id}', '${stage.id}')"` : 'disabled'}>
                            <span class="chapter-stage-item-index">关卡 ${index + 1}</span>
                            <span>${label}</span>
                        </button>
                    `;
                    }).join('')}
                </div>
                <div class="chapter-stage-detail">
                    <div class="chapter-stage-detail-heading">
                        <div class="chapter-stage-heading-main">
                            <div class="chapter-stage-detail-kicker">OPERATION FILE</div>
                            <div class="chapter-stage-detail-title">${activeStage.name}</div>
                        </div>
                        <button type="button" class="btn btn-secondary dungeon-stage-codex-btn" onclick="window.game.ui.dungeonView.openMonsterCodexModal(null, '${activeStage.id}')">本关图鉴</button>
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
                    <div class="chapter-stage-preview-block">
                        <div class="chapter-stage-detail-label">敌人预览</div>
                        <div class="dungeon-enemy-preview-row">
                            ${enemyPreview.map((enemy) => `
                                <button type="button" class="dungeon-enemy-chip" onclick="window.game.ui.dungeonView.openMonsterDetail('${enemy.id}', '${activeStage.id}')">
                                    <span>${enemy.icon}</span>
                                    <strong>${enemy.name}</strong>
                                </button>
                            `).join('')}
                        </div>
                    </div>
                    <div class="chapter-stage-preview-block">
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
        const selectedIndex = this.getSelectedChapterIndex(chapters);
        const prevChapter = this.getAdjacentChapter(-1);
        const nextChapter = this.getAdjacentChapter(1);
        const background = selectedChapter?.background || window.GameSceneBackgrounds?.dungeon?.src || '';
        const chapterSummary = selectedChapter ? this.getChapterTacticalSummary(selectedChapter) : null;
        const progressSummary = this.getChapterProgressSummary(chapters);
        const headerSubtitle = selectedChapter && chapterSummary
            ? `第${selectedChapter.index}章 · ${selectedChapter.name} · ${chapterSummary.clearedStageCount}/${chapterSummary.stageCount} 已清剿`
            : '左右滑动章节卡片，拖得越远可一次跨越更多章节。';

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
                    </div>
                    <div class="dungeon-chapter-carousel">
                        <button class="dungeon-chapter-arrow ${prevChapter ? '' : 'is-hidden'}" ${prevChapter ? `onclick="window.game.ui.dungeonView.switchChapterByOffset(-1)"` : ''}>&lsaquo;</button>
                        ${selectedChapter ? `
                            <div class="dungeon-chapter-viewport">
                                <div class="dungeon-chapter-track" data-selected-index="${selectedIndex}">
                                    ${chapters.map((chapter) => this.getChapterSlideMarkup(chapter, chapter.id === selectedChapter.id)).join('')}
                                </div>
                            </div>
                        ` : '<div class="shelter-empty">暂无章节</div>'}
                        <button class="dungeon-chapter-arrow ${nextChapter ? '' : 'is-hidden'}" ${nextChapter ? `onclick="window.game.ui.dungeonView.switchChapterByOffset(1)"` : ''}>&rsaquo;</button>
                    </div>
                </div>
            </div>
        `;
        this.bindChapterCarouselInteractions();
        this.refreshMonsterCodexModal();
    };
})();
