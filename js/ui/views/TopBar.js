class TopBar {
    constructor() {
        this.element = document.getElementById('top-bar');
        this.level = 1;
        this.energy = 100;
        this.maxEnergy = 100;
        this.gold = 0;
        this.diamond = 0;
        this.playerInfoModal = null;
        this.avatarPickerModal = null;
        this.pendingAvatarHeroConfigId = null;
        this.playerInfoSaveTimer = null;
        this.playerInfoSaveDirty = false;
        this.init();
    }

    init() {
        this.create();
        this.setupEvents();
    }

    create() {
        this.element.innerHTML = `
            <button type="button" class="player-avatar topbar-player-chip" id="player-avatar">
                <div class="topbar-player-avatar-image-shell">
                    <div class="avatar-icon topbar-player-avatar-image"></div>
                </div>
                <span class="topbar-player-meta">
                    <span class="topbar-player-kicker" id="topbar-player-name">幸存者</span>
                    <span class="topbar-player-level" id="player-level">Lv.1</span>
                </span>
            </button>
            <div class="topbar-resource-strip">
                <div class="status-item status-item-energy">
                    <span class="status-icon status-icon-energy">⚡</span>
                    <span class="status-value" id="player-energy">100/100</span>
                </div>
                <div class="status-item status-item-gold">
                    <span class="status-icon status-icon-resource status-icon-gold">G</span>
                    <span class="status-value text-gold" id="player-gold">0</span>
                </div>
                <div class="status-item status-item-diamond">
                    <span class="status-icon status-icon-resource status-icon-diamond">◆</span>
                    <span class="status-value text-diamond" id="player-diamond">0</span>
                </div>
            </div>
        `;
        this.avatarElement = this.element.querySelector('#player-avatar');
        this.avatarIconElement = this.element.querySelector('.avatar-icon');
        this.playerNameElement = this.element.querySelector('#topbar-player-name');
        this.levelElement = this.element.querySelector('#player-level');
        this.energyElement = this.element.querySelector('#player-energy');
        this.goldElement = this.element.querySelector('#player-gold');
        this.diamondElement = this.element.querySelector('#player-diamond');
        if (this.avatarElement) {
            this.avatarElement.addEventListener('click', () => this.showPlayerInfo());
        }
        this.renderStatusResourceIcons();
        this.refreshAccountStatus();
    }

    renderStatusResourceIcons() {
        if (!this.element) {
            return;
        }
        const goldIcon = this.element.querySelector('.status-icon-gold');
        const diamondIcon = this.element.querySelector('.status-icon-diamond');
        if (goldIcon) {
            goldIcon.innerHTML = ResourceVisualConfig.getIconMarkup('gold', 'resource-icon-image status-icon-image');
        }
        if (diamondIcon) {
            diamondIcon.innerHTML = ResourceVisualConfig.getIconMarkup('diamond', 'resource-icon-image status-icon-image');
        }
    }

    getPlayerInfoActionMarkup() {
        const isLoggedIn = authService.isLoggedIn();
        if (!isLoggedIn) {
            return `
                <div class="player-info-action-group">
                    <button class="btn btn-primary btn-small" onclick="window.game.ui.topBar.goToLogin()">前往登录</button>
                </div>
            `;
        }

        return `
            <div class="player-info-action-group">
                <button class="btn btn-primary btn-small" onclick="window.game.ui.topBar.uploadCloudSave()">上传云存档</button>
                <button class="btn btn-primary btn-small" onclick="window.game.ui.topBar.downloadCloudSave()">下载云存档</button>
                <button class="btn btn-danger btn-small" onclick="window.game.ui.topBar.logoutAccount()">退出登录</button>
            </div>
        `;
    }

    getPlayerInfoToolsMarkup() {
        return `
            <div class="player-info-tools card">
                <div class="player-info-tools-body">
                    <div class="player-info-cdkey-row">
                        <input
                            type="text"
                            id="player-cdkey-input"
                            class="player-info-input player-cdkey-input"
                            placeholder="输入 CDKEY"
                            autocomplete="off"
                            spellcheck="false"
                        >
                        <button class="btn btn-primary btn-small player-cdkey-btn" onclick="window.game.ui.topBar.redeemCdkey()">获取</button>
                    </div>
                    ${this.getPlayerInfoActionMarkup()}
                </div>
            </div>
        `;
    }

    getPlayerNameMarkup() {
        return `
            <div class="player-info-name-row">
                <div class="player-info-name" id="player-info-name">${this.escapeHtml(window.game.player.nickname || '幸存者')}</div>
                <button
                    type="button"
                    class="player-name-edit-btn"
                    title="修改名称"
                    onclick="window.game.ui.topBar.openNicknameEditor()"
                >✎</button>
            </div>
        `;
    }

    getUnlockedAvatarHeroIds() {
        return new Set(heroManager.getAllHeroes().map(hero => hero.configId));
    }

    getCurrentAvatarHeroConfigId() {
        const unlockedHeroIds = this.getUnlockedAvatarHeroIds();
        const selectedId = window.game?.player?.avatarHeroConfigId || null;
        if (selectedId && unlockedHeroIds.has(selectedId)) {
            return selectedId;
        }
        return heroManager.getAllHeroes()[0]?.configId || null;
    }

    getCurrentAvatarHeroConfig() {
        const configId = this.getCurrentAvatarHeroConfigId();
        return configId ? HeroConfig.getHeroConfig(configId) : null;
    }

    getAvatarMarkup(heroConfig, options = {}) {
        const sizeClass = options.sizeClass || '';
        const fallbackClass = options.fallbackClass || '';
        const portrait = heroConfig?.cardPortrait || heroConfig?.portrait || null;
        if (portrait) {
            return `<div class="player-hero-avatar ${sizeClass}"><img class="player-hero-avatar-image" src="${portrait}" alt="${heroConfig.name || '玩家头像'}" loading="lazy" decoding="async"></div>`;
        }
        return `<div class="player-hero-avatar player-hero-avatar-fallback ${sizeClass} ${fallbackClass}">${heroConfig?.icon || '👤'}</div>`;
    }

    updateTopBarAvatar() {
        if (!this.avatarIconElement) {
            return;
        }
        const heroConfig = this.getCurrentAvatarHeroConfig();
        this.avatarIconElement.innerHTML = this.getAvatarMarkup(heroConfig, {
            sizeClass: 'topbar-player-avatar-circle',
            fallbackClass: 'topbar-player-avatar-fallback'
        });
    }

    updatePlayerAvatarPreview() {
        const preview = document.getElementById('player-avatar-preview');
        if (!preview) {
            return;
        }
        const configId = this.pendingAvatarHeroConfigId || this.getCurrentAvatarHeroConfigId();
        preview.innerHTML = this.getAvatarMarkup(HeroConfig.getHeroConfig(configId), {
            sizeClass: 'player-info-avatar-large'
        });
    }

    openAvatarPicker() {
        if (this.avatarPickerModal?.isShown()) {
            return;
        }

        const unlockedHeroIds = this.getUnlockedAvatarHeroIds();
        const selectedId = this.pendingAvatarHeroConfigId || this.getCurrentAvatarHeroConfigId();
        const content = `
            <div class="player-avatar-picker-grid">
                ${HeroConfig.getAllHeroes().map(heroConfig => {
                    const unlocked = unlockedHeroIds.has(heroConfig.id);
                    const selected = unlocked && heroConfig.id === selectedId;
                    return `
                        <button
                            type="button"
                            class="player-avatar-option ${unlocked ? 'is-unlocked' : 'is-locked'} ${selected ? 'is-selected' : ''}"
                            ${unlocked ? `onclick="window.game.ui.topBar.selectAvatarHero('${heroConfig.id}')"` : 'disabled'}
                            title="${heroConfig.name}"
                        >
                            <div class="player-avatar-option-thumb">
                                ${this.getAvatarMarkup(heroConfig, { sizeClass: 'player-avatar-option-image' })}
                            </div>
                            <div class="player-avatar-option-name">${heroConfig.name}</div>
                        </button>
                    `;
                }).join('')}
            </div>
        `;

        const modal = new Modal({
            title: '选择头像',
            className: 'player-avatar-picker-modal',
            content,
            buttons: [
                { text: '关闭', className: 'btn-secondary', onClick: () => modal.close() }
            ],
            onClose: () => {
                this.avatarPickerModal = null;
            }
        });
        this.avatarPickerModal = modal;
        modal.show();
    }

    selectAvatarHero(configId) {
        this.pendingAvatarHeroConfigId = configId;
        this.updatePlayerAvatarPreview();
        this.applyPlayerInfoDraft();
        this.schedulePlayerInfoSave();
        if (this.avatarPickerModal?.isShown()) {
            this.avatarPickerModal.close();
        }
    }

    getAccountIdMarkup() {
        const user = authService.getCurrentUser();
        const accountId = String(user?.id || user?._id || '').trim();
        const text = accountId || '未登录';
        const copyButton = accountId
            ? '<button type="button" class="btn btn-secondary btn-small player-info-copy-id-btn" onclick="window.game.ui.topBar.copyAccountId()">复制</button>'
            : '';
        return `
            <div class="player-info-stat-inline player-info-account-id">
                <span>账号ID：</span>
                <strong class="player-info-account-value">${this.escapeHtml(text)}</strong>
                ${copyButton}
            </div>
        `;
    }

    async copyAccountId() {
        const user = authService.getCurrentUser();
        const accountId = String(user?.id || user?._id || '').trim();
        if (!accountId) {
            Toast.info('未登录账号');
            return;
        }
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(accountId);
            } else {
                const input = document.createElement('textarea');
                input.value = accountId;
                input.style.position = 'fixed';
                input.style.left = '-9999px';
                document.body.appendChild(input);
                input.select();
                document.execCommand('copy');
                input.remove();
            }
            Toast.success('已复制');
        } catch (error) {
            Toast.error('复制失败');
        }
    }

    showPlayerInfo() {
        this.pendingAvatarHeroConfigId = this.getCurrentAvatarHeroConfigId();
        const modal = new Modal({
            title: '玩家信息',
            className: 'player-info-modal',
            content: `
                <div class="player-info-panel">
                    <div class="player-info-header">
                        <div class="player-info-avatar-column">
                            <div id="player-avatar-preview">${this.getAvatarMarkup(this.getCurrentAvatarHeroConfig(), { sizeClass: 'player-info-avatar-large' })}</div>
                            ${this.getPlayerNameMarkup()}
                        </div>
                        <div class="player-info-meta">
                            <div class="player-info-stats">
                                <div class="player-info-stat-inline">玩家等级：<strong id="info-level">${window.game.player.level}</strong></div>
                                <div class="player-info-stat-inline">玩家经验：<strong><span id="info-exp">${window.game.player.exp}</span>/<span id="info-exp-required">${GameConfig.getExpRequired(window.game.player.level)}</span></strong></div>
                                ${this.getAccountIdMarkup()}
                            </div>
                            <button class="btn btn-secondary btn-small player-avatar-config-btn" onclick="window.game.ui.topBar.openAvatarPicker()">设置头像</button>
                        </div>
                    </div>
                    <div class="player-info-toggle-row">
                        <label class="player-info-toggle ${window.battleManager?.isAutoBattleAllowed?.() ? '' : 'is-disabled'}">
                            <input type="checkbox" id="auto-battle-setting" ${window.game.settings.autoBattle ? 'checked' : ''} ${window.battleManager?.isAutoBattleAllowed?.() ? '' : 'disabled'}>
                            <span>自动战斗${window.battleManager?.isAutoBattleAllowed?.() ? '' : '<em class="player-info-toggle-hint">（需卓越特权）</em>'}</span>
                        </label>
                        <label class="player-info-toggle">
                            <input type="checkbox" id="mute-setting" ${window.game.settings.muted ? 'checked' : ''}>
                            <span>关闭游戏声音</span>
                        </label>
                        <label class="player-info-toggle">
                            <input type="checkbox" id="environment-effects-setting" ${window.game.settings.environmentEffectsDisabled ? 'checked' : ''}>
                            <span>关闭游戏特效</span>
                        </label>
                    </div>
                    ${this.getPlayerInfoToolsMarkup()}
                </div>
            `,
            buttons: [
                { text: '保存', className: 'btn-primary', onClick: () => this.savePlayerInfo(modal) },
                { text: '取消', className: 'btn-secondary', onClick: () => modal.close() }
            ],
            onClose: () => {
                this.playerInfoModal = null;
                this.pendingAvatarHeroConfigId = null;
                if (this.avatarPickerModal?.isShown()) {
                    this.avatarPickerModal.close();
                }
            }
        });
        this.playerInfoModal = modal;
        modal.show();
    }

    openNicknameEditor() {
        const currentName = window.game.player.nickname || '幸存者';
        const modal = new Modal({
            title: '修改名称',
            className: 'player-name-modal',
            content: `
                <div class="player-name-edit-panel">
                    <input
                        type="text"
                        id="player-name-edit-input"
                        class="player-info-input"
                        maxlength="8"
                        value="${this.escapeAttribute(currentName)}"
                        placeholder="请输入玩家名称"
                    >
                </div>
            `,
            buttons: [
                {
                    text: '确认',
                    className: 'btn-primary',
                    onClick: () => {
                        const input = document.getElementById('player-name-edit-input');
                        const value = String(input?.value || '').trim();
                        if (!value || value.length > 8) {
                            Toast.info('玩家名称长度在1-8个字以内');
                            return;
                        }
                        window.game.player.nickname = value;
                        const nameElement = document.getElementById('player-info-name');
                        if (nameElement) {
                            nameElement.textContent = value;
                        }
                        window.game.save();
                        this.refreshAccountStatus();
                        modal.close();
                        Toast.success('名称修改成功');
                    }
                },
                { text: '取消', className: 'btn-secondary', onClick: () => modal.close() }
            ]
        });
        modal.show();
    }

    escapeAttribute(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    savePlayerInfo(modal) {
        const autoBattleCheckbox = document.getElementById('auto-battle-setting');
        const muteCheckbox = document.getElementById('mute-setting');
        const environmentEffectsCheckbox = document.getElementById('environment-effects-setting');

        window.game.player.avatarHeroConfigId = this.pendingAvatarHeroConfigId || this.getCurrentAvatarHeroConfigId();
        if (autoBattleCheckbox) {
            window.game.settings.autoBattle = autoBattleCheckbox.checked;
        }
        if (muteCheckbox) {
            window.game.settings.muted = muteCheckbox.checked;
            audioManager.setMuted(window.game.settings.muted);
        }
        if (environmentEffectsCheckbox) {
            window.game.settings.environmentEffectsDisabled = environmentEffectsCheckbox.checked;
        }

        if (window.game.currentView === 'battle') {
            window.game.ui.battleView.applyAutoBattleSettingChange();
            window.game.ui.battleView.applyEnvironmentEffectSettingChange?.();
        }

        modal.close();
        window.game.save();
        this.refreshAccountStatus();
        Toast.success('设置已保存');
    }

    async redeemCdkey() {
        if (!authService.isLoggedIn()) {
            Toast.error('请先登录账号');
            return;
        }

        const input = document.getElementById('player-cdkey-input');
        const code = String(input?.value || '').trim().toUpperCase();
        if (!code) {
            Toast.info('请输入 CDKEY');
            return;
        }

        try {
            const result = await CdkeyApi.redeem(code);
            if (!result?.success) {
                Toast.info(result?.message || '获取失败');
                return;
            }

            mailManager.applyRewards(result.rewards);
            window.game?.refreshRuntimeUI?.();
            window.game?.save?.();
            if (input) {
                input.value = '';
            }

            const rewardEntries = (Array.isArray(result.rewards) ? result.rewards : []).map((entry) => {
                if (entry.type === 'resource') {
                    return RewardModal.createResourceReward(entry.id, entry.amount);
                }
                if (entry.type === 'fragment' || ItemConfig.getItemConfig(entry.id)?.type === 'fragment') {
                    const heroConfigId = ItemConfig.getItemConfig(entry.id)?.fragmentHeroId || String(entry.id || '').replace(/_fragment$/, '');
                    return RewardModal.createFragmentReward(heroConfigId, entry.amount);
                }
                return RewardModal.createItemReward(entry.id, entry.amount);
            }).filter(Boolean);

            if (rewardEntries.length > 0) {
                await RewardModal.show({
                    title: '获取成功',
                    rewards: rewardEntries,
                    summaryText: result?.cdkey?.title || result?.message || 'CDKEY 已获取'
                });
            } else {
                Toast.success(result?.message || '获取成功');
            }
        } catch (error) {
            Toast.error(error?.message || '获取失败');
        }
    }

    goToLogin() {
        window.game.ui.loginView.show();
    }

    async uploadCloudSave() {
        if (!authService.isLoggedIn()) {
            Toast.error('请先登录账号');
            return;
        }
        const success = await saveSyncService.uploadCurrentSave();
        if (success) {
            Toast.success('云存档上传成功');
        } else {
            Toast.error('云存档上传失败');
        }
    }

    async downloadCloudSave() {
        if (!authService.isLoggedIn()) {
            Toast.error('请先登录账号');
            return;
        }
        try {
            await saveSyncService.downloadRemoteSaveToGame();
            Toast.success('已从云端加载存档');
        } catch (error) {
            Toast.error(error.message || '下载云存档失败');
        }
    }

    logoutAccount() {
        authService.logout();
        window.game.handleLogout();
    }

    setupEvents() {
        eventManager.on('resourceUpdate', data => {
            if (data.type === 'gold') this.updateGold(data.total);
            if (data.type === 'diamond') this.updateDiamond(data.total);
        });
        eventManager.on('playerUpdate', data => {
            if (data.level !== undefined) this.updateLevel(data.level);
            if (data.energy !== undefined) this.updateEnergy(data.energy, data.maxEnergy);
            if (data.nickname !== undefined) this.updatePlayerName();
        });
        eventManager.on('authChange', () => this.refreshAccountStatus());
        eventManager.on('heroAdd', () => this.refreshAccountStatus());
    }

    refreshAccountStatus() {
        this.updateTopBarAvatar();
        this.updatePlayerName();
        if (this.avatarElement) {
            const user = authService.getCurrentUser();
            this.avatarElement.title = authService.isLoggedIn()
                ? `当前已登录：${user?.nickname || user?.account || '账号'}`
                : '点击查看玩家信息';
        }
    }

    getDisplayPlayerName() {
        const user = authService.getCurrentUser?.() || {};
        return String(window.game?.player?.nickname || user.nickname || user.account || '幸存者').trim() || '幸存者';
    }

    updatePlayerName() {
        if (!this.playerNameElement) {
            return;
        }
        const name = this.getDisplayPlayerName();
        this.playerNameElement.textContent = name;
        this.playerNameElement.title = name;
    }

    updateLevel(level) {
        this.level = level;
        if (this.levelElement) {
            this.levelElement.textContent = `Lv.${level}`;
        }
    }

    updateEnergy(energy, maxEnergy) {
        this.energy = energy;
        this.maxEnergy = maxEnergy;
        if (this.energyElement) {
            this.energyElement.textContent = `${energy}/${maxEnergy}`;
        }
    }

    updateGold(gold) {
        this.gold = gold;
        if (this.goldElement) {
            this.goldElement.textContent = Utils.formatNumber(gold);
        }
    }

    updateDiamond(diamond) {
        this.diamond = diamond;
        if (this.diamondElement) {
            this.diamondElement.textContent = Utils.formatNumber(diamond);
        }
    }

    updateAll(data) {
        if (data.level !== undefined) this.updateLevel(data.level);
        if (data.energy !== undefined) this.updateEnergy(data.energy, data.maxEnergy || data.energy);
        if (data.gold !== undefined) this.updateGold(data.gold);
        if (data.diamond !== undefined) this.updateDiamond(data.diamond);
        this.refreshAccountStatus();
    }
}

