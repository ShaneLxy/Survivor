/**
 * 进度条组件
 */
class ProgressBar {
    constructor(config) {
        this.config = {
            value: 0,
            max: 100,
            showText: true,
            color: '#4ade80',
            ...config
        };

        this.element = this.create();
        this.update(this.config.value, this.config.max);
    }

    /**
     * 创建进度条
     * @returns {HTMLElement}
     */
    create() {
        const container = document.createElement('div');
        container.className = 'progress-bar-container';

        const fill = document.createElement('div');
        fill.className = 'progress-bar-fill';
        fill.style.background = `linear-gradient(90deg, ${this.config.color} 0%, ${this.adjustColor(this.config.color, -20)} 100%)`;

        const text = document.createElement('div');
        text.className = 'progress-bar-text';

        container.appendChild(fill);
        container.appendChild(text);

        this.fillElement = fill;
        this.textElement = text;

        if (!this.config.showText) {
            text.style.display = 'none';
        }

        return container;
    }

    /**
     * 调整颜色亮度
     * @param {string} color - 颜色
     * @param {number} amount - 调整量
     * @returns {string}
     */
    adjustColor(color, amount) {
        const hex = color.replace('#', '');
        const num = parseInt(hex, 16);
        const r = (num >> 16) + amount;
        const g = ((num >> 8) & 0x00FF) + amount;
        const b = (num & 0x0000FF) + amount;

        const newColor = Math.min(255, Math.max(0, r | g << 8 | b << 16));
        return '#' + (0x1000000 + newColor).toString(16).slice(1);
    }

    /**
     * 更新进度
     * @param {number} value - 当前值
     * @param {number} max - 最大值
     */
    update(value, max) {
        if (max !== undefined) {
            this.config.max = max;
        }

        this.config.value = value;

        const percent = Math.min(100, Math.max(0, (value / this.config.max) * 100));
        this.fillElement.style.width = `${percent}%`;

        if (this.config.showText) {
            this.textElement.textContent = `${value}/${this.config.max}`;
        }
    }

    /**
     * 设置颜色
     * @param {string} color - 颜色
     */
    setColor(color) {
        this.config.color = color;
        this.fillElement.style.background = `linear-gradient(90deg, ${color} 0%, ${this.adjustColor(color, -20)} 100%)`;
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
    }
}
