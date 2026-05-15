/**
 * 签到 / 福利视图
 */
class CheckinView {
    constructor() {
        this.element = document.getElementById('main-display');
        this.visible = false;
    }

    show() {
        this.visible = true;
        this.render();
    }

    hide() {
        this.visible = false;
        this.element.innerHTML = '';
    }

    getDefaultWelfareGiftConfigs() {
        return [
            {
                id: 'gift_gold',
                name: '补给金币箱',
                title: '补给金币箱',
                caption: '观看激励视频',
                description: '领取一批基础金币补给。',
                sortOrder: 1,
                rewards: [{ type: 'resource', id: 'gold', count: 5000 }],
                adLimits: { normal: 3, welfare: 4, supreme: 5 }
            },
            {
                id: 'gift_diamond',
                name: '钻石应急包',
                title: '钻石应急包',
                caption: '观看激励视频',
                description: '补充少量稀有货币。',
                sortOrder: 2,
                rewards: [{ type: 'resource', id: 'diamond', count: 50 }],
                adLimits: { normal: 3, welfare: 4, supreme: 5 }
            },
            {
                id: 'gift_energy',
                name: '作战体力包',
                title: '作战体力包',
                caption: '观看激励视频',
                description: '补充体力药水与经验药水。',
                sortOrder: 3,
                rewards: [
                    { type: 'item', id: 'energy_potion', count: 1 },
                    { type: 'item', id: 'exp_potion', count: 20 }
                ],
                adLimits: { normal: 3, welfare: 4, supreme: 5 }
            }
        ];
    }

    getDefaultMonthCardConfigs() {
        return [
            {
                id: 'welfare_month_card',
                kind: 'monthCard',
                name: '福利月卡',
                title: '福利月卡',
                subtitle: '每日基础资源补给',
                description: '通过观看激励视频激活，激活后每日可领取一组额外资源。',
                requiredViews: 30,
                activationViews: 30,
                durationDays: 30,
                badge: '月卡',
                sortOrder: 101,
                dailyRewards: [
                    { type: 'resource', id: 'gold', count: 3000 },
                    { type: 'resource', id: 'meat', count: 20 }
                ]
            },
            {
                id: 'supreme_month_card',
                kind: 'monthCard',
                name: '至尊月卡',
                title: '至尊月卡',
                subtitle: '更高阶的日常福利',
                description: '激活门槛更高，但每日补给更丰厚，同时提升福利礼包观看上限。',
                requiredViews: 55,
                activationViews: 55,
                durationDays: 30,
                badge: '至尊',
                sortOrder: 102,
                dailyRewards: [
                    { type: 'resource', id: 'diamond', count: 30 },
                    { type: 'resource', id: 'gold', count: 6000 },
                    { type: 'item', id: 'energy_potion', count: 1 }
                ]
            }
        ];
    }

    getRawWelfareConfigs() {
        const configured = window.CheckinConfig?.welfareGifts;
        const list = Array.isArray(configured)
            ? configured
            : [
                ...this.getDefaultWelfareGiftConfigs(),
                ...this.getDefaultMonthCardConfigs()
            ];
        return [...list].filter(entry => entry?.id);
    }

    isMonthCardEntry(entry) {
        return entry?.kind === 'monthCard' || String(entry?.id || '').includes('month_card');
    }

    isBrokenText(value) {
        const text = String(value ?? '').trim();
        if (!text) {
            return true;
        }
        if (/^\?+$/.test(text) || text.includes('�')) {
            return true;
        }
        return /[Ã¥Ã¦Ã§Ã¨Ã©ÃªÃ«Ã¬Ã­Ã®Ã¯Ã°Ã±Ã²Ã³Ã´ÃµÃ¶Ã·Ã¸Ã¹ÃºÃ»Ã¼]/.test(text) ||
            /[锟斤拷鈥]/.test(text);
    }

    getEntryFallbackMap() {
        return {
            gift_gold: {
                name: '补给金币箱',
                title: '补给金币箱',
                caption: '观看激励视频',
                description: '领取一批基础金币补给。'
            },
            gift_diamond: {
                name: '钻石应急包',
                title: '钻石应急包',
                caption: '观看激励视频',
                description: '补充少量稀有货币。'
            },
            gift_energy: {
                name: '作战体力包',
                title: '作战体力包',
                caption: '观看激励视频',
                description: '补充体力药水与经验药水。'
            },
            welfare_month_card: {
                name: '福利月卡',
                title: '福利月卡',
                subtitle: '每日基础资源补给',
                description: '观看 30 次激励视频激活，月卡有效期 30 天。',
                badge: '月卡'
            },
            supreme_month_card: {
                name: '至尊月卡',
                title: '至尊月卡',
                subtitle: '更高阶的日常福利',
                description: '观看 55 次激励视频激活，月卡有效期 30 天。',
                badge: '至尊'
            }
        };
    }

