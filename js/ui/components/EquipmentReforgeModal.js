/**
 * 装备洗炼弹窗
 * - 列出当前武器库等级解锁的属性
 * - 显示该装备各可洗炼属性的“当前值 / 范围”
 * - 点击重投后立即应用结果（结果可好可坏，与现有刷词条玩法一致）
 * - 显示洗炼额外加成 reforgeBonus
 */
class EquipmentReforgeModal {
    constructor() {
        this.modal = null;
        this.currentInstanceId = null;
        this.lastResult = null; // { statKey, baseRoll, value, previous, bonus }
    }

    show(target) {
        const resolved = itemManager.resolveEquipmentTarget(target);
        if (!resolved?.equipment) {
            Toast.error('装备不存在');
            return;
        }
        this.currentInstanceId = resolved.equipment.instanceId;
        this.lastResult = null;
        this.modal = new Modal({
            title: `${resolved.equipment.name} · 洗炼`,
            content: this.buildContent(),
            buttons: [
                { text: '关闭', className: 'btn-secondary', onClick: () => this.close() }
            ],
            onClose: () => {
                this.modal = null;
                this.currentInstanceId = null;
                this.lastResult = null;
            }
        });
        this.modal.show();
        this.bindReforgeButtons();
    }

    close() {
        if (this.modal) {
            this.modal.close();
        }
    }

    renderEquipmentIcon(equipment) {
        if (equipment?.iconSrc) {
            return `<img class="equipment-enhance-icon-image" src="${equipment.iconSrc}" alt="${equipment.name || '装备'}">`;
        }
        return equipment?.icon || '📦';
    }

    buildContent() {
        const info = itemManager.getEquipmentReforgeInfo(this.currentInstanceId);
        if (!info.success) {
            // 即使没有可洗炼属性，也保留装备头部 + 错误说明，方便用户理解
            const fallbackEquipment = info.equipment;
            const stoneOwnedFallback = itemManager.getItemCount(ItemManager.REFORGE_STONE_ITEM_ID);
            const headerHtml = fallbackEquipment
                ? this.renderHeader(fallbackEquipment, null, Number(info.armoryLevel) || 0, Number(info.bonus) || 0, ItemManager.getReforgeCost(fallbackEquipment.rarity), stoneOwnedFallback)
                : '';
            return `
                <div class="equipment-enhance-panel">
                    ${headerHtml}
                    <div class="equipment-enhance-costs card">
                        <div class="equipment-enhance-empty">${info.message || '装备不存在'}</div>
                    </div>
                </div>
            `;
        }

        const { equipment, holder, armoryLevel, bonus, availableStats, cost, stoneOwned } = info;
        const costAmount = Number(cost) || 1;
        const ownedAmount = Number(stoneOwned) || 0;
        const canAfford = ownedAmount >= costAmount;

        const statRows = availableStats.map((stat) => {
            const [min, max] = stat.range;
            const minWithBonus = Math.max(0, Number(min) || 0) + (Number(bonus) || 0);
            const maxWithBonus = Math.max(0, Number(max) || 0) + (Number(bonus) || 0);
            const rangeText = `+${minWithBonus} ~ +${maxWithBonus}`;
            const highlight = this.lastResult && this.lastResult.statKey === stat.key;
            const resultBlock = highlight ? this.renderResultBlock(stat) : '';
            const disabledAttr = canAfford ? '' : 'disabled';
            const btnClass = canAfford ? 'btn-primary' : 'btn-secondary';
            const btnStyle = canAfford
                ? 'padding:4px 12px;font-size:12px;'
                : 'padding:4px 12px;font-size:12px;opacity:0.55;cursor:not-allowed;';
            return `
                <div class="equipment-enhance-stat-row" data-reforge-row="${stat.key}">
                    <div style="display:flex;flex-direction:column;gap:2px;">
                        <span>${stat.name}</span>
                        <span style="font-size:11px;color:#888;">范围 ${rangeText}</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <strong>当前 +${stat.current}</strong>
                        <button class="${btnClass} equipment-reforge-btn" data-reforge-stat="${stat.key}" style="${btnStyle}" ${disabledAttr}>重投</button>
                    </div>
                </div>
                ${resultBlock}
            `;
        }).join('');

        const stoneCountColor = canAfford ? '#7fdc88' : '#e57373';
        const costSummary = `
            <div class="equipment-enhance-meta" style="display:flex;align-items:center;gap:8px;margin-top:2px;">
                <span>每次洗炼消耗：</span>
                <strong style="color:#fff4c4;">🪨 洗炼石 × ${costAmount}</strong>
                <span style="color:${stoneCountColor};">（持有 ${ownedAmount}）</span>
            </div>
        `;

        return `
            <div class="equipment-enhance-panel">
                ${this.renderHeader(equipment, holder, armoryLevel, bonus, costAmount, ownedAmount, costSummary)}
                <div class="equipment-enhance-costs card">
                    <div class="equipment-enhance-cost-title">可洗炼属性</div>
                    ${statRows || '<div class="equipment-enhance-empty">当前武器库等级未解锁可洗炼属性</div>'}
                    <div class="equipment-enhance-tip">提示：洗炼后属性会被重新随机，可能高于或低于当前值，请谨慎操作。</div>
                    ${!canAfford ? '<div class="equipment-enhance-tip" style="color:#e57373;">洗炼石不足，无法继续洗炼。可在副本掉落或商店获取。</div>' : ''}
                </div>
            </div>
        `;
    }

