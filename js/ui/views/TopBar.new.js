/**
 * 顶部状态栏
 */
class TopBar {
    constructor() {
        this.element = document.getElementById('top-bar');
        this.level = 1;
        this.energy = 100;
        this.maxEnergy = 100;
        this.gold = 0;
        this.diamond = 0;
        this.init();
    }

    init() {
        this.create();
        this.setupEvents();
    }

    create() {
        this.element.innerHTML = `
            <div class="player-avatar" id="player-avatar" style="cursor:pointer;display:flex;align-items:center;gap:8px;">
                <span class="avatar-icon">👤</span>
                <span id="player-level" style="font-size:12px;color:#ffd700;font-weight:bold;">Lv.1</span>
            </div>
            <div class="status-item">
                <span class="status-icon">⚡</span>
                <span class="status-label">体力</span>
                <span class="status-value" id="player-energy">100/100</span>
            </div>
            <div class="status-item">
                <span class="status-icon">🪙</span>
                <span class="status-value text-gold" id="player-gold">0</span>
            </div>
            <div class="status-item">
                <span class="status-icon">💎</span>
                <span class="status-value text-diamond" id="player-diamond">0</span>
            </div>
        `;
        this.avatarElement = this.element.querySelector('#player-avatar');
        this.avatarIconElement = this.element.querySelector('.avatar-icon');
        this.levelElement = this.element.querySelector('#player-level');
        this.energyElement = this.element.querySelector('#player-energy');
        this.goldElement = this.element.querySelector('#player-gold');
        this.diamondElement = this.element.querySelector('#player-diamond');
        if (this.avatarElement) {
            this.avatarElement.addEventListener('click', () => this.showPlayerInfo());
        }
        this.refreshAccountStatus();
    }

    getAccountStatusMarkup() {
        const user = authService.getCurrentUser();
        const isLoggedIn = authService.isLoggedIn();
        const accountName = user?.nickname || user?.account || '未知账号';
        const statusText = isLoggedIn ? `当前已登录：${accountName}` : '当前未登录';

        return `
            <div style="padding:12px;border-radius:10px;background:rgba(255,255,255,0.04);display:flex;flex-direction:column;gap:10px;">
                <div style="font-weight:bold;color:#f8fafc;">账号</div>
                <div style="font-size:12px;color:#cbd5e1;line-height:1.7;">${statusText}</div>
                <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;">
                    ${isLoggedIn
                        ? `
                            <button class="btn btn-primary btn-small" onclick="window.game.ui.topBar.uploadCloudSave()">上传云存档</button>
                            <button class="btn btn-primary btn-small" onclick="window.game.ui.topBar.downloadCloudSave()">下载云存档</button>
                            <button class="btn btn-danger btn-small" onclick="window.game.ui.topBar.logoutAccount()">退出登录</button>
                        `
                        : `
                            <button class="btn btn-primary btn-small" onclick="window.game.ui.topBar.goToLogin()">前往登录</button>
                        `}
                </div>
            </div>
        `;
    }

    showPlayerInfo() {
        const modal = new Modal({
            title: '玩家信息',
            content: `
                <div style="text-align:center;padding:10px;display:flex;flex-direction:column;gap:12px;">
                    <div style="font-size:64px;">${authService.isLoggedIn() ? '🧑‍🚀' : '👤'}</div>
                    <div>
                        <label style="display:block;margin-bottom:6px;">玩家昵称</label>
                        <input type="text" id="player-nickname" value="${window.game.player.nickname || '幸存者'}"
                               style="width:100%;padding:8px;border-radius:5px;border:1px solid #4a4a4a;background:#2a2a2a;color:#e0e0e0;text-align:center;">
                    </div>
                    <label style="display:flex;align-items:center;justify-content:center;gap:10px;cursor:pointer;">
                        <input type="checkbox" id="auto-battle-setting" ${window.game.settings.autoBattle ? 'checked' : ''}>
                        <span>自动战斗</span>
                    </label>
                    <label style="display:flex;align-items:center;justify-content:center;gap:10px;cursor:pointer;">
                        <input type="checkbox" id="mute-setting" ${window.game.settings.muted ? 'checked' : ''}>
                        <span>关闭游戏声音</span>
                    </label>
                    <div style="padding:10px;background:rgba(0,0,0,0.2);border-radius:8px;line-height:1.8;">
                        <p style="margin:0;">玩家等级：<span id="info-level">${window.game.player.level}</span></p>
                        <p style="margin:0;">玩家经验：<span id="info-exp">${window.game.player.exp}</span>/<span id="info-exp-required">${GameConfig.getExpRequired(window.game.player.level)}</span></p>
                    </div>
                    ${this.getAccountStatusMarkup()}
                </div>
            `,
            buttons: [
                { text: '保存', className: 'btn-primary', onClick: () => this.savePlayerInfo(modal) },
                { text: '取消', className: 'btn-secondary', onClick: () => modal.close() }
            ]
        });
        modal.show();
    }

    savePlayerInfo(modal) {
        const nicknameInput = document.getElementById('player-nickname');
        const autoBattleCheckbox = document.getElementById('auto-battle-setting');
        const muteCheckbox = document.getElementById('mute-setting');

        if (nicknameInput) {
            window.game.player.nickname = nicknameInput.value || '幸存者';
        }
        if (autoBattleCheckbox) {
            window.game.settings.autoBattle = autoBattleCheckbox.checked;
        }
        if (muteCheckbox) {
            window.game.settings.muted = muteCheckbox.checked;
            audioManager.setMuted(window.game.settings.muted);
        }

        if (window.game.currentView === 'battle') {
            window.game.ui.battleView.applyAutoBattleSettingChange();
        }

        modal.close();
        window.game.save();
        this.refreshAccountStatus();
        Toast.success('设置已保存');
    }

    goToLogin() {
        window.game.ui.loginView.show();
    }

    showWechatReservedInfo() {
        Toast.info('微信登录结构已预留，后续接入微信小游戏时可直接对接 code2Session');
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
        });
        eventManager.on('authChange', () => this.refreshAccountStatus());
    }

    refreshAccountStatus() {
        if (this.avatarIconElement) {
            this.avatarIconElement.textContent = authService.isLoggedIn() ? '🧑‍🚀' : '👤';
        }
        if (this.avatarElement) {
            const user = authService.getCurrentUser();
            this.avatarElement.title = authService.isLoggedIn()
                ? `当前已登录：${user?.nickname || user?.account || '账号'}`
                : '点击查看玩家信息';
        }
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
