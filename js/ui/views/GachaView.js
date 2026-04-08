/**
 * 招募场景视图
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

    renderPoolRates(poolId) {
        const entries = GachaConfig.getPoolDisplayEntries(poolId);
        return `
            <div class="recruit-rate-list">
                ${entries.map(entry => `
                    <div class="recruit-rate-row">
                        <span class="recruit-rate-label">${entry.label}</span>
                        <strong class="recruit-rate-value">${entry.rateText}</strong>
                    </div>
                `).join('')}
            </div>
        `;
    }

    render() {
        const heroSingleCost = gachaManager.calculateCost('hero_pool', 1);
        const heroTenCost = gachaManager.calculateCost('hero_pool', 10);
        const equipSingleCost = gachaManager.calculateCost('equipment_pool', 1);
        const equipTenCost = gachaManager.calculateCost('equipment_pool', 10);

        this.element.innerHTML = `
            <div class="gacha-view recruit-view">
                <h2 class="gacha-title">招募中心</h2>
                <div class="recruit-split-layout">
                    <div class="recruit-panel card">
                        <div class="recruit-panel-icon">🦸</div>
                        <div class="recruit-panel-title">英雄招募</div>
                        <div class="recruit-panel-desc">奖励将从招募池中随机抽取，重复英雄仍会自动转化为碎片。</div>
                        ${this.renderPoolRates('hero_pool')}
                        <div class="recruit-panel-actions">
                            <button class="btn btn-primary btn-large" onclick="window.game.ui.gachaView.executePool('hero_pool', 1)">招募1次 · 💰${heroSingleCost.amount}</button>
                            <button class="btn btn-primary btn-large" onclick="window.game.ui.gachaView.executePool('hero_pool', 10)">招募10次 · 💰${heroTenCost.amount}</button>
                        </div>
                    </div>
                    <div class="recruit-panel card">
                        <div class="recruit-panel-icon">🛠️</div>
                        <div class="recruit-panel-title">装备打造</div>
                        <div class="recruit-panel-desc">打造可能获得装备，也可能拿到金币、木材或铁矿石。</div>
                        ${this.renderPoolRates('equipment_pool')}
                        <div class="recruit-panel-actions">
                            <button class="btn btn-secondary btn-large" onclick="window.game.ui.gachaView.executePool('equipment_pool', 1)">打造1次 · 💰${equipSingleCost.amount}</button>
                            <button class="btn btn-secondary btn-large" onclick="window.game.ui.gachaView.executePool('equipment_pool', 10)">打造10次 · 💰${equipTenCost.amount}</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async executePool(poolId, count) {
        const pool = gachaManager.getPoolConfig(poolId);
        const cost = gachaManager.calculateCost(poolId, count);
        if (!pool || !cost) {
            Toast.error('招募配置异常');
            return;
        }

        if (shelterManager.getResource('gold') < cost.amount) {
            Toast.error(`金币不足,需要 ${cost.amount}`);
            return;
        }

        const result = gachaManager.pull(poolId, count);
        if (!result.success) {
            Toast.error(result.message);
            return;
        }

        const rewardResult = gachaManager.addResults(result.results);
        await RewardModal.show({
            title: `${pool.name}${count > 1 ? ` x${count}` : ''}`,
            rewards: rewardResult.rewards,
            summaryText: `已消耗 ${cost.amount} 金币`
        });

        window.game.save();
        this.refresh();
    }

    refresh() {
        if (this.visible) {
            this.render();
        }
    }
}

const gachaView = new GachaView();
window.gachaView = gachaView;