    withWelfareFallback(entry) {
        const fallback = this.getEntryFallbackMap()[entry?.id] || {};
        const pick = (key, defaultValue = '') => {
            const source = entry?.[key];
            if (!this.isBrokenText(source)) {
                return String(source).trim();
            }
            const candidate = fallback[key];
            if (!this.isBrokenText(candidate)) {
                return String(candidate).trim();
            }
            return defaultValue;
        };
        return {
            ...entry,
            name: pick('name', entry?.id || ''),
            title: pick('title', pick('name', entry?.id || '')),
            subtitle: pick('subtitle', ''),
            caption: pick('caption', '观看激励视频'),
            description: pick('description', ''),
            badge: pick('badge', '月卡')
        };
    }

    getMonthCardConfigs() {
        const cards = this.getRawWelfareConfigs()
            .filter(entry => this.isMonthCardEntry(entry))
            .map(entry => {
                const normalized = this.withWelfareFallback({
                    ...entry,
                    kind: 'monthCard'
                });
                return {
                    ...normalized,
                    id: String(entry.id || '').trim(),
                    requiredViews: Math.max(1, Number(entry.requiredViews ?? entry.activationViews ?? 1) || 1),
                    durationDays: Math.max(1, Number(entry.durationDays ?? 30) || 30),
                    dailyRewards: Array.isArray(entry.dailyRewards) ? entry.dailyRewards : []
                };
            })
            .sort((left, right) =>
                Number(left.sortOrder || 0) - Number(right.sortOrder || 0) ||
                String(left.name || left.id).localeCompare(String(right.name || right.id), 'zh-CN')
            );
        return cards.length ? cards : this.getDefaultMonthCardConfigs();
    }

    getWelfareGiftConfigs() {
        const gifts = this.getRawWelfareConfigs()
            .filter(entry => !this.isMonthCardEntry(entry))
            .map(entry => ({
                ...this.withWelfareFallback(entry),
                adLimits: this.normalizeGiftAdLimits(entry?.adLimits),
                rewards: Array.isArray(entry?.rewards) ? entry.rewards : []
            }));
        const list = gifts.length ? gifts : this.getDefaultWelfareGiftConfigs();
        return [...list]
            .filter(gift => gift?.id)
            .sort((left, right) =>
                Number(left.sortOrder || 0) - Number(right.sortOrder || 0) ||
                String(left.name || left.title || left.id).localeCompare(
                    String(right.name || right.title || right.id),
                    'zh-CN'
                )
            );
    }

    normalizeGiftAdLimits(value) {
        return {
            normal: Math.max(0, Number(value?.normal ?? 3) || 0),
            welfare: Math.max(0, Number(value?.welfare ?? 4) || 0),
            supreme: Math.max(0, Number(value?.supreme ?? 5) || 0)
        };
    }

    getGiftName(gift) {
        return gift?.name || gift?.title || gift?.id || '福利礼包';
    }

    getGiftCaption(gift) {
        return gift?.caption || '观看激励视频';
    }