    renderHeader(equipment, holder, armoryLevel, bonus, costAmount, stoneOwned, costSummaryHtml) {
        const holderText = holder?.hero
            ? `已装备于 ${holder.hero.name}`
            : '当前位于背包';
        const ownedAmount = Number(stoneOwned) || 0;
        const canAfford = ownedAmount >= (Number(costAmount) || 1);
        const stoneCountColor = canAfford ? '#7fdc88' : '#e57373';
        const summary = costSummaryHtml ?? `
            <div class="equipment-enhance-meta" style="display:flex;align-items:center;gap:8px;margin-top:2px;">
                <span>每次洗炼消耗：</span>
                <strong style="color:#fff4c4;">🪨 洗炼石 × ${costAmount}</strong>
                <span style="color:${stoneCountColor};">（持有 ${ownedAmount}）</span>
            </div>
        `;
        return `
            <div class="equipment-enhance-header">
                <div class="equipment-enhance-icon">${this.renderEquipmentIcon(equipment)}</div>
                <div class="equipment-enhance-main">
                    <div class="equipment-enhance-name" style="color:${GameConfig.getRarityConfig(equipment.rarity).color};">${equipment.name}</div>
                    <div class="equipment-enhance-meta">${EquipmentConfig.getRarityName(equipment.rarity)} · ${EquipmentConfig.getSlotName(equipment.slot)} · ${holderText}</div>
                    <div class="equipment-enhance-meta">武器库等级：Lv.${armoryLevel}</div>
                    <div class="equipment-enhance-meta">额外加成：+${bonus}（自动叠加在每次洗炼结果上）</div>
                    ${summary}
                </div>
            </div>
        `;
    }

    renderResultBlock(stat) {
        const result = this.lastResult;
        if (!result || result.statKey !== stat.key) return '';
        const diff = Number(result.value) - Number(result.previous || 0);
        const diffText = diff === 0
            ? '<span style="color:#a0a0a0;">持平</span>'
            : diff > 0
                ? `<span style="color:#7fdc88;">+${diff}</span>`
                : `<span style="color:#e57373;">${diff}</span>`;
        const baseRoll = Number(result.baseRoll) || 0;
        const bonus = Number(result.bonus) || 0;
        const formula = bonus > 0
            ? `<div style="margin-top:4px;font-size:11px;color:rgba(159,179,200,0.78);">基础随机 +${baseRoll} · 武器库加成 +${bonus} = <strong style="color:#fff4c4;">+${result.value}</strong></div>`
            : '';
        return `
            <div class="equipment-enhance-stat-row" style="background:rgba(122,204,214,0.08);border-radius:6px;padding:6px 10px;font-size:12px;flex-direction:column;align-items:stretch;gap:0;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span>本次洗炼结果</span>
                    <strong>+${result.previous} → +${result.value} ${diffText}</strong>
                </div>
                ${formula}
            </div>
        `;
    }

    bindReforgeButtons() {
        const root = this.modal?.element;
        if (!root) return;
        root.querySelectorAll('[data-reforge-stat]').forEach((btn) => {
            btn.addEventListener('click', () => {
                if (btn.disabled) {
                    Toast.info('洗炼石不足，请先补充洗炼石');
                    return;
                }
                this.handleReforge(btn.dataset.reforgeStat);
            });
        });
    }

    refresh() {
        if (!this.modal || !this.modal.isShown()) {
            return;
        }
        const info = itemManager.getEquipmentReforgeInfo(this.currentInstanceId);
        if (!info.success && !info.equipment) {
            this.close();
            return;
        }
        this.modal.setContent(this.buildContent());
        this.bindReforgeButtons();
    }

    handleReforge(statKey) {
        if (!statKey) return;
        const info = itemManager.getEquipmentReforgeInfo(this.currentInstanceId);
        if (!info.success) {
            Toast.error(info.message || '无法洗炼');
            return;
        }
        const statBefore = info.availableStats.find(s => s.key === statKey);
        const previousValue = statBefore ? Number(statBefore.current) || 0 : 0;

        const result = itemManager.reforgeEquipment(this.currentInstanceId, statKey);
        if (!result.success) {
            Toast.error(result.message);
            this.refresh();
            return;
        }
        this.lastResult = {
            statKey,
            previous: previousValue,
            value: Number(result.value) || 0,
            baseRoll: Number(result.baseRoll) || 0,
            bonus: Number(result.bonus) || 0
        };
        const diff = this.lastResult.value - previousValue;
        const stoneSuffix = result.stoneCost
            ? `（消耗 ${result.stoneCost} 洗炼石，剩余 ${result.stoneRemaining}）`
            : '';
        if (diff > 0) {
            Toast.success(`${Equipment.getStatName(statKey)} +${previousValue} → +${this.lastResult.value}（提升）${stoneSuffix}`);
        } else if (diff < 0) {
            Toast.info(`${Equipment.getStatName(statKey)} +${previousValue} → +${this.lastResult.value}（下降）${stoneSuffix}`);
        } else {
            Toast.info(`${Equipment.getStatName(statKey)} 持平 +${this.lastResult.value}${stoneSuffix}`);
        }
        try {
            window.game?.ui?.itemGrid?.refresh?.();
            window.game?.ui?.heroView?.refresh?.();
            window.game?.save?.();
        } catch (error) {
            console.warn('[EquipmentReforgeModal] 刷新失败:', error);
        }
        this.refresh();
    }
}

const equipmentReforgeModal = new EquipmentReforgeModal();
window.equipmentReforgeModal = equipmentReforgeModal;
