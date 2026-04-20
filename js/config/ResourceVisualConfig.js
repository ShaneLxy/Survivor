const ResourceVisualConfig = {
    icons: {
        gold: { src: 'assets/icons/resource-gold.svg', fallback: 'G' },
        wood: { src: 'assets/icons/resource-wood.svg', fallback: 'W' },
        stone: { src: 'assets/icons/resource-stone.svg', fallback: 'S' }
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