    render() {
        const status = checkinManager.getCheckinStatus();
        const bonusRewards = CheckinManager.REWARDS;
        const dailyRewards = CheckinManager.DAILY_REWARDS;
        const welfareGifts = this.getWelfareGiftConfigs();
        const monthCards = this.getMonthCardConfigs();
        const cycleProgress = Math.round((status.claimedDay / bonusRewards.length) * 100);
        const activeDay = status.isTodayCheckedIn ? status.claimedDay : status.nextDay;
        const todayBonusReward = bonusRewards[Math.max(0, activeDay - 1)] || bonusRewards[0];
        const totalCheckins = checkinManager.totalCheckins || 0;
        const dailyRewardText = this.getRewardText(dailyRewards);
        const bonusRewardText = this.getRewardText(todayBonusReward);
        const regularRewards = bonusRewards.slice(0, Math.max(0, bonusRewards.length - 1));
        const premiumReward = bonusRewards[bonusRewards.length - 1] || null;
        const regularDayCards = regularRewards
            .map((reward, index) => this.renderDayCard(reward, index + 1, status))
            .join('');
        const premiumDayCard = premiumReward
            ? this.renderDayCard(premiumReward, bonusRewards.length, status, 'checkin-side-premium')
            : '';

        this.element.innerHTML = `
            <div class="checkin-view">
                <div class="checkin-stage-header">
                    <div class="checkin-stage-heading-row">
                        <div class="checkin-stage-heading-group">
                            <div class="checkin-stage-kicker">SUPPLY CHECKPOINT</div>
                            <h1 class="checkin-title">每日福利</h1>
                            <div class="checkin-subtitle">每日固定补给稳定入账，七日签到额外奖励按循环队列持续发放。</div>
                        </div>
                    </div>
                    <div class="checkin-stage-stats">
                        <div class="checkin-stage-stat">
                            <span>今日状态</span>
                            <strong>${status.isTodayCheckedIn ? '已领取' : '待领取'}</strong>
                        </div>
                        <div class="checkin-stage-stat">
                            <span>本轮进度</span>
                            <strong>${activeDay}/7</strong>
                        </div>
                        <div class="checkin-stage-stat">
                            <span>累计签到</span>
                            <strong>${totalCheckins}</strong>
                        </div>
                    </div>
                </div>
                <div class="checkin-supply-board">
                    <div class="checkin-cycle-meter" style="--checkin-progress: ${cycleProgress}%">
                        <span></span>
                    </div>
                    <div class="checkin-supply-layout">
                        <div class="checkin-days">
                            ${regularDayCards}
                        </div>
                        ${premiumDayCard}
                    </div>
                </div>
                <div class="checkin-action-panel ${status.isTodayCheckedIn ? 'is-complete' : 'is-ready'}">
                    <div class="checkin-action-copy">
                        <span>${status.isTodayCheckedIn ? 'TODAY LOGGED' : 'READY TO CLAIM'}</span>
                        <strong>${status.isTodayCheckedIn ? `第 ${activeDay} 天补给已入账` : `领取每日补给 + DAY ${activeDay} 额外补给`}</strong>
                        <div class="checkin-claim-rewards">
                            <div class="checkin-claim-row">
                                <span>每日固定</span>
                                <strong>${this.escapeHtml(dailyRewardText)}</strong>
                            </div>
                            <div class="checkin-claim-row is-bonus">
                                <span>签到额外</span>
                                <strong>${this.escapeHtml(bonusRewardText)}</strong>
                            </div>
                        </div>
                    </div>
                    <button class="checkin-claim-button" ${status.isTodayCheckedIn ? 'disabled' : 'onclick="window.game.ui.checkinView.doCheckin()"'}>${status.isTodayCheckedIn ? '已完成' : '领取'}</button>
                </div>
                ${this.renderMonthCardBoard(monthCards)}
                ${this.renderWelfareBoard(welfareGifts)}
            </div>
        `;
    }

    renderMonthCardBoard(monthCards) {
        return `
            <div class="checkin-month-card-board">
                <div class="checkin-welfare-header">
                    <div>
                        <div class="checkin-welfare-kicker">MONTH PASS</div>
                        <div class="checkin-welfare-title">月卡福利</div>
                    </div>
                    <div class="checkin-welfare-tip">本月看视频解锁 30 天权益</div>
                </div>
                <div class="checkin-month-card-list">
                    ${monthCards.map(card => this.renderMonthCard(card)).join('')}
                </div>
            </div>
        `;
    }

