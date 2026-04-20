class Toast {
    static getDisplayDuration(message, type, duration) {
        const explicitDuration = Number(duration) || 0;
        const text = String(message || '');
        const baseDuration = explicitDuration > 0
            ? explicitDuration
            : (type === 'error' ? 2600 : 2000);
        const extraDuration = Math.max(0, text.length - 10) * 90;
        return Math.min(5000, baseDuration + extraDuration);
    }

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
        toast.textContent = String(message || '');
        toast.style.position = 'relative';
        toast.style.zIndex = '1';
        toast.setAttribute('role', 'status');

        const container = this.ensureContainer();
        container.appendChild(toast);

        const displayDuration = this.getDisplayDuration(message, type, duration);

        audioManager.playSFX('toast');

        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, displayDuration);
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

window.Toast = Toast;
