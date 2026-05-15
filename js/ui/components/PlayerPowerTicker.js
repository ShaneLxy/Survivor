class PlayerPowerTicker {
    constructor() {
        this.root = null;
        this.valueElement = null;
        this.deltaElement = null;
        this.labelElement = null;
        this.animationFrame = null;
        this.hideTimeout = null;
        this.checkScheduled = false;
        this.ready = false;
        this.lastKnownPower = this.getCurrentPower();
        this.activeTargetPower = this.lastKnownPower;
        this.animationStart = 0;
        this.animationFrom = 0;
        this.animationTo = 0;
        this.isAnimating = false;
        this.bindEvents();
    }

    getCurrentPower() {
        if (typeof heroManager !== 'undefined' && heroManager && typeof heroManager.getTeamPower === 'function') {
            return heroManager.getTeamPower();
        }

        if (typeof heroManager !== 'undefined' && heroManager && typeof heroManager.getTeam === 'function') {
            return heroManager.getTeam().reduce((sum, hero) => sum + (hero?.getPower?.() || 0), 0);
        }

        return 0;
    }

    formatValue(value) {
        return GameConfig.formatCombatPower(value);
    }

    resolveAssetUrl(path) {
        return window.VersionManager?.getVersionedAssetUrl?.(path) || path;
    }

    ensureRoot() {
        if (this.root) {
            return;
        }

        this.root = document.createElement('div');
        this.root.className = 'player-power-ticker';
        this.root.innerHTML = `
            <div class="player-power-ticker-card">
                <div class="player-power-ticker-emblem" aria-hidden="true">
                    <img src="${this.resolveAssetUrl('assets/images/ui/power-surge-emblem.png')}" alt="">
                </div>
                <div class="player-power-ticker-content">
                    <div class="player-power-ticker-label">
                        <span>战力提升</span>
                        <span class="player-power-ticker-signal">COMBAT POWER</span>
                    </div>
                    <div class="player-power-ticker-values">
                        <div class="player-power-ticker-value">0</div>
                        <div class="player-power-ticker-delta">+0</div>
                    </div>
                </div>
            </div>
        `;

        this.labelElement = this.root.querySelector('.player-power-ticker-label');
        this.valueElement = this.root.querySelector('.player-power-ticker-value');
        this.deltaElement = this.root.querySelector('.player-power-ticker-delta');
        document.body.appendChild(this.root);
    }

    bindEvents() {
        if (typeof eventManager === 'undefined' || !eventManager) {
            return;
        }

        [
            'teamUpdate',
            'heroLevelUp',
            'heroStarsUp',
            'heroEquipmentChange',
            'equipmentUpdate',
            'heroAdd',
            'heroRemove'
        ].forEach((eventName) => {
            eventManager.on(eventName, () => this.scheduleCheck());
        });

        eventManager.on('authChange', (data) => {
            const loggedIn = data?.loggedIn !== false;
            this.ready = loggedIn;
            this.lastKnownPower = this.getCurrentPower();
            this.activeTargetPower = this.lastKnownPower;
        });
    }

    scheduleCheck() {
        if (!this.ready) {
            return;
        }

        if (this.checkScheduled) {
            return;
        }

        this.checkScheduled = true;
        window.requestAnimationFrame(() => {
            this.checkScheduled = false;
            this.handlePowerChange();
        });
    }

    handlePowerChange() {
        const nextPower = this.getCurrentPower();
        const previousPower = this.lastKnownPower;
        this.lastKnownPower = nextPower;

        if (nextPower <= previousPower) {
            return;
        }

        const startPower = this.isAnimating ? Math.max(this.activeTargetPower, previousPower) : previousPower;
        this.show(startPower, nextPower);
    }

    show(fromPower, toPower) {
        this.ensureRoot();

        this.animationFrom = Math.max(0, Number(fromPower) || 0);
        this.animationTo = Math.max(this.animationFrom, Number(toPower) || 0);
        this.activeTargetPower = this.animationTo;
        this.animationStart = performance.now();
        this.isAnimating = true;

        this.root.classList.remove('is-leaving', 'is-counting');
        void this.root.offsetWidth;
        this.root.classList.add('is-visible', 'is-counting');
        this.deltaElement.textContent = `+${this.formatValue(this.animationTo - this.animationFrom)}`;

        if (this.animationFrame) {
            window.cancelAnimationFrame(this.animationFrame);
        }
        if (this.hideTimeout) {
            window.clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }

        this.tick();
    }

    getRollingValue(progress) {
        const eased = 1 - Math.pow(1 - progress, 3);
        let value = Math.floor(this.animationFrom + (this.animationTo - this.animationFrom) * eased);

        if (progress < 0.92) {
            const jitterDigits = progress < 0.35 ? 3 : (progress < 0.68 ? 2 : 1);
            const magnitude = Math.pow(10, jitterDigits);
            value = Math.floor(value / magnitude) * magnitude + Math.floor(Math.random() * magnitude);
        }

        return Math.min(value, this.animationTo);
    }

    tick() {
        const elapsed = performance.now() - this.animationStart;

        if (elapsed <= 2000) {
            const progress = Math.min(1, elapsed / 2000);
            this.valueElement.textContent = this.formatValue(this.getRollingValue(progress));
            this.animationFrame = window.requestAnimationFrame(() => this.tick());
            return;
        }

        if (elapsed <= 3000) {
            this.valueElement.textContent = this.formatValue(this.animationTo);
            this.animationFrame = window.requestAnimationFrame(() => this.tick());
            return;
        }

        this.valueElement.textContent = this.formatValue(this.animationTo);
        this.root.classList.remove('is-counting');
        this.root.classList.add('is-leaving');
        this.isAnimating = false;
        this.hideTimeout = window.setTimeout(() => {
            if (this.root) {
                this.root.classList.remove('is-visible', 'is-leaving');
            }
            this.hideTimeout = null;
        }, 220);
    }
}

const playerPowerTicker = new PlayerPowerTicker();
window.playerPowerTicker = playerPowerTicker;
