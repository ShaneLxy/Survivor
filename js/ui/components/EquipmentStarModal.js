/**
 * 装备升星弹窗
 */
class EquipmentStarModal {
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
            title: `${resolved.equipment.name} · 升星`,
            content: this.buildContent(),
            buttons: [
                { text: '升星', className: 'btn-primary', onClick: () => this.handleUpgrade() },
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

    renderEquipmentIcon(equipment) {
        if (equipment?.iconSrc) {
            return `<img class="equipment-enhance-icon-image" src="${equipment.iconSrc}" alt="${equipment.name || '装备'}">`;
        }
        return equipment?.icon || '📦';
    }

    renderPreviewRows(info) {
        const preview = info.preview || {};
        const rows = Object.entries(preview).map(([statKey, value]) => `
            <div class="equipment-enhance-stat-row">
                <span>${Equipment.getStatName(statKey)}</span>
                <strong>+${value.current} -> +${value.next}</strong>
            </div>
        `).join('');
        return rows || '<div class="equipment-enhance-empty">当前星级已是可用状态，没有额外升星增益</div>';
    }

    buildContent() {
        const info = itemManager.getEquipmentStarInfo(this.currentInstanceId);
        if (!info.success) {
            return `<div class="equipment-enhance-panel"><div class="equipment-enhance-empty">${info.message || '装备不存在'}</div></div>`;
        }

        const { equipment, holder, maxStarLevel, requiredCount } = info;
        const holderText = holder?.hero
            ? `已装备于 ${holder.hero.name}`
            : '当前位于背包';

        return `
            <div class="equipment-enhance-panel">
                <div class="equipment-enhance-header">
                    <div class="equipment-enhance-icon">${this.renderEquipmentIcon(equipment)}</div>
                    <div class="equipment-enhance-main">
                        <div class="equipment-enhance-name" style="color:${GameConfig.getRarityConfig(equipment.rarity).color};">${equipment.name}</div>
                        <div class="equipment-enhance-meta">${EquipmentConfig.getRarityName(equipment.rarity)} · ${EquipmentConfig.getSlotName(equipment.slot)} · ${holderText}</div>
                        <div class="equipment-enhance-meta">星级：${equipment.starLevel} / ${maxStarLevel}</div>
                        <div class="equipment-enhance-meta">每星 +${Math.round(EquipmentConfig.getStarBonusPerLevel() * 100)}% 基础属性</div>
                    </div>
                </div>
                <div class="equipment-enhance-costs card">
                    <div class="equipment-enhance-cost-title">升星消耗</div>
                    <div class="equipment-enhance-cost-row">
                        <span>同名 0 星装备</span>
                        <strong class="${info.selectedMaterials.length >= requiredCount ? 'ok' : 'warn'}">${info.selectedMaterials.length} / ${requiredCount}</strong>
                    </div>
                    ${info.message ? `<div class="equipment-enhance-tip warn-text">${info.message}</div>` : ''}
                </div>
                <div class="equipment-enhance-preview card">
                    <div class="equipment-enhance-cost-title">升星后属性预览</div>
                    ${this.renderPreviewRows(info)}
                </div>
            </div>
        `;
    }

    refresh() {
        if (!this.modal || !this.modal.isShown()) {
            return;
        }
        const info = itemManager.getEquipmentStarInfo(this.currentInstanceId);
        if (!info.success) {
            this.close();
            return;
        }
        this.modal.setTitle(`${info.equipment.name} · 升星`);
        this.modal.setContent(this.buildContent());
    }

    handleUpgrade() {
        const result = itemManager.upgradeEquipmentStar(this.currentInstanceId);
        if (!result.success) {
            Toast.error(result.message);
            this.refresh();
            return;
        }
        Toast.success(result.message);
        window.game.ui.itemGrid.refresh();
        window.game.ui.heroView.refresh();
        window.game.save();
        this.refresh();
    }
}

const equipmentStarModal = new EquipmentStarModal();
window.equipmentStarModal = equipmentStarModal;
