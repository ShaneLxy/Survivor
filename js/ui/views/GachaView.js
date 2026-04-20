/**
 * 招募场景视图
 */
class GachaView {
    constructor() {
        this.element = document.getElementById('main-display');
        this.visible = false;
        this.activeRatePopover = null;
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
                <div class="recruit-rate-popover-header">
                    <span>奖池概率</span>
                    <button type="button" class="recruit-rate-popover-close" onclick="window.game.ui.gachaView.closeRatePopover()">×</button>
                </div>
                ${entries.map(entry => `
                    <div class="recruit-rate-row">
                        <span class="recruit-rate-label">${entry.label}</span>
                        <strong class="recruit-rate-value">${entry.rateText}</strong>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderRatePopover(poolId) {
        if (this.activeRatePopover !== poolId) {
            return '';
        }
        return `
            <div class="recruit-rate-popover">
                ${this.renderPoolRates(poolId)}
            </div>
        `;
    }

    toggleRatePopover(poolId) {
        this.activeRatePopover = this.activeRatePopover === poolId ? null : poolId;
        this.refresh();
    }

    closeRatePopover() {
        this.activeRatePopover = null;
        this.refresh();
    }

    formatCostText(cost, options = {}) {
        const includeLabel = options.includeLabel !== false;
        const resourceLabel = shelterManager.getResourceInfo(cost?.type)?.name || cost?.type || '资源';
        const resourceIcon = shelterManager.getResourceInfo(cost?.type)?.icon || '💠';
        return includeLabel
            ? `${resourceIcon}${cost?.amount || 0} ${resourceLabel}`
            : `${resourceIcon}${cost?.amount || 0}`;
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
                        <div class="recruit-panel-icon">🎯</div>
                        <div class="recruit-panel-title">英雄招募</div>
                        <div class="recruit-panel-desc">奖励将从招募奖池中随机抽取，重复英雄会自动转化为碎片。</div>
                        <button type="button" class="recruit-rate-trigger" onclick="window.game.ui.gachaView.toggleRatePopover('hero_pool')" aria-label="查看英雄招募奖池概率">?</button>
                        ${this.renderRatePopover('hero_pool')}
                        <div class="recruit-panel-actions">
                            <button class="btn btn-primary btn-large" onclick="window.game.ui.gachaView.executePool('hero_pool', 1)">招募1次 · ${this.formatCostText(heroSingleCost, { includeLabel: false })}</button>
                            <button class="btn btn-primary btn-large" onclick="window.game.ui.gachaView.executePool('hero_pool', 10)">招募10次 · ${this.formatCostText(heroTenCost, { includeLabel: false })}</button>
                        </div>
                    </div>
                    <div class="recruit-panel card">
                        <div class="recruit-panel-icon">⚒️</div>
                        <div class="recruit-panel-title">装备打造</div>
                        <div class="recruit-panel-desc">打造可能获得装备，也可能获得金币、木材或铁矿石等奖励。</div>
                        <button type="button" class="recruit-rate-trigger" onclick="window.game.ui.gachaView.toggleRatePopover('equipment_pool')" aria-label="查看装备打造奖池概率">?</button>
                        ${this.renderRatePopover('equipment_pool')}
                        <div class="recruit-panel-actions">
                            <button class="btn btn-secondary btn-large" onclick="window.game.ui.gachaView.executePool('equipment_pool', 1)">打造1次 · ${this.formatCostText(equipSingleCost, { includeLabel: false })}</button>
                            <button class="btn btn-secondary btn-large" onclick="window.game.ui.gachaView.executePool('equipment_pool', 10)">打造10次 · ${this.formatCostText(equipTenCost, { includeLabel: false })}</button>
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

        const resourceInfo = shelterManager.getResourceInfo(cost.type) || {};
        const resourceLabel = resourceInfo.name || cost.type;
        if (shelterManager.getResource(cost.type) < cost.amount) {
            Toast.error(`${resourceLabel}不足，需要 ${cost.amount}`);
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
            summaryText: `已消耗 ${cost.amount} ${resourceLabel}`
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
