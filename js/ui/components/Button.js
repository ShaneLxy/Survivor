/**
 * 按钮组件
 */
class Button {
    constructor(config) {
        this.config = {
            text: '',
            className: 'btn-primary',
            disabled: false,
            onClick: null,
            ...config
        };

        this.element = this.create();
    }

    /**
     * 创建按钮元素
     * @returns {HTMLElement}
     */
    create() {
        const button = document.createElement('button');
        button.className = `btn ${this.config.className}`;
        button.textContent = this.config.text;

        if (this.config.disabled) {
            button.disabled = true;
            button.classList.add('disabled');
        }

        if (this.config.onClick) {
            button.addEventListener('click', this.config.onClick);
        }

        return button;
    }

    /**
     * 渲染到容器
     * @param {HTMLElement} container - 容器元素
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
     * 设置文本
     * @param {string} text - 文本
     */
    setText(text) {
        this.element.textContent = text;
    }

    /**
     * 禁用
     * @param {boolean} disabled - 是否禁用
     */
    setDisabled(disabled) {
        this.element.disabled = disabled;
        if (disabled) {
            this.element.classList.add('disabled');
        } else {
            this.element.classList.remove('disabled');
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
