/**
 * 战前剧情对话组件
 * 支持打字机效果、多轮对话、立绘显示
 */
class StoryDialogue {
    constructor(dialogues = [], options = {}) {
        this.dialogues = dialogues;
        this.currentIndex = 0;
        this.isTyping = false;
        this.typingTimer = null;
        this.currentText = '';
        this.fullText = '';
        this.onComplete = options.onComplete || (() => {});
        this.onSkip = options.onSkip || (() => {});
        this.typingSpeed = options.typingSpeed || 60; // 每个字的延迟（毫秒）

        this.container = null;
        this.textElement = null;
        this.avatarElement = null;
        this.nameElement = null;
        this.skipButton = null;

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
        // 创建遮罩层
        const overlay = document.createElement('div');
        overlay.className = 'story-dialogue-overlay';

        // 创建对话框容器
        this.container = document.createElement('div');
        this.container.className = 'story-dialogue-container';

        // 创建立绘容器
        this.avatarElement = document.createElement('div');
        this.avatarElement.className = 'story-dialogue-avatar';

        // 创建对话框
        const dialogueBox = document.createElement('div');
        dialogueBox.className = 'story-dialogue-box';

        // 角色名
        this.nameElement = document.createElement('div');
        this.nameElement.className = 'story-dialogue-name';

        // 对话文本
        this.textElement = document.createElement('div');
        this.textElement.className = 'story-dialogue-text';

        // 跳过按钮
        this.skipButton = document.createElement('button');
        this.skipButton.className = 'story-dialogue-skip';
        this.skipButton.innerHTML = '▶';
        this.skipButton.title = '点击继续';

        dialogueBox.appendChild(this.nameElement);
        dialogueBox.appendChild(this.textElement);
        dialogueBox.appendChild(this.skipButton);

        this.container.appendChild(this.avatarElement);
        this.container.appendChild(dialogueBox);

        overlay.appendChild(this.container);
        document.body.appendChild(overlay);

        this.overlay = overlay;
    }

    bindEvents() {
        // 跳过按钮点击
        this.skipButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleSkip();
        });

        // 点击屏幕任意空白处（整个遮罩层）都可以跳过
        // 注意：避免触摸/鼠标事件双触发 —— 同一次点击只响应一次
        const handleOverlayTap = (e) => {
            // 跳过按钮自己已绑定 click 并 stopPropagation，不会冒泡到这里
            // 这里保留一道防御，避免极端情况下 skipButton 也被算入
            if (e.target === this.skipButton || this.skipButton.contains(e.target)) {
                return;
            }
            this.handleSkip();
        };

        // 使用 pointerup 一次性覆盖鼠标 / 触摸 / 触控笔；若浏览器不支持则退回 click
        if ('onpointerup' in window) {
            this.overlay.addEventListener('pointerup', handleOverlayTap);
        } else {
            this.overlay.addEventListener('click', handleOverlayTap);
        }
    }

    handleSkip() {
        if (this.isTyping) {
            // 第一次点击：显示完整文本
            this.completeCurrentText();
        } else {
            // 第二次点击：进入下一句
            this.nextDialogue();
        }
    }

    showDialogue(index) {
        if (index >= this.dialogues.length) {
            this.complete();
            return;
        }

        this.currentIndex = index;
        const dialogue = this.dialogues[index];

        // 更新角色名
        this.nameElement.textContent = dialogue.speakerName || '';

        // 更新立绘
        this.updateAvatar(dialogue);

        // 开始打字机效果
        this.fullText = dialogue.text || '';
        this.currentText = '';
        this.textElement.textContent = '';
        this.startTyping();
    }

    updateAvatar(dialogue) {
        this.avatarElement.innerHTML = '';
        this.avatarElement.className = 'story-dialogue-avatar';

        if (!dialogue.avatarType || dialogue.avatarType === 'none') {
            // 旁白模式，不显示立绘
            this.avatarElement.style.display = 'none';
            this.container.classList.add('narrator-mode');
            return;
        }

        this.avatarElement.style.display = 'block';
        this.container.classList.remove('narrator-mode');

        // 根据位置调整布局
        if (dialogue.position === 'right') {
            this.container.classList.add('avatar-right');
            this.container.classList.remove('avatar-left');
        } else {
            this.container.classList.add('avatar-left');
            this.container.classList.remove('avatar-right');
        }

        // 获取立绘
        let portraitSrc = null;

        if (dialogue.avatarType === 'hero') {
            // 根据 speaker 字段匹配英雄立绘
            if (dialogue.speaker) {
                // 如果指定了 speaker（如 "hero_001"），使用该英雄的立绘
                const heroConfig = HeroConfig.getHeroConfig(dialogue.speaker);
                portraitSrc = heroConfig?.portrait || heroConfig?.cardPortrait || heroConfig?.iconSrc;
            } else {
                // 如果没有指定 speaker，使用玩家队伍第一个英雄的立绘（兜底逻辑）
                const firstHero = heroManager?.team?.[0] ? heroManager.getHero(heroManager.team[0]) : null;
                if (firstHero) {
                    const heroConfig = HeroConfig.getHeroConfig(firstHero.configId);
                    portraitSrc = heroConfig?.portrait || heroConfig?.cardPortrait || heroConfig?.iconSrc;
                }
            }
        } else if (dialogue.avatarType === 'enemy' && dialogue.speaker) {
            // 使用敌人立绘
            const enemyConfig = DungeonConfig.getEnemyConfig(dialogue.speaker);
            portraitSrc = enemyConfig?.portrait;
        }

        if (portraitSrc) {
            const img = document.createElement('img');
            img.src = portraitSrc;
            img.alt = dialogue.speakerName || '';
            this.avatarElement.appendChild(img);
        } else {
            // 没有立绘时显示占位符
            const placeholder = document.createElement('div');
            placeholder.className = 'story-dialogue-avatar-placeholder';
            placeholder.textContent = dialogue.speakerName?.[0] || '?';
            this.avatarElement.appendChild(placeholder);
        }
    }

    startTyping() {
        this.isTyping = true;
        this.skipButton.title = '点击显示全部';
        let charIndex = 0;

        const typeNextChar = () => {
            if (charIndex < this.fullText.length) {
                this.currentText += this.fullText[charIndex];
                this.textElement.textContent = this.currentText;
                charIndex++;
                this.typingTimer = setTimeout(typeNextChar, this.typingSpeed);
            } else {
                this.isTyping = false;
                this.skipButton.title = '点击继续';
            }
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
        this.skipButton.title = '点击继续';
    }

    nextDialogue() {
        this.showDialogue(this.currentIndex + 1);
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
        }
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
    }
}

window.StoryDialogue = StoryDialogue;
