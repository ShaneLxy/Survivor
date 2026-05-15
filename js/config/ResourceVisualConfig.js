const ResourceVisualConfig = {
    icons: {
        gold: { src: 'assets/images/items/resource-gold.png', fallback: 'G' },
        wood: { src: 'assets/images/items/resource-wood.png', fallback: 'W' },
        stone: { src: 'assets/images/items/resource-stone.png', fallback: 'S' },
        meat: { src: 'assets/images/items/resource-meat.png', fallback: 'M' },
        iron_ore: { src: 'assets/images/items/resource-iron-ore.png', fallback: 'I' },
        diamond: { src: 'assets/images/items/resource-diamond.png', fallback: 'D' }
    },

    get(type) {
        const icon = this.icons[type];
        if (!icon) {
            return null;
        }
        return {
            ...icon,
            src: icon.src ? (window.VersionManager?.getVersionedAssetUrl?.(icon.src) || icon.src) : icon.src
        };
    },

    getIconMarkup(type, className = 'resource-icon-image') {
        const icon = this.get(type);
        if (!icon?.src) {
            return '';
        }
        return `<img class="${className}" src="${icon.src}" alt="${type}">`;
    },

    applyToElement(element, type, fallbackText = '') {
        if (!element) {
            return;
        }
        const icon = this.get(type);
        if (!icon?.src) {
            element.textContent = fallbackText || type || '';
            return;
        }
        element.innerHTML = `<img class="resource-icon-image" src="${icon.src}" alt="${type}">`;
    }
};

window.ResourceVisualConfig = ResourceVisualConfig;
