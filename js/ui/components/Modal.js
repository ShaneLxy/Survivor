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
            className: '',
            onClose: null,
            ...config
        };

        this.element = null;
        this.overlay = null;
    }

    create() {
        try {
            this.overlay = document.createElement('div');
            this.overlay.className = 'modal-overlay';

            const content = document.createElement('div');
            content.className = 'modal-content';
            if (this.config.className) {
                content.classList.add(...String(this.config.className).split(/\s+/).filter(Boolean));
            }

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

            const body = document.createElement('div');
            body.className = 'modal-body';
            if (typeof this.config.content === 'string') {
                body.innerHTML = this.config.content;
            } else if (this.config.content instanceof HTMLElement) {
                body.appendChild(this.config.content);
            }
            content.appendChild(body);

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

    show() {
        if (!this.element) {
            this.create();
        }

        const container = document.getElementById('modal-container');
        if (container) {
            container.appendChild(this.overlay);
        }

        audioManager.playSFX('modal_open');
    }

    close() {
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }

        if (this.config.onClose) {
            this.config.onClose();
        }
    }

    setTitle(title) {
        this.config.title = title;
        const titleElement = this.element.querySelector('.modal-title');
        if (titleElement) {
            titleElement.textContent = title;
        }
    }

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

    destroy() {
        this.close();
        this.element = null;
        this.overlay = null;
    }

    isShown() {
        return this.overlay && this.overlay.parentNode !== null;
    }

    static closeAll() {
        const container = document.getElementById('modal-container');
        if (container) {
            container.innerHTML = '';
        }
    }
}
