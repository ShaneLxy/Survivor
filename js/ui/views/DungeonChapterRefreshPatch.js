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

        return `
            <div class="chapter-stage-layout">
                <div class="chapter-stage-list chapter-stage-list-horizontal">
                    ${stages.map((stage, index) => `
                        <button class="chapter-stage-item ${activeStage.id === stage.id ? 'is-active' : ''}"
                            onclick="window.game.ui.dungeonView.selectStage('${chapter.id}', '${stage.id}')">
                            <span class="chapter-stage-item-index">关卡 ${index + 1}</span>
                            <span>推荐 Lv.${stage.level}</span>
                        </button>
                    `).join('')}
                </div>
                <div class="chapter-stage-detail">
                    <div class="chapter-stage-detail-title">${activeStage.name}</div>
                    <div class="chapter-stage-detail-desc">${activeStage.description || '危险仍在蔓延，整备完成后再深入。'}</div>
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
                            ${rewardPreview.map((reward) => `<span class="dungeon-reward-chip">${reward}</span>`).join('')}
                        </div>
                    </div>
                    <div class="chapter-stage-detail-meta">
                        <span>体力 ${activeStage.energyCost}</span>
                        <span>敌人 ${activeStage.getInfo().enemyCount}</span>
                        <span>推荐等级 Lv.${activeStage.level}</span>
                    </div>
                    <div class="chapter-stage-detail-actions">
                        <button class="btn btn-primary" onclick="window.game.ui.dungeonView.enterDungeon('${activeStage.id}')">进入战斗</button>
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
                        <div>
                            <h2 class="dungeon-title">副本章节</h2>
                            <div class="dungeon-subtitle">左右切换章节，点击中间章节卡查看本章节关卡详情。</div>
                        </div>
                        <button class="btn btn-secondary" onclick="window.game.ui.dungeonView.openMonsterCodexModal()">怪物图鉴</button>
                    </div>
                    <div class="dungeon-chapter-carousel">
                        <button class="dungeon-chapter-arrow ${prevChapter ? '' : 'is-hidden'}" ${prevChapter ? `onclick="window.game.ui.dungeonView.switchChapterByOffset(-1)"` : ''}>&lsaquo;</button>
                        <button type="button" class="dungeon-chapter-peek left ${prevChapter ? '' : 'is-hidden'}" ${prevChapter ? `onclick="window.game.ui.dungeonView.switchChapterTo('${prevChapter.id}')"` : 'disabled'}>
                            ${prevChapter ? `<span>第${prevChapter.index}章</span><strong>${prevChapter.name}</strong>` : ''}
                        </button>
                        ${selectedChapter ? `
                            <button type="button" class="dungeon-chapter-card card ${chapterAccessibility.accessible ? '' : 'is-locked'}" onclick="window.game.ui.dungeonView.openChapterStageModal('${selectedChapter.id}')">
                                <div class="dungeon-chapter-card-kicker">第${selectedChapter.index}章</div>
                                <div class="dungeon-chapter-card-title">${selectedChapter.name}</div>
                                <div class="dungeon-chapter-card-desc">${selectedChapter.description}</div>
                                <div class="dungeon-chapter-card-meta">
                                    <span>${stageCount} 个关卡</span>
                                    <span>推荐 Lv.${selectedChapter.dungeons[0]?.level || 1}</span>
                                </div>
                                <div class="dungeon-chapter-card-tip">点击查看章节详情</div>
                                ${chapterAccessibility.accessible ? '' : `<div class="dungeon-chapter-lock-overlay"><span>${chapterAccessibility.message}</span></div>`}
                            </button>
                        ` : '<div class="shelter-empty">暂无章节</div>'}
                        <button type="button" class="dungeon-chapter-peek right ${nextChapter ? '' : 'is-hidden'}" ${nextChapter ? `onclick="window.game.ui.dungeonView.switchChapterTo('${nextChapter.id}')"` : 'disabled'}>
                            ${nextChapter ? `<span>第${nextChapter.index}章</span><strong>${nextChapter.name}</strong>` : ''}
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