    renderMonthCard(card) {
        const status = checkinManager.getMonthCardStatus(card);
        const actionText = status.active
            ? (status.canClaim ? '领取今日奖励' : '今日已领取')
            : '未解锁';
        const actionDisabled = !status.active || !status.canClaim;
        return `
            <div class="checkin-month-card ${status.active ? 'is-active' : ''}">
                <div class="checkin-month-card-top">
                    <div class="checkin-month-card-copy">
                        <strong>${this.escapeHtml(card.name)}</strong>
                        <span>${this.escapeHtml(card.subtitle || '')}</span>
                    </div>
                    <div class="checkin-month-card-badge">${this.escapeHtml(card.badge || '月卡')}</div>
                </div>
                <div class="checkin-month-card-progress">
                    <span>${status.active ? `有效期 ${status.durationDays} 天` : `本月进度 ${status.watchedMonth}/${status.requiredViews}`}</span>
                    <strong>${status.active ? (status.canClaim ? '待领取' : '已领取') : '未解锁'}</strong>
                </div>
                <div class="checkin-month-card-action-row">
                    <div class="checkin-month-card-rewards">
                        ${(card.dailyRewards || []).map((reward) => this.renderWelfareRewardChip(reward)).join('')}
                    </div>
                    <div class="checkin-month-card-footer">
                        <button
                            type="button"
                            class="checkin-month-card-button"
                            ${actionDisabled ? 'disabled' : ''}
                            onclick="window.game.ui.checkinView.handleMonthCardAction('${card.id}')">${this.escapeHtml(actionText)}</button>
                    </div>
                </div>
            </div>
        `;
    }

    renderWelfareBoard(welfareGifts) {
        const adSkipCardCount = itemManager.getAdSkipCardCount?.() || 0;
        const adBadgeText = adSkipCardCount > 0 ? '免AD' : 'AD';
        return `
            <div class="checkin-welfare-board">
                <div class="checkin-welfare-header">
                    <div>
                        <div class="checkin-welfare-kicker">WELFARE CRATE</div>
                        <div class="checkin-welfare-title">福利礼包</div>
                    </div>
                    <div class="checkin-welfare-tip">左右滑动查看更多礼包</div>
                </div>
                <div class="checkin-welfare-list">
                    ${welfareGifts.length ? welfareGifts.map((gift) => {
                        const usage = checkinManager.getWelfareGiftUsage(gift.id, gift.adLimits);
                        return `
                            <button
                                type="button"
                                class="checkin-welfare-card"
                                data-welfare-id="${gift.id}"
                                ${usage.remaining <= 0 ? 'disabled' : ''}
                                onclick="window.game.ui.checkinView.watchWelfareGift('${gift.id}')">
                                <div class="checkin-welfare-card-top">
                                    <div class="checkin-welfare-copy">
                                        <strong>${this.escapeHtml(this.getGiftName(gift))}</strong>
                                        <span>${this.escapeHtml(this.getGiftCaption(gift))}</span>
                                    </div>
                                    <div class="checkin-welfare-badge">${adBadgeText}</div>
                                </div>
                                <div class="checkin-welfare-desc">${this.escapeHtml(gift.description || '领取一组额外福利奖励。')}</div>
                                <div class="checkin-welfare-limit">今日 ${usage.used}/${usage.limit} 次</div>
                                <div class="checkin-welfare-rewards">
                                    ${(gift.rewards || []).map((reward) => this.renderWelfareRewardChip(reward)).join('')}
                                </div>
                            </button>
                        `;
                    }).join('') : '<div class="checkin-welfare-empty">当前尚未配置福利礼包</div>'}
                </div>
            </div>
        `;
    }

    renderWelfareRewardChip(reward) {
        const normalized = this.getRewardEntries([reward])[0] || { label: '奖励', count: 0, icon: 'R', iconSrc: '' };
        return `
            <span class="checkin-welfare-reward-chip">
                <span class="checkin-welfare-reward-icon">
                    ${normalized.iconSrc
                        ? `<img class="day-reward-icon-image" src="${normalized.iconSrc}" alt="${this.escapeHtml(normalized.label)}">`
                        : this.escapeHtml(normalized.icon || 'R')}
                </span>
                <span>${this.escapeHtml(normalized.label)} x${normalized.count}</span>
            </span>
        `;
    }

    renderDayCard(reward, day, status, extraClass = '') {
        const isChecked = day <= status.claimedDay;
        const isToday = status.canCheckin && day === status.nextDay;
        const isFuture = day > status.claimedDay && day !== status.nextDay;
        const rewardChips = this.getRewardEntries(reward).map(item => `
            <span class="day-reward-chip" title="${this.escapeHtml(`${item.label} x${item.count}`)}">
                <span class="day-reward-icon">${this.renderRewardIconMarkup(item)}</span>
                <span class="day-reward-count">x${item.count}</span>
            </span>
        `).join('');
        const classes = [
            'checkin-day',
            day === 7 ? 'is-premium' : '',
            isChecked ? 'checked' : '',
            isToday ? 'today' : '',
            isFuture ? 'future' : '',
            extraClass
        ].filter(Boolean).join(' ');
        const statusText = isChecked ? '已领取' : (isToday ? '今日额外' : '待领取');
        const clickAction = !isChecked && isToday ? 'onclick="window.game.ui.checkinView.doCheckin()"' : '';

        return `
            <div class="${classes}" ${clickAction}>
                <div class="day-topline">
                    <span class="day-index">DAY ${day}</span>
                    <span class="day-status">${statusText}</span>
                </div>
                <div class="day-reward-row">
                    <div class="day-number">${day}</div>
                    <div class="day-reward">${rewardChips}</div>
                </div>
            </div>
        `;
    }

