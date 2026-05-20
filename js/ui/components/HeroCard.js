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

    create() {
        const hero = this.config.hero;
        if (!hero) {
            const empty = document.createElement('div');
            empty.className = 'hero-card card';
            empty.innerHTML = '<div class="hero-avatar">📦</div>';
            return empty;
        }

        const card = document.createElement('div');
        card.className = 'hero-card card';
        card.dataset.heroId = hero.id || '';
        card.dataset.heroConfigId = hero.configId || '';

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
        card.style.setProperty('--hero-card-rarity', rarityColor);

        if (isInTeam) {
            const badge = document.createElement('div');
            badge.className = 'hero-team-badge';
            badge.textContent = '参战';
            card.appendChild(badge);
        }

        const professionIcon = hero.professionIcon || HeroConfig.getProfessionIconPath?.(hero.profession);
        if (professionIcon) {
            const professionBadge = document.createElement('div');
            professionBadge.className = 'hero-profession-badge';
            professionBadge.title = HeroConfig.getProfessionName(hero.profession);
            professionBadge.innerHTML = `<img class="hero-profession-badge-image" src="${professionIcon}" alt="${HeroConfig.getProfessionName(hero.profession)}">`;
            card.appendChild(professionBadge);
        }

        const portrait = hero.cardPortrait || hero.portrait || null;
        const avatar = document.createElement('div');
        avatar.className = `hero-avatar ${portrait ? 'hero-avatar-portrait' : ''}`;
        if (portrait) {
            avatar.innerHTML = `<img class="hero-avatar-image" src="${portrait}" alt="${hero.name}" loading="lazy" decoding="async" draggable="false">`;
        } else {
            avatar.textContent = hero.icon || '❓';
            avatar.style.color = rarityColor;
        }
        card.appendChild(avatar);

        const level = document.createElement('div');
        level.className = 'hero-level';
        level.textContent = `Lv.${hero.level}`;
        card.appendChild(level);

        const stars = document.createElement('div');
        stars.className = `hero-stars ${starInfo.className}`;
        stars.textContent = starInfo.text;
        stars.title = starInfo.label;
        card.appendChild(stars);

        const metaRow = document.createElement('div');
        metaRow.className = 'hero-card-meta-row';

        const power = document.createElement('div');
        power.className = 'hero-power';
        power.textContent = `战力 ${GameConfig.formatCombatPower(hero.getPower())}`;
        metaRow.appendChild(power);
        card.appendChild(metaRow);

        return card;
    }

    getRarityColor(rarity) {
        const colors = {
            common: '#a0a0a0',
            rare: '#a335ee',
            epic: '#ff8000',
            legendary: '#ffcc00'
        };
        return colors[rarity] || colors.common;
    }

    setupEvents() {
        if (this.config.onClick) {
            this.element.addEventListener('click', this.config.onClick);
        }
    }

    updateHero(hero) {
        this.config.hero = hero;

        const oldElement = this.element;
        this.element = this.create();
        this.setupEvents();

        if (oldElement.parentNode) {
            oldElement.parentNode.replaceChild(this.element, oldElement);
        }
    }

    setSelected(selected) {
        this.config.selected = selected;
        if (selected) {
            this.element.classList.add('selected');
        } else {
            this.element.classList.remove('selected');
        }
    }

    render(container) {
        if (typeof container === 'string') {
            container = document.getElementById(container);
        }
        if (container) {
            container.appendChild(this.element);
        }
    }

    destroy() {
        if (this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        if (this.config.onClick) {
            this.element.removeEventListener('click', this.config.onClick);
        }
    }
}
