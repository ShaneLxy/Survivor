/**
 * 地牢场景视图
 */
class DungeonView {
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
        this.element.innerHTML = `
            <div class="dungeon-view">
                <h2 class="dungeon-title">副本探索</h2>
                <div id="dungeon-list" class="dungeon-list"></div>
            </div>
        `;
        this.renderDungeons();
    }

    renderDungeons() {
        const list = this.element.querySelector('#dungeon-list');
        const playerLevel = window.game.player.level;
        const dungeons = dungeonManager.getDungeonsByLevel(playerLevel);
        if (dungeons.length === 0) {
            list.innerHTML = '<div style="text-align:center;color:#a0a0a0;">暂无可用副本</div>';
            return;
        }
        dungeons.forEach(dungeon => {
            const card = this.createDungeonCard(dungeon);
            list.appendChild(card);
        });
    }

    createDungeonCard(dungeon) {
        const info = dungeon.getInfo();
        const completed = dungeonManager.isCompleted(dungeon.id);
        const stars = dungeonManager.getStars(dungeon.id);
        const card = document.createElement('div');
        card.className = 'dungeon-item card';
        card.innerHTML = `
            <div class="dungeon-icon">${info.icon}</div>
            <div class="dungeon-info">
                <div class="dungeon-name">${info.name} ${completed ? '(已完成)' : ''}</div>
                <div class="dungeon-level">推荐等级: ${info.level} | 体力消耗: ${info.energyCost}</div>
                <div class="dungeon-reward">敌人数量: ${info.enemyCount}</div>
                <div style="color:#ffd700;">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
            </div>
            <button class="btn btn-primary" onclick="window.game.ui.dungeonView.enterDungeon('${dungeon.id}')">进入</button>
        `;
        return card;
    }

    enterDungeon(dungeonId) {
        const dungeon = dungeonManager.getDungeon(dungeonId);
        const playerLevel = window.game.player.level;
        const playerEnergy = window.game.player.energy;
        if (!dungeon) {
            Toast.error('地牢不存在');
            return;
        }
        if (!dungeon.canEnter(playerLevel)) {
            Toast.error(`需要等级 ${dungeon.level}`);
            return;
        }
        if (playerEnergy < dungeon.energyCost) {
            Toast.error(`体力不足,需要 ${dungeon.energyCost}`);
            return;
        }
        window.game.player.energy -= dungeon.energyCost;
        eventManager.emit('playerUpdate', {
            energy: window.game.player.energy,
            maxEnergy: window.game.player.maxEnergy
        });
        eventManager.emit('enterBattle', { dungeonId });
    }

    refresh() {
        if (this.visible) this.render();
    }
}

const dungeonView = new DungeonView();

// 暴露到全局
window.dungeonView = dungeonView;