    getRewardEntries(reward) {
        const rewardList = Array.isArray(reward) ? reward : (reward?.rewards || []);
        return rewardList.map(r => {
            const count = Number(r.count ?? r.amount ?? r.total ?? 0) || 0;
            if (r.type === 'resource') {
                const info = shelterManager.getResourceInfo(r.id);
                return {
                    icon: info.icon || 'R',
                    iconSrc: info.iconSrc || null,
                    label: info.name || r.id,
                    count
                };
            }
            if (r.type === 'item') {
                const item = ItemConfig.getItemConfig(r.id) || {};
                return {
                    icon: item.icon || 'I',
                    iconSrc: item.iconSrc || null,
                    label: item.name || r.id,
                    count
                };
            }
            if (r.type === 'fragment') {
                const fragmentItem = ItemConfig.getItemConfig(r.id) || {};
                return {
                    icon: fragmentItem.icon || 'F',
                    iconSrc: fragmentItem.iconSrc || null,
                    label: fragmentItem.name || r.id,
                    count
                };
            }
            if (r.type === 'random_fragments') {
                return {
                    icon: 'F',
                    iconSrc: ItemConfig.getItemIconSrc?.('hero_summon') || null,
                    label: '随机碎片',
                    count
                };
            }
            return {
                icon: 'I',
                iconSrc: null,
                label: r.id || '奖励',
                count
            };
        });
    }

    renderRewardIconMarkup(item) {
        if (item?.iconSrc) {
            return `<img class="day-reward-icon-image" src="${item.iconSrc}" alt="${this.escapeHtml(item.label || '奖励')}">`;
        }
        return this.escapeHtml(item?.icon || 'I');
    }

    getRewardText(reward) {
        return this.getRewardEntries(reward)
            .map(r => `${r.label}x${r.count}`)
            .join(' ');
    }

    escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    }

    async doCheckin() {
        const result = checkinManager.checkin();
        if (result.success) {
            this.render();
            await RewardModal.show({
                title: `签到成功 - DAY ${result.claimedDay}`,
                rewards: result.rewards,
                summaryText: '每日固定补给与签到额外奖励已入账'
            });
            window.game.save();
        } else {
            Toast.error(result.message);
        }
    }

    getDirichletRewardAdPlugin() {
        return window.Capacitor?.Plugins?.DirichletRewardAd || null;
    }

    getRewardAdUserId() {
        const player = window.game?.player;
        return String(player?.id || player?.accountId || player?.username || player?.name || 'guest');
    }

    canGrantWelfareRewards(rewards) {
        const itemEntries = (Array.isArray(rewards) ? rewards : [])
            .filter(reward => reward?.type === 'item')
            .map(reward => ({ id: reward.id, count: Number(reward.count ?? reward.amount ?? 1) || 1 }));
        return itemManager.canAddItemBundle(itemEntries);
    }

    grantWelfareRewards(rewards) {
        (Array.isArray(rewards) ? rewards : []).forEach(reward => {
            const count = Number(reward.count ?? reward.amount ?? 0) || 0;
            if (!count) {
                return;
            }
            if (reward.type === 'resource') {
                shelterManager.addResource(reward.id, count);
                return;
            }
            if (reward.type === 'item') {
                itemManager.addItem(reward.id, count);
                return;
            }
            if (reward.type === 'fragment') {
                const item = ItemConfig.getItemConfig(reward.id) || {};
                const heroId = item.fragmentHeroId;
                if (heroId) {
                    heroManager.addFragments(heroId, count);
                }
            }
        });
    }

    createRewardModalEntries(rewards) {
        return (Array.isArray(rewards) ? rewards : []).map(reward => {
            const count = Number(reward.count ?? reward.amount ?? 0) || 0;
            if (reward.type === 'resource') {
                return RewardModal.createResourceReward(reward.id, count);
            }
            if (reward.type === 'item') {
                return RewardModal.createItemReward(reward.id, count);
            }
            if (reward.type === 'fragment') {
                const item = ItemConfig.getItemConfig(reward.id) || {};
                if (item.fragmentHeroId) {
                    return RewardModal.createFragmentReward(item.fragmentHeroId, count);
                }
            }
            return null;
        }).filter(Boolean);
    }

    async playRewardVideo(extraKey, rewardName) {
        if (itemManager.hasAdSkipCard?.()) {
            const consumeResult = itemManager.consumeAdSkipCard?.(1);
            if (!consumeResult?.success) {
                Toast.error(consumeResult?.message || '免广告卡消耗失败');
                return { success: false };
            }
            checkinManager.recordRewardVideoWatch?.();
            Toast.success(`已消耗1张免广告卡，剩余${consumeResult.remaining}张`);
            return { success: true, skippedAd: true, consumeResult };
        }

        const plugin = this.getDirichletRewardAdPlugin();
        if (!plugin?.showRewardVideo) {
            Toast.error('当前环境未接入激励视频广告');
            return { success: false };
        }

        Toast.info('正在加载激励视频...');
        const result = await plugin.showRewardVideo({
            spaceId: 1056294,
            userId: this.getRewardAdUserId(),
            rewardName,
            rewardAmount: 1,
            extra: extraKey
        });
        const rewardGranted = Boolean(result?.rewardGranted || result?.rewardVerify || result?.videoComplete);
        if (!rewardGranted) {
            Toast.error(result?.message || '广告未完整播放，未发放奖励');
            return { success: false, result };
        }
        checkinManager.recordRewardVideoWatch?.();
        return { success: true, result };
    }

    async watchWelfareGift(giftId) {
        const gift = this.getWelfareGiftConfigs().find(entry => entry.id === giftId);
        if (!gift) {
            Toast.error('礼包配置不存在');
            return;
        }

        const giftWatchCheck = checkinManager.canWatchWelfareGift(gift.id, gift.adLimits);
        if (!giftWatchCheck.success) {
            Toast.error(giftWatchCheck.message);
            return;
        }

        const inventoryCheck = this.canGrantWelfareRewards(gift.rewards);
        if (!inventoryCheck.success) {
            Toast.error(inventoryCheck.message || '背包容量不足');
            return;
        }

        const button = this.element?.querySelector(`[data-welfare-id="${giftId}"]`);
        button?.setAttribute('disabled', 'disabled');
        button?.classList.add('is-loading');

        try {
            const videoResult = await this.playRewardVideo(`checkin_welfare_${giftId}`, this.getGiftName(gift));
            if (!videoResult.success) {
                return;
            }

            checkinManager.recordWelfareGiftWatch(gift.id);
            this.grantWelfareRewards(gift.rewards);
            window.game.save();
            window.game.refreshRuntimeUI();
            this.render();
            await RewardModal.show({
                title: `${this.getGiftName(gift)} 已领取`,
                rewards: this.createRewardModalEntries(gift.rewards),
                summaryText: '福利礼包奖励已发放到背包与资源库'
            });
        } catch (error) {
            console.error('welfare reward ad failed', error);
            Toast.error(error?.message || '激励视频加载失败');
        } finally {
            button?.removeAttribute('disabled');
            button?.classList.remove('is-loading');
        }
    }

    async handleMonthCardAction(cardId) {
        const card = this.getMonthCardConfigs().find(entry => entry.id === cardId);
        if (!card) {
            Toast.error('月卡配置不存在');
            return;
        }

        const status = checkinManager.getMonthCardStatus(card);
        if (!status.active) {
            Toast.info(`${card.name} 本月进度 ${status.watchedMonth}/${status.requiredViews}`);
            return;
        }

        const claimResult = checkinManager.claimMonthCardRewards(card);
        if (!claimResult.success) {
            Toast.error(claimResult.message);
            return;
        }
        window.game.save();
        window.game.refreshRuntimeUI();
        this.render();
        await RewardModal.show({
            title: `${card.name} 每日奖励`,
            rewards: claimResult.rewards,
            summaryText: '月卡每日奖励已发放'
        });
    }

    refresh() {
        if (this.visible) {
            this.render();
        }
    }
}

const checkinView = new CheckinView();
window.checkinView = checkinView;