const topBar = new TopBar();
window.topBar = topBar;

TopBar.prototype.bindPlayerInfoAutoSave = function() {
    const modalElement = this.playerInfoModal?.element;
    if (!modalElement) {
        return;
    }
    ['auto-battle-setting', 'mute-setting', 'environment-effects-setting'].forEach((id) => {
        const input = modalElement.querySelector(`#${id}`);
        if (input) {
            input.addEventListener('change', () => {
                this.applyPlayerInfoDraft();
                this.schedulePlayerInfoSave();
            });
        }
    });
};

TopBar.prototype.applyPlayerInfoDraft = function() {
    const autoBattleCheckbox = document.getElementById('auto-battle-setting');
    const muteCheckbox = document.getElementById('mute-setting');
    const environmentEffectsCheckbox = document.getElementById('environment-effects-setting');

    window.game.player.avatarHeroConfigId = this.pendingAvatarHeroConfigId || this.getCurrentAvatarHeroConfigId();
    if (autoBattleCheckbox) {
        window.game.settings.autoBattle = autoBattleCheckbox.checked;
    }
    if (muteCheckbox) {
        window.game.settings.muted = muteCheckbox.checked;
        audioManager.setMuted(window.game.settings.muted);
    }
    if (environmentEffectsCheckbox) {
        window.game.settings.environmentEffectsDisabled = environmentEffectsCheckbox.checked;
    }

    if (window.game.currentView === 'battle') {
        window.game.ui?.battleView?.applyAutoBattleSettingChange?.();
        window.game.ui?.battleView?.applyEnvironmentEffectSettingChange?.();
    }

    this.refreshAccountStatus();
};

