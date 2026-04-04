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
        list.innerHTML = '';
        if (dungeons.length === 0) {
            list.innerHTML = '<div style="text-align:center;color:#a0a0a0;">暂无可用副本</div>';
            return;
        }
        dungeons.forEach(dungeon => list.appendChild(this.createDungeonCard(dungeon)));
    }

    createDungeonCard(dungeon) {
        const info = dungeon.getInfo();
        const completed = dungeonManager.isCompleted(dungeon.id);
        const stars = dungeonManager.getStars(dungeon.id);
        const canSweep = dungeonManager.canSweep(dungeon.id);
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
            <div class="dungeon-card-actions">
                <button class="btn btn-primary" onclick="window.game.ui.dungeonView.enterDungeon('${dungeon.id}')">战斗</button>
                <button class="btn ${canSweep ? 'btn-success' : 'btn-secondary'}" ${canSweep ? '' : 'disabled'} onclick="window.game.ui.dungeonView.sweepDungeon('${dungeon.id}')">扫荡</button>
            </div>

        `;
        return card;
    }

    consumeEnergyForDungeon(dungeon) {
        if (window.game.player.energy < dungeon.energyCost) {
            Toast.error(`体力不足,需要 ${dungeon.energyCost}`);
            return false;
        }
        window.game.player.energy -= dungeon.energyCost;
        eventManager.emit('playerUpdate', {
            energy: window.game.player.energy,
            maxEnergy: window.game.player.maxEnergy
        });
        return true;
    }

    enterDungeon(dungeonId) {
        const dungeon = dungeonManager.getDungeon(dungeonId);
        if (!dungeon) {
            Toast.error('地牢不存在');
            return;
        }
        if (!dungeon.canEnter(window.game.player.level)) {
            Toast.error(`需要等级 ${dungeon.level}`);
            return;
        }
        if (heroManager.getTeam().length === 0) {
            Toast.error('请先配置参战英雄');
            return;
        }
        if (!this.consumeEnergyForDungeon(dungeon)) {
            return;
        }
        window.game.save();
        eventManager.emit('enterBattle', { dungeonId, sceneId: dungeon.sceneId });
    }

    async sweepDungeon(dungeonId) {
        const dungeon = dungeonManager.getDungeon(dungeonId);
        if (!dungeon) {
            Toast.error('地牢不存在');
            return;
        }
        if (!dungeonManager.canSweep(dungeonId)) {
            Toast.info('首次通关后才能扫荡');
            return;
        }
        const teamIds = heroManager.getTeamIds();
        if (teamIds.length === 0) {
            Toast.error('请先配置参战英雄');
            return;
        }
        if (!this.consumeEnergyForDungeon(dungeon)) {
            return;
        }

        const rewardResult = window.game.grantDungeonVictoryRewards(dungeon, teamIds);
        await RewardModal.show({
            title: '扫荡完成',
            rewards: rewardResult.rewardEntries,
            summaryText: '无需进入战斗场景，已直接结算本次副本奖励'
        });
        this.refresh();
    }

    refresh() {
        if (this.visible) {
            this.render();
        }
    }
}

const dungeonView = new DungeonView();
window.dungeonView = dungeonView;
