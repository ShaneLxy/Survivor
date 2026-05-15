(function() {
    if (typeof Game === 'undefined' || !window.game || !window.tutorialManager) {
        return;
    }

    const STARTER_HERO_ID = TutorialManager.STARTER_HERO_ID || 'hero_020';
    const STARTER_EQUIPMENT_TEMPLATE_ID = TutorialManager.STARTER_EQUIPMENT_TEMPLATE_ID || 'common_weapon_cracked_club';

    function emitTutorial(type, payload = {}) {
        window.tutorialManager?.emitTutorialEvent?.(type, payload);
    }

    function hasHero(configId) {
        return heroManager.getAllHeroes().some(hero => hero.configId === configId);
    }

    function hasEquipment(templateId) {
        const inBag = itemManager.getAllEquipment().some(equipment => equipment.templateId === templateId);
        const equipped = heroManager.getAllHeroes().some(hero => (
            Object.values(hero.equipment || {}).some(equipment => equipment?.templateId === templateId)
        ));
        return inBag || equipped;
    }

    function getStarterPackKey() {
        const user = authService?.getCurrentUser?.();
        return `survivor_starter_pack_${user?.id || user?.account || 'guest'}`;
    }

    function getTutorialStateKey() {
        const user = authService?.getCurrentUser?.();
        return `survivor_tutorial_state_${user?.id || user?.account || 'guest'}`;
    }

    function hasTutorialFlag(flag) {
        if (window.tutorialManager?.hasStateFlag?.(flag)) {
            return true;
        }
        try {
            const state = JSON.parse(localStorage.getItem(getTutorialStateKey()) || '{}') || {};
            return Boolean(state[flag]);
        } catch (error) {
            return false;
        }
    }

    function setTutorialFlag(flag) {
        if (window.tutorialManager?.setStateFlag?.(flag)) {
            window.tutorialManager.setStateFlag(flag);
            return;
        }
        try {
            const state = JSON.parse(localStorage.getItem(getTutorialStateKey()) || '{}') || {};
            state[flag] = true;
            localStorage.setItem(getTutorialStateKey(), JSON.stringify(state));
        } catch (error) {
            console.warn('[Tutorial] failed to persist tutorial flag', flag, error);
        }
    }

    function grantNewAccountStarterPack() {
        const key = getStarterPackKey();
        if (localStorage.getItem(key) === '1' || hasTutorialFlag('starterPackGranted')) {
            return;
        }
        localStorage.setItem(key, '1');
        setTutorialFlag('starterPackGranted');
        shelterManager.resources = {
            ...shelterManager.resources,
            gold: 500,
            diamond: 500
        };
        itemManager.addItem('hero_summon', 1);
        itemManager.addItem('weapon_forge_ticket', 1);
        itemManager.addItem('ad_skip_card', 1);
        window.game.player.gold = shelterManager.getResource('gold');
        window.game.player.diamond = shelterManager.getResource('diamond');
    }

    const originalInitNewGame = Game.prototype.initNewGame;
    Game.prototype.initNewGame = function() {
        originalInitNewGame.call(this);
        tutorialManager.loadState?.(null);
        heroManager.heroes = [];
        heroManager.team = [];
        grantNewAccountStarterPack();
    };

    const originalLoadFromSave = Game.prototype.loadFromSave;
    Game.prototype.loadFromSave = function(saveData) {
        originalLoadFromSave.call(this, saveData);
        tutorialManager.loadState?.(saveData?.data?.tutorialData || null);
    };

    const originalGetSaveData = Game.prototype.getSaveData;
    Game.prototype.getSaveData = function() {
        const data = originalGetSaveData.call(this);
        return {
            ...data,
            tutorialData: tutorialManager.getSaveData?.() || {}
        };
    };

    const originalGachaPull = GachaManager.prototype.pull;
    GachaManager.prototype.pull = function(poolIdOrCount = 1, countMaybe) {
        const poolId = typeof countMaybe === 'number' ? poolIdOrCount : this.currentPool;
        const count = typeof countMaybe === 'number' ? countMaybe : poolIdOrCount;
        if (count !== 1) {
            return originalGachaPull.call(this, poolIdOrCount, countMaybe);
        }

        const pool = this.getPoolConfig(poolId);
        const cost = this.getPaymentOption(poolId, count);
        if (!pool || !cost || !this.hasEnoughPayment(cost)) {
            return originalGachaPull.call(this, poolIdOrCount, countMaybe);
        }

        let forcedResults = null;
        if (poolId === 'hero_pool'
            && window.tutorialManager?.canUseStarterGuarantee?.('hero')
            && !hasHero(STARTER_HERO_ID)) {
            forcedResults = [{
                type: 'hero',
                poolId,
                entryId: 'tutorial_starter_hero',
                configId: STARTER_HERO_ID,
                rarity: HeroConfig.getHeroConfig(STARTER_HERO_ID)?.rarity || 'common',
                name: HeroConfig.getHeroConfig(STARTER_HERO_ID)?.name || '破伤风-断钉',
                icon: HeroConfig.getHeroConfig(STARTER_HERO_ID)?.icon || 'H'
            }];
        } else if (poolId === 'equipment_pool'
            && window.tutorialManager?.canUseStarterGuarantee?.('equipment')
            && !hasEquipment(STARTER_EQUIPMENT_TEMPLATE_ID)) {
            const equipment = EquipmentConfig.createEquipment(STARTER_EQUIPMENT_TEMPLATE_ID, 'common');
            if (equipment) {
                forcedResults = [{
                    type: 'equipment',
                    poolId,
                    entryId: 'tutorial_starter_equipment',
                    rarity: equipment.rarity,
                    equipment
                }];
            }
        }

        if (!forcedResults) {
            return originalGachaPull.call(this, poolIdOrCount, countMaybe);
        }

        const inventoryCheck = this.canAcceptResults(forcedResults);
        if (!inventoryCheck.success) {
            return { success: false, message: inventoryCheck.message || '背包容量达到上限' };
        }

        if (!this.consumePayment(cost)) {
            const costLabel = this.getPaymentLabel(cost);
            return { success: false, message: `${costLabel}不足，需要 ${cost?.amount || 0}` };
        }

        if (poolId === 'hero_pool') {
            setTutorialFlag('starterHeroGuaranteeUsed');
        } else if (poolId === 'equipment_pool') {
            setTutorialFlag('starterEquipmentGuaranteeUsed');
        }
        eventManager.emit('gachaPull', { poolId, results: forcedResults, cost });
        return { success: true, poolId, results: forcedResults, cost };
    };

    /*
     * Safety net for older saves that already passed the starter guarantee:
     * if the player already owns the starter items, the tutorial can still advance.
     */
    const originalGachaAddResults = GachaManager.prototype.addResults;
    GachaManager.prototype.addResults = function(results) {
        const added = originalGachaAddResults.call(this, results);
        if (window.tutorialManager?.isActiveStep?.('recruit_hero')
            && (added?.addedHeroes?.some(hero => hero.configId === STARTER_HERO_ID) || hasHero(STARTER_HERO_ID))) {
            emitTutorial('tutorial:starterHeroReady', { heroId: STARTER_HERO_ID });
        }
        if (window.tutorialManager?.isActiveStep?.('forge_equipment')
            && (added?.addedEquipment?.some(equipment => equipment.templateId === STARTER_EQUIPMENT_TEMPLATE_ID) || hasEquipment(STARTER_EQUIPMENT_TEMPLATE_ID))) {
            emitTutorial('tutorial:starterEquipmentReady', { templateId: STARTER_EQUIPMENT_TEMPLATE_ID });
        }
        return added;
    };

    const originalTabSwitch = TabBar.prototype.switchTab;
    TabBar.prototype.switchTab = function(tabId) {
        originalTabSwitch.call(this, tabId);
        emitTutorial('tutorial:viewSwitch', { view: tabId });
    };

    const originalGachaSetActivePool = GachaView.prototype.setActivePool;
    GachaView.prototype.setActivePool = function(poolId) {
        originalGachaSetActivePool.call(this, poolId);
        emitTutorial('tutorial:gachaPoolSelected', { poolId });
    };

    const originalGachaRenderDrawButton = GachaView.prototype.renderDrawButton;
    GachaView.prototype.renderDrawButton = function(poolId, count) {
        const markup = originalGachaRenderDrawButton.call(this, poolId, count);
        if (markup.includes('data-draw-count=')) {
            return markup;
        }
        return markup.replace(
            'type="button"',
            `type="button" data-pool-id="${poolId}" data-draw-count="${count}"`
        );
    };

    const originalShelterToggleMenu = ShelterView.prototype.toggleCompactBuildingMenu;
    ShelterView.prototype.toggleCompactBuildingMenu = function(event) {
        originalShelterToggleMenu?.call(this, event);
        emitTutorial('tutorial:shelterBuildingMenuOpen');
    };

    const originalHeroManagerAddToTeam = HeroManager.prototype.addToTeam;
    HeroManager.prototype.addToTeam = function(heroId) {
        const success = originalHeroManagerAddToTeam.call(this, heroId);
        const hero = this.getHero(heroId);
        if (success && hero?.configId === STARTER_HERO_ID) {
            emitTutorial('tutorial:starterHeroInTeam', { heroId });
        }
        return success;
    };

    const originalHeroEquipToHero = HeroManager.prototype.equipToHero;
    HeroManager.prototype.equipToHero = function(heroId, equipmentInstanceId) {
        const result = originalHeroEquipToHero.call(this, heroId, equipmentInstanceId);
        if (result?.success && result.hero?.configId === STARTER_HERO_ID && result.equipment?.templateId === STARTER_EQUIPMENT_TEMPLATE_ID) {
            emitTutorial('tutorial:starterEquipmentEquipped', { heroId, equipmentId: equipmentInstanceId });
        }
        return result;
    };

    const originalHeroShowTeam = HeroView.prototype.showTeam;
    HeroView.prototype.showTeam = function() {
        originalHeroShowTeam.call(this);
        emitTutorial('tutorial:teamModalOpened');
    };

    const originalHeroOnClick = HeroView.prototype.onHeroClick;
    HeroView.prototype.onHeroClick = function(hero) {
        originalHeroOnClick.call(this, hero);
        if (hero?.configId === STARTER_HERO_ID) {
            emitTutorial('tutorial:starterHeroDetailOpened', { heroId: hero.id });
        }
    };

    const originalHeroShowEquipSelection = HeroView.prototype.showEquipSelection;
    HeroView.prototype.showEquipSelection = function(heroId, slot) {
        originalHeroShowEquipSelection.call(this, heroId, slot);
        const hero = heroManager.getHero(heroId);
        if (hero?.configId === STARTER_HERO_ID && slot === 'weapon') {
            emitTutorial('tutorial:starterEquipmentSelectionOpened', { heroId, slot });
        }
    };

    const originalTaskClaimDaily = TaskView.prototype.claimDaily;
    TaskView.prototype.claimDaily = async function(taskId) {
        const wasClaimed = Boolean(taskManager.dailyClaimed?.[taskId]);
        const promise = originalTaskClaimDaily.call(this, taskId);
        if (!wasClaimed && taskManager.dailyClaimed?.[taskId]) {
            emitTutorial('tutorial:taskRewardClaimed', { taskId, type: 'daily' });
        }
        return promise;
    };

    const originalTaskClaimAchievement = TaskView.prototype.claimAchievement;
    TaskView.prototype.claimAchievement = async function(taskId) {
        const wasClaimed = Boolean(taskManager.achievementClaimed?.[taskId]);
        const promise = originalTaskClaimAchievement.call(this, taskId);
        if (!wasClaimed && taskManager.achievementClaimed?.[taskId]) {
            emitTutorial('tutorial:taskRewardClaimed', { taskId, type: 'achievement' });
        }
        return promise;
    };

    const originalDoCheckin = CheckinView.prototype.doCheckin;
    CheckinView.prototype.doCheckin = async function() {
        const before = checkinManager.getCheckinStatus?.()?.isTodayCheckedIn;
        const promise = originalDoCheckin.call(this);
        const after = checkinManager.getCheckinStatus?.()?.isTodayCheckedIn;
        if (!before && after) {
            emitTutorial('tutorial:checkinClaimed');
        }
        return promise;
    };

    const originalRecordWelfareGiftWatch = CheckinManager.prototype.recordWelfareGiftWatch;
    CheckinManager.prototype.recordWelfareGiftWatch = function(giftId) {
        const before = this.getWelfareGiftUsage?.(giftId)?.used || 0;
        const result = originalRecordWelfareGiftWatch.call(this, giftId);
        const after = this.getWelfareGiftUsage?.(giftId)?.used || 0;
        if (after > before) {
            emitTutorial('tutorial:welfareGiftClaimed', { giftId });
        }
        return result;
    };

    const originalOpenChapterStageModal = DungeonView.prototype.openChapterStageModal;
    DungeonView.prototype.openChapterStageModal = function(chapterId) {
        originalOpenChapterStageModal.call(this, chapterId);
        if (this.chapterStageModal?.isShown?.()) {
            emitTutorial('tutorial:dungeonChapterOpened', { chapterId });
        }
    };

    const originalOnLoginSuccess = Game.prototype.onLoginSuccess;
    Game.prototype.onLoginSuccess = async function() {
        await originalOnLoginSuccess.call(this);
        if (!this.gameReady) {
            return;
        }
        if (tutorialManager.shouldAutoStart()) {
            setTimeout(() => tutorialManager.start(), 280);
        }
    };
})();
