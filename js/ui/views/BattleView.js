/**
 * 战斗场景视图
 */
class BattleView {
    constructor() {
        this.element = document.getElementById('main-display');
        this.visible = false;
    }

    show() {
        this.visible = true;
    }

    hide() {
        this.visible = false;
        this.stopBattle();
        this.element.innerHTML = '';
    }

    async startBattle(dungeonId) {
        // 调试日志
        window._battleDebug = { startTime: Date.now() };
        
        const dungeon = dungeonManager.getDungeon(dungeonId);
        const playerLevel = window.game.player.level;
        
        // 检查是否有英雄
        const heroes = heroManager.createBattleUnits();
        console.log('[BattleView] heroes count:', heroes.length);
        
        // 检查敌人
        const enemies = dungeon.createEnemies(playerLevel);
        console.log('[BattleView] enemies count:', enemies.length);
        
        if (heroes.length === 0) {
            alert('没有可战斗的英雄！');
            eventManager.emit('viewChange', { view: 'dungeon' });
            return;
        }
        
        if (enemies.length === 0) {
            alert('没有敌人！');
            eventManager.emit('viewChange', { view: 'dungeon' });
            return;
        }
        
        battleManager.initBattle(heroes, enemies, window.game.settings.skipBattle ? 'skip' : 'normal');
        this.render(heroes, enemies);
        
        // 添加超时保护
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('战斗超时')), 30000);
        });
        
        try {
            const result = await Promise.race([
                battleManager.executeBattle(),
                timeoutPromise
            ]);
            console.log('[BattleView] got result:', result, 'time:', Date.now() - window._battleDebug.startTime);
            this.onBattleEnd(result, dungeon);
        } catch (e) {
            console.error('[BattleView] battle error:', e);
            alert('战斗出错: ' + e.message);
            eventManager.emit('viewChange', { view: 'dungeon' });
        }
    }

    render(heroes, enemies) {
        this.element.innerHTML = `
            <div class="battle-view">
                <h2 class="battle-title">战斗进行中</h2>
                <div class="battle-field">
                    <div id="battle-heroes" class="battle-side"></div>
                    <div style="font-size:32px;">⚔️</div>
                    <div id="battle-enemies" class="battle-side"></div>
                </div>
                <div class="battle-actions">
                    <button class="btn btn-secondary" onclick="window.game.ui.battleView.toggleBattleSpeed()">
                        ${window.game.settings.skipBattle ? '跳过' : '正常'}速度
                    </button>
                    <button class="btn btn-danger" onclick="window.game.ui.battleView.fleeBattle()">逃跑</button>
                </div>
                <div id="battle-log" class="battle-log"></div>
            </div>
        `;
        this.renderUnits(heroes, 'battle-heroes');
        this.renderUnits(enemies, 'battle-enemies');
        eventManager.on('battleUnitAction', (data) => this.onBattleAction(data));
        eventManager.on('battleUnitDie', (data) => this.onUnitDie(data));
    }

    renderUnits(units, containerId) {
        const container = this.element.querySelector(`#${containerId}`);
        if (!container) {
            console.error('[BattleView] container not found:', containerId);
            return;
        }
        container.innerHTML = '';
        units.forEach(unit => {
            const unitElement = document.createElement('div');
            unitElement.className = 'battle-unit';
            unitElement.id = `unit-${unit.id}`;
            unitElement.dataset.alive = 'true';
            unitElement.innerHTML = `
                <div class="battle-avatar">${unit.icon}</div>
                <div class="battle-name">${unit.name}</div>
                <div class="battle-hp-bar">
                    <div class="battle-hp-fill" style="width:100%;"></div>
                </div>
                <div class="battle-hp-text">${unit.hp}/${unit.maxHp}</div>
            `;
            container.appendChild(unitElement);
        });
    }

    onBattleAction(data) {
        if (!data || !data.target) {
            console.error('[BattleView] onBattleAction: invalid data', data);
            return;
        }
        this.updateUnitHP(data.target.id, data.target.hp, data.target.maxHp);
        const attackerName = data.attacker?.name || '未知';
        const targetName = data.target?.name || '未知';
        this.addBattleLog(`${attackerName} 对 ${targetName} 造成 ${data.damage} 点伤害`);
    }

    onUnitDie(data) {
        const unitElement = this.element.querySelector(`#unit-${data.unit.id}`);
        if (unitElement) {
            unitElement.dataset.alive = 'false';
            unitElement.style.opacity = '0.3';
        }
    }

    updateUnitHP(unitId, hp, maxHp) {
        const unitElement = this.element.querySelector(`#unit-${unitId}`);
        if (!unitElement) return;
        const hpFill = unitElement.querySelector('.battle-hp-fill');
        const hpText = unitElement.querySelector('.battle-hp-text');
        const percent = (hp / maxHp * 100).toFixed(1);
        hpFill.style.width = `${percent}%`;
        hpText.textContent = `${hp}/${maxHp}`;
    }

    addBattleLog(message) {
        const logElement = this.element.querySelector('#battle-log');
        if (!logElement) {
            console.error('[BattleView] battle-log element not found');
            return;
        }
        const entry = document.createElement('div');
        entry.className = 'battle-log-entry';
        entry.textContent = String(message);
        logElement.appendChild(entry);
        logElement.scrollTop = logElement.scrollHeight;
    }

    onBattleEnd(result, dungeon) {
        console.log('[BattleView] onBattleEnd called, result:', result);
        
        try {
            this.stopBattle();
            
            setTimeout(() => {
                try {
                    console.log('[BattleView] Processing result, victory:', result ? result.victory : 'no result');
                    
                    // 安全检查 result
                    if (!result) {
                        console.error('[BattleView] result is null/undefined!');
                        this.showBattleResult(false, null);
                        return;
                    }
                    
                    if (result.victory) {
                        console.log('[BattleView] Victory, calculating rewards...');
                        const rewards = dungeon.calculateRewards(window.game.player.level);
                        console.log('[BattleView] rewards:', JSON.stringify(rewards));
                        
                        if (rewards && rewards.gold) {
                            const goldAmount = Number(rewards.gold) || 0;
                            shelterManager.addResource('gold', goldAmount);
                            console.log('[BattleView] Added gold:', goldAmount);
                        }
                        if (rewards && rewards.exp) {
                            window.game.player.exp += Number(rewards.exp) || 0;
                        }
                        
                        if (rewards && rewards.items && rewards.items.length > 0) {
                            rewards.items.forEach(item => {
                                if (item && item.id) {
                                    itemManager.addItem(item.id, item.count || 1);
                                }
                            });
                        }
                        
                        dungeonManager.completeDungeon(dungeon.id, 3);
                        this.showBattleResult(true, rewards);
                    } else {
                        console.log('[BattleView] Defeat');
                        this.showBattleResult(false, null);
                    }
                } catch (innerError) {
                    console.error('[BattleView] Inner error:', innerError);
                    console.error('[BattleView] Stack:', innerError.stack);
                    alert('结算出错: ' + innerError.message);
                }
            }, 500);
        } catch (e) {
            console.error('[BattleView] onBattleEnd error:', e);
            alert('战斗结束出错: ' + e.message);
        }
    }

    showBattleResult(victory, rewards) {
        console.log('[BattleView] showBattleResult called, victory:', victory, 'rewards:', rewards);
        
        try {
            // 准备道具显示 - 使用安全的字符串拼接
            let itemsHtml = '';
            if (victory && rewards && rewards.items && rewards.items.length > 0) {
                const items = [];
                for (let i = 0; i < rewards.items.length; i++) {
                    const item = rewards.items[i];
                    const icon = (item && item.icon) ? String(item.icon) : '📦';
                    const name = (item && item.name) ? String(item.name) : '未知';
                    const count = (item && item.count) ? String(item.count) : '1';
                    items.push('<span style="margin:5px;">' + icon + name + 'x' + count + '</span>');
                }
                itemsHtml = items.join('');
            }
            
            const exp = (rewards && rewards.exp) ? String(rewards.exp) : '0';
            const gold = (rewards && rewards.gold) ? String(rewards.gold) : '0';
            
            const modal = new Modal({
                title: victory ? '战斗胜利' : '战斗失败',
                content: `
                    <div style="text-align:center;">
                        <div style="font-size:64px;margin-bottom:15px;">${victory ? '🎉' : '💀'}</div>
                        ${victory ? `
                            <p>获得经验: ${exp}</p>
                            <p>获得金币: ${gold}</p>
                            ${itemsHtml ? '<p>获得道具:</p>' + itemsHtml : ''}
                        ` : '<p>再接再厉!</p>'}
                    </div>
                `,
                buttons: [{
                    text: '确定',
                    className: 'btn-primary',
                    onClick: () => {
                        modal.close();
                        eventManager.emit('viewChange', { view: 'dungeon' });
                    }
                }]
            });
            modal.show();
            console.log('[BattleView] Modal shown successfully');
        } catch (e) {
            console.error('[BattleView] showBattleResult error:', e);
            alert('显示结果出错: ' + e.message);
        }
    }

    toggleBattleSpeed() {
        window.game.settings.skipBattle = !window.game.settings.skipBattle;
        battleManager.setBattleSpeed(window.game.settings.skipBattle ? 'skip' : 'normal');
        Toast.info(window.game.settings.skipBattle ? '已开启跳过战斗' : '已恢复正常速度');
    }

    fleeBattle() {
        if (confirm('确定要逃跑吗?')) {
            this.stopBattle();
            eventManager.emit('viewChange', { view: 'dungeon' });
        }
    }

    stopBattle() {
        eventManager.off('battleUnitAction');
        eventManager.off('battleUnitDie');
        battleManager.reset();
    }
}

const battleView = new BattleView();

// 暴露到全局
window.battleView = battleView;
