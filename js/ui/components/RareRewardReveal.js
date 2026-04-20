class RareRewardReveal {
    static getEligibleRewards(rewards = []) {
        return (Array.isArray(rewards) ? rewards : []).filter((reward) => {
            const rarity = String(reward?.rarity || '').toLowerCase();
            const type = String(reward?.type || '').toLowerCase();
            return (rarity === 'epic' || rarity === 'legendary') && (type === 'hero' || type === 'equipment');
        });
    }

    static async playSequence(rewards = []) {
        const eligibleRewards = this.getEligibleRewards(rewards);
        for (const reward of eligibleRewards) {
            await this.playSingle(reward);
        }
    }

    static getTheme(rarity = 'epic') {
        const normalized = String(rarity || 'epic').toLowerCase();
        if (normalized === 'legendary') {
            return {
                rarityName: '\u4f20\u8bf4',
                headline: 'Legendary Drop',
                color: '#ffcc00',
                colorSoft: '#ffe27a',
                colorDeep: '#9a5c00',
                colorEdge: '#fff1b6',
                glow: 'rgba(255, 204, 0, 0.45)',
                glowStrong: 'rgba(255, 232, 154, 0.88)',
                panel: 'linear-gradient(180deg, rgba(76, 48, 2, 0.96), rgba(28, 17, 1, 0.98))',
                backdrop: 'radial-gradient(circle at center, rgba(255, 224, 130, 0.36), rgba(0, 0, 0, 0.94) 62%)',
                flash: 'rgba(255, 244, 188, 0.95)',
                flashSoft: 'rgba(255, 219, 93, 0.58)',
                impactDuration: 190,
                revealDelay: 340
            };
        }

        return {
            rarityName: '\u53f2\u8bd7',
            headline: 'Epic Drop',
            color: '#ff8000',
            colorSoft: '#ffb15a',
            colorDeep: '#6b2f00',
            colorEdge: '#ffd5a7',
            glow: 'rgba(255, 128, 0, 0.36)',
            glowStrong: 'rgba(255, 165, 88, 0.68)',
            panel: 'linear-gradient(180deg, rgba(79, 37, 7, 0.96), rgba(24, 12, 3, 0.98))',
            backdrop: 'radial-gradient(circle at center, rgba(255, 160, 78, 0.28), rgba(0, 0, 0, 0.92) 62%)',
            flash: 'rgba(255, 199, 150, 0.72)',
            flashSoft: 'rgba(255, 152, 76, 0.44)',
            impactDuration: 130,
            revealDelay: 290
        };
    }

    static buildArrowMaskMarkup(theme, side) {
        const arrows = [];
        for (let index = 0; index < 36; index++) {
            const row = Math.floor(index / 6);
            const opacity = 0.35 + (index % 6) * 0.09;
            const scale = 0.84 + row * 0.05 + (index % 2) * 0.04;
            arrows.push(`
                <span
                    class="rare-reward-arrow ${side}"
                    style="--arrow-opacity:${opacity.toFixed(2)};--arrow-scale:${scale.toFixed(2)};--arrow-color:${index % 3 === 0 ? theme.color : (index % 3 === 1 ? theme.colorSoft : theme.colorDeep)}">
                </span>
            `);
        }
        return arrows.join('');
    }

    static getRewardTypeLabel(reward) {
        return String(reward?.type || '').toLowerCase() === 'hero'
            ? '\u82f1\u96c4'
            : '\u6b66\u5668';
    }

    static getRewardCaption(reward) {
        if (String(reward?.type || '').toLowerCase() === 'hero') {
            return '\u5168\u65b0\u4f19\u4f34\u5df2\u52a0\u5165\u4f60\u7684\u9635\u5bb9';
        }
        return '\u9ad8\u54c1\u8d28\u6218\u5229\u54c1\u5df2\u6536\u5165\u80cc\u5305';
    }

    static getRewardVisualMarkup(reward) {
        if (reward?.iconSrc) {
            return `<img class="rare-reward-portrait" src="${reward.iconSrc}" alt="${reward?.name || 'reward'}">`;
        }

        return `
            <div class="rare-reward-icon-frame">
                <div class="rare-reward-icon">${reward?.icon || '\u2605'}</div>
            </div>
        `;
    }

    static createOverlay(reward, theme) {
        const overlay = document.createElement('div');
        overlay.className = `rare-reward-reveal-overlay ${String(reward?.rarity || 'epic').toLowerCase()}`;
        overlay.innerHTML = `
            <div
                class="rare-reward-reveal-backdrop"
                style="--rare-reward-backdrop:${theme.backdrop};--rare-reward-panel:${theme.panel};--rare-reward-color:${theme.color};--rare-reward-color-soft:${theme.colorSoft};--rare-reward-color-deep:${theme.colorDeep};--rare-reward-color-edge:${theme.colorEdge};--rare-reward-glow:${theme.glow};--rare-reward-glow-strong:${theme.glowStrong};--rare-reward-flash:${theme.flash};--rare-reward-flash-soft:${theme.flashSoft};">
                <div class="rare-reward-flash-layer"></div>
                <div class="rare-reward-rings">
                    <span class="rare-reward-ring ring-a"></span>
                    <span class="rare-reward-ring ring-b"></span>
                    <span class="rare-reward-starburst"></span>
                </div>
                <div class="rare-reward-mask top">
                    <div class="rare-reward-mask-pattern">
                        ${this.buildArrowMaskMarkup(theme, 'top')}
                    </div>
                </div>
                <div class="rare-reward-mask bottom">
                    <div class="rare-reward-mask-pattern">
                        ${this.buildArrowMaskMarkup(theme, 'bottom')}
                    </div>
                </div>
                <div class="rare-reward-stage">
                    <div class="rare-reward-panel">
                        <div class="rare-reward-quality-band">
                            <span class="rare-reward-quality-name">${theme.rarityName}</span>
                            <span class="rare-reward-quality-divider"></span>
                            <span class="rare-reward-type-name">${this.getRewardTypeLabel(reward)}</span>
                        </div>
                        <div class="rare-reward-headline">${theme.headline}</div>
                        <div class="rare-reward-kicker">${theme.rarityName}${this.getRewardTypeLabel(reward)}\u5df2\u83b7\u5f97</div>
                        <div class="rare-reward-visual-stage">
                            <div class="rare-reward-visual-glow"></div>
                            <div class="rare-reward-visual-shell">
                                ${this.getRewardVisualMarkup(reward)}
                            </div>
                        </div>
                        <div class="rare-reward-name">${reward?.name || '\u672a\u77e5\u5956\u52b1'}</div>
                        <div class="rare-reward-caption">${this.getRewardCaption(reward)}</div>
                        <div class="rare-reward-hint-shell">
                            <div class="rare-reward-hint">\u70b9\u51fb\u4efb\u610f\u4f4d\u7f6e\u7ee7\u7eed</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        return overlay;
    }

    static async playSingle(reward) {
        const theme = this.getTheme(reward?.rarity);
        const overlay = this.createOverlay(reward, theme);
        document.body.appendChild(overlay);

        const backdrop = overlay.querySelector('.rare-reward-reveal-backdrop');
        if (!backdrop) {
            overlay.remove();
            return;
        }

        await new Promise((resolve) => requestAnimationFrame(resolve));
        backdrop.classList.add('is-closing');

        await this.wait(300);
        backdrop.classList.add('is-impact');
        await this.wait(theme.impactDuration);
        backdrop.classList.remove('is-impact');
        backdrop.classList.add('is-reveal');

        await this.wait(theme.revealDelay);

        await new Promise((resolve) => {
            let closed = false;

            const close = (event) => {
                if (closed) {
                    return;
                }

                if (event) {
                    event.preventDefault();
                    event.stopPropagation();
                }

                closed = true;
                overlay.removeEventListener('click', close, true);
                overlay.removeEventListener('touchstart', close, true);
                backdrop.classList.add('is-dismiss');
                window.setTimeout(() => {
                    overlay.remove();
                    resolve();
                }, 180);
            };

            overlay.addEventListener('click', close, true);
            overlay.addEventListener('touchstart', close, true);
        });
    }

    static wait(duration) {
        return new Promise((resolve) => window.setTimeout(resolve, duration));
    }
}

window.RareRewardReveal = RareRewardReveal;
