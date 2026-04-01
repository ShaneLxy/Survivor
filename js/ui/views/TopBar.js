/**
 * 顶部状态栏
 */
class TopBar {
    constructor() {
        this.element = document.getElementById('top-bar');
        this.level = 1;
        this.exp = 0;
        this.energy = 100;
        this.maxEnergy = 100;
        this.gold = 0;
        this.diamond = 0;

        this.init();
    }

    /**
     * 初始化
     */
    init() {
        this.create();
        this.setupEvents();
    }

    /**
     * 创建状态栏
     */
    create() {
        this.element.innerHTML = `
            <div class="status-item">
                <span class="status-icon">👤</span>
                <span class="status-label">Lv.</span>
                <span class="status-value" id="player-level">1</span>
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
    }

    /**
     * 设置事件
     */
    setupEvents() {
        eventManager.on('resourceUpdate', (data) => {
            if (data.type === 'gold') {
                this.updateGold(data.total);
            }
            if (data.type === 'diamond') {
                this.updateDiamond(data.total);
            }
        });

        eventManager.on('playerUpdate', (data) => {
            if (data.level !== undefined) {
                this.updateLevel(data.level);
            }
            if (data.energy !== undefined) {
                this.updateEnergy(data.energy, data.maxEnergy);
            }
        });
    }

    /**
     * 更新等级
     * @param {number} level - 等级
     */
    updateLevel(level) {
        this.level = level;
        this.levelElement.textContent = level;
    }

    /**
     * 更新体力
     * @param {number} energy - 当前体力
     * @param {number} maxEnergy - 最大体力
     */
    updateEnergy(energy, maxEnergy) {
        this.energy = energy;
        this.maxEnergy = maxEnergy;
        this.energyElement.textContent = `${energy}/${maxEnergy}`;
    }

    /**
     * 更新金币
     * @param {number} gold - 金币数量
     */
    updateGold(gold) {
        this.gold = gold;
        this.goldElement.textContent = Utils.formatNumber(gold);
    }

    /**
     * 更新钻石
     * @param {number} diamond - 钻石数量
     */
    updateDiamond(diamond) {
        this.diamond = diamond;
        this.diamondElement.textContent = Utils.formatNumber(diamond);
    }

    /**
     * 更新所有状态
     * @param {Object} data - 玩家数据
     */
    updateAll(data) {
        if (data.level !== undefined) this.updateLevel(data.level);
        if (data.energy !== undefined) this.updateEnergy(data.energy, data.maxEnergy || data.energy);
        if (data.gold !== undefined) this.updateGold(data.gold);
    }
}

// 导出单例
const topBar = new TopBar();

// 暴露到全局
window.topBar = topBar;
