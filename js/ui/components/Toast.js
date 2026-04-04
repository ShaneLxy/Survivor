/**
 * Toast提示组件
 */
class Toast {
    static ensureContainer() {
        let container = document.getElementById('toast-container');

        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
        }

        if (container.parentNode !== document.body) {
            document.body.appendChild(container);
        }

        container.style.position = 'fixed';
        container.style.top = '20%';
        container.style.left = '50%';
        container.style.transform = 'translate3d(-50%, 0, 0)';
        container.style.zIndex = '2147483647';
        container.style.pointerEvents = 'none';
        container.style.isolation = 'isolate';

        return container;
    }

    static show(message, type = 'info', duration = 2000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type} slide-up`;
        toast.textContent = message;
        toast.style.position = 'relative';
        toast.style.zIndex = '1';

        const container = this.ensureContainer();
        container.appendChild(toast);

        // 播放音效
        audioManager.playSFX('toast');

        // 自动移除
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, duration);
    }

    static success(message, duration = 2000) {
        return this.show(message, 'success', duration);
    }

    static error(message, duration = 3000) {
        return this.show(message, 'error', duration);
    }

    static warning(message, duration = 2000) {
        return this.show(message, 'warning', duration);
    }

    static info(message, duration = 2000) {
        return this.show(message, 'info', duration);
    }
}

// 暴露到全局
window.Toast = Toast;
