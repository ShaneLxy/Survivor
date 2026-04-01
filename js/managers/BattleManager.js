/**
 * 战斗管理器 - 单例模式
 */
class BattleManager {
    constructor() {
        if (BattleManager.instance) {
            return BattleManager.instance;
        }
        this.heroes = [];
        this.enemies = [];
        this.battleLog = [];
        this.currentRound = 0;
        this.isBattling = false;
        this.result = null;
        this.battleSpeed = 'normal'; // 'normal' or 'skip'
        BattleManager.instance = this;
    }

    /**
     * 初始化战斗
     * @param {Array<BattleUnit>} heroes - 英雄单位
     * @param {Array<BattleUnit>} enemies - 敌人单位
     * @param {string} speed - 战斗速度
     */
    initBattle(heroes, enemies, speed = 'normal') {
        this.heroes = heroes;
        this.enemies = enemies;
        this.battleLog = [];
        this.currentRound = 0;
        this.isBattling = true;
        this.result = null;
        this.battleSpeed = speed;

        this.addLog('battle', '战斗开始!');
        eventManager.emit('battleStart', { heroes, enemies });
    }

    /**
     * 执行战斗
     * @returns {Promise<Object>}
     */
    executeBattle() {
        return new Promise((resolve) => {
            // 确保战斗状态正确
            this.isBattling = true;
            
            // 同步执行战斗（跳过模式）
            while (this.isBattling) {
                this.currentRound++;
                this.addLog('round', `第 ${this.currentRound} 回合`);
                this.executeRound();

                if (this.checkBattleEnd()) {
                    this.isBattling = false;
                    break;
                }

                // 防止无限循环
                if (this.currentRound >= 100) {
                    this.isBattling = false;
                    this.result = { victory: false, reason: 'max_rounds' };
                    break;
                }
            }
            
            console.log('[BattleManager] executeBattle done, result:', this.result);
            resolve(this.result);
        });
    }

    /**
     * 执行一回合
     */
    executeRound() {
        // 生成行动队列(按速度排序)
        const allUnits = [...this.heroes, ...this.enemies];
        allUnits.sort((a, b) => b.speed - a.speed);

        for (const unit of allUnits) {
            if (!unit.isAlive()) continue;

            const isHero = this.heroes.includes(unit);
            const targets = isHero ? this.enemies : this.heroes;
            const aliveTargets = targets.filter(t => t.isAlive());

            if (aliveTargets.length === 0) break;

            // 选择目标(优先攻击血量最低的)
            const target = aliveTargets.sort((a, b) => a.hp - b.hp)[0];

            // 决定是否使用技能(30%概率使用)
            const useSkill = Math.random() < 0.3 && unit.skill;

            const attackResult = unit.attack(target, useSkill);

            // 记录战斗日志
            this.addLog('damage',
                `${attackResult.attacker} 对 ${attackResult.target} 造成 ${attackResult.damage} 点伤害${useSkill ? ` [${attackResult.skillName}]` : ''}`
            );

            eventManager.emit('battleUnitAction', {
                attacker: unit,
                target,
                damage: attackResult.damage,
                useSkill
            });

            if (!target.isAlive()) {
                this.addLog('death', `${target.name} 倒下了!`);
                eventManager.emit('battleUnitDie', { unit: target });
            }
        }
    }

    /**
     * 检查战斗是否结束
     * @returns {boolean}
     */
    checkBattleEnd() {
        const heroesAlive = this.heroes.filter(h => h.isAlive()).length;
        const enemiesAlive = this.enemies.filter(e => e.isAlive()).length;

        if (enemiesAlive === 0) {
            this.result = {
                victory: true,
                survivors: this.heroes.filter(h => h.isAlive())
            };
            this.addLog('result', '战斗胜利!');
            eventManager.emit('battleEnd', this.result);
            return true;
        } else if (heroesAlive === 0) {
            this.result = {
                victory: false,
                survivors: []
            };
            this.addLog('result', '战斗失败...');
            eventManager.emit('battleEnd', this.result);
            return true;
        }

        return false;
    }

    /**
     * 添加战斗日志
     * @param {string} type - 日志类型
     * @param {string} message - 消息
     */
    addLog(type, message) {
        this.battleLog.push({
            round: this.currentRound,
            type,
            message,
            timestamp: Date.now()
        });
    }

    /**
     * 获取战斗日志
     * @returns {Array}
     */
    getBattleLog() {
        return this.battleLog;
    }

    /**
     * 获取战斗结果
     * @returns {Object|null}
     */
    getResult() {
        return this.result;
    }

    /**
     * 重置
     */
    reset() {
        this.heroes = [];
        this.enemies = [];
        this.battleLog = [];
        this.currentRound = 0;
        this.isBattling = false;
        this.result = null;
    }

    /**
     * 设置战斗速度
     * @param {string} speed - 战斗速度
     */
    setBattleSpeed(speed) {
        this.battleSpeed = speed;
    }
}

// 导出单例
const battleManager = new BattleManager();

// 暴露到全局
window.battleManager = battleManager;
