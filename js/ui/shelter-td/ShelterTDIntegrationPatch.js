// ShelterTDIntegrationPatch.js
// 把塔防场景嵌入到 .shelter-compact-content-hud 下方
// 由于 ShelterView.render() 每次都 innerHTML 整体重写,
// 我们 hook render,在 render 后重新挂载塔防 wrapper(复用同一实例),避免重建。
(function() {
    if (typeof ShelterView === 'undefined' || !window.shelterView) return;
    if (!window.ShelterTD || !window.ShelterTD.ShelterTDScene) {
        console.warn('[ShelterTD] modules not loaded');
        return;
    }

    const ShelterTDScene = window.ShelterTD.ShelterTDScene;
    let scene = null;

    function syncSceneStatus() {
        if (!scene || !window.shelterManager?.ensureTdIdleState) {
            return;
        }
        const now = Date.now();
        shelterManager.ensureTdIdleState(now);
        const chest = shelterManager.getTdChestStatus(now);
        scene.setMonitorStatus?.({
            idleSeconds: Math.min(
                shelterManager.constructor?.MAX_PRODUCTION_SECONDS || (12 * 3600),
                Math.max(0, Math.floor((now - (Number(shelterManager.tdIdleState?.lastCollectAt) || now)) / 1000))
            ),
            chestStored: chest.stored,
            chestCapacity: chest.capacity,
            chestNextSeconds: chest.nextSeconds,
            tapCount: Number(shelterManager.tdIdleState?.tapCount) || 0,
            tapLimit: 200,
            tapBonusPercent: Math.floor(((shelterManager.getTdTapBonusMultiplier?.(now) || 1) - 1) * 100)
        });
    }

    function buildCollectRewards(result) {
        const rewards = (result?.rewards || []).map((reward) => reward.type === 'item'
            ? RewardModal.createItemReward(reward.id, reward.amount)
            : RewardModal.createResourceReward(reward.id, reward.amount));
        const chestRewards = Array.isArray(result?.chestRewards)
            ? result.chestRewards
            : (result?.chestReward ? [result.chestReward] : []);
        chestRewards.forEach((reward) => {
            if (reward.type === 'item') rewards.push(RewardModal.createItemReward(reward.id, reward.amount, { description: '稀有补给' }));
            else if (reward.type === 'resource') rewards.push(RewardModal.createResourceReward(reward.id, reward.amount, { description: '稀有补给' }));
            else if (reward.type === 'fragment') rewards.push(RewardModal.createFragmentReward(reward.heroId, reward.amount, { description: '稀有补给' }));
        });
        return rewards;
    }

    async function collectMonitorRewards() {
        const result = shelterManager.collectTdIdleRewards?.();
        if (!result?.success) {
            Toast?.info?.(result?.message || '当前暂无可收取收益');
            return;
        }
        if (scene?.running) scene.playCollectBurst();
        await RewardModal.show({
            title: '监控补给',
            rewards: buildCollectRewards(result),
            summaryText: `本次结算 ${result.hours} 小时收益${result.tapBonusPercent ? ` · 点击加成 +${result.tapBonusPercent}%` : ''}`
        });
        syncSceneStatus();
        window.game?.refreshRuntimeUI?.();
        window.game?.save?.();
    }

    function getCurrentLevel() {
        try {
            const b = shelterManager.getBuilding('building_shelter');
            return b?.level || 1;
        } catch (e) { return 1; }
    }

    function ensureScene() {
        if (!scene) {
            scene = new ShelterTDScene({
                level: getCurrentLevel(),
                showFps: false,
                onSecondTick: () => {
                    syncSceneStatus();
                },
                onChestClick: () => {
                    collectMonitorRewards();
                },
                onTapBonus: () => {
                    const beforeBonus = Math.floor(((shelterManager.getTdTapBonusMultiplier?.() || 1) - 1) * 100);
                    const tapResult = shelterManager.recordTdTap?.();
                    const afterBonus = Math.floor(((shelterManager.getTdTapBonusMultiplier?.() || 1) - 1) * 100);
                    syncSceneStatus();
                    return {
                        counted: !!tapResult?.success,
                        reason: tapResult?.reason || '',
                        tapCount: tapResult?.tapCount || Number(shelterManager.tdIdleState?.tapCount) || 0,
                        tapLimit: 200,
                        tapBonusPercent: afterBonus,
                        justLeveled: tapResult?.success && afterBonus > beforeBonus
                    };
                }
            });
            window.ShelterTD.scene = scene; // debug 用
        }
        return scene;
    }

    function mountInto(viewEl) {
        const host = viewEl?.querySelector?.('.shelter-compact-content-hud');
        if (!host) return;
        // 已经在里面了就不动
        const inst = ensureScene();
        if (!inst.wrapper) {
            inst.mount(host);
        } else {
            // 复用:重新 append 到新 host(innerHTML 重写后旧 host 已被替换)
            inst.rebind(host);
        }
        // 同步等级
        inst.setLevel(getCurrentLevel());
        syncSceneStatus();
        // 确保运行
        inst.resume();
    }

    // ---- hook render ----
    const origRender = ShelterView.prototype.render;
    ShelterView.prototype.render = function() {
        origRender.apply(this, arguments);
        try { mountInto(this.element); } catch (e) { console.error('[ShelterTD] mount fail', e); }
    };

    // ---- hook hide/show 控制 raf ----
    const origHide = ShelterView.prototype.hide;
    ShelterView.prototype.hide = function() {
        if (scene) scene.pause();
        if (typeof origHide === 'function') return origHide.apply(this, arguments);
    };
    const origShow = ShelterView.prototype.show;
    ShelterView.prototype.show = function() {
        const r = typeof origShow === 'function' ? origShow.apply(this, arguments) : undefined;
        if (scene) scene.resume();
        return r;
    };

    // ---- 升级时同步等级 ----
    // upgradeBuilding 走 shelterManager.upgradeBuilding,我们 hook 收尾
    if (typeof shelterManager !== 'undefined') {
        const origUpgrade = shelterManager.upgradeBuilding;
        if (typeof origUpgrade === 'function') {
            shelterManager.upgradeBuilding = function(id) {
                const r = origUpgrade.apply(this, arguments);
                if (r?.success && id === 'building_shelter' && scene) {
                    scene.setLevel(getCurrentLevel());
                    syncSceneStatus();
                }
                return r;
            };
        }
    }

    // ---- 一键收取时播放爽快感动画 ----
    const origCollect = ShelterView.prototype.collectAllProduction;
    if (typeof origCollect === 'function') {
        ShelterView.prototype.collectAllProduction = async function() {
            return collectMonitorRewards();
        };
    }

    // 当前视图已经渲染过(冷启动情形),立即尝试挂载
    if (window.shelterView?.element && window.shelterView?.visible) {
        try { mountInto(window.shelterView.element); } catch (e) {}
    }

    console.log('[ShelterTD] integration patch installed');
})();
