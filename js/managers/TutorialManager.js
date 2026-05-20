class TutorialManager {
    constructor() {
        if (TutorialManager.instance) {
            return TutorialManager.instance;
        }

        this.currentStepIndex = 0;
        this.overlay = null;
        this.spotlight = null;
        this.panel = null;
        this.activeTarget = null;
        this.active = false;
        this.boundEventHandler = (event) => this.handleGameEvent(event);
        this.boundClickGuard = (event) => this.handleDocumentClick(event);
        this.boundSpotlightUpdate = () => this.updateSpotlight();
        this.gameEventUnsubscribers = [];
        this.rewardModalCloseTimers = [];
        this.promotedContainers = [];
        this.pendingCompletionStepIndex = null;
        this.waitingForRewardDialog = false;
        this.replayMode = false;
        this.persistedState = {};
        this.activeModalOverlay = null;
        this.steps = this.createSteps();
        TutorialManager.instance = this;
    }

    createSteps() {
        return [
            {
                id: 'shelter_open_buildings',
                view: 'shelter',
                target: '[data-shelter-action="building_menu"], .shelter-building-card, .building-card',
                title: '先认识避难所',
                description: '建筑会持续生产资源。先点开建筑列表，看一眼农场、矿场和水井。',
                waitEvent: 'tutorial:shelterBuildingMenuOpen',
                closeRewardModalAfterComplete: true
            },
            {
                id: 'shelter_collect',
                view: 'shelter',
                target: '[data-shelter-action="collect_all"], .collect-all',
                title: '领取一次产出',
                description: '这里可以统一收取建筑产出。新手阶段已为你准备好一份可领取资源。',
                waitEvent: 'shelterProductionCollect',
                prepare: () => this.ensureShelterCollectReady(),
                closeRewardModalAfterComplete: true,
                replaySkipWhen: () => this.isReplayMode() || this.hasStateFlag('shelterCollectPrimed')
            },
            {
                id: 'recruit_enter',
                view: 'shelter',
                target: '[data-tab="recruit"]',
                title: '前往招募中心',
                description: '接下来补充第一名伙伴和第一件武器。',
                waitView: 'recruit'
            },
            {
                id: 'recruit_select_hero_pool',
                view: 'recruit',
                target: '.recruit-pool-tab[data-pool-id="hero_pool"]',
                title: '选择英雄招募',
                description: '先确认当前是英雄招募池，然后使用你的英雄招募券。',
                waitEvent: 'tutorial:gachaPoolSelected',
                eventFilter: ({ payload }) => payload?.poolId === 'hero_pool',
                replaySkipWhen: () => this.isReplayMode()
            },
            {
                id: 'recruit_hero',
                view: 'recruit',
                target: '[data-pool-id="hero_pool"][data-draw-count="1"], .recruit-draw-button-single, .recruit-draw-button',
                title: '使用英雄招募券',
                description: '这次招募会必得英雄“破伤风-断钉”，作为你的第一名出战成员。',
                waitEvent: 'tutorial:starterHeroReady',
                prepare: () => this.prepareRecruitPool('hero_pool'),
                closeRewardModalAfterComplete: true,
                replaySkipWhen: () => this.isReplayMode() || this.hasStateFlag('starterHeroGuaranteeUsed')
            },
            {
                id: 'forge_select_pool',
                view: 'recruit',
                target: '.recruit-pool-tab[data-pool-id="equipment_pool"]',
                title: '切到装备打造',
                description: '现在切换到装备打造池，准备打造第一件武器。',
                waitEvent: 'tutorial:gachaPoolSelected',
                eventFilter: ({ payload }) => payload?.poolId === 'equipment_pool',
                skipWhen: () => window.game?.ui?.gachaView?.activePoolId === 'equipment_pool',
                replaySkipWhen: () => this.isReplayMode()
            },
            {
                id: 'forge_equipment',
                view: 'recruit',
                target: '[data-pool-id="equipment_pool"][data-draw-count="1"], .recruit-draw-button-single, .recruit-draw-button',
                title: '打造第一件装备',
                description: '切到装备打造，使用装备打造券。首次打造必得“裂木短棒”。',
                waitEvent: 'tutorial:starterEquipmentReady',
                prepare: () => this.prepareRecruitPool('equipment_pool'),
                closeRewardModalAfterComplete: true,
                replaySkipWhen: () => this.isReplayMode() || this.hasStateFlag('starterEquipmentGuaranteeUsed')
            },
            {
                id: 'hero_enter',
                view: 'recruit',
                target: '[data-tab="hero"]',
                title: '整备英雄',
                description: '进入英雄页，把断钉设为参战，并给他装备裂木短棒。',
                waitView: 'hero'
            },
            {
                id: 'hero_team_open',
                view: 'hero',
                target: '.hero-command-action-primary',
                title: '打开编队',
                description: '点击英雄页右上方的“编队”，进入出战成员调整界面。',
                waitEvent: 'tutorial:teamModalOpened',
                skipWhen: () => this.isStarterHeroInTeam()
            },
            {
                id: 'hero_team_select',
                view: 'hero',
                target: '.hero-team-roster-card[data-hero-config-id="hero_020"]:not(.is-in-team), .hero-team-roster-card[data-hero-config-id="hero_020"]',
                title: '让断钉参战',
                description: '在编队弹窗中点击“破伤风-断钉”的卡片，让他加入出战队伍。',
                waitEvent: 'tutorial:starterHeroInTeam',
                skipWhen: () => this.isStarterHeroInTeam()
            },
            {
                id: 'hero_open_detail',
                view: 'hero',
                target: '.hero-card[data-hero-config-id="hero_020"]',
                title: '打开断钉档案',
                description: '回到英雄列表后，点击断钉的英雄卡片，进入他的档案。',
                waitEvent: 'tutorial:starterHeroDetailOpened',
                prepare: () => this.closeTeamModal(),
                skipWhen: () => this.isStarterEquipmentEquipped()
            },
            {
                id: 'hero_equip_slot',
                view: 'hero',
                target: '.hero-equipment-button[data-hero-config-id="hero_020"][data-equipment-slot="weapon"]',
                title: '选择武器槽',
                description: '在断钉档案的装备区域，点击武器槽位。',
                waitEvent: 'tutorial:starterEquipmentSelectionOpened',
                skipWhen: () => this.isStarterEquipmentEquipped()
            },
            {
                id: 'hero_equip_select',
                view: 'hero',
                target: '.hero-equipment-equip-button[data-equipment-template-id="common_weapon_cracked_club"]',
                title: '穿戴裂木短棒',
                description: '在装备列表中点击“裂木短棒”的穿戴按钮。',
                waitEvent: 'tutorial:starterEquipmentEquipped',
                afterComplete: async () => {
                    await Utils.delay(180);
                    this.closeHeroDetail();
                },
                skipWhen: () => this.isStarterEquipmentEquipped()
            },
            {
                id: 'task_enter',
                view: 'hero',
                target: '[data-tab="task"]',
                title: '领取任务奖励',
                description: '任务中心会告诉你下一步做什么。先去领取一个已经完成的新手任务。',
                waitView: 'task',
                prepare: () => this.closeHeroDetail()
            },
            {
                id: 'task_claim',
                view: 'task',
                target: '.task-card.is-ready .task-claim-btn:not(:disabled)',
                title: '任务会给你方向',
                description: '领取一个已完成任务的奖励。后面不知道做什么时，就先看任务中心。',
                waitEvent: 'tutorial:taskRewardClaimed',
                closeRewardModalAfterComplete: true,
                skipWhen: () => !document.querySelector('.task-card.is-ready .task-claim-btn:not(:disabled)')
            },
            {
                id: 'checkin_enter',
                view: 'task',
                target: '[data-tab="checkin"]',
                title: '看看福利页',
                description: '每日签到和福利礼包都在这里。',
                waitView: 'checkin'
            },
            {
                id: 'checkin_claim',
                view: 'checkin',
                target: '.checkin-claim-button:not(:disabled), .checkin-day.today',
                title: '领取今日签到',
                description: '签到奖励每天刷新，先把今天的奖励拿到手。',
                waitEvent: 'tutorial:checkinClaimed',
                closeRewardModalAfterComplete: true,
                skipWhen: () => Boolean(checkinManager.getCheckinStatus?.()?.isTodayCheckedIn)
            },
            {
                id: 'welfare_ad',
                view: 'checkin',
                target: '.checkin-welfare-card:not(:disabled)',
                title: '领取一个福利礼包',
                description: '第一个福利礼包会优先消耗免广告卡，直接获得奖励并累计特权进度。',
                waitEvent: 'tutorial:welfareGiftClaimed',
                closeRewardModalAfterComplete: true,
                skipWhen: () => !document.querySelector('.checkin-welfare-card:not(:disabled)')
            },
            {
                id: 'dungeon_enter',
                view: 'checkin',
                target: '[data-tab="dungeon"]',
                title: '准备第一次战斗',
                description: '基础准备完成了，现在进入副本页挑战第一章第一关。',
                waitView: 'dungeon'
            },
            {
                id: 'dungeon_open_chapter',
                view: 'dungeon',
                target: '.dungeon-chapter-slide.is-active, .dungeon-chapter-card, .chapter-stage-card',
                title: '打开第一章',
                description: '点击第一章卡片，查看关卡列表。',
                waitEvent: 'tutorial:dungeonChapterOpened',
                skipWhen: () => Boolean(document.querySelector('.chapter-stage-detail-actions .btn-primary'))
            },
            {
                id: 'dungeon_start',
                view: 'dungeon',
                target: '.chapter-stage-detail-actions .btn-primary',
                title: '开始第一关',
                description: '选择第一关并开始战斗。胜利后你就可以自由探索了。',
                waitEvent: 'enterBattle'
            }
        ];
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

    getStateKey() {
        const user = authService?.getCurrentUser?.();
        return `survivor_tutorial_state_${user?.id || user?.account || 'guest'}`;
    }

    getState() {
        try {
            const localState = JSON.parse(localStorage.getItem(this.getStateKey()) || '{}') || {};
            return {
                ...(this.persistedState || {}),
                ...localState
            };
        } catch (error) {
            return { ...(this.persistedState || {}) };
        }
    }

    updateState(patch = {}) {
        const state = {
            ...this.getState(),
            ...patch
        };
        this.persistedState = { ...state };
        localStorage.setItem(this.getStateKey(), JSON.stringify(state));
        return state;
    }

    loadState(saveData = null) {
        this.persistedState = saveData && typeof saveData === 'object'
            ? { ...saveData }
            : {};
        if (Object.keys(this.persistedState).length > 0) {
            this.updateState(this.persistedState);
        }
    }

    getSaveData() {
        return { ...this.getState() };
    }

    hasStateFlag(flag) {
        return Boolean(this.getState()?.[flag]);
    }

    setStateFlag(flag) {
        this.updateState({ [flag]: true });
    }

    shouldAutoStart() {
        return !this.hasSeen() && !taskManager.achievementClaimed?.achievement_finish_tutorial;
    }

    isReplayMode() {
        return Boolean(this.replayMode);
    }

    isActiveStep(stepId) {
        return Boolean(this.active && this.steps[this.currentStepIndex]?.id === stepId);
    }

    canUseStarterGuarantee(kind) {
        if (!this.active || this.isReplayMode()) {
            return false;
        }
        if (kind === 'hero') {
            return this.isActiveStep('recruit_hero') && !this.hasStateFlag('starterHeroGuaranteeUsed');
        }
        if (kind === 'equipment') {
            return this.isActiveStep('forge_equipment') && !this.hasStateFlag('starterEquipmentGuaranteeUsed');
        }
        return false;
    }

    start(options = {}) {
        if (!window.game?.gameReady) {
            return;
        }
        this.stop(false);
        this.currentStepIndex = 0;
        this.replayMode = Boolean(options.replay) || this.hasSeen() || Boolean(taskManager.achievementClaimed?.achievement_finish_tutorial);
        this.active = true;
        eventManager.on('tutorialEvent', this.boundEventHandler);
        document.addEventListener('click', this.boundClickGuard, true);
        window.addEventListener('resize', this.boundSpotlightUpdate);
        window.addEventListener('scroll', this.boundSpotlightUpdate, true);
        ['shelterProductionCollect', 'enterBattle'].forEach((type) => {
            this.gameEventUnsubscribers.push(
                eventManager.on(type, (payload) => this.handleGameEvent({ type, payload }))
            );
        });
        this.ensureOverlay();
        this.showStep();
    }

    ensureOverlay() {
        if (!this.overlay) {
            this.overlay = document.createElement('div');
            this.overlay.className = 'tutorial-overlay';
            document.body.appendChild(this.overlay);
        }
        if (!this.spotlight) {
            this.spotlight = document.createElement('div');
            this.spotlight.className = 'tutorial-spotlight';
            document.body.appendChild(this.spotlight);
        }
        if (!this.panel) {
            this.panel = document.createElement('div');
            this.panel.className = 'tutorial-panel card';
            document.body.appendChild(this.panel);
        }
        this.overlay.style.display = 'block';
        this.spotlight.style.display = 'none';
        this.panel.style.display = 'block';
    }

    cleanupHighlight() {
        if (this.activeTarget) {
            this.activeTarget.classList.remove('tutorial-highlight');
            this.activeTarget = null;
        }
        if (this.activeModalOverlay) {
            this.activeModalOverlay.classList.remove('tutorial-modal-focus');
            this.activeModalOverlay = null;
        }
        this.promotedContainers.forEach((container) => {
            container.classList.remove('tutorial-stack-focus', 'tutorial-modal-container-focus');
        });
        this.promotedContainers = [];
        if (this.spotlight) {
            this.spotlight.style.display = 'none';
        }
        this.overlay?.classList.remove('has-spotlight');
    }

    emitTutorialEvent(type, payload = {}) {
        eventManager.emit('tutorialEvent', { type, payload });
    }

    handleGameEvent(event) {
        if (!this.active || !event?.type) {
            return;
        }
        const step = this.steps[this.currentStepIndex];
        if (!step) {
            return;
        }
        if (step.waitView && event.type === 'tutorial:viewSwitch' && event.payload?.view === step.waitView) {
            if (!step.eventFilter || step.eventFilter(event) !== false) {
                this.completeCurrentStep(step);
            }
            return;
        }
        if (step.waitEvent && event.type === step.waitEvent && (!step.eventFilter || step.eventFilter(event) !== false)) {
            this.completeCurrentStep(step);
        }
    }

    async completeCurrentStep(step) {
        const stepIndex = this.currentStepIndex;
        if (!this.active || this.pendingCompletionStepIndex === stepIndex) {
            return;
        }

        this.pendingCompletionStepIndex = stepIndex;
        try {
            if (step.closeRewardModalAfterComplete) {
                await this.waitForRewardDialogsToClose(stepIndex);
            }
            if (!this.active || this.currentStepIndex !== stepIndex) {
                return;
            }
            await step.afterComplete?.();
            if (!this.active || this.currentStepIndex !== stepIndex) {
                return;
            }
            this.nextStep();
        } finally {
            if (this.pendingCompletionStepIndex === stepIndex) {
                this.pendingCompletionStepIndex = null;
            }
        }
    }

    stop(markAsSeen = true) {
        this.active = false;
        eventManager.off?.('tutorialEvent', this.boundEventHandler);
        document.removeEventListener('click', this.boundClickGuard, true);
        window.removeEventListener('resize', this.boundSpotlightUpdate);
        window.removeEventListener('scroll', this.boundSpotlightUpdate, true);
        this.clearGameEventSubscriptions();
        this.clearRewardModalCloseTimers();
        this.cleanupHighlight();
        this.replayMode = false;
        this.pendingCompletionStepIndex = null;
        this.waitingForRewardDialog = false;
        document.getElementById('modal-container')?.classList.remove('tutorial-reward-modal-focus');
        if (markAsSeen) {
            this.markSeen();
        }
        if (this.overlay) {
            this.overlay.style.display = 'none';
        }
        if (this.spotlight) {
            this.spotlight.style.display = 'none';
        }
        if (this.panel) {
            this.panel.style.display = 'none';
        }
    }

    clearGameEventSubscriptions() {
        this.gameEventUnsubscribers.forEach(unsubscribe => unsubscribe?.());
        this.gameEventUnsubscribers = [];
    }

    clearRewardModalCloseTimers() {
        this.rewardModalCloseTimers.forEach(timerId => clearTimeout(timerId));
        this.rewardModalCloseTimers = [];
    }

    closeRewardModalsForStep() {
        this.clearRewardModalCloseTimers();
    }

    hasRewardDialogSurface() {
        return Boolean(
            document.querySelector('.reward-modal-shell, .reward-detail-modal-shell, .rare-reward-reveal-overlay')
            || window.RewardModal?.activeInstances?.size > 0
        );
    }

    async waitForRewardDialogsToClose(stepIndex) {
        this.clearRewardModalCloseTimers();
        this.waitingForRewardDialog = true;
        const modalContainer = document.getElementById('modal-container');
        modalContainer?.classList.add('tutorial-reward-modal-focus');

        let sawDialog = false;
        let lastDialogAt = 0;
        const startedAt = Date.now();
        try {
            while (this.active && this.currentStepIndex === stepIndex) {
                const hasDialog = this.hasRewardDialogSurface();
                const now = Date.now();
                if (hasDialog) {
                    sawDialog = true;
                    lastDialogAt = now;
                } else if ((sawDialog && now - lastDialogAt > 420) || now - startedAt > 2600) {
                    break;
                }
                await Utils.delay(120);
            }
            await Utils.delay(120);
        } finally {
            this.waitingForRewardDialog = false;
            modalContainer?.classList.remove('tutorial-reward-modal-focus');
        }
    }

    async showStep() {
        const step = this.steps[this.currentStepIndex];
        if (!step) {
            this.finish();
            return;
        }

        if (step.replaySkipWhen?.()) {
            this.currentStepIndex += 1;
            this.showStep();
            return;
        }

        const stepIndex = this.currentStepIndex;
        if (window.game.currentView !== step.view) {
            window.game.switchView(step.view);
            await Utils.delay(80);
        }

        await step.prepare?.();
        if (!this.active || this.currentStepIndex !== stepIndex) {
            return;
        }

        await Utils.delay(60);
        if (step.skipWhen?.()) {
            this.currentStepIndex += 1;
            this.showStep();
            return;
        }

        await Utils.delay(80);
        this.cleanupHighlight();
        const target = await this.waitForTarget(step.target, stepIndex);
        if (!this.active || this.currentStepIndex !== stepIndex) {
            return;
        }
        if (target) {
            this.activeTarget = target;
            target.classList.add('tutorial-highlight');
            this.promoteTargetStack(target);
            target.scrollIntoView?.({ block: 'center', inline: 'center', behavior: 'smooth' });
            await Utils.delay(120);
            if (!this.active || this.currentStepIndex !== stepIndex) {
                return;
            }
            this.updateSpotlight();
            this.positionPanel(target);
        } else {
            this.updateSpotlight();
            this.positionPanel(null);
        }

        this.renderPanel(step);

        if (step.autoComplete?.()) {
            window.setTimeout(() => this.nextStep(), 180);
            return;
        }
    }

    renderPanel(step) {
        if (!this.panel) {
            return;
        }
        this.panel.innerHTML = `
            <div class="tutorial-step-index">新手教程 ${this.currentStepIndex + 1}/${this.steps.length}</div>
            <div class="tutorial-step-title">${step.title}</div>
            <div class="tutorial-step-desc">${step.description}</div>
            <div class="tutorial-step-hint">${this.activeTarget ? '请点击屏幕中高亮的区域继续。' : '正在等待目标控件出现，请稍候。'}</div>
            <div class="tutorial-panel-actions">
                <button class="btn btn-secondary" onclick="window.tutorialManager.skip()">跳过</button>
            </div>
        `;
    }

    async waitForTarget(selector, stepIndex) {
        for (let attempt = 0; attempt < 8; attempt++) {
            const target = this.findTarget(selector);
            if (target) {
                return target;
            }
            if (!this.active || this.currentStepIndex !== stepIndex) {
                return null;
            }
            await Utils.delay(90);
        }
        return null;
    }

    findTarget(selector) {
        if (!selector) {
            return null;
        }
        const selectors = selector.split(',').map(item => item.trim()).filter(Boolean);
        for (const entry of selectors) {
            const targets = [...document.querySelectorAll(entry)];
            const target = targets.find(element => this.isUsableTarget(element));
            if (target) {
                return target;
            }
        }
        return null;
    }

    isUsableTarget(element) {
        if (!element || element.disabled) {
            return false;
        }
        const rect = element.getBoundingClientRect?.();
        if (!rect || rect.width <= 0 || rect.height <= 0) {
            return false;
        }
        const style = window.getComputedStyle?.(element);
        return !style || (style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0);
    }

    promoteTargetModal(target) {
        const modalOverlay = target?.closest?.('.modal-overlay');
        if (!modalOverlay) {
            return;
        }
        modalOverlay.classList.add('tutorial-modal-focus');
        this.activeModalOverlay = modalOverlay;
    }

    promoteTargetStack(target) {
        this.promoteTargetModal(target);

        const modalContainer = target?.closest?.('#modal-container');
        if (modalContainer) {
            modalContainer.classList.add('tutorial-modal-container-focus');
            this.promotedContainers.push(modalContainer);
        }

        const fixedContainer = target?.closest?.('.tab-bar, .top-bar, .item-section');
        if (fixedContainer) {
            fixedContainer.classList.add('tutorial-stack-focus');
            this.promotedContainers.push(fixedContainer);
        }
    }

    updateSpotlight() {
        if (!this.spotlight) {
            return;
        }
        const target = this.activeTarget;
        if (!target || !this.isUsableTarget(target)) {
            this.spotlight.style.display = 'none';
            this.overlay?.classList.remove('has-spotlight');
            return;
        }
        const rect = target.getBoundingClientRect();
        const padding = 7;
        const left = Math.max(6, rect.left - padding);
        const top = Math.max(6, rect.top - padding);
        const right = Math.min(window.innerWidth - 6, rect.right + padding);
        const bottom = Math.min(window.innerHeight - 6, rect.bottom + padding);
        this.spotlight.style.display = 'block';
        this.overlay?.classList.add('has-spotlight');
        this.spotlight.style.left = `${left}px`;
        this.spotlight.style.top = `${top}px`;
        this.spotlight.style.width = `${Math.max(16, right - left)}px`;
        this.spotlight.style.height = `${Math.max(16, bottom - top)}px`;
    }

    positionPanel(target) {
        if (!this.panel) {
            return;
        }
        const rect = target?.getBoundingClientRect?.();
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
        const shouldUseTop = Boolean(rect && viewportHeight && rect.top > viewportHeight * 0.58);
        this.panel.classList.toggle('is-top', shouldUseTop);
    }

    isAllowedTutorialClick(target) {
        if (this.waitingForRewardDialog && target?.closest?.('#modal-container, .rare-reward-reveal-overlay')) {
            return true;
        }
        if (target?.closest?.('.reward-modal-shell, .rare-reward-reveal-overlay')) {
            return true;
        }
        if (this.panel?.contains(target) || this.activeTarget?.contains(target)) {
            return true;
        }
        return false;
    }

    handleDocumentClick(event) {
        if (!this.active) {
            return;
        }
        const target = event.target;
        if (this.isAllowedTutorialClick(target)) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        Toast.info('请先点击当前高亮的指引目标。');
    }

    nextStep() {
        if (!this.active) {
            return;
        }
        this.currentStepIndex += 1;
        this.showStep();
    }

    skip() {
        this.stop(true);
        Toast.info('已跳过新手教程，可以继续自由探索。');
    }

    finish() {
        this.stop(true);
        taskManager.record('tutorialComplete');
        Toast.success('新手教程完成，继续挑战副本可以解锁更多奖励。');
        window.game.refreshRuntimeUI();
        window.game.save();
    }

    ensureShelterCollectReady() {
        if (this.isReplayMode()) {
            return;
        }
        if (this.hasStateFlag('shelterCollectPrimed')) {
            return;
        }
        if (!shelterManager.productionTimers) {
            return;
        }
        const now = Date.now();
        const oneHourAgo = now - 3600 * 1000 - 1000;
        (ShelterManager.PRODUCTION_BUILDING_IDS || []).forEach((buildingId) => {
            if (shelterManager.getBuilding(buildingId)) {
                shelterManager.productionTimers[buildingId] = Math.min(
                    Number(shelterManager.productionTimers[buildingId]) || oneHourAgo,
                    oneHourAgo
                );
            }
        });
        this.setStateFlag('shelterCollectPrimed');
        window.game.ui.shelterView?.refresh?.();
    }

    prepareRecruitPool(poolId) {
        if (window.game.currentView === 'recruit') {
            window.game.ui.gachaView?.setActivePool?.(poolId);
        } else {
            window.game.ui.gachaView.activePoolId = poolId;
        }
    }

    getStarterHero() {
        return heroManager.getAllHeroes().find(hero => hero.configId === TutorialManager.STARTER_HERO_ID) || null;
    }

    getStarterEquipmentInBag() {
        return itemManager.getAllEquipment().find(equipment => equipment.templateId === TutorialManager.STARTER_EQUIPMENT_TEMPLATE_ID) || null;
    }

    isStarterHeroInTeam() {
        const hero = this.getStarterHero();
        return Boolean(hero && heroManager.isHeroInTeam(hero.id));
    }

    isStarterEquipmentEquipped() {
        const hero = this.getStarterHero();
        if (!hero) {
            return false;
        }
        return Object.values(hero.equipment || {}).some(equipment => (
            equipment?.templateId === TutorialManager.STARTER_EQUIPMENT_TEMPLATE_ID
        ));
    }

    closeTeamModal() {
        window.game?.ui?.heroView?.closeTeamModal?.();
    }

    closeHeroDetail() {
        window.game?.ui?.heroView?.closeEquipmentSelectionModal?.();
        window.game?.ui?.heroView?.closeHeroDetail?.();
    }

}

TutorialManager.STARTER_HERO_ID = 'hero_020';
TutorialManager.STARTER_EQUIPMENT_TEMPLATE_ID = 'common_weapon_cracked_club';

const tutorialManager = new TutorialManager();
window.tutorialManager = tutorialManager;
