/**
 * 英雄卡片组件
 */
class HeroCard {
    constructor(config) {
        this.config = {
            hero: null,
            selected: false,
            onClick: null,
            ...config
        };

        this.element = this.create();
        this.setupEvents();
    }

    /**
     * 创建英雄卡片
     * @returns {HTMLElement}
     */
    create() {
        const hero = this.config.hero;
        if (!hero) {
            const empty = document.createElement('div');
            empty.className = 'hero-card card';
            empty.innerHTML = '<div class="hero-avatar">📦</div><div class="hero-name">空</div>';
            return empty;
        }

        const card = document.createElement('div');
        card.className = 'hero-card card';

        const isInTeam = typeof heroManager !== 'undefined'
            && heroManager
            && typeof heroManager.isHeroInTeam === 'function'
            && heroManager.isHeroInTeam(hero.id);

        if (this.config.selected || isInTeam) {
            card.classList.add('selected');
        }

        const rarityColor = this.getRarityColor(hero.rarity);
        const starInfo = HeroConfig.getStarDisplayInfo(hero.stars);
        card.style.borderColor = rarityColor;

        if (isInTeam) {
            const badge = document.createElement('div');
            badge.className = 'hero-team-badge';
            badge.textContent = '已参战';
            card.appendChild(badge);
        }

        const avatar = document.createElement('div');
        avatar.className = 'hero-avatar';
        avatar.textContent = hero.icon;
        avatar.style.color = rarityColor;
        card.appendChild(avatar);

        const name = document.createElement('div');
        name.className = 'hero-name';
        name.textContent = hero.name;
        name.style.color = rarityColor;
        card.appendChild(name);

        const level = document.createElement('div');
        level.className = 'hero-level';
        level.textContent = `Lv.${hero.level}`;
        card.appendChild(level);

        const stars = document.createElement('div');
        stars.className = `hero-stars ${starInfo.className}`;
        stars.textContent = starInfo.text;
        stars.title = starInfo.label;
        card.appendChild(stars);

        const power = document.createElement('div');
        power.className = 'hero-power';
        power.textContent = `战力:${hero.getPower()}`;
        card.appendChild(power);

        return card;
    }

    /**
     * 获取稀有度颜色
     * @param {string} rarity - 稀有度
     * @returns {string}
     */
    getRarityColor(rarity) {
        const colors = {
            common: '#a0a0a0',
            rare: '#a335ee',
            epic: '#ff8000',
            legendary: '#ffcc00'
        };
        return colors[rarity] || colors.common;
    }

    /**
     * 设置事件
     */
    setupEvents() {
        if (this.config.onClick) {
            this.element.addEventListener('click', this.config.onClick);
        }
    }

    /**
     * 更新英雄
     * @param {Hero} hero - 英雄对象
     */
    updateHero(hero) {
        this.config.hero = hero;

        const oldElement = this.element;
        this.element = this.create();
        this.setupEvents();

        if (oldElement.parentNode) {
            oldElement.parentNode.replaceChild(this.element, oldElement);
        }
    }

    /**
     * 设置选中状态
     * @param {boolean} selected - 是否选中
     */
    setSelected(selected) {
        this.config.selected = selected;
        if (selected) {
            this.element.classList.add('selected');
        } else {
            this.element.classList.remove('selected');
        }
    }

    /**
     * 渲染到容器
     * @param {HTMLElement} container - 容器
     */
    render(container) {
        if (typeof container === 'string') {
            container = document.getElementById(container);
        }
        if (container) {
            container.appendChild(this.element);
        }
    }

    /**
     * 销毁
     */
    destroy() {
        if (this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        if (this.config.onClick) {
            this.element.removeEventListener('click', this.config.onClick);
        }
    }
}
