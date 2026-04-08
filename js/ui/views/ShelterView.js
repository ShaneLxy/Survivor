/**
 * 避难所场景视图
 */
class ShelterView {
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

    getSceneMediaMarkup(sceneKey) {
        const mediaConfig = window.GameSceneBackgrounds?.[sceneKey];
        if (!mediaConfig?.src) {
            return '';
        }
        if (mediaConfig.type === 'video') {
            const poster = mediaConfig.poster ? ` poster="${mediaConfig.poster}"` : '';
            const mimeType = mediaConfig.mimeType || 'video/mp4';
            return `
                <video class="scene-loop-media" autoplay muted loop playsinline${poster}>
                    <source src="${mediaConfig.src}" type="${mimeType}">
                </video>
            `;
        }
        return `<img class="scene-loop-media" src="${mediaConfig.src}" alt="">`;
    }

    render() {
        this.element.innerHTML = `
            <div class="scene-view shelter-view shelter-scene-view">
                <div class="scene-view-backdrop shelter-scene-backdrop">
                    ${this.getSceneMediaMarkup('shelter')}
                    <div class="scene-backdrop-glow scene-backdrop-glow-a"></div>
                    <div class="scene-backdrop-glow scene-backdrop-glow-b"></div>
                    <div class="scene-backdrop-grid"></div>
                </div>
                <div class="scene-view-overlay"></div>
                <div class="scene-view-content">
                    <h2 class="shelter-title">避难所</h2>
                    <div id="building-grid" class="building-grid"></div>
                </div>
            </div>
        `;
        this.renderBuildings();
    }

    renderBuildings() {
        const grid = this.element.querySelector('#building-grid');
        const buildings = shelterManager.getAllBuildings();

        if (!buildings || buildings.length === 0) {
            grid.innerHTML = '<div style="text-align:center;padding:20px;color:#888;">暂无建筑</div>';
            return;
        }

        buildings.forEach(building => {
            const card = this.createBuildingCard(building);
            grid.appendChild(card);
        });
    }

    createBuildingCard(building) {
        const card = document.createElement('div');
        card.className = 'building-card card';

        try {
            const info = building.getInfo();
            card.innerHTML = `
                <div class="building-icon">${info.icon}</div>
                <div class="building-name">${info.name}</div>
                <div class="building-level">Lv.${info.level}</div>
                <div class="building-effect">${this.getEffectText(info.effect)}</div>
                ${this.getUpgradeButton(info)}
            `;
        } catch (e) {
            console.error('[ShelterView] Error creating card:', e);
            card.innerHTML = '<div style="color:red;">加载失败</div>';
        }
        return card;
    }

    getEffectText(effect) {
        if (!effect) return '';
        switch (effect.type) {
            case 'energyBonus':
                return `体力+${effect.value}`;
            case 'production':
                return (effect.outputs || [])
                    .map(output => `${output.type === 'item' ? (ItemConfig.getItemConfig(output.id)?.name || output.id) : shelterManager.getResourceDisplayName(output.id)} ${output.amountPerHour}/小时`)
                    .join(' · ');
            case 'statBonus':
                return `属性加成${(effect.value * 100).toFixed(0)}%`;
            default:
                return '';
        }
    }

    getUpgradeButton(info) {
        if (!info.canUpgrade) {
            return '<button class="btn btn-small btn-secondary" disabled>已满级</button>';
        }
        if (!info.upgradeCost) {
            return '<button class="btn btn-small btn-secondary" disabled>暂无升级数据</button>';
        }
        const costText = Object.entries(info.upgradeCost)
            .map(([type, amount]) => `${shelterManager.getResourceDisplayName(type)}:${amount}`)
            .join(' ');
        return `<button class="btn btn-small btn-primary" onclick="window.game.ui.shelterView.upgradeBuilding('${info.id}')">升级 (${costText})</button>`;
    }

    upgradeBuilding(buildingId) {
        const result = shelterManager.upgradeBuilding(buildingId);
        if (result.success) {
            Toast.success(result.message);
            this.render();
            window.game.save();
        } else {
            Toast.error(result.message);
        }
    }

    refresh() {
        if (this.visible) {
            this.render();
        }
    }
}

const shelterView = new ShelterView();
window.shelterView = shelterView;
