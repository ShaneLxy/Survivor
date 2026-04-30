/**
 * 副本场景视图
 */
class DungeonView {
    constructor() {
        this.element = document.getElementById('main-display');
        this.visible = false;
        this.activeCodexTab = 'normal';
        this.codexCache = null;
        this.codexModal = null;
        this.activeCodexEnemyId = null;
    }

    show() {
        this.visible = true;
        this.render();
    }

    hide() {
        this.visible = false;
        this.element.innerHTML = '';
    }

    getSceneMediaMarkup(sceneKey) {
        const mediaConfig = window.GameSceneBackgrounds?.[sceneKey];
        if (!mediaConfig?.src) {
            return '';
        }
        if (mediaConfig.type === 'video') {
            const poster = mediaConfig.poster ? ` poster="${mediaConfig.poster}"` : '';
            const mimeType = mediaConfig.mimeType || 'video/mp4';
            const mobileFallbackSrc = mediaConfig.mobileFallbackSrc
                ? ` data-mobile-fallback-src="${mediaConfig.mobileFallbackSrc}"`
                : '';
            return `
                <video
                    class="scene-loop-media"
                    autoplay
                    muted
                    loop
                    playsinline
                    webkit-playsinline="true"
                    x5-playsinline="true"
                    x5-video-player-type="h5-page"
                    x5-video-player-fullscreen="false"
                    x-webkit-airplay="deny"
                    disablepictureinpicture
                    controlslist="nofullscreen nodownload noremoteplayback"
                    preload="auto"${poster}${mobileFallbackSrc}>
                    <source src="${mediaConfig.src}" type="${mimeType}">
                </video>
            `;
        }
        return `<img class="scene-loop-media" src="${mediaConfig.src}" alt="">`;
    }

