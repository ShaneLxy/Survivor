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
                <span class="status-icon">❤️</span>
                <span class="status-label">体力</span>
                <span class="status-value" id="player-energy">100/100</span>
            </div>
            <div class="status-item">
                <span class="status-icon">💰</span>
                <span class="status-value text-gold" id="player-gold">0</span>
            </div>
            <div class="status-item">
                <span class="status-icon">💎</span>
                <span class="status-value text-diamond" id="player-diamond">0</span>
            </div>
        `;
        this.levelElement = this.element.querySelector('#player-level');
        this.energyElement = this.element.querySelector('#player-energy');
        this.goldElement = this.element.querySelector('#player-gold');
        this.diamondElement = this.element.querySelector('#player-diamond');
        const avatar = this.element.querySelector('#player-avatar');
        if (avatar) {
            avatar.addEventListener('click', () => this.showPlayerInfo());
        }
    }

    showPlayerInfo() {
        const modal = new Modal({
            title: '玩家信息',
            content: `
                <div style="text-align:center;padding:10px;display:flex;flex-direction:column;gap:12px;">
                    <div style="font-size:64px;">👤</div>
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
        Toast.success('设置已保存');

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
    }
}

const topBar = new TopBar();
window.topBar = topBar;
