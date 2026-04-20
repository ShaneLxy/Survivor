class TutorialManager {
    constructor() {
        if (TutorialManager.instance) {
            return TutorialManager.instance;
        }
        this.currentStepIndex = 0;
        this.overlay = null;
        this.panel = null;
        this.activeTarget = null;
        this.steps = [
            {
                id: 'tutorial_shelter',
                view: 'shelter',
                target: '.shelter-building-card',
                title: '先看避难所',
                description: '这里是资源与成长核心，建筑会持续累计产出，满 1 小时后就能手动收获。'
            },
            {
                id: 'tutorial_hero',
                view: 'hero',
                target: '[data-tab="hero"]',
                title: '英雄是主战力',
                description: '在英雄页可以查看角色、编队和装备，副本战斗前记得先配置上阵阵容。'
            },
            {
                id: 'tutorial_recruit',
                view: 'recruit',
                target: '[data-tab="recruit"]',
                title: '招募补充战力',
                description: '招募和打造会提供英雄、装备与资源，是前期快速补强的重要入口。'
            },
            {
                id: 'tutorial_dungeon',
                view: 'dungeon',
                target: '.dungeon-spotlight',
                title: '副本决定推进节奏',
                description: '先在章节轨道选择区域，再从主舞台查看敌方与掉落，准备好后进入战斗。'
            },
            {
                id: 'tutorial_task',
                view: 'task',
                target: '[data-tab="task"]',
                title: '任务会告诉你下一步做什么',
                description: '每日任务给短期目标，成就记录长期成长。完成指引后，这里也会同步留下成就。'
            }
        ];
        TutorialManager.instance = this;
    }

    getSeenKey() {
        const user = authService?.getCurrentUser?.();
        return `survivor_tutorial_seen_${user?.id || user?.account || 'guest'}`;
    }

    hasSeen() {
        return localStorage.getItem(this.getSeenKey()) === '1';
    }

    markSeen() {
        localStorage.setItem(this.getSeenKey(), '1');
    }

    shouldAutoStart() {
        return !this.hasSeen() && !taskManager.achievementClaimed?.achievement_finish_tutorial;
    }

    start() {
        this.currentStepIndex = 0;
        this.ensureOverlay();
        this.showStep();
    }

    ensureOverlay() {
        if (!this.overlay) {
            this.overlay = document.createElement('div');
            this.overlay.className = 'tutorial-overlay';
            document.body.appendChild(this.overlay);
        }
        if (!this.panel) {
            this.panel = document.createElement('div');
            this.panel.className = 'tutorial-panel card';
            document.body.appendChild(this.panel);
        }
        this.overlay.style.display = 'block';
        this.panel.style.display = 'block';
    }

    cleanupHighlight() {
        if (this.activeTarget) {
            this.activeTarget.classList.remove('tutorial-highlight');
            this.activeTarget = null;
        }
    }

    stop(markAsSeen = true) {
        this.cleanupHighlight();
        if (markAsSeen) {
            this.markSeen();
        }
        if (this.overlay) {
            this.overlay.style.display = 'none';
        }
        if (this.panel) {
            this.panel.style.display = 'none';
        }
    }

    async showStep() {
        const step = this.steps[this.currentStepIndex];
        if (!step) {
            this.finish();
            return;
        }
        if (window.game.currentView !== step.view) {
            window.game.switchView(step.view);
        }

        await Utils.delay(60);
        this.cleanupHighlight();
        const target = document.querySelector(step.target);
        if (target) {
            this.activeTarget = target;
            target.classList.add('tutorial-highlight');
        }

        const isLast = this.currentStepIndex === this.steps.length - 1;
        this.panel.innerHTML = `
            <div class="tutorial-step-index">新手指引 ${this.currentStepIndex + 1}/${this.steps.length}</div>
            <div class="tutorial-step-title">${step.title}</div>
            <div class="tutorial-step-desc">${step.description}</div>
            <div class="tutorial-panel-actions">
                <button class="btn btn-secondary" onclick="window.tutorialManager.skip()">跳过</button>
                <button class="btn btn-primary" onclick="window.tutorialManager.nextStep()">${isLast ? '完成指引' : '下一步'}</button>
            </div>
        `;
    }

    nextStep() {
        this.currentStepIndex += 1;
        this.showStep();
    }

    skip() {
        this.stop(true);
        Toast.info('已跳过新手指引，可继续自由探索。');
    }

    finish() {
        this.stop(true);
        taskManager.record('tutorialComplete');
        Toast.success('新手指引完成，成就已解锁。');
        window.game.refreshRuntimeUI();
    }
}

const tutorialManager = new TutorialManager();
window.tutorialManager = tutorialManager;
