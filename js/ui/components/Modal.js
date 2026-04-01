/**
 * 弹窗组件
 */
class Modal {
    constructor(config) {
        this.config = {
            title: '',
            content: '',
            buttons: [],
            showClose: true,
            onClose: null,
            ...config
        };

        this.element = null;
        this.overlay = null;
    }

    /**
     * 创建弹窗
     * @returns {HTMLElement}
     */
    create() {
        try {
            // 遮罩层
            this.overlay = document.createElement('div');
            this.overlay.className = 'modal-overlay';

            // 弹窗内容
            const content = document.createElement('div');
            content.className = 'modal-content';

            // 标题栏
            const header = document.createElement('div');
            header.className = 'modal-header';

            const title = document.createElement('div');
            title.className = 'modal-title';
            title.textContent = String(this.config.title || '');
            header.appendChild(title);

            if (this.config.showClose) {
                const closeBtn = document.createElement('button');
                closeBtn.className = 'modal-close';
                closeBtn.textContent = '×';
                closeBtn.addEventListener('click', () => this.close());
                header.appendChild(closeBtn);
            }

            content.appendChild(header);

            // 内容区
            const body = document.createElement('div');
            body.className = 'modal-body';
            if (typeof this.config.content === 'string') {
                body.innerHTML = this.config.content;
            } else if (this.config.content instanceof HTMLElement) {
                body.appendChild(this.config.content);
            }
            content.appendChild(body);

            // 按钮区
            if (this.config.buttons && this.config.buttons.length > 0) {
                const footer = document.createElement('div');
                footer.className = 'modal-footer';

                this.config.buttons.forEach(btnConfig => {
                    try {
                        const button = new Button(btnConfig);
                        button.render(footer);
                    } catch (btnError) {
                        console.error('Button error:', btnError);
                    }
                });

                content.appendChild(footer);
            }

            this.overlay.appendChild(content);
            this.element = content;

            return this.overlay;
        } catch (e) {
            console.error('Modal create error:', e);
            throw e;
        }
    }

    /**
     * 显示弹窗
     */
    show() {
        if (!this.element) {
            this.create();
        }

        const container = document.getElementById('modal-container');
        if (container) {
            container.appendChild(this.overlay);
        }

        // 播放音效
        audioManager.playSFX('modal_open');
    }

    /**
     * 关闭弹窗
     */
    close() {
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }

        if (this.config.onClose) {
            this.config.onClose();
        }
    }

    /**
     * 设置标题
     * @param {string} title - 标题
     */
    setTitle(title) {
        this.config.title = title;
        const titleElement = this.element.querySelector('.modal-title');
        if (titleElement) {
            titleElement.textContent = title;
        }
    }

    /**
     * 设置内容
     * @param {string|HTMLElement} content - 内容
     */
    setContent(content) {
        this.config.content = content;
        const bodyElement = this.element.querySelector('.modal-body');
        if (bodyElement) {
            bodyElement.innerHTML = '';
            if (typeof content === 'string') {
                bodyElement.innerHTML = content;
            } else if (content instanceof HTMLElement) {
                bodyElement.appendChild(content);
            }
        }
    }

    /**
     * 销毁弹窗
     */
    destroy() {
        this.close();
        this.element = null;
        this.overlay = null;
    }

    /**
     * 检查弹窗是否正在显示
     * @returns {boolean}
     */
    isShown() {
        return this.overlay && this.overlay.parentNode !== null;
    }
}
