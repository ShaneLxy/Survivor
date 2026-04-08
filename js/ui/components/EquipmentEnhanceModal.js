/**
 * 装备强化弹窗
 */
class EquipmentEnhanceModal {
    constructor() {
        this.modal = null;
        this.currentInstanceId = null;
    }

    show(target) {
        const resolved = itemManager.resolveEquipmentTarget(target);
        if (!resolved?.equipment) {
            Toast.error('装备不存在');
            return;
        }
        this.currentInstanceId = resolved.equipment.instanceId;
        this.modal = new Modal({
            title: `${resolved.equipment.name} · 强化`,
            content: this.buildContent(),
            buttons: [
                { text: '强化', className: 'btn-primary', onClick: () => this.handleEnhance() },
                { text: '关闭', className: 'btn-secondary', onClick: () => this.close() }
            ],
            onClose: () => {
                this.modal = null;
                this.currentInstanceId = null;
            }
        });
        this.modal.show();
    }

    close() {
        if (this.modal) {
            this.modal.close();
        }
    }

    buildPreviewRows(info) {
        const preview = info.preview || {};
        const rows = Object.entries(preview).map(([statKey, value]) => `
            <div class="equipment-enhance-stat-row">
                <span>${Equipment.getStatName(statKey)}</span>
                <strong>+${value.current} → +${value.next}</strong>
            </div>
        `).join('');
        return rows || '<div class="equipment-enhance-empty">当前装备没有可通过强化提升的基础属性</div>';
    }

    buildContent() {
        const info = itemManager.getEquipmentEnhanceInfo(this.currentInstanceId);
        if (!info.success) {
            return `<div class="equipment-enhance-panel"><div class="equipment-enhance-empty">${info.message || '装备不存在'}</div></div>`;
        }

        const { equipment, holder, cost, maxLevel } = info;
        const holderText = holder?.hero
            ? `已装备于 ${holder.hero.name}`
            : '当前位于背包';

        return `
            <div class="equipment-enhance-panel">
                <div class="equipment-enhance-header">
                    <div class="equipment-enhance-icon">${equipment.icon}</div>
                    <div class="equipment-enhance-main">
                        <div class="equipment-enhance-name" style="color:${GameConfig.getRarityConfig(equipment.rarity).color};">${equipment.name}</div>
                        <div class="equipment-enhance-meta">${EquipmentConfig.getRarityName(equipment.rarity)} · ${EquipmentConfig.getSlotName(equipment.slot)} · ${holderText}</div>
                        <div class="equipment-enhance-meta">强化等级：+${equipment.enhanceLevel} / +${maxLevel}</div>
                        <div class="equipment-enhance-meta">当前成功率：${info.successRateText}</div>
                    </div>
                </div>
                <div class="equipment-enhance-costs card">
                    <div class="equipment-enhance-cost-title">本次消耗</div>
                    <div class="equipment-enhance-cost-row">
                        <span>金币</span>
                        <strong class="${shelterManager.getResource('gold') >= cost.gold ? 'ok' : 'warn'}">${shelterManager.getResource('gold')} / ${cost.gold}</strong>
                    </div>
                    <div class="equipment-enhance-cost-row">
                        <span>铁矿石</span>
                        <strong class="${shelterManager.getResource('iron_ore') >= cost.iron_ore ? 'ok' : 'warn'}">${shelterManager.getResource('iron_ore')} / ${cost.iron_ore}</strong>
                    </div>
                    <div class="equipment-enhance-tip">失败仅扣金币和铁矿石，不会掉级。</div>
                    ${info.message ? `<div class="equipment-enhance-tip warn-text">${info.message}</div>` : ''}
                </div>
                <div class="equipment-enhance-preview card">
                    <div class="equipment-enhance-cost-title">下次成功后强化加成</div>
                    ${this.buildPreviewRows(info)}
                </div>
            </div>
        `;
    }

    refresh() {
        if (!this.modal || !this.modal.isShown()) {
            return;
        }
        const info = itemManager.getEquipmentEnhanceInfo(this.currentInstanceId);
        if (!info.success) {
            this.close();
            return;
        }
        this.modal.setTitle(`${info.equipment.name} · 强化`);
        this.modal.setContent(this.buildContent());
    }

    handleEnhance() {
        const result = itemManager.enhanceEquipment(this.currentInstanceId);
        if (!result.success) {
            Toast.error(result.message);
            this.refresh();
            return;
        }

        if (result.upgraded) {
            Toast.success(result.message);
        } else {
            Toast.info(result.message);
        }
        window.game.ui.itemGrid.refresh();
        window.game.ui.heroView.refresh();
        window.game.save();
        this.refresh();
    }
}

const equipmentEnhanceModal = new EquipmentEnhanceModal();
window.equipmentEnhanceModal = equipmentEnhanceModal;
