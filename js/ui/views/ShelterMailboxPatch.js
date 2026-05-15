(function() {
    if (typeof ShelterView === 'undefined' || !window.shelterView || !window.mailManager) {
        return;
    }

    const originalGetCompactButtonList = ShelterView.prototype.getCompactButtonList;
    ShelterView.prototype.getCompactButtonList = function() {
        const buttons = typeof originalGetCompactButtonList === 'function'
            ? originalGetCompactButtonList.call(this)
            : [];

        const nextButtons = buttons.filter((button) => button.id !== 'mailbox');
        const shelterIndex = nextButtons.findIndex((button) => button.id === 'building_shelter');
        const mailboxButton = { id: 'mailbox', label: '邮箱', icon: '✉️' };

        if (shelterIndex === -1) {
            return [mailboxButton, ...nextButtons];
        }

        return [
            ...nextButtons.slice(0, shelterIndex),
            mailboxButton,
            ...nextButtons.slice(shelterIndex)
        ];
    };

    ShelterView.prototype.escapeMailboxHtml = function(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };

    ShelterView.prototype.openBuildingDetail = (function(originalOpenBuildingDetail) {
        return function(buildingId) {
            if (buildingId === 'mailbox') {
                this.openMailboxModal();
                return;
            }
            return originalOpenBuildingDetail.call(this, buildingId);
        };
    })(ShelterView.prototype.openBuildingDetail);

    ShelterView.prototype.openMailboxModal = function(initialMailId = null) {
        if (typeof this.mailboxShowExpired !== 'boolean') {
            this.mailboxShowExpired = false;
        }

        const modal = new Modal({
            title: '邮箱',
            className: 'mailbox-modal-shell',
            content: '',
            buttons: [
                { text: '关闭', className: 'btn-secondary', onClick: () => modal.close() }
            ]
        });

        const setListView = () => {
            modal.setContent(this.getMailboxListMarkup());
            this.bindMailboxListEvents(modal, setListView, setDetailView);
        };

        const setDetailView = (mailId) => {
            const mail = mailManager.getActiveMail(mailId);
            if (!mail) {
                setListView();
                return;
            }

            mailManager.markAsRead(mail.id);
            modal.setContent(this.getMailboxDetailMarkup(mail));
            this.bindMailboxDetailEvents(modal, mail.id, setListView, setDetailView);
        };

        modal.show();
        modal.setContent(`
            <div class="mailbox-layout mailbox-layout-empty">
                <div class="mailbox-empty-state">
                    <div class="mailbox-empty-icon">📨</div>
                    <div class="mailbox-empty-title">正在同步邮箱</div>
                    <div class="mailbox-empty-text">稍等一下，正在获取服务器最新邮件。</div>
                </div>
            </div>
        `);

        mailManager.refresh({ silent: true }).finally(() => {
            if (initialMailId) {
                setDetailView(initialMailId);
                return;
            }
            setListView();
        });
    };

    ShelterView.prototype.bindMailboxListEvents = function(modal, setListView, setDetailView) {
        const root = modal.element?.querySelector('.mailbox-screen-list');
        if (!root) {
            return;
        }

        root.querySelectorAll('[data-mail-id]').forEach((node) => {
            node.addEventListener('click', () => setDetailView(node.dataset.mailId));
        });

        const claimAllButton = root.querySelector('[data-mail-action="claim-all"]');
        claimAllButton?.addEventListener('click', async () => {
            const result = await mailManager.claimAll();
            if (!result.success) {
                Toast.info(result.message);
                return;
            }

            window.game?.refreshRuntimeUI?.();
            await this.showMailboxRewards(result.rewards, result.message);
            setListView();
        });

        const toggleExpiredButton = root.querySelector('[data-mail-action="toggle-expired"]');
        toggleExpiredButton?.addEventListener('click', () => {
            this.mailboxShowExpired = !this.mailboxShowExpired;
            setListView();
        });
    };

    ShelterView.prototype.bindMailboxDetailEvents = function(modal, mailId, setListView, setDetailView) {
        const root = modal.element?.querySelector('.mailbox-screen-detail');
        if (!root) {
            return;
        }

        root.querySelector('[data-mail-action="back"]')?.addEventListener('click', () => setListView());
        root.querySelector('[data-mail-action="claim"]')?.addEventListener('click', async () => {
            const result = await mailManager.claimMail(mailId);
            if (!result.success) {
                Toast.info(result.message);
                return;
            }

            window.game?.refreshRuntimeUI?.();
            await this.showMailboxRewards(result.rewards, result.message);
            setDetailView(mailId);
        });
    };

    ShelterView.prototype.getMailboxListMarkup = function() {
        const visibleMails = mailManager.getVisibleMails();
        const expiredMails = mailManager.getExpiredMails();
        const claimableCount = visibleMails.filter((mail) => mailManager.canClaim(mail)).length;

        if (visibleMails.length === 0 && expiredMails.length === 0) {
            return `
                <div class="mailbox-layout mailbox-layout-empty">
                    <div class="mailbox-empty-state">
                        <div class="mailbox-empty-icon">📭</div>
                        <div class="mailbox-empty-title">当前没有邮件</div>
                        <div class="mailbox-empty-text">新的系统通知和补给邮件会出现在这里。</div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="mailbox-screen mailbox-screen-list">
                <div class="mailbox-screen-header">
                    <div>
                        <div class="mailbox-screen-title">邮箱概览</div>
                        <div class="mailbox-screen-subtitle">当前 ${visibleMails.length} 封有效邮件</div>
                    </div>
                    <button type="button" class="btn btn-primary mailbox-claim-all-btn" data-mail-action="claim-all" ${claimableCount > 0 ? '' : 'disabled'}>
                        一键领取
                    </button>
                </div>
                <div class="mailbox-list mailbox-list-vertical">
                    ${visibleMails.map((mail) => this.getMailboxPreviewMarkup(mail)).join('')}
                    ${expiredMails.length > 0 ? `
                        <div class="mailbox-expired-block">
                            <button type="button" class="mailbox-expired-toggle" data-mail-action="toggle-expired">
                                <span>已过期邮件 ${expiredMails.length} 封</span>
                                <span>${this.mailboxShowExpired ? '收起' : '展开'}</span>
                            </button>
                            ${this.mailboxShowExpired ? `
                                <div class="mailbox-expired-list">
                                    ${expiredMails.map((mail) => this.getMailboxPreviewMarkup(mail)).join('')}
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    };

    ShelterView.prototype.getMailboxPreviewMarkup = function(mail) {
        const previewTitle = this.escapeMailboxHtml(mail.title);
        const sender = this.escapeMailboxHtml(mail.sender);
        const statusText = mailManager.getStatusText(mail);
        const unreadClass = mail.readAt ? '' : ' is-unread';
        const claimedClass = mailManager.isClaimed(mail) ? ' is-claimed' : '';
        const expiredClass = mailManager.isExpired(mail) ? ' is-expired' : '';

        return `
            <button type="button" class="mail-preview-item${unreadClass}${claimedClass}${expiredClass}" data-mail-id="${this.escapeMailboxHtml(mail.id)}">
                <div class="mail-preview-title-row">
                    <span class="mail-preview-title" title="${previewTitle}">${previewTitle}</span>
                    ${mail.readAt ? '' : '<span class="mail-preview-badge">新</span>'}
                </div>
                <div class="mail-preview-meta">
                    <span>${sender}</span>
                    <span>${statusText}</span>
                </div>
            </button>
        `;
    };

    ShelterView.prototype.getMailboxDetailMarkup = function(mail) {
        const attachmentMarkup = mail.attachments.length > 0
            ? mail.attachments.map((entry) => {
                const meta = mailManager.getEntryMeta(entry);
                return `
                    <div class="mail-attachment-item">
                        <div class="mail-attachment-icon">${meta.icon}</div>
                        <div class="mail-attachment-info">
                            <div class="mail-attachment-name">${this.escapeMailboxHtml(meta.name)}</div>
                            <div class="mail-attachment-count">x${entry.amount}</div>
                        </div>
                    </div>
                `;
            }).join('')
            : '<div class="mail-attachment-empty">该邮件不包含附件</div>';

        const canClaim = mailManager.canClaim(mail);
        const statusText = mailManager.getStatusText(mail);

        return `
            <div class="mailbox-screen mailbox-screen-detail">
                <div class="mailbox-screen-header mailbox-screen-header-detail">
                    <button type="button" class="mailbox-back-btn" data-mail-action="back">返回</button>
                    <div class="mailbox-detail-status">${statusText}</div>
                </div>
                <div class="mail-detail-card">
                    <div class="mail-detail-header">
                        <div class="mail-detail-title">${this.escapeMailboxHtml(mail.title)}</div>
                        <div class="mail-detail-sender">发件人：${this.escapeMailboxHtml(mail.sender)}</div>
                    </div>
                    <div class="mail-detail-body">${this.escapeMailboxHtml(mail.body).replace(/\n/g, '<br>')}</div>
                    <div class="mail-detail-section">
                        <div class="mail-detail-section-title">邮件包含物品</div>
                        <div class="mail-attachment-list">${attachmentMarkup}</div>
                    </div>
                    <div class="mail-detail-footer">
                        <div class="mail-detail-expire">过期时间：${mailManager.formatExpireTime(mail)}</div>
                        <div class="mail-detail-expire-tip">默认保留 7 天</div>
                    </div>
                    <button type="button" class="btn btn-primary mail-claim-btn" data-mail-action="claim" ${canClaim ? '' : 'disabled'}>
                        ${mailManager.isClaimed(mail) ? '已领取' : (mailManager.isExpired(mail) ? '已过期' : '领取附件')}
                    </button>
                </div>
            </div>
        `;
    };

    ShelterView.prototype.showMailboxRewards = async function(rewards, summaryText) {
        const rewardEntries = (Array.isArray(rewards) ? rewards : []).map((entry) => {
            if (entry.type === 'resource') {
                return RewardModal.createResourceReward(entry.id, entry.amount);
            }
            if (entry.type === 'fragment' || ItemConfig.getItemConfig(entry.id)?.type === 'fragment') {
                const heroConfigId = ItemConfig.getItemConfig(entry.id)?.fragmentHeroId || String(entry.id || '').replace(/_fragment$/, '');
                return RewardModal.createFragmentReward(heroConfigId, entry.amount);
            }
            return RewardModal.createItemReward(entry.id, entry.amount);
        }).filter(Boolean);

        if (rewardEntries.length === 0) {
            Toast.success(summaryText || '领取成功');
            return;
        }

        await RewardModal.show({
            title: '邮件附件',
            rewards: rewardEntries,
            summaryText: summaryText || '已领取邮件附件'
        });
    };

    ShelterView.prototype.render = (function(originalRender) {
        return function() {
            originalRender.call(this);
            const mailboxButton = this.element?.querySelector('button[onclick*="openBuildingDetail(\'mailbox\'"]');
            mailboxButton?.classList.add('mailbox');
        };
    })(ShelterView.prototype.render);
})();
