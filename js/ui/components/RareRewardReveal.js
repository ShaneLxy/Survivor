class RareRewardReveal {
    static getEligibleRewards(rewards = []) {
        return (Array.isArray(rewards) ? rewards : []).filter((reward) => {
            const rarity = String(reward?.rarity || '').toLowerCase();
            const type = String(reward?.type || '').toLowerCase();
            const count = Math.max(0, Number(reward?.count) || 0);
            const isRareEnough = rarity === 'epic' || rarity === 'legendary';
            if (!isRareEnough) {
                return false;
            }
            if (type === 'hero' || type === 'equipment') {
                return true;
            }
            return type === 'fragment' && count >= 50;
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
                headline: 'LEGENDARY SIGNAL',
                terminalLabel: 'HIGH VALUE ACQUIRED',
                vaultLabel: 'VAULT UNLOCK',
                serialLabel: 'BAY-04 / LEGENDARY PAYLOAD',
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
            headline: 'EPIC SIGNAL',
            terminalLabel: 'RARE ASSET ACQUIRED',
            vaultLabel: 'ASSET UNLOCK',
            serialLabel: 'BAY-03 / EPIC PAYLOAD',
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

    static escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    }

    static getRewardKind(reward) {
        const type = String(reward?.type || '').toLowerCase();
        if (type === 'hero' || type === 'fragment') {
            return type;
        }
        return 'equipment';
    }

    static getVisualKind(reward) {
        return this.getRewardKind(reward) === 'fragment' ? 'hero' : this.getRewardKind(reward);
    }

    static buildDoorMaskMarkup(side) {
        return `
            <div class="rare-reward-door-shell ${side}">
                <div class="rare-reward-door-texture"></div>
                <div class="rare-reward-door-vignette"></div>
                <div class="rare-reward-door-sweep"></div>
            </div>
        `;
    }

    static getRewardTypeLabel(reward) {
        const kind = this.getRewardKind(reward);
        if (kind === 'hero') {
            return '\u82f1\u96c4';
        }
        if (kind === 'fragment') {
            return '\u82f1\u96c4\u788e\u7247';
        }
        return '\u88c5\u5907';
    }

    static getRewardCaption(reward) {
        const kind = this.getRewardKind(reward);
        if (kind === 'hero') {
            return '\u9ad8\u4ef7\u503c\u6218\u6597\u5355\u5143\u5df2\u5f52\u6863\uff0c\u53ef\u7acb\u5373\u7f16\u5165\u961f\u4f0d';
        }
        if (kind === 'fragment') {
            return '\u9ad8\u4ef7\u503c\u82f1\u96c4\u788e\u7247\u5df2\u5165\u5e93\uff0c\u53ef\u7528\u4e8e\u82f1\u96c4\u5347\u661f\u4e0e\u540e\u7eed\u5408\u6210';
        }
        return '\u9ad8\u54c1\u8d28\u6218\u5229\u54c1\u5df2\u5c01\u5b58\u5165\u5e93\uff0c\u53ef\u5728\u82f1\u96c4\u9875\u8fdb\u884c\u7a7f\u6234';
    }

    static getRewardVisualMarkup(reward) {
        const name = this.escapeHtml(reward?.name || 'reward');
        const visualKind = this.getVisualKind(reward);
        if (reward?.iconSrc) {
            if (visualKind === 'hero') {
                return `<img class="rare-reward-portrait" src="${reward.iconSrc}" alt="${name}">`;
            }
            return `
                <div class="rare-reward-equipment-frame">
                    <img class="rare-reward-equipment-art" src="${reward.iconSrc}" alt="${name}">
                </div>
            `;
        }

        return `
            <div class="rare-reward-icon-frame">
                <div class="rare-reward-icon">${reward?.icon || '\u2605'}</div>
            </div>
        `;
    }

    static createOverlay(reward, theme) {
        const kind = this.getRewardKind(reward);
        const visualKind = this.getVisualKind(reward);
        const rarity = String(reward?.rarity || 'epic').toLowerCase();
        const rarityName = this.escapeHtml(theme.rarityName);
        const typeName = this.escapeHtml(this.getRewardTypeLabel(reward));
        const count = Math.max(0, Number(reward?.count) || 0);
        const displayName = kind === 'fragment' && count > 1
            ? `${reward?.name || '\u672a\u77e5\u5956\u52b1'} x${count}`
            : (reward?.name || '\u672a\u77e5\u5956\u52b1');
        const rewardName = this.escapeHtml(displayName);
        const caption = this.escapeHtml(this.getRewardCaption(reward));
        const terminalLabel = this.escapeHtml(theme.terminalLabel);
        const headline = this.escapeHtml(theme.headline);
        const overlay = document.createElement('div');
        overlay.className = `rare-reward-reveal-overlay ${rarity} rare-reward-kind-${kind}`;
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
                    ${this.buildDoorMaskMarkup('top', theme)}
                </div>
                <div class="rare-reward-mask bottom">
                    ${this.buildDoorMaskMarkup('bottom', theme)}
                </div>
                <div class="rare-reward-stage">
                    <div class="rare-reward-panel rare-reward-panel-${visualKind}">
                        <div class="rare-reward-quality-band">
                            <span class="rare-reward-quality-name">${rarityName}</span>
                            <span class="rare-reward-quality-divider"></span>
                            <span class="rare-reward-type-name">${typeName}</span>
                        </div>
                        <div class="rare-reward-headline">${headline}</div>
                        <div class="rare-reward-kicker">${terminalLabel}</div>
                        <div class="rare-reward-visual-stage">
                            <div class="rare-reward-visual-glow"></div>
                            <div class="rare-reward-visual-shell rare-reward-visual-shell-${visualKind}">
                                ${this.getRewardVisualMarkup(reward)}
                            </div>
                        </div>
                        <div class="rare-reward-name">${rewardName}</div>
                        <div class="rare-reward-caption">${caption}</div>
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
