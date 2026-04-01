/**
 * 英雄管理场景视图
 */
class HeroView {
    constructor() {
        this.element = document.getElementById('main-display');
        this.visible = false;
        this.teamModal = null; // 缓存编队窗口实例
        this.heroDetailModal = null; // 缓存英雄详情窗口实例
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
            <div class="hero-view">
                <h2 class="hero-view-title">英雄管理</h2>
                <div style="display:flex;justify-content:center;gap:15px;margin-bottom:20px;">
                    <button class="btn btn-primary" onclick="window.game.ui.heroView.showGacha()">召唤英雄</button>
                    <button class="btn btn-secondary" onclick="window.game.ui.heroView.showTeam()">编队</button>
                </div>
                <div id="hero-grid" class="hero-grid"></div>
            </div>
        `;
        this.renderHeroes();
    }

    renderHeroes() {
        const grid = this.element.querySelector('#hero-grid');
        const heroes = heroManager.getAllHeroes();
        if (heroes.length === 0) {
            grid.innerHTML = '<div style="text-align:center;color:#a0a0a0;">暂无英雄,快去召唤吧!</div>';
            return;
        }
        heroes.forEach(hero => {
            const card = new HeroCard({ hero: hero, onClick: () => this.onHeroClick(hero) });
            card.render(grid);
        });
    }

    onHeroClick(hero) {
        // 如果已有英雄详情窗口且正在显示，则更新内容并返回
        if (this.heroDetailModal && this.heroDetailModal.isShown()) {
            this.updateHeroDetailModal(hero);
            return;
        }

        const info = hero.getInfo();
        // 获取升星所需碎片数量
        const targetStars = info.stars + 1;
        const fragmentCost = targetStars * 50;
        const currentFragments = heroManager.getFragments(hero.configId);
        const hasEnoughFragments = currentFragments >= fragmentCost;

        this.heroDetailModal = new Modal({
            title: hero.name,
            content: `
                <div style="text-align:center;">
                    <div style="font-size:64px;margin-bottom:15px;">${hero.icon}</div>
                    <p style="color:${this.getRarityColor(hero.rarity)}">${this.getRarityName(hero.rarity)}</p>
                    <p>等级: <span id="hero-level">${info.level}</span></p>
                    <p>经验: <span id="hero-exp">${info.exp}</span>/${GameConfig.getExpRequired(info.level)}</p>
                    <p>星级: <span id="hero-stars">${'★'.repeat(info.stars)}</span></p>
                    <p>战力: <span id="hero-power">${info.power}</span></p>
                    <div style="margin-top:15px;text-align:left;">
                        <p>生命: <span id="hero-hp">${info.stats.hp}</span></p>
                        <p>攻击: <span id="hero-attack">${info.stats.attack}</span></p>
                        <p>防御: <span id="hero-defense">${info.stats.defense}</span></p>
                        <p>速度: <span id="hero-speed">${info.stats.speed}</span></p>
                    </div>
                    <div style="margin-top:15px;padding:10px;background:rgba(0,0,0,0.2);border-radius:5px;">
                        <p style="margin:0;">升星消耗: <span id="fragment-cost" style="color:${hasEnoughFragments ? '#4caf50' : '#f44336'}">${fragmentCost}个${hero.name}碎片</span></p>
                        <p style="margin:5px 0 0 0;font-size:12px;color:#a0a0a0;">(当前拥有: ${currentFragments}个)</p>
                    </div>
                </div>
            `,
            buttons: [
                { text: '升级', className: 'btn-primary', onClick: () => { this.levelUpHero(hero); } },
                { text: '升星', className: 'btn-primary', onClick: () => { this.upgradeStars(hero); } },
                { text: '关闭', className: 'btn-secondary', onClick: () => { this.heroDetailModal = null; } }
            ]
        });
        this.heroDetailModal.show();
    }

    // 更新英雄详情窗口内容
    updateHeroDetailModal(hero) {
        if (!this.heroDetailModal || !this.heroDetailModal.isShown()) {
            this.onHeroClick(hero);
            return;
        }

        const info = hero.getInfo();

        // 更新各个数值
        const updateValue = (id, value) => {
            const el = this.heroDetailModal.element.querySelector('#' + id);
            if (el) el.textContent = value;
        };

        updateValue('hero-level', info.level);
        updateValue('hero-exp', info.exp);
        updateValue('hero-stars', '★'.repeat(info.stars));
        updateValue('hero-power', info.power);
        updateValue('hero-hp', info.stats.hp);
        updateValue('hero-attack', info.stats.attack);
        updateValue('hero-defense', info.stats.defense);
        updateValue('hero-speed', info.stats.speed);
    }

    levelUpHero(hero) {
        const result = heroManager.addHeroExp(hero.id, 100);
        if (result) {
            Toast.success(`${hero.name}升级了!`);
            this.render();
            // 更新英雄详情窗口
            this.updateHeroDetailModal(hero);
        } else {
            Toast.info('升级中...');
        }
    }

    upgradeStars(hero) {
        const fragmentCheck = heroManager.canUpgradeStarsWithFragments(hero.id);
        if (!fragmentCheck.can) {
            Toast.error(fragmentCheck.message);
            return;
        }
        // 消耗碎片
        heroManager.removeFragments(hero.configId, fragmentCheck.cost);
        // 执行升星
        const result = heroManager.upgradeHeroStars(hero.id);
        if (result) {
            Toast.success(`${hero.name}升星成功!`);
            this.render();
            // 更新英雄详情窗口
            this.updateHeroDetailModal(hero);
        } else {
            Toast.error('星级已满或条件不足');
        }
    }

    showGacha() {
        eventManager.emit('viewChange', { view: 'gacha' });
    }

    showTeam() {
        // 如果已有编队窗口且正在显示，则不重复创建
        if (this.teamModal && this.teamModal.isShown()) {
            return;
        }

        const heroes = heroManager.getAllHeroes();
        const team = heroManager.getTeam();
        let content = '<div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;">';
        heroes.forEach(hero => {
            const inTeam = team.includes(hero);
            content += `
                <div class="hero-card card ${inTeam ? 'selected' : ''}" style="cursor:pointer;" onclick="window.game.ui.heroView.toggleTeam('${hero.id}')">
                    <div class="hero-avatar">${hero.icon}</div>
                    <div class="hero-name">${hero.name}</div>
                    <div class="hero-level">Lv.${hero.level}</div>
                    ${inTeam ? '<div class="hero-stars">已编队</div>' : ''}
                </div>
            `;
        });
        content += '</div>';
        this.teamModal = new Modal({
            title: '英雄编队',
            content: content,
            buttons: [{ text: '关闭', className: 'btn-secondary', onClick: () => { this.teamModal = null; } }]
        });
        this.teamModal.show();
    }

    toggleTeam(heroId) {
        const hero = heroManager.getHero(heroId);
        const team = heroManager.getTeam();
        if (team.includes(hero)) {
            heroManager.removeFromTeam(heroId);
            Toast.info('已移除编队');
        } else {
            const success = heroManager.addToTeam(heroId);
            if (success) {
                Toast.info('已加入编队');
            } else {
                Toast.error('编队已满');
            }
        }
        // 更新现有窗口内容而不重新创建
        this.updateTeamModal();
    }

    // 更新编队窗口内容
    updateTeamModal() {
        if (!this.teamModal || !this.teamModal.isShown()) {
            this.showTeam();
            return;
        }

        const heroes = heroManager.getAllHeroes();
        const team = heroManager.getTeam();
        let content = '<div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;">';
        heroes.forEach(hero => {
            const inTeam = team.includes(hero);
            content += `
                <div class="hero-card card ${inTeam ? 'selected' : ''}" style="cursor:pointer;" onclick="window.game.ui.heroView.toggleTeam('${hero.id}')">
                    <div class="hero-avatar">${hero.icon}</div>
                    <div class="hero-name">${hero.name}</div>
                    <div class="hero-level">Lv.${hero.level}</div>
                    ${inTeam ? '<div class="hero-stars">已编队</div>' : ''}
                </div>
            `;
        });
        content += '</div>';

        // 更新模态框内容
        const bodyEl = this.teamModal.element.querySelector('.modal-body');
        if (bodyEl) {
            bodyEl.innerHTML = content;
        }
    }

    getRarityColor(rarity) {
        const colors = { common: '#a0a0a0', rare: '#a335ee', epic: '#ff8000', legendary: '#ffcc00' };
        return colors[rarity] || colors.common;
    }

    getRarityName(rarity) {
        const names = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传说' };
        return names[rarity] || '普通';
    }

    refresh() {
        if (this.visible) this.render();
    }
}

const heroView = new HeroView();

// 暴露到全局
window.heroView = heroView;
