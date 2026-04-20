(function() {
    if (typeof DungeonView === 'undefined' || !window.dungeonView) {
        return;
    }

    DungeonView.prototype.ensureSelectedDungeon = function(dungeons) {
        if (!Array.isArray(dungeons) || dungeons.length === 0) {
            this.selectedDungeonId = null;
            return null;
        }
        const current = dungeons.find((dungeon) => dungeon.id === this.selectedDungeonId);
        if (current) {
            return current;
        }
        this.selectedDungeonId = dungeons[0].id;
        return dungeons[0];
    };

    DungeonView.prototype.selectDungeon = function(dungeonId) {
        this.selectedDungeonId = dungeonId;
        this.render();
    };

    DungeonView.prototype.getDungeonRewardPreview = function(dungeon) {
        const rewardLines = [];
        if (dungeon.rewards?.gold) {
            rewardLines.push(`金币 ${dungeon.rewards.gold.min}-${dungeon.rewards.gold.max}`);
        }
        if (dungeon.rewards?.exp) {
            rewardLines.push(`经验 ${dungeon.rewards.exp.min}-${dungeon.rewards.exp.max}`);
        }
        (dungeon.rewards?.items || []).forEach((item) => {
            const name = shelterManager.isResourceType(item.id)
                ? shelterManager.getResourceDisplayName(item.id)
                : (ItemConfig.getItemConfig(item.id)?.name || item.id);
            rewardLines.push(`${name} ${Math.round((item.chance || 0) * 100)}%`);
        });
        return rewardLines;
    };

    DungeonView.prototype.getDungeonEnemyPreview = function(dungeon) {
        const entries = dungeon.getAllEnemyEntries().slice(0, 4);
        return entries.map((entry) => {
            const config = DungeonConfig.getEnemyConfig(entry.id);
            return {
                id: entry.id,
                icon: config?.icon || '?',
                name: config?.name || entry.id
            };
        });
    };

    DungeonView.prototype.createDungeonRailItem = function(dungeon) {
        const completed = dungeonManager.isCompleted(dungeon.id);
        const stars = dungeonManager.getStars(dungeon.id);
        return `
            <button type="button"
                class="dungeon-rail-item ${this.selectedDungeonId === dungeon.id ? 'is-active' : ''}"
                onclick="window.game.ui.dungeonView.selectDungeon('${dungeon.id}')">
                <span class="dungeon-rail-level">Lv.${dungeon.level}</span>
                <span class="dungeon-rail-name">${dungeon.name}</span>
                <span class="dungeon-rail-meta">${completed ? `已通关 · ${stars}星` : `体力 ${dungeon.energyCost}`}</span>
            </button>
        `;
    };

    DungeonView.prototype.getSelectedDungeonPanel = function(dungeon) {
        const completed = dungeonManager.isCompleted(dungeon.id);
        const stars = dungeonManager.getStars(dungeon.id);
        const canSweep = dungeonManager.canSweep(dungeon.id);
        const rewards = this.getDungeonRewardPreview(dungeon);
        const enemies = this.getDungeonEnemyPreview(dungeon);

        return `
            <div class="dungeon-spotlight card dungeon-theme-${dungeon.id}">
                <div class="dungeon-spotlight-visual">
                    <div class="dungeon-spotlight-badge">${completed ? '已征服区域' : '待探索区域'}</div>
                    <div class="dungeon-spotlight-icon">${dungeon.icon}</div>
                    <div class="dungeon-spotlight-stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
                </div>
                <div class="dungeon-spotlight-content">
                    <div class="dungeon-spotlight-title-row">
                        <div>
                            <div class="dungeon-spotlight-kicker">章节 ${dungeon.level}</div>
                            <h3 class="dungeon-spotlight-title">${dungeon.name}</h3>
                        </div>
                        <div class="dungeon-spotlight-meta">
                            <span>推荐等级 Lv.${dungeon.level}</span>
                            <span>体力 ${dungeon.energyCost}</span>
                            <span>敌人 ${dungeon.getInfo().enemyCount}</span>
                        </div>
                    </div>
                    <div class="dungeon-spotlight-desc">${dungeon.description || '危险仍在蔓延，谨慎推进。'}</div>
                    <div class="dungeon-spotlight-section">
                        <div class="dungeon-spotlight-section-title">敌方预览</div>
                        <div class="dungeon-enemy-preview-row">
                            ${enemies.map((enemy) => `
                                <button type="button" class="dungeon-enemy-chip" onclick="window.game.ui.dungeonView.openMonsterDetail('${enemy.id}')">
                                    <span>${enemy.icon}</span>
                                    <strong>${enemy.name}</strong>
                                </button>
                            `).join('')}
                        </div>
                    </div>
                    <div class="dungeon-spotlight-section">
                        <div class="dungeon-spotlight-section-title">掉落预览</div>
                        <div class="dungeon-reward-preview-row">
                            ${rewards.map((reward) => `<span class="dungeon-reward-chip">${reward}</span>`).join('')}
                        </div>
                    </div>
                    <div class="dungeon-spotlight-actions">
                        <button class="btn btn-primary" onclick="window.game.ui.dungeonView.enterDungeon('${dungeon.id}')">进入战斗</button>
                        <button class="btn ${canSweep ? 'btn-success' : 'btn-secondary'}" ${canSweep ? '' : 'disabled'} onclick="window.game.ui.dungeonView.sweepDungeon('${dungeon.id}')">快速扫荡</button>
                    </div>
                </div>
            </div>
        `;
    };

    DungeonView.prototype.render = function() {
        this.codexCache = dungeonManager.getMonsterCompendium(window.game.player.level);
        const dungeons = dungeonManager.getDungeonsByLevel(window.game.player.level);
        const selectedDungeon = this.ensureSelectedDungeon(dungeons);

        this.element.innerHTML = `
            <div class="scene-view dungeon-view dungeon-scene-view">
                <div class="scene-view-backdrop dungeon-scene-backdrop">
                    ${this.getSceneMediaMarkup('dungeon')}
                    <div class="scene-backdrop-glow scene-backdrop-glow-a"></div>
                    <div class="scene-backdrop-glow scene-backdrop-glow-b"></div>
                    <div class="scene-backdrop-grid"></div>
                </div>
                <div class="scene-view-overlay"></div>
                <div class="scene-view-content">
                    <div class="dungeon-header-bar dungeon-header-bar-patched">
                        <div>
                            <h2 class="dungeon-title">副本探索</h2>
                            <div class="dungeon-subtitle">用章节轨道选择战区，再从主舞台查看掉落、怪物与行动入口。</div>
                        </div>
                        <button class="btn btn-secondary" onclick="window.game.ui.dungeonView.openMonsterCodexModal()">怪物图鉴</button>
                    </div>
                    <div class="dungeon-stage-layout">
                        <div class="dungeon-stage-main">
                            ${selectedDungeon ? this.getSelectedDungeonPanel(selectedDungeon) : '<div class="shelter-empty">暂无可用副本</div>'}
                        </div>
                        <div class="dungeon-stage-rail">
                            <div class="dungeon-stage-rail-title">章节轨道</div>
                            <div class="dungeon-stage-rail-list">
                                ${dungeons.map((dungeon) => this.createDungeonRailItem(dungeon)).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        this.refreshMonsterCodexModal();
    };
})();
