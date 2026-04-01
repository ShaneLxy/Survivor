/**
 * 抽卡场景视图
 */
class GachaView {
    constructor() {
        this.element = document.getElementById('main-display');
        this.visible = false;
    }

    show() {
        this.visible = true;
        this.render();
    }

    hide() {
        this.visible = false;
        this.element.innerHTML = '';
    }

    render() {
        const pool = gachaManager.getPoolConfig();
        const singleCost = gachaManager.calculateCost(1);
        const tenCost = gachaManager.calculateCost(10);
        this.element.innerHTML = `
            <div class="gacha-view">
                <h2 class="gacha-title">英雄召唤</h2>
                <div class="gacha-buttons">
                    <button class="btn btn-primary btn-large" onclick="window.game.ui.gachaView.pull(1)">
                        <span>召唤 x1</span>
                        <span style="margin-left:10px;font-size:14px;">💰${singleCost.amount}</span>
                    </button>
                    <button class="btn btn-primary btn-large" onclick="window.game.ui.gachaView.pull(10)">
                        <span>召唤 x10</span>
                        <span style="margin-left:10px;font-size:14px;">💰${tenCost.amount}</span>
                    </button>
                </div>
                <div id="gacha-results" class="gacha-results"></div>
            </div>
        `;
    }

    async pull(count) {
        const cost = gachaManager.calculateCost(count);
        if (shelterManager.getResource('gold') < cost.amount) {
            Toast.error(`金币不足,需要 ${cost.amount}`);
            return;
        }
        // 不在这里扣费，让 gachaManager.pull() 统一处理
        const result = gachaManager.pull(count);
        if (result.success) {
            Toast.success(`消耗${cost.amount}金币`);
            await this.showResults(result.results, count);
            const addedHeroes = gachaManager.addResultsToHeroes(result.results);
            if (addedHeroes.length > 0) {
                Toast.success(`获得${addedHeroes.length}个新英雄!`);
            }
        } else {
            Toast.error(result.message);
        }
    }

    async showResults(results, count) {
        const resultsElement = this.element.querySelector('#gacha-results');
        resultsElement.innerHTML = '';
        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const card = this.createResultCard(result);
            resultsElement.appendChild(card);
            await Utils.delay(GameConfig.ui.animations.gachaDelay);
        }
    }

    createResultCard(result) {
        const card = document.createElement('div');
        card.className = 'gacha-result-card card';
        card.style.borderColor = this.getRarityColor(result.rarity);
        card.innerHTML = `
            <div class="gacha-result-icon" style="color:${this.getRarityColor(result.rarity)}">${result.icon}</div>
            <div class="gacha-result-name" style="color:${this.getRarityColor(result.rarity)}">${result.name}</div>
            <div style="color:${this.getRarityColor(result.rarity)}">${this.getRarityName(result.rarity)}</div>
        `;
        return card;
    }

    getRarityColor(rarity) {
        const colors = { common: '#a0a0a0', rare: '#a335ee', epic: '#ff8000', legendary: '#ffcc00' };
        return colors[rarity] || colors.common;
    }

    getRarityName(rarity) {
        const names = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传说' };
        return names[rarity] || '普通';
    }

    refresh() {
        if (this.visible) this.render();
    }
}

const gachaView = new GachaView();

// 暴露到全局
window.gachaView = gachaView;
