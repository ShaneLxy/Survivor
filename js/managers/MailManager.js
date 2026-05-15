class MailManager {
    constructor() {
        if (MailManager.instance) {
            return MailManager.instance;
        }

        this.mails = [];
        this.localMails = [];
        this.refreshTimer = null;
        this.refreshInterval = 30000;
        MailManager.instance = this;
    }

    init(initialMails = null) {
        if (Array.isArray(initialMails)) {
            this.mails = initialMails.map((mail) => this.normalizeMail(mail)).filter(Boolean);
            this.localMails = [];
            return;
        }

        this.mails = [];
        this.localMails = Array.isArray(initialMails?.localMails)
            ? initialMails.localMails.map((mail) => this.normalizeMail({ ...mail, local: true })).filter(Boolean)
            : [];
    }

    normalizeTimestamp(value) {
        if (value === null || value === undefined || value === '') {
            return null;
        }
        const numeric = Number(value);
        if (Number.isFinite(numeric) && numeric > 0) {
            return numeric;
        }
        const parsed = Date.parse(String(value));
        return Number.isFinite(parsed) ? parsed : null;
    }

    normalizeMail(mail) {
        if (!mail) {
            return null;
        }

        const createdAt = this.normalizeTimestamp(mail.createdAt) || Date.now();
        const expireAt = this.normalizeTimestamp(mail.expireAt);

        return {
            id: String(mail.id || mail._id || Utils.generateId()),
            accountId: mail.accountId ? String(mail.accountId) : null,
            title: String(mail.title || '未命名邮件'),
            body: String(mail.body || ''),
            sender: String(mail.sender || '系统'),
            createdAt,
            expireAt,
            readAt: this.normalizeTimestamp(mail.readAt),
            claimedAt: this.normalizeTimestamp(mail.claimedAt),
            attachments: this.normalizeAttachments(mail.attachments),
            local: Boolean(mail.local)
        };
    }

    normalizeAttachments(attachments) {
        return (Array.isArray(attachments) ? attachments : [])
            .map((entry) => {
                const amount = Math.max(0, Number(entry?.amount) || 0);
                if (!entry?.id || amount <= 0) {
                    return null;
                }
                return {
                    type: this.normalizeAttachmentType(entry.type),
                    id: String(entry.id),
                    amount
                };
            })
            .filter(Boolean);
    }

    normalizeAttachmentType(type) {
        if (type === 'resource') {
            return 'resource';
        }
        if (type === 'fragment') {
            return 'fragment';
        }
        return 'item';
    }

    setMails(mails) {
        this.mails = (Array.isArray(mails) ? mails : [])
            .map((mail) => this.normalizeMail(mail))
            .filter(Boolean);
        eventManager.emit('mailUpdate', { type: 'refresh', total: this.mails.length });
        return this.getAllMails();
    }

    async refresh(options = {}) {
        if (!authService.isLoggedIn()) {
            return this.getAllMails();
        }

        try {
            const response = await MailApi.list();
            return this.setMails(response?.mails || []);
        } catch (error) {
            if (!options.silent) {
                console.warn('[MailManager] refresh failed:', error);
            }
            return this.getAllMails();
        }
    }

    startAutoRefresh() {
        this.stopAutoRefresh();
        if (!authService.isLoggedIn()) {
            return;
        }
        this.refresh({ silent: true });
        this.refreshTimer = setInterval(() => {
            this.refresh({ silent: true });
        }, this.refreshInterval);
    }

    stopAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    }

    getAllMails() {
        return [...this.mails, ...this.localMails].sort((left, right) => {
            const leftExpired = this.isExpired(left) ? 1 : 0;
            const rightExpired = this.isExpired(right) ? 1 : 0;
            if (leftExpired !== rightExpired) {
                return leftExpired - rightExpired;
            }

            const leftClaimed = this.isClaimed(left) ? 1 : 0;
            const rightClaimed = this.isClaimed(right) ? 1 : 0;
            if (leftClaimed !== rightClaimed) {
                return leftClaimed - rightClaimed;
            }

            const leftRead = left.readAt ? 1 : 0;
            const rightRead = right.readAt ? 1 : 0;
            if (leftRead !== rightRead) {
                return leftRead - rightRead;
            }

            return Number(right.createdAt) - Number(left.createdAt);
        });
    }

    getVisibleMails() {
        return this.getAllMails().filter((mail) => !this.isExpired(mail));
    }

    getExpiredMails() {
        return this.getAllMails().filter((mail) => this.isExpired(mail));
    }

    getMail(mailId) {
        return this.mails.find((mail) => mail.id === mailId)
            || this.localMails.find((mail) => mail.id === mailId)
            || null;
    }

    getActiveMail(mailId = null) {
        const list = this.getAllMails();
        if (list.length === 0) {
            return null;
        }
        return this.getMail(mailId) || list[0];
    }

    async markAsRead(mailId) {
        const mail = this.getMail(mailId);
        if (!mail || mail.readAt) {
            return mail;
        }

        mail.readAt = Date.now();
        eventManager.emit('mailUpdate', { mailId, type: 'read' });

        if (!authService.isLoggedIn()) {
            return mail;
        }

        try {
            const response = await MailApi.markRead(mailId);
            if (response?.mail) {
                const nextMail = this.normalizeMail(response.mail);
                const index = this.mails.findIndex((entry) => entry.id === nextMail.id);
                if (index !== -1) {
                    this.mails.splice(index, 1, nextMail);
                }
                return nextMail;
            }
        } catch (error) {
            console.warn('[MailManager] markAsRead failed:', error);
        }

        return mail;
    }

    isExpired(mail) {
        const expireAt = Number(mail?.expireAt) || 0;
        return expireAt > 0 && expireAt <= Date.now();
    }

    isClaimed(mail) {
        return Boolean(Number(mail?.claimedAt) || 0);
    }

    canClaim(mail) {
        return Boolean(mail)
            && !this.isExpired(mail)
            && !this.isClaimed(mail)
            && Array.isArray(mail.attachments)
            && mail.attachments.length > 0;
    }

    canStoreAttachments(attachments) {
        const itemEntries = (Array.isArray(attachments) ? attachments : [])
            .filter(entry => entry?.type !== 'resource')
            .filter(entry => entry?.type !== 'fragment' && ItemConfig.getItemConfig(entry.id)?.type !== 'fragment')
            .map(entry => ({ id: entry.id, count: entry.amount || 1 }));
        return itemManager.canAddItemBundle(itemEntries);
    }

    createSystemMail(options = {}) {
        const mail = this.normalizeMail({
            id: options.id || `local_mail_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            title: options.title || '系统补发奖励',
            body: options.body || '',
            sender: options.sender || '系统',
            createdAt: Date.now(),
            expireAt: options.expireAt || Date.now() + 30 * 24 * 60 * 60 * 1000,
            attachments: options.attachments || [],
            local: true
        });
        if (!mail) {
            return null;
        }
        this.localMails.unshift(mail);
        eventManager.emit('mailUpdate', { mailId: mail.id, type: 'local-create' });
        window.game?.save?.();
        return mail;
    }

    getRemainingDays(mail) {
        const expireAt = Number(mail?.expireAt) || 0;
        const remainingMs = expireAt - Date.now();
        if (remainingMs <= 0) {
            return 0;
        }
        return Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
    }

    formatExpireTime(mail) {
        const expireAt = Number(mail?.expireAt) || 0;
        if (!expireAt) {
            return '长期有效';
        }
        return new Date(expireAt).toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    }

    getStatusText(mail) {
        if (this.isClaimed(mail)) {
            return '已领取';
        }
        if (this.isExpired(mail)) {
            return '已过期';
        }
        return `剩余${this.getRemainingDays(mail)}天`;
    }

    getEntryMeta(entry) {
        if (entry?.type === 'resource') {
            const info = shelterManager.getResourceInfo(entry.id);
            return {
                name: info?.name || entry.id,
                icon: info?.iconSrc
                    ? `<img class="mail-attachment-icon-image" src="${info.iconSrc}" alt="${info?.name || entry.id}">`
                    : `<span class="mail-attachment-icon-text">${info?.icon || '📦'}</span>`
            };
        }

        const item = ItemConfig.getItemConfig(entry?.id);
        return {
            name: item?.name || entry?.id || '未知物品',
            icon: item?.iconSrc
                ? `<img class="mail-attachment-icon-image" src="${item.iconSrc}" alt="${item?.name || entry?.id || '物品'}">`
                : `<span class="mail-attachment-icon-text">${item?.icon || '🎁'}</span>`
        };
    }

    grantAttachment(entry) {
        if (!entry) {
            return false;
        }

        if (entry.type === 'resource') {
            shelterManager.addResource(entry.id, entry.amount);
            return true;
        }

        if (entry.type === 'fragment' || ItemConfig.getItemConfig(entry.id)?.type === 'fragment') {
            const heroConfigId = this.resolveFragmentHeroId(entry.id);
            if (!heroConfigId) {
                return false;
            }
            heroManager.addFragments(heroConfigId, entry.amount);
            return true;
        }

        return itemManager.addItem(entry.id, entry.amount);
    }

    resolveFragmentHeroId(fragmentId) {
        const item = ItemConfig.getItemConfig(fragmentId);
        if (item?.fragmentHeroId) {
            return item.fragmentHeroId;
        }
        return String(fragmentId || '').replace(/_fragment$/, '');
    }

    applyRewards(rewards) {
        (Array.isArray(rewards) ? rewards : []).forEach((entry) => this.grantAttachment(entry));
    }

    async claimMail(mailId) {
        const mail = this.getMail(mailId);
        if (!this.canClaim(mail)) {
            return { success: false, message: '邮件不可领取' };
        }

        const inventoryCheck = this.canStoreAttachments(mail.attachments);
        if (!inventoryCheck.success) {
            return { success: false, message: inventoryCheck.message || '背包容量达到上限' };
        }

        if (mail.local) {
            this.applyRewards(mail.attachments);
            mail.claimedAt = Date.now();
            mail.readAt = mail.readAt || Date.now();
            eventManager.emit('mailUpdate', { mailId, type: 'claim' });
            window.game?.save?.();
            return { success: true, mail, rewards: mail.attachments };
        }

        if (!authService.isLoggedIn()) {
            return { success: false, message: '请先登录' };
        }

        const response = await MailApi.claim(mailId);
        if (response?.mail) {
            const updatedMail = this.normalizeMail(response.mail);
            const index = this.mails.findIndex((mail) => mail.id === updatedMail.id);
            if (index !== -1) {
                this.mails.splice(index, 1, updatedMail);
            } else {
                this.mails.push(updatedMail);
            }
        }
        if (response?.success) {
            this.applyRewards(response.rewards);
        }
        return response;
    }

    async claimAll() {
        const remoteClaimable = this.mails.filter((mail) => this.canClaim(mail));
        const localClaimable = this.localMails.filter((mail) => this.canClaim(mail));
        const localAttachments = localClaimable.flatMap((mail) => mail.attachments || []);
        const allAttachments = [
            ...remoteClaimable.flatMap((mail) => mail.attachments || []),
            ...localAttachments
        ];
        const localInventoryCheck = this.canStoreAttachments(allAttachments);
        if (!localInventoryCheck.success) {
            return { success: false, message: localInventoryCheck.message || '\u80cc\u5305\u5bb9\u91cf\u8fbe\u5230\u4e0a\u9650' };
        }

        const claimLocalMails = () => {
            localClaimable.forEach((mail) => {
                this.applyRewards(mail.attachments);
                mail.claimedAt = Date.now();
                mail.readAt = mail.readAt || Date.now();
            });
            if (localClaimable.length > 0) {
                eventManager.emit('mailUpdate', { type: 'claim-all-local' });
                window.game?.save?.();
            }
        };

        if (!authService.isLoggedIn()) {
            if (localClaimable.length > 0) {
                claimLocalMails();
                return { success: true, rewards: localAttachments, mails: this.getAllMails() };
            }
            return { success: false, message: '\u8bf7\u5148\u767b\u5f55' };
        }

        const response = await MailApi.claimAll();
        if (Array.isArray(response?.mails)) {
            this.setMails(response.mails);
        }
        if (response?.success) {
            claimLocalMails();
            this.applyRewards(response.rewards);
            response.rewards = [...(response.rewards || []), ...localAttachments];
            response.mails = this.getAllMails();
        }
        return response;
    }

    getSaveData() {
        return {
            localMails: this.localMails
                .filter((mail) => !this.isExpired(mail))
                .map((mail) => ({ ...mail }))
        };
    }
}

const mailManager = new MailManager();
window.mailManager = mailManager;
