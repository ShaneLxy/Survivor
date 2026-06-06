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
        this.codexPortraitCache = new Set();
        this.expandedCodexEntries = new Set();
        this.codexAdvancedStatsExpanded = new Set();
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

    getStageCodexEntries(dungeon) {
        if (!dungeon || typeof dungeon.getAllEnemyEntries !== 'function') {
            return [];
        }

        return dungeon.getAllEnemyEntries().map((entry, index) => {
            const config = DungeonConfig.getEnemyConfig(entry.id) || {};
            const rank = DungeonConfig.getEnemyEntryRank(entry, config);
            const stats = DungeonConfig.resolveEnemyEntryStats(entry, dungeon.level) || {};
            const skills = DungeonConfig.resolveEnemyEntrySkills(entry, config);
            const codexKey = `${dungeon.id}:${rank}:${entry.id}:${entry.waveId || entry.sourceType || 'initial'}:${index}`;
            return {
                ...entry,
                id: entry.id,
                codexKey,
                name: entry.name || config.name || entry.id,
                icon: config.icon || entry.icon || '?',
                portrait: entry.portrait || config.portrait || null,
                rank,
                rankLabel: DungeonConfig.getEnemyRankLabel(rank),
                unlocked: true,
                previewLevel: dungeon.level,
                unlockLevel: dungeon.level,
                stats,
                skills,
                skill: skills[0] || null,
                description: entry.description || config.description || '该敌人暂无战术描述。',
                count: Math.max(1, Number(entry.count) || 1),
                dungeons: [{ id: dungeon.id, name: dungeon.name, level: dungeon.level }]
            };
        });
    }

    getStageCodexCache(dungeon) {
        const entries = this.getStageCodexEntries(dungeon);
        return this.getCodexTabConfigs().reduce((cache, tab) => {
            cache[tab.key] = entries.filter((entry) => entry.rank === tab.key);
            return cache;
        }, { normal: [], elite: [], boss: [] });
    }

    setMonsterCodexContext(dungeonId = null) {
        this.codexDungeonId = dungeonId || null;
        const dungeon = dungeonId ? dungeonManager.getDungeon(dungeonId) : null;
        this.codexCache = dungeon
            ? this.getStageCodexCache(dungeon)
            : dungeonManager.getMonsterCompendium(window.game.player.level);
        this.codexStageName = dungeon?.name || '';
        if (!this.getCurrentCodexEntries().length) {
            const firstTabWithEntries = this.getCodexTabConfigs().find((tab) => (this.codexCache?.[tab.key] || []).length > 0);
            this.activeCodexTab = firstTabWithEntries?.key || 'normal';
        }
        return dungeon;
    }

    getCurrentCodexEntries() {
        return this.codexCache?.[this.activeCodexTab] || [];
    }

    ensureActiveCodexSelection(preferredEnemyId = null) {
        const entries = this.getCurrentCodexEntries();
        const preferred = preferredEnemyId
            ? entries.find(entry => (entry.codexKey === preferredEnemyId || entry.id === preferredEnemyId) && entry.unlocked)
            : null;
        if (preferred) {
            this.activeCodexEnemyId = preferred.codexKey || preferred.id;
            return preferred;
        }
        const active = entries.find(entry => (entry.codexKey || entry.id) === this.activeCodexEnemyId && entry.unlocked);
        if (active) {
            return active;
        }
        const firstUnlocked = entries.find(entry => entry.unlocked);
        this.activeCodexEnemyId = firstUnlocked ? (firstUnlocked.codexKey || firstUnlocked.id) : null;
        return firstUnlocked || null;
    }

    getActiveCodexEntry() {
        return this.ensureActiveCodexSelection();
    }

    openMonsterCodexModal(initialEnemyId = null, dungeonId = null) {
        this.setMonsterCodexContext(dungeonId || this.codexDungeonId || null);
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
            return '<div class="mcdx-empty">当前分类暂无怪物</div>';
        }

        return entries.map((entry) => this.renderCodexCard(entry)).join('');
    }

    renderCodexCard(entry) {
        const key = entry.codexKey || entry.id;
        const isExpanded = entry.unlocked && this.expandedCodexEntries.has(key);
        const tags = this.getEnemyTagList(entry);
        const status = entry.unlocked
            ? (isExpanded ? '收起 ▲' : '展开 ▼')
            : `需要 Lv.${entry.unlockLevel}`;
        const headerOnClick = entry.unlocked
            ? `onclick="window.game.ui.dungeonView.toggleCodexEntry('${key}')"`
            : '';
        const meta = entry.unlocked
            ? `Lv.${entry.previewLevel} · ${entry.rankLabel}${entry.count ? ` ×${entry.count}` : ''}`
            : '未识别目标';
        const tagsMarkup = (entry.unlocked && tags.length)
            ? `<div class="mcdx-card-tags">${tags.map((t) => `<span class="mcdx-tag mcdx-tag-${t.kind}">${t.label}</span>`).join('')}</div>`
            : '';

        return `
            <div class="mcdx-card ${entry.rank} ${entry.unlocked ? 'is-unlocked' : 'is-locked'} ${isExpanded ? 'is-expanded' : ''}">
                <button type="button" class="mcdx-card-head" ${headerOnClick} ${entry.unlocked ? '' : 'disabled'}>
                    ${this.getMonsterPortraitMarkup(entry, 'mcdx-card-thumb')}
                    <div class="mcdx-card-summary">
                        <div class="mcdx-card-name-row">
                            <span class="mcdx-card-name">${entry.unlocked ? entry.name : '未知目标'}</span>
                            <span class="mcdx-rank-badge ${entry.rank}">${entry.rankLabel}</span>
                        </div>
                        <div class="mcdx-card-meta">${meta}</div>
                        ${tagsMarkup}
                    </div>
                    <span class="mcdx-card-state">${status}</span>
                </button>
                ${isExpanded ? `<div class="mcdx-card-body">${this.getMonsterDetailContent(entry)}</div>` : ''}
            </div>
        `;
    }

    getEnemyTagList(entry) {
        const stats = entry.stats || {};
        const tags = [];
        const range = Number(stats.attackRange) || 0;
        if (range >= 4) tags.push({ kind: 'range', label: '远程' });
        else if (range >= 2) tags.push({ kind: 'range', label: '中距离' });
        else tags.push({ kind: 'range', label: '近战' });

        const move = Number(stats.moveRange) || 0;
        if (move >= 4) tags.push({ kind: 'mobility', label: '高机动' });
        else if (move <= 1) tags.push({ kind: 'mobility', label: '迟缓' });

        const skills = Array.isArray(entry.skills) ? entry.skills : (entry.skill ? [entry.skill] : []);
        const desc = skills.map((s) => `${s?.name || ''} ${s?.description || ''}`).join(' ').toLowerCase();
        if (/范围|aoe|群体|爆裂|冲击波/.test(desc)) tags.push({ kind: 'skill', label: '范围' });
        if (/眩晕|减速|定身|束缚|沉默|控制/.test(desc)) tags.push({ kind: 'skill', label: '控制' });
        if (/治疗|回复|护盾|增益|加血/.test(desc)) tags.push({ kind: 'skill', label: '支援' });
        if (/燃烧|中毒|流血|灼烧|腐蚀|debuff|减益/.test(desc)) tags.push({ kind: 'skill', label: '持续伤害' });

        return tags.slice(0, 3);
    }

    toggleCodexEntry(key) {
        if (!key) return;
        if (this.expandedCodexEntries.has(key)) {
            this.expandedCodexEntries.delete(key);
            this.codexAdvancedStatsExpanded.delete(key);
        } else {
            this.expandedCodexEntries.add(key);
        }
        this.activeCodexEnemyId = key;
        this.refreshMonsterCodexModal();
    }

    toggleCodexAdvancedStats(key) {
        if (!key) return;
        if (this.codexAdvancedStatsExpanded.has(key)) {
            this.codexAdvancedStatsExpanded.delete(key);
        } else {
            this.codexAdvancedStatsExpanded.add(key);
        }
        this.refreshMonsterCodexModal();
        if (this.codexAdvancedStatsExpanded.has(key)) {
            requestAnimationFrame(() => {
                const list = document.querySelector('.mcdx-list');
                const adv = document.querySelector('.mcdx-card.is-expanded .mcdx-stat-advanced');
                if (list && adv) {
                    const listRect = list.getBoundingClientRect();
                    const advRect = adv.getBoundingClientRect();
                    const delta = advRect.bottom - listRect.bottom + 12;
                    if (delta > 0) list.scrollTop += delta;
                }
            });
        }
    }

    getMonsterCodexModalContent() {
        const entries = this.getCurrentCodexEntries();
        this.ensureActiveCodexSelection();
        const tabConfigs = this.getCodexTabConfigs();
        const overview = this.getCodexOverview();
        this.preloadMonsterCodexPortraits();
        const title = this.codexDungeonId ? '本关怪物图鉴' : '怪物图鉴';
        return `
            <div class="mcdx-shell">
                <div class="mcdx-header">
                    <div class="mcdx-header-title">${title}</div>
                    <div class="mcdx-header-progress">已识别 <strong>${overview.unlocked}</strong>/${overview.total}</div>
                </div>
                <div class="mcdx-tabs">
                    ${tabConfigs.map((tab) => {
                        const stats = this.getCodexTabStats(tab.key);
                        return `
                            <button type="button" class="mcdx-tab ${tab.key} ${this.activeCodexTab === tab.key ? 'is-active' : ''}"
                                onclick="window.game.ui.dungeonView.switchCodexTab('${tab.key}', true)">
                                <span class="mcdx-tab-label">${tab.label}</span>
                                <span class="mcdx-tab-count">${stats.unlocked}/${stats.total}</span>
                            </button>
                        `;
                    }).join('')}
                </div>
                <div class="mcdx-list">
                    ${this.getMonsterCodexListMarkup(entries)}
                </div>
            </div>
        `;
    }


    getMonsterCodexModalContent_LEGACY_UNUSED() {
        const entries = this.getCurrentCodexEntries();
        const activeEntry = this.ensureActiveCodexSelection();
        const tabConfigs = this.getCodexTabConfigs();
        const overview = this.getCodexOverview();
        const activeTabStats = this.getCodexTabStats(this.activeCodexTab);
        this.preloadMonsterCodexPortraits();
        const title = this.codexDungeonId ? '本关怪物图鉴' : '怪物图鉴';
        const subtitle = this.codexDungeonId
            ? `${this.codexStageName || '当前关卡'}的敌人属性与技能来自该关卡配置。`
            : '记录副本敌方单位、威胁等级与专属技能，未开放内容将保持封锁状态。';
        return `
            <div class="monster-codex-modal-layout">
                <div class="monster-codex-command-header">
                    <div class="monster-codex-logo" aria-hidden="true">
                        <span>MC</span>
                    </div>
                    <div class="monster-codex-heading">
                        <div class="monster-codex-kicker">MONSTER CODEX</div>
                        <div class="monster-codex-title">${title}</div>
                        <div class="monster-codex-subtitle">${subtitle}</div>
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
        const skills = Array.isArray(entry.skills) && entry.skills.length ? entry.skills : (entry.skill ? [entry.skill] : []);
        const key = entry.codexKey || entry.id;
        const advancedExpanded = this.codexAdvancedStatsExpanded.has(key);
        const combatTip = entry.combatTip
            || (entry.config && entry.config.combatTip)
            || this.getAutoCombatTip(entry);

        const tagsRow = (() => {
            const tags = this.getEnemyTagList(entry);
            if (!tags.length) return '';
            return `<div class="mcdx-detail-tags">${tags.map((t) => `<span class="mcdx-tag mcdx-tag-${t.kind}">${t.label}</span>`).join('')}</div>`;
        })();

        const skillsMarkup = skills.length
            ? skills.map((skill) => {
                const skillTags = this.getSkillTypeTags(skill);
                const name = skill?.name || skill?.id || '未命名技能';
                const desc = skill?.description || '暂无描述';
                return `
                    <div class="mcdx-skill-card">
                        <div class="mcdx-skill-head">
                            <span class="mcdx-skill-name">${name}</span>
                            ${skillTags.map((t) => `<span class="mcdx-tag mcdx-tag-${t.kind}">${t.label}</span>`).join('')}
                        </div>
                        <div class="mcdx-skill-desc">${desc}</div>
                    </div>
                `;
            }).join('')
            : '<div class="mcdx-skill-empty">该怪物无专属技能</div>';

        return `
            <div class="mcdx-detail ${entry.rank}">
                <div class="mcdx-detail-hero">
                    ${this.getMonsterPortraitMarkup(entry, `mcdx-detail-portrait ${entry.rank}`)}
                    <div class="mcdx-detail-hero-overlay">
                        <div class="mcdx-detail-name-row">
                            <span class="mcdx-detail-name">${entry.name}</span>
                            <span class="mcdx-rank-badge ${entry.rank}">${entry.rankLabel}</span>
                        </div>
                        ${tagsRow}
                    </div>
                </div>

                <div class="mcdx-detail-desc">${entry.description || '该敌人暂无战术描述。'}</div>
                ${combatTip ? `<div class="mcdx-detail-tip"><span class="mcdx-tip-icon">⚠</span><span class="mcdx-tip-text">${combatTip}</span></div>` : ''}

                <div class="mcdx-stat-row">
                    ${this.buildCoreStatCell('HP', stats.hp || 0)}
                    ${this.buildCoreStatCell('ATK', stats.attack || 0)}
                    ${this.buildCoreStatCell('DEF', stats.defense || 0)}
                    ${this.buildCoreStatCell('SPD', stats.speed || 0)}
                </div>
                <button type="button" class="mcdx-stat-toggle" onclick="window.game.ui.dungeonView.toggleCodexAdvancedStats('${key}')">
                    ${advancedExpanded ? '收起详细数值 ▲' : '详细数值 ▼'}
                </button>
                ${advancedExpanded ? `
                <div class="mcdx-stat-advanced">
                    ${this.buildAdvancedStatCell('暴击', stats.crit || 0)}
                    ${this.buildAdvancedStatCell('抗暴', stats.antiCrit || 0)}
                    ${this.buildAdvancedStatCell('破防', stats.defensePen || 0)}
                    ${this.buildAdvancedStatCell('命中', stats.accuracy || 0)}
                    ${this.buildAdvancedStatCell('闪避', stats.dodge || 0)}
                    ${this.buildAdvancedStatCell('攻距', stats.attackRange || 0)}
                    ${this.buildAdvancedStatCell('移距', stats.moveRange || 0)}
                </div>
                ` : ''}

                <div class="mcdx-skill-section">
                    <div class="mcdx-skill-title">⚡ 专属技能</div>
                    ${skillsMarkup}
                </div>
            </div>
        `;
    }

    buildCoreStatCell(label, value) {
        return `
            <div class="mcdx-stat-cell">
                <span class="mcdx-stat-label">${label}</span>
                <strong class="mcdx-stat-value">${value}</strong>
            </div>
        `;
    }

    buildAdvancedStatCell(label, value) {
        return `
            <div class="mcdx-stat-adv-cell">
                <span>${label}</span>
                <strong>${value}</strong>
            </div>
        `;
    }

    getSkillTypeTags(skill) {
        const text = `${skill?.name || ''} ${skill?.description || ''}`.toLowerCase();
        const tags = [];
        if (/范围|aoe|群体|爆裂|冲击波/.test(text)) tags.push({ kind: 'skill', label: '范围' });
        if (/眩晕|减速|定身|束缚|沉默|控制/.test(text)) tags.push({ kind: 'skill', label: '控制' });
        if (/治疗|回复|护盾|增益/.test(text)) tags.push({ kind: 'skill', label: '支援' });
        if (/燃烧|中毒|流血|灼烧|腐蚀|debuff|减益/.test(text)) tags.push({ kind: 'skill', label: '持续' });
        if (/冲锋|位移|突进|拉扯|击退/.test(text)) tags.push({ kind: 'skill', label: '位移' });
        return tags.slice(0, 2);
    }

    getAutoCombatTip(entry) {
        const stats = entry.stats || {};
        const range = Number(stats.attackRange) || 0;
        const move = Number(stats.moveRange) || 0;
        if (entry.rank === 'boss') {
            return '高威胁领主，优先集火击杀，注意其专属技能节奏。';
        }
        if (range >= 4) {
            return '远程单位，安排前排吸引仇恨后再切入。';
        }
        if (range <= 1 && move >= 4) {
            return '高速近战，远程英雄保持距离避免被贴脸。';
        }
        if (entry.rank === 'elite') {
            return '精英目标，建议集中输出尽快清除。';
        }
        return '';
    }

    openMonsterDetail(enemyId, dungeonId = null) {
        this.openMonsterCodexModal(enemyId, dungeonId);
    }

    getMonsterPortraitMarkup(entry, className) {
        if (!entry?.unlocked) {
            return `<span class="${className}">?</span>`;
        }
        if (entry.portrait) {
            return `<span class="${className} has-portrait"><img src="${entry.portrait}" alt="${entry.name || '怪物'}" loading="eager" decoding="async"></span>`;
        }
        return `<span class="${className}">${entry.icon || '?'}</span>`;
    }

    preloadMonsterCodexPortraits() {
        if (typeof Image === 'undefined') {
            return;
        }
        Object.values(this.codexCache || {}).flat().forEach((entry) => {
            if (!entry?.portrait || this.codexPortraitCache.has(entry.portrait)) {
                return;
            }
            const image = new Image();
            image.src = entry.portrait;
            this.codexPortraitCache.add(entry.portrait);
        });
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
        return GameConfig.calculateCombatPower(stats);
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
