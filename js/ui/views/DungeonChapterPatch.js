(function() {
    if (typeof DungeonView === 'undefined' || !window.dungeonView) {
        return;
    }

    DungeonView.prototype.getChapters = function() {
        return (window.DungeonChapterConfig || []).map((chapter) => ({
            ...chapter,
            dungeons: chapter.dungeonIds.map((id) => dungeonManager.getDungeon(id)).filter(Boolean)
        })).filter((chapter) => chapter.dungeons.length > 0);
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

    DungeonView.prototype.switchChapterByOffset = function(offset) {
        const chapters = this.getChapters();
        const currentIndex = chapters.findIndex((chapter) => chapter.id === this.selectedChapterId);
        const nextIndex = Math.max(0, Math.min(chapters.length - 1, currentIndex + offset));
        this.selectedChapterId = chapters[nextIndex]?.id || this.selectedChapterId;
        this.render();
    };

    DungeonView.prototype.getAdjacentChapter = function(offset) {
        const chapters = this.getChapters();
        const currentIndex = chapters.findIndex((chapter) => chapter.id === this.selectedChapterId);
        return chapters[currentIndex + offset] || null;
    };

    DungeonView.prototype.openChapterStageModal = function(chapterId) {
        const chapter = this.getChapters().find((entry) => entry.id === chapterId);
        if (!chapter) {
            Toast.error('章节不存在');
            return;
        }
        this.selectedStageId = chapter.dungeons[0]?.id || null;
        const modal = new Modal({
            className: 'chapter-stage-modal',
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

    DungeonView.prototype.getChapterStageModalContent = function(chapter) {
        const stages = chapter.dungeons;
        const activeStage = stages.find((stage) => stage.id === this.selectedStageId) || stages[0];
        const rewardPreview = this.getDungeonRewardPreview(activeStage);
        const enemyPreview = this.getDungeonEnemyPreview(activeStage);
        const canSweep = dungeonManager.canSweep(activeStage.id);

        return `
            <div class="chapter-stage-layout">
                <div class="chapter-stage-list">
                    ${stages.map((stage, index) => `
                        <button class="chapter-stage-item ${activeStage.id === stage.id ? 'is-active' : ''}"
                            onclick="window.game.ui.dungeonView.selectStage('${chapter.id}', '${stage.id}')">
                            <span class="chapter-stage-item-index">关卡 ${index + 1}</span>
                            <strong>${stage.name}</strong>
                            <span>推荐 Lv.${stage.level}</span>
                        </button>
                    `).join('')}
                </div>
                <div class="chapter-stage-detail">
                    <div class="chapter-stage-detail-title">${activeStage.name}</div>
                    <div class="chapter-stage-detail-desc">${activeStage.description || '危险正在蔓延，准备好后再深入。'}</div>
                    <div class="chapter-stage-detail-section">
                        <div class="chapter-stage-detail-label">怪物信息</div>
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
                        <div class="chapter-stage-detail-label">掉落梗概</div>
                        <div class="dungeon-reward-preview-row">
                            ${rewardPreview.map((reward) => `<span class="dungeon-reward-chip">${reward}</span>`).join('')}
                        </div>
                    </div>
                    <div class="chapter-stage-detail-meta">
                        <span>体力 ${activeStage.energyCost}</span>
                        <span>敌人数 ${activeStage.getInfo().enemyCount}</span>
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

        this.element.innerHTML = `
            <div class="scene-view dungeon-view dungeon-view-chapter" style="--chapter-bg:url('${background}')">
                <div class="scene-view-backdrop dungeon-scene-backdrop dungeon-chapter-backdrop">
                    <div class="dungeon-chapter-image" style="background-image:url('${background}')"></div>
                    <div class="scene-backdrop-glow scene-backdrop-glow-a"></div>
                    <div class="scene-backdrop-glow scene-backdrop-glow-b"></div>
                </div>
                <div class="scene-view-overlay"></div>
                <div class="scene-view-content dungeon-chapter-content">
                    <div class="dungeon-header-bar dungeon-header-bar-patched">
                        <div>
                            <h2 class="dungeon-title">副本章节</h2>
                            <div class="dungeon-subtitle">左右切换章节，再点击章节卡进入当前章节的关卡详情。</div>
                        </div>
                        <button class="btn btn-secondary" onclick="window.game.ui.dungeonView.openMonsterCodexModal()">怪物图鉴</button>
                    </div>
                    <div class="dungeon-chapter-carousel">
                        <button class="dungeon-chapter-arrow ${prevChapter ? '' : 'is-hidden'}" ${prevChapter ? `onclick="window.game.ui.dungeonView.switchChapterByOffset(-1)"` : ''}>‹</button>
                        <div class="dungeon-chapter-peek left ${prevChapter ? '' : 'is-hidden'}">
                            ${prevChapter ? `<span>第${prevChapter.index}章</span><strong>${prevChapter.name}</strong>` : ''}
                        </div>
                        ${selectedChapter ? `
                            <button type="button" class="dungeon-chapter-card card" onclick="window.game.ui.dungeonView.openChapterStageModal('${selectedChapter.id}')">
                                <div class="dungeon-chapter-card-kicker">第 ${selectedChapter.index} 章</div>
                                <div class="dungeon-chapter-card-title">${selectedChapter.name}</div>
                                <div class="dungeon-chapter-card-desc">${selectedChapter.description}</div>
                                <div class="dungeon-chapter-card-meta">
                                    <span>关卡数 ${stageCount}</span>
                                    <span>推荐等级 Lv.${selectedChapter.dungeons[0]?.level || 1}</span>
                                </div>
                                <div class="dungeon-chapter-card-tip">点击查看本章关卡</div>
                            </button>
                        ` : '<div class="shelter-empty">暂无章节</div>'}
                        <div class="dungeon-chapter-peek right ${nextChapter ? '' : 'is-hidden'}">
                            ${nextChapter ? `<span>第${nextChapter.index}章</span><strong>${nextChapter.name}</strong>` : ''}
                        </div>
                        <button class="dungeon-chapter-arrow ${nextChapter ? '' : 'is-hidden'}" ${nextChapter ? `onclick="window.game.ui.dungeonView.switchChapterByOffset(1)"` : ''}>›</button>
                    </div>
                </div>
            </div>
        `;
        this.refreshMonsterCodexModal();
    };
})();