    render() {
        this.codexCache = dungeonManager.getMonsterCompendium(window.game.player.level);
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
                    <div class="dungeon-header-bar">
                        <h2 class="dungeon-title">副本探索</h2>
                        <button class="btn btn-secondary" onclick="window.game.ui.dungeonView.openMonsterCodexModal()">怪物图鉴</button>
                    </div>
                    <div id="dungeon-list" class="dungeon-list"></div>
                </div>
            </div>
        `;
        this.renderDungeons();
        this.refreshMonsterCodexModal();
    }

    renderDungeons() {
        const list = this.element.querySelector('#dungeon-list');
        const playerLevel = window.game.player.level;
        const dungeons = dungeonManager.getDungeonsByLevel(playerLevel);
        list.innerHTML = '';
        if (dungeons.length === 0) {
            list.innerHTML = '<div style="text-align:center;color:#a0a0a0;">暂无可用副本</div>';
            return;
        }
        dungeons.forEach(dungeon => list.appendChild(this.createDungeonCard(dungeon)));
    }

    getCurrentCodexEntries() {
        return this.codexCache?.[this.activeCodexTab] || [];
    }

    ensureActiveCodexSelection(preferredEnemyId = null) {
        const entries = this.getCurrentCodexEntries();
        const preferred = preferredEnemyId ? entries.find(entry => entry.id === preferredEnemyId && entry.unlocked) : null;
        if (preferred) {
            this.activeCodexEnemyId = preferred.id;
            return preferred;
        }
        const active = entries.find(entry => entry.id === this.activeCodexEnemyId && entry.unlocked);
        if (active) {
            return active;
        }
        const firstUnlocked = entries.find(entry => entry.unlocked);
        this.activeCodexEnemyId = firstUnlocked?.id || null;
        return firstUnlocked || null;
    }

    getActiveCodexEntry() {
        return this.ensureActiveCodexSelection();
    }

    openMonsterCodexModal(initialEnemyId = null) {
        this.codexCache = dungeonManager.getMonsterCompendium(window.game.player.level);
        this.ensureActiveCodexSelection(initialEnemyId);
        if (this.codexModal?.isShown()) {
            this.refreshMonsterCodexModal();
            return;
        }

        this.codexModal = new Modal({
            className: 'monster-codex-modal-shell',
            title: '敌方情报终端',
            content: this.getMonsterCodexModalContent(),
            buttons: [{ text: '关闭', className: 'btn-secondary', onClick: () => this.codexModal?.close() }],
            onClose: () => {
                this.codexModal = null;
            }
        });
        this.codexModal.show();
    }

    refreshMonsterCodexModal() {
        if (!this.codexModal?.isShown()) {
            return;
        }
        this.codexModal.setContent(this.getMonsterCodexModalContent());
    }

    switchCodexTab(tab, fromModal = false) {
        this.activeCodexTab = tab;
        this.ensureActiveCodexSelection();
        if (fromModal) {
            this.refreshMonsterCodexModal();
            return;
        }
        this.render();
    }

    selectMonsterCodexEntry(enemyId) {
        this.activeCodexEnemyId = enemyId;
        this.refreshMonsterCodexModal();
    }

    getCodexTabConfigs() {
        return [
            { key: 'normal', label: '普通', code: 'NORMAL', shortCode: 'N' },
            { key: 'elite', label: '精英', code: 'ELITE', shortCode: 'E' },
            { key: 'boss', label: '领主', code: 'LORD', shortCode: 'B' }
        ];
    }

    getCodexTabStats(tab) {
        const entries = this.codexCache?.[tab] || [];
        const unlocked = entries.filter((entry) => entry.unlocked).length;
        return {
            total: entries.length,
            unlocked
        };
    }

    getCodexOverview() {
        return this.getCodexTabConfigs().reduce((summary, tab) => {
            const stats = this.getCodexTabStats(tab.key);
            summary.total += stats.total;
            summary.unlocked += stats.unlocked;
            return summary;
        }, { total: 0, unlocked: 0 });
    }

    getMonsterThreatLabel(rank) {
        if (rank === 'boss') {
            return '高危领主';
        }
        if (rank === 'elite') {
            return '精英威胁';
        }
        return '常规目标';
    }

    getMonsterCodexListMarkup(entries) {
        if (entries.length === 0) {
            return '<div class="monster-codex-empty">当前分类暂无怪物</div>';
        }

        return entries.map(entry => `
            <button type="button" class="monster-codex-list-item ${entry.rank} ${entry.unlocked ? 'is-unlocked' : 'is-locked'} ${entry.id === this.activeCodexEnemyId ? 'is-active' : ''}"
                ${entry.unlocked ? `onclick="window.game.ui.dungeonView.selectMonsterCodexEntry('${entry.id}')"` : 'disabled'}>
                <span class="monster-codex-list-icon">${entry.unlocked ? entry.icon : '?'}</span>
                <span class="monster-codex-list-main">
                    <span class="monster-codex-list-name">${entry.unlocked ? entry.name : '未知目标'}</span>
                    <span class="monster-codex-list-meta">${entry.unlocked ? `Lv.${entry.previewLevel} · ${entry.rankLabel}` : `需要 Lv.${entry.unlockLevel}`}</span>
                </span>
                <span class="monster-codex-list-status">${entry.unlocked ? '已识别' : '封锁'}</span>
            </button>
        `).join('');
    }

    getMonsterCodexModalContent() {
        const entries = this.getCurrentCodexEntries();
        const activeEntry = this.ensureActiveCodexSelection();
        const tabConfigs = this.getCodexTabConfigs();
        const overview = this.getCodexOverview();
        const activeTabStats = this.getCodexTabStats(this.activeCodexTab);
        return `
            <div class="monster-codex-modal-layout">
                <div class="monster-codex-command-header">
                    <div class="monster-codex-logo" aria-hidden="true">
                        <span>MC</span>
                    </div>
                    <div class="monster-codex-heading">
                        <div class="monster-codex-kicker">MONSTER CODEX</div>
                        <div class="monster-codex-title">怪物图鉴</div>
                        <div class="monster-codex-subtitle">记录副本敌方单位、威胁等级与专属技能，未开放内容将保持封锁状态。</div>
                    </div>
                    <div class="monster-codex-header-metrics">
                        <div class="monster-codex-header-metric">
                            <strong>${overview.unlocked}/${overview.total}</strong>
                            <span>总识别</span>
                        </div>
                        <div class="monster-codex-header-metric">
                            <strong>${activeTabStats.unlocked}/${activeTabStats.total}</strong>
                            <span>当前分类</span>
                        </div>
                    </div>
                </div>
                <div class="monster-codex-modal-left">
                    <div class="monster-codex-tabs">
                        ${tabConfigs.map((tab) => {
                            const stats = this.getCodexTabStats(tab.key);
                            return `
                                <button type="button" class="monster-codex-tab ${tab.key} ${this.activeCodexTab === tab.key ? 'is-active' : ''}"
                                    onclick="window.game.ui.dungeonView.switchCodexTab('${tab.key}', true)">
                                    <span class="monster-codex-tab-code">${tab.shortCode}</span>
                                    <span class="monster-codex-tab-main">
                                        <span>${tab.label}</span>
                                        <strong>${stats.unlocked}/${stats.total}</strong>
                                    </span>
                                </button>
                            `;
                        }).join('')}
                    </div>
                    <div class="monster-codex-entry-heading">
                        <span>情报索引</span>
                        <strong>${activeTabStats.unlocked} 已识别</strong>
                    </div>
                    <div class="monster-codex-entry-list">
                        ${this.getMonsterCodexListMarkup(entries)}
                    </div>
                </div>
                <div class="monster-codex-modal-right">
                    ${activeEntry ? this.getMonsterDetailContent(activeEntry) : '<div class="monster-codex-empty monster-codex-empty-panel">当前分类还没有已解锁怪物</div>'}
                </div>
            </div>
        `;
    }

    getMonsterDetailContent(entry) {
        const stats = entry.stats || {};
        const dungeonText = entry.dungeons.map(item => `${item.name} Lv.${item.level}`).join('、');
        const skillName = entry.skill?.name || '无';
        const skillDescription = entry.skill?.description || '该怪物暂无专属技能。';
        const power = this.calculateMonsterPower(stats);
        return `
            <div class="monster-detail-panel monster-detail-panel-inline ${entry.rank}">
                <div class="monster-detail-header">
                    <div class="monster-detail-icon-wrap">
                        <div class="monster-detail-icon ${entry.rank}">${entry.icon}</div>
                        <div class="monster-detail-threat">${this.getMonsterThreatLabel(entry.rank)}</div>
                    </div>
                    <div class="monster-detail-main">
                        <div class="monster-detail-kicker">ENEMY FILE</div>
                        <div class="monster-detail-name-row">
                            <div class="monster-detail-name">${entry.name}</div>
                            <span class="monster-rank-badge ${entry.rank}">${entry.rankLabel}</span>
                        </div>
                        <div class="monster-detail-tags">
                            <span class="monster-rank-badge neutral">副本强度 Lv.${entry.previewLevel}</span>
                            <span class="monster-rank-badge neutral">战术档案</span>
                        </div>
                        <div class="monster-detail-desc">${entry.description}</div>
                    </div>
                    <div class="monster-detail-power">
                        <span>战力评估</span>
                        <strong>${power}</strong>
                    </div>
                </div>
                <div class="monster-detail-intel-strip">
                    <div class="monster-detail-intel-item">
                        <span>出现副本</span>
                        <strong>${dungeonText || '未知区域'}</strong>
                    </div>
                    <div class="monster-detail-intel-item">
                        <span>攻击距离</span>
                        <strong>${stats.attackRange || 0}</strong>
                    </div>
                    <div class="monster-detail-intel-item">
                        <span>移动距离</span>
                        <strong>${stats.moveRange || 0}</strong>
                    </div>
                </div>
                <div class="monster-detail-stats">
                    ${this.buildMonsterStatItem('生命', `${stats.hp || 0}`, 'is-core')}
                    ${this.buildMonsterStatItem('攻击', `${stats.attack || 0}`, 'is-core')}
                    ${this.buildMonsterStatItem('防御', `${stats.defense || 0}`, 'is-core')}
                    ${this.buildMonsterStatItem('速度', `${stats.speed || 0}`)}
                    ${this.buildMonsterStatItem('暴击', `${stats.crit || 0}`)}
                    ${this.buildMonsterStatItem('抗暴', `${stats.antiCrit || 0}`)}
                    ${this.buildMonsterStatItem('破防', `${stats.defensePen || 0}`)}
                    ${this.buildMonsterStatItem('命中', `${stats.accuracy || 0}`)}
                    ${this.buildMonsterStatItem('闪避', `${stats.dodge || 0}`)}
                </div>
                <div class="monster-detail-skill">
                    <div class="monster-detail-skill-kicker">SPECIAL SKILL</div>
                    <div class="monster-detail-skill-title">${skillName}</div>
                    <div class="monster-detail-skill-desc">${skillDescription}</div>
                </div>
            </div>
        `;
    }

    openMonsterDetail(enemyId) {
        this.openMonsterCodexModal(enemyId);
    }

    buildMonsterStatItem(label, value, className = '') {
        return `
            <div class="monster-detail-stat-item ${className}">
                <span>${label}</span>
                <strong>${value}</strong>
            </div>
        `;
    }

    calculateMonsterPower(stats) {
        return Math.floor(
            (Number(stats.attack) || 0) * 2 +
            (Number(stats.defense) || 0) * 1.5 +
            (Number(stats.hp) || 0) * 0.5 +
            (Number(stats.speed) || 0) * 1.2 +
            (Number(stats.crit) || 0) +
            (Number(stats.antiCrit) || 0) +
            (Number(stats.defensePen) || 0) +
            (Number(stats.attackRange) || 0) * 8 +
            (Number(stats.moveRange) || 0) * 6
        );
    }

    createDungeonCard(dungeon) {
        const info = dungeon.getInfo();
        const completed = dungeonManager.isCompleted(dungeon.id);
        const stars = dungeonManager.getStars(dungeon.id);
        const canSweep = dungeonManager.canSweep(dungeon.id);
        const card = document.createElement('div');
        card.className = 'dungeon-item card';
        card.innerHTML = `
            <div class="dungeon-icon">${info.icon}</div>
            <div class="dungeon-info">
                <div class="dungeon-name">${info.name} ${completed ? '(已完成)' : ''}</div>
                <div class="dungeon-level">推荐等级: ${info.level} | 体力消耗: ${info.energyCost}</div>
                <div class="dungeon-reward">怪物总数: ${info.enemyCount}（含领主）</div>
                <div style="color:#ffd700;">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
            </div>
            <div class="dungeon-card-actions">
                <button class="btn btn-primary" onclick="window.game.ui.dungeonView.enterDungeon('${dungeon.id}')">战斗</button>
                <button class="btn ${canSweep ? 'btn-success' : 'btn-secondary'}" ${canSweep ? '' : 'disabled'} onclick="window.game.ui.dungeonView.sweepDungeon('${dungeon.id}')">扫荡</button>
            </div>
        `;
        return card;
    }

    consumeEnergyForDungeon(dungeon) {
        if (window.game.player.energy < dungeon.energyCost) {
            Toast.error(`体力不足，需要 ${dungeon.energyCost}`);
            return false;
        }
        window.game.player.energy -= dungeon.energyCost;
        eventManager.emit('playerUpdate', {
            energy: window.game.player.energy,
            maxEnergy: window.game.player.maxEnergy
        });
        return true;
    }

    enterDungeon(dungeonId) {
        const dungeon = dungeonManager.getDungeon(dungeonId);
        if (!dungeon) {
            Toast.error('副本不存在');
            return;
        }
        const accessibility = typeof this.getDungeonAccessibility === 'function'
            ? this.getDungeonAccessibility(dungeonId)
            : { accessible: true, message: '' };
        if (!accessibility.accessible) {
            Toast.error(accessibility.message || '当前副本尚未解锁');
            return;
        }
        if (heroManager.getTeam().length === 0) {
            Toast.error('请先配置参战英雄');
            return;
        }
        if (!this.consumeEnergyForDungeon(dungeon)) {
            return;
        }
        this.chapterStageModal = null;
        this.codexModal = null;
        Modal.closeAll();
        window.game.save();
        eventManager.emit('enterBattle', { dungeonId, sceneId: dungeon.sceneId });
    }

    async sweepDungeon(dungeonId) {
        const dungeon = dungeonManager.getDungeon(dungeonId);
        if (!dungeon) {
            Toast.error('副本不存在');
            return;
        }
        const accessibility = typeof this.getDungeonAccessibility === 'function'
            ? this.getDungeonAccessibility(dungeonId)
            : { accessible: true, message: '' };
        if (!accessibility.accessible) {
            Toast.error(accessibility.message || '当前副本尚未解锁');
            return;
        }
        if (!dungeonManager.canSweep(dungeonId)) {
            Toast.info('首次通关后才能扫荡');
            return;
        }
        const teamIds = heroManager.getTeamIds();
        if (teamIds.length === 0) {
            Toast.error('请先配置参战英雄');
            return;
        }
        if (!this.consumeEnergyForDungeon(dungeon)) {
            return;
        }

        const rewardResult = window.game.grantDungeonVictoryRewards(dungeon, teamIds);
        await RewardModal.show({
            title: '扫荡完成',
            rewards: rewardResult.rewardEntries,
            summaryText: '无需进入战斗场景，已直接结算本次副本奖励'
        });
        this.refresh();
    }

    refresh() {
        if (this.visible) {
            this.render();
        }
        this.refreshMonsterCodexModal();
    }
}

const dungeonView = new DungeonView();
window.dungeonView = dungeonView;
