/**
 * 道具卡片组件
 */
class ItemCard {
    constructor(config) {
        this.config = {
            item: null,
            disabled: false,
            onClick: null,
            onLongPress: null,
            ...config
        };

        this.element = this.create();
        this.setupEvents();
    }

    /**
     * 创建道具卡片
     * @returns {HTMLElement}
     */
    create() {
        const item = this.config.item;
        if (!item) {
            const empty = document.createElement('div');
            empty.className = 'item-card item-card-empty';
            empty.setAttribute('aria-hidden', 'true');
            return empty;
        }

        const card = document.createElement('div');
        card.className = `item-card card item-card-${item.type || 'item'} item-rarity-${item.rarity || 'common'}`;
        if (this.config.disabled) {
            card.classList.add('disabled');
        }

        const rarityColor = this.getRarityColor(item.rarity);
        card.style.setProperty('--item-rarity-color', rarityColor);
        card.style.borderColor = rarityColor;
        card.title = `${item.name || '物品'} x${item.totalCount || item.count || 1}`;

        // 图标
        const icon = document.createElement('div');
        icon.className = 'item-icon';
        if (item.iconSrc) {
            icon.innerHTML = `<img class="resource-icon-image item-icon-image" src="${item.iconSrc}" alt="${item.name}">`;
        } else {
            icon.textContent = item.icon;
            icon.style.color = rarityColor;
        }
        card.appendChild(icon);

        // 数量
        if (item.count > 1 || item.stackLimit > 1) {
            const count = document.createElement('div');
            count.className = 'item-count';
            count.textContent = item.displayCount || item.count;
            card.appendChild(count);
        }

        // 名称
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

        // 长按事件
        if (this.config.onLongPress) {
            let timer = null;

            this.element.addEventListener('touchstart', (e) => {
                timer = setTimeout(() => {
                    this.config.onLongPress(this.config.item, e);
                }, 500);
            });

            this.element.addEventListener('touchend', () => {
                if (timer) clearTimeout(timer);
            });

            this.element.addEventListener('touchmove', () => {
                if (timer) clearTimeout(timer);
            });
        }
    }

    /**
     * 更新道具
     * @param {Item} item - 道具对象
     */
    updateItem(item) {
        this.config.item = item;

        const oldElement = this.element;
        this.element = this.create();
        this.setupEvents();

        if (oldElement.parentNode) {
            oldElement.parentNode.replaceChild(this.element, oldElement);
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
