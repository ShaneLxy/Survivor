/**
 * 气泡浮层组件 - 用于显示操作菜单
 */
class FloatingMenu {
    constructor(options = {}) {
        this.targetElement = options.targetElement || null;
        this.buttons = options.buttons || [];
        this.onClose = options.onClose || null;
        this.position = options.position || 'right'; // 'right', 'bottom'
        this.element = null;
        this.isShown = false;
    }

    /**
     * 显示气泡菜单
     * @param {HTMLElement} target - 目标元素
     * @param {Array} buttons - 按钮配置数组 [{text, onClick, className}]
     */
    show(target, buttons) {
        this.targetElement = target;
        this.buttons = buttons || this.buttons;
        
        // 如果已有菜单，先关闭
        if (this.isShown) {
            this.hide();
        }

        this.create();
        this.positionMenu();
        document.addEventListener('click', this.handleOutsideClick.bind(this));
        this.isShown = true;
    }

    /**
     * 创建DOM元素
     */
    create() {
        // 创建容器
        this.element = document.createElement('div');
        this.element.className = 'floating-menu';
        
        // 创建按钮
        this.buttons.forEach(btn => {
            const button = document.createElement('button');
            button.className = btn.className || 'btn btn-sm';
            button.textContent = btn.text;
            button.onclick = (e) => {
                e.stopPropagation();
                if (btn.onClick) {
                    btn.onClick();
                }
                this.hide();
            };
            this.element.appendChild(button);
        });

        document.body.appendChild(this.element);
    }

    /**
     * 定位菜单
     */
    positionMenu() {
        if (!this.targetElement || !this.element) return;

        const targetRect = this.targetElement.getBoundingClientRect();
        const menuStyle = this.element.style;

        if (this.position === 'right') {
            // 显示在目标右侧
            menuStyle.left = `${targetRect.right + 10}px`;
            menuStyle.top = `${targetRect.top}px`;
        } else {
            // 显示在目标下方
            menuStyle.left = `${targetRect.left}px`;
            menuStyle.top = `${targetRect.bottom + 10}px`;
        }

        // 检查是否超出屏幕
        const menuRect = this.element.getBoundingClientRect();
        if (menuRect.right > window.innerWidth) {
            menuStyle.left = `${window.innerWidth - menuRect.width - 10}px`;
        }
        if (menuRect.bottom > window.innerHeight) {
            menuStyle.top = `${targetRect.top - menuRect.height - 10}px`;
        }
    }

    /**
     * 处理点击外部区域
     */
    handleOutsideClick(e) {
        if (this.element && !this.element.contains(e.target) && 
            !this.targetElement.contains(e.target)) {
            this.hide();
        }
    }

    /**
     * 隐藏菜单
     */
    hide() {
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
        document.removeEventListener('click', this.handleOutsideClick.bind(this));
        this.isShown = false;
        if (this.onClose) {
            this.onClose();
        }
    }

    /**
     * 检查是否正在显示
     */
    isShowing() {
        return this.isShown;
    }
}

// 全局实例
window.floatingMenu = new FloatingMenu();