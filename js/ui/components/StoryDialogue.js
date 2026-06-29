class StoryDialogue {
    constructor(dialogues = [], options = {}) {
        this.dialogues = dialogues;
        this.currentIndex = 0;
        this.currentSegments = [];
        this.currentSegmentIndex = 0;
        this.isTyping = false;
        this.typingTimer = null;
        this.currentText = '';
        this.fullText = '';
        this.onComplete = options.onComplete || (() => {});
        this.onSkip = options.onSkip || (() => {});
        this.backgroundImage = String(options.backgroundImage || '').trim();
        this.typingSpeed = options.typingSpeed || 60;
        this.segmentCharLimit = Math.max(1, Number(options.segmentCharLimit) || 50);

        this.container = null;
        this.textElement = null;
        this.avatarElement = null;
        this.nameElement = null;
        this.nextButton = null;
        this.skipAllButton = null;
        this.overlay = null;

        this.init();
    }

    init() {
        this.createElements();
        this.bindEvents();
        if (this.dialogues.length > 0) {
            this.showDialogue(0);
        }
    }

    createElements() {
        const overlay = document.createElement('div');
        overlay.className = 'story-dialogue-overlay';
        if (this.backgroundImage) {
            const absoluteBackground = /^(?:https?:|data:|blob:|\/)/i.test(this.backgroundImage)
                ? this.backgroundImage
                : `/${this.backgroundImage.replace(/^\.\//, '')}`;
            overlay.classList.add('has-scene-background');
            overlay.style.setProperty('--story-dialogue-bg', `url("${absoluteBackground}")`);
        }

        this.container = document.createElement('div');
        this.container.className = 'story-dialogue-container';

        this.avatarElement = document.createElement('div');
        this.avatarElement.className = 'story-dialogue-avatar';

        const dialogueBox = document.createElement('div');
        dialogueBox.className = 'story-dialogue-box';

        this.skipAllButton = document.createElement('button');
        this.skipAllButton.className = 'story-dialogue-skip-all';
        this.skipAllButton.textContent = 'SKIP';
        this.skipAllButton.title = '跳过全部剧情';

        this.nameElement = document.createElement('div');
        this.nameElement.className = 'story-dialogue-name';

        this.textElement = document.createElement('div');
        this.textElement.className = 'story-dialogue-text';

        this.nextButton = document.createElement('button');
        this.nextButton.className = 'story-dialogue-skip';
        this.nextButton.innerHTML = '&#9654;';
        this.nextButton.title = '点击继续';

        dialogueBox.appendChild(this.skipAllButton);
        dialogueBox.appendChild(this.nameElement);
        dialogueBox.appendChild(this.textElement);
        dialogueBox.appendChild(this.nextButton);

        this.container.appendChild(this.avatarElement);
        this.container.appendChild(dialogueBox);

        overlay.appendChild(this.container);
        document.body.appendChild(overlay);

        this.overlay = overlay;
    }

    bindEvents() {
        this.nextButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleAdvance();
        });

        this.skipAllButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.skip();
        });

        const handleOverlayTap = (e) => {
            if (
                e.target === this.nextButton
                || this.nextButton.contains(e.target)
                || e.target === this.skipAllButton
                || this.skipAllButton.contains(e.target)
            ) {
                return;
            }
            this.handleAdvance();
        };

        if ('onpointerup' in window) {
            this.overlay.addEventListener('pointerup', handleOverlayTap);
        } else {
            this.overlay.addEventListener('click', handleOverlayTap);
        }
    }

    splitTextIntoSegments(text) {
        const source = String(text || '').trim();
        if (!source) {
            return [''];
        }

        const segments = [];
        const punctuationPattern = /[。！？；，、\n]/;
        let remaining = source;

        while (remaining.length > this.segmentCharLimit) {
            const chunk = remaining.slice(0, this.segmentCharLimit);
            let splitIndex = -1;
            for (let i = chunk.length - 1; i >= 0; i -= 1) {
                if (punctuationPattern.test(chunk[i])) {
                    splitIndex = i + 1;
                    break;
                }
            }
            if (splitIndex <= 0) {
                splitIndex = this.segmentCharLimit;
            }
            segments.push(remaining.slice(0, splitIndex).trim());
            remaining = remaining.slice(splitIndex).trim();
        }

        if (remaining.length > 0 || segments.length === 0) {
            segments.push(remaining);
        }

        return segments.filter(segment => segment.length > 0);
    }

    handleAdvance() {
        if (this.isTyping) {
            this.completeCurrentText();
            return;
        }
        this.advanceToNextPart();
    }

    advanceToNextPart() {
        if (this.currentSegmentIndex + 1 < this.currentSegments.length) {
            this.currentSegmentIndex += 1;
            this.showCurrentSegment();
            return;
        }
        this.showDialogue(this.currentIndex + 1);
    }

    showDialogue(index) {
        if (index >= this.dialogues.length) {
            this.complete();
            return;
        }

        this.currentIndex = index;
        this.currentSegmentIndex = 0;
        const dialogue = this.dialogues[index];

        this.nameElement.textContent = dialogue.speakerName || '';
        this.updateAvatar(dialogue);
        this.currentSegments = this.splitTextIntoSegments(dialogue.text || '');
        this.showCurrentSegment();
    }

    showCurrentSegment() {
        this.fullText = this.currentSegments[this.currentSegmentIndex] || '';
        this.currentText = '';
        this.textElement.textContent = '';
        this.startTyping();
    }

    updateAvatar(dialogue) {
        this.avatarElement.innerHTML = '';
        this.avatarElement.className = 'story-dialogue-avatar';

        if (!dialogue.avatarType || dialogue.avatarType === 'none') {
            this.avatarElement.style.display = 'none';
            this.container.classList.add('narrator-mode');
            return;
        }

        this.avatarElement.style.display = 'block';
        this.container.classList.remove('narrator-mode');

        if (dialogue.position === 'right') {
            this.container.classList.add('avatar-right');
            this.container.classList.remove('avatar-left');
        } else {
            this.container.classList.add('avatar-left');
            this.container.classList.remove('avatar-right');
        }

        let portraitSrc = null;
        if (dialogue.avatarType === 'hero') {
            if (dialogue.speaker) {
                const heroConfig = HeroConfig.getHeroConfig(dialogue.speaker);
                portraitSrc = heroConfig?.portrait || heroConfig?.cardPortrait || heroConfig?.iconSrc;
            } else {
                const firstHero = heroManager?.team?.[0] ? heroManager.getHero(heroManager.team[0]) : null;
                if (firstHero) {
                    const heroConfig = HeroConfig.getHeroConfig(firstHero.configId);
                    portraitSrc = heroConfig?.portrait || heroConfig?.cardPortrait || heroConfig?.iconSrc;
                }
            }
        } else if (dialogue.avatarType === 'enemy' && dialogue.speaker) {
            const enemyConfig = DungeonConfig.getEnemyConfig(dialogue.speaker);
            portraitSrc = enemyConfig?.portrait;
        }

        if (portraitSrc) {
            const img = document.createElement('img');
            img.src = portraitSrc;
            img.alt = dialogue.speakerName || '';
            this.avatarElement.appendChild(img);
            return;
        }

        const placeholder = document.createElement('div');
        placeholder.className = 'story-dialogue-avatar-placeholder';
        placeholder.textContent = dialogue.speakerName?.[0] || '?';
        this.avatarElement.appendChild(placeholder);
    }

    startTyping() {
        this.isTyping = true;
        this.nextButton.title = '点击显示全部';
        let charIndex = 0;

        const typeNextChar = () => {
            if (charIndex < this.fullText.length) {
                this.currentText += this.fullText[charIndex];
                this.textElement.textContent = this.currentText;
                charIndex += 1;
                this.typingTimer = setTimeout(typeNextChar, this.typingSpeed);
                return;
            }
            this.isTyping = false;
            this.typingTimer = null;
            this.nextButton.title = '点击继续';
        };

        typeNextChar();
    }

    completeCurrentText() {
        if (this.typingTimer) {
            clearTimeout(this.typingTimer);
            this.typingTimer = null;
        }
        this.currentText = this.fullText;
        this.textElement.textContent = this.currentText;
        this.isTyping = false;
        this.nextButton.title = '点击继续';
    }

    complete() {
        this.destroy();
        this.onComplete();
    }

    skip() {
        this.destroy();
        this.onSkip();
    }

    destroy() {
        if (this.typingTimer) {
            clearTimeout(this.typingTimer);
            this.typingTimer = null;
        }
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
    }
}

window.StoryDialogue = StoryDialogue;