TopBar.prototype.schedulePlayerInfoSave = function() {
    this.playerInfoSaveDirty = true;
    if (this.playerInfoSaveTimer) {
        clearTimeout(this.playerInfoSaveTimer);
    }
    this.playerInfoSaveTimer = setTimeout(() => this.flushPlayerInfoSave(), 240);
};

TopBar.prototype.flushPlayerInfoSave = function() {
    if (this.playerInfoSaveTimer) {
        clearTimeout(this.playerInfoSaveTimer);
        this.playerInfoSaveTimer = null;
    }
    if (!this.playerInfoSaveDirty) {
        return;
    }
    window.game?.save?.();
    this.playerInfoSaveDirty = false;
};

TopBar.prototype.selectAvatarHero = function(configId) {
    this.pendingAvatarHeroConfigId = configId;
    this.updatePlayerAvatarPreview();
    this.applyPlayerInfoDraft();
    this.schedulePlayerInfoSave();
    if (this.avatarPickerModal?.isShown()) {
        this.avatarPickerModal.close();
    }
};

TopBar.prototype.showPlayerInfo = function() {
    this.pendingAvatarHeroConfigId = this.getCurrentAvatarHeroConfigId();
    const modal = new Modal({
        title: '玩家信息',
        className: 'player-info-modal',
        content: `
            <div class="player-info-panel">
                <div class="player-info-header">
                    <div class="player-info-avatar-column">
                        <div id="player-avatar-preview">${this.getAvatarMarkup(this.getCurrentAvatarHeroConfig(), { sizeClass: 'player-info-avatar-large' })}</div>
                        ${this.getPlayerNameMarkup()}
                    </div>
                    <div class="player-info-meta">
                        <div class="player-info-stats">
                            <div class="player-info-stat-inline">玩家等级：<strong id="info-level">${window.game.player.level}</strong></div>
                            <div class="player-info-stat-inline">玩家经验：<strong><span id="info-exp">${window.game.player.exp}</span>/<span id="info-exp-required">${GameConfig.getExpRequired(window.game.player.level)}</span></strong></div>
                            ${this.getAccountIdMarkup()}
                        </div>
                        <button class="btn btn-secondary btn-small player-avatar-config-btn" onclick="window.game.ui.topBar.openAvatarPicker()">设置头像</button>
                    </div>
                </div>
                <div class="player-info-toggle-row">
                    <label class="player-info-toggle ${window.battleManager?.isAutoBattleAllowed?.() ? '' : 'is-disabled'}">
                        <input type="checkbox" id="auto-battle-setting" ${window.game.settings.autoBattle ? 'checked' : ''} ${window.battleManager?.isAutoBattleAllowed?.() ? '' : 'disabled'}>
                        <span>自动战斗${window.battleManager?.isAutoBattleAllowed?.() ? '' : '<em class="player-info-toggle-hint">（需卓越特权）</em>'}</span>
                    </label>
                    <label class="player-info-toggle">
                        <input type="checkbox" id="mute-setting" ${window.game.settings.muted ? 'checked' : ''}>
                        <span>关闭游戏声音</span>
                    </label>
                    <label class="player-info-toggle">
                        <input type="checkbox" id="environment-effects-setting" ${window.game.settings.environmentEffectsDisabled ? 'checked' : ''}>
                        <span>关闭游戏特效</span>
                    </label>
                </div>
                ${this.getPlayerInfoToolsMarkup()}
            </div>
        `,
        buttons: [
            { text: '关闭', className: 'btn-secondary', onClick: () => modal.close() }
        ],
        onClose: () => {
            this.flushPlayerInfoSave();
            this.playerInfoModal = null;
            this.pendingAvatarHeroConfigId = null;
            if (this.avatarPickerModal?.isShown()) {
                this.avatarPickerModal.close();
            }
        }
    });
    this.playerInfoModal = modal;
    modal.show();
    this.bindPlayerInfoAutoSave();
};

TopBar.prototype.savePlayerInfo = function(modal) {
    this.applyPlayerInfoDraft();
    this.flushPlayerInfoSave();
    modal?.close?.();
};
