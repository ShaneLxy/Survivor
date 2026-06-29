/**
 * 登录 / 注册视图
 */
class LoginView {
    constructor() {
        this.mode = 'login';
        this.isSubmitting = false;
        this.element = null;
        this.guestLoginModal = null;
        this.announcementModal = null;
        this.bannedLoginModal = null;
        this.sessionNotice = '';
        this.versionPolicy = null;
        this.operationConfig = { gameStatus: 'unknown', announcements: [] };
        this.serverStatus = 'loading';
        this.serverStatusText = '连接中';
        this.activeAnnouncementIndex = 0;
        this.operationFetchToken = 0;
        this.operationConfigLoaded = false;
        this.operationConfigLoadingPromise = null;
        this.tapTapUpdateCheckTriggered = false;

        this.KEY_ACCOUNT = 'survivor_remember_account';
        this.KEY_PASSWORD = 'survivor_remember_password';
        this.KEY_REMEMBER_PWD = 'survivor_remember_pwd_checked';
        this.KEY_READ_ANNOUNCEMENTS = 'survivor_read_announcements';

        this._announcementTouch = null;
        this._operationDebugModal = null;
    }

    _closeOperationDebugModal() {
        this._operationDebugModal?.close?.();
        this._operationDebugModal = null;
    }

    _showOperationDebugModal(payload = {}) {
        this._closeOperationDebugModal();
        const attempts = Array.isArray(payload.attempts) ? payload.attempts : [];
        const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
        const content = `
            <div class="login-debug-modal">
                <div class="login-debug-summary">
                    <div><span>最终状态</span><strong>${payload.finalStatus || 'unknown'}</strong></div>
                    <div><span>最终地址</span><strong>${payload.finalUrl || 'N/A'}</strong></div>
                    <div><span>最终错误</span><strong>${payload.finalError || 'none'}</strong></div>
                    <div><span>在线状态</span><strong>${payload.onlineState || 'unknown'}</strong></div>
                </div>
                <div class="login-debug-list">
                    ${attempts.map((item, index) => `
                        <div class="login-debug-item">
                            <div class="login-debug-item-head">候选 ${index + 1}</div>
                            <div><span>URL</span><code>${item.url || ''}</code></div>
                            <div><span>Base</span><code>${item.baseUrl || ''}</code></div>
                            <div><span>状态码</span><code>${item.status || 'N/A'}</code></div>
                            <div><span>错误名</span><code>${item.errorName || ''}</code></div>
                            <div><span>响应体</span><pre>${String(item.body || '').replace(/[&<>"']/g, (char) => ({
                                '&': '&amp;',
                                '<': '&lt;',
                                '>': '&gt;',
                                '"': '&quot;',
                                "'": '&#39;'
                            }[char]))}</pre></div>
                            <div><span>错误</span><code>${item.error || ''}</code></div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        this._operationDebugModal = new Modal({
            title: '登录请求调试',
            className: 'login-debug-modal-shell',
            content,
            buttons: [{ text: '关闭', className: 'btn-primary', onClick: () => this._closeOperationDebugModal() }],
            onClose: () => {
                this._operationDebugModal = null;
            }
        });
        this._operationDebugModal.show();
    }

    _getOperationBlockedMessage() {
        return this.serverStatus === 'maintenance'
            ? '服务器维护中，请稍后再试'
            : '正在连接服务器，请稍后再试';
    }

    _getReadAnnouncementIds() {
        try {
            const raw = localStorage.getItem(this.KEY_READ_ANNOUNCEMENTS);
            if (!raw) return new Set();
            const arr = JSON.parse(raw);
            return new Set(Array.isArray(arr) ? arr : []);
        } catch (e) {
            return new Set();
        }
    }

    _markAnnouncementRead(id) {
        if (!id) return;
        const set = this._getReadAnnouncementIds();
        if (set.has(id)) return;
        set.add(id);
        try {
            localStorage.setItem(this.KEY_READ_ANNOUNCEMENTS, JSON.stringify(Array.from(set).slice(-50)));
        } catch (e) { /* noop */ }
        this._updateAnnouncementBadge();
    }

    _getUnreadAnnouncementCount() {
        const list = this.operationConfig.announcements || [];
        if (list.length === 0) return 0;
        const readSet = this._getReadAnnouncementIds();
        return list.filter((item) => !readSet.has(item.id)).length;
    }

    _updateAnnouncementBadge() {
        if (!this.element) return;
        const btn = this.element.querySelector('#btn-login-announcement');
        if (!btn) return;
        const count = this._getUnreadAnnouncementCount();
        let badge = btn.querySelector('.login-announcement-badge');
        if (count > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'login-announcement-badge';
                btn.appendChild(badge);
            }
            badge.textContent = count > 9 ? '9+' : String(count);
            btn.classList.add('has-unread');
        } else {
            if (badge) badge.remove();
            btn.classList.remove('has-unread');
        }
    }

    show() {
        Modal.closeAll();
        document.body?.classList.remove('app-boot-hidden');
        this._ensureContainer();
        this.mode = 'login';
        if (!this.operationConfigLoaded) {
            this._setOperationStatus('loading', '连接中');
        }
        this.render();
        this._loadOperationConfig();
        this._triggerTapTapUpdateCheck();
        this._fadeIn();
        window.audioManager?.playSceneBgm?.('login');

        const appEl = document.getElementById('app');
        if (appEl) appEl.style.display = 'none';
        this._setGameChromeVisible(false);

        const toastContainer = document.getElementById('toast-container');
        if (toastContainer) toastContainer.style.display = 'none';
    }

    showSessionNotice(message) {
        this.sessionNotice = message || '账号已在别处登录，请重新登录';
        if (!this.element) {
            this.show();
            return;
        }
        this.render();
    }

    hide() {
        this.sessionNotice = '';
        this._stopRecClock();
        this.guestLoginModal?.close?.();
        this.guestLoginModal = null;
        this.announcementModal?.close?.();
        this.announcementModal = null;
        this.bannedLoginModal?.close?.();
        this.bannedLoginModal = null;
        if (this.element) {
            this.element.classList.add('login-fade-out');
            setTimeout(() => {
                if (this.element && this.element.parentNode) {
                    this.element.remove();
                }
                this.element = null;
            }, 400);
        }

        const appEl = document.getElementById('app');
        if (appEl) appEl.style.display = '';
        document.body?.classList.remove('app-boot-hidden');
        this._setGameChromeVisible(true);

        const toastContainer = document.getElementById('toast-container');
        if (toastContainer) toastContainer.style.display = '';
    }

    _ensureContainer() {
        let container = document.getElementById('login-page');
        if (!container) {
            container = document.createElement('div');
            container.id = 'login-page';
            document.body.appendChild(container);
        }
        this.element = container;
    }

    _fadeIn() {
        if (this.element) {
            this.element.classList.remove('login-fade-out');
            this.element.classList.add('login-fade-in');
        }
    }

    _setOperationStatus(status, text) {
        this.serverStatus = status;
        this.serverStatusText = text;
        this._updateOperationStatusUI();
    }

    _updateOperationStatusUI() {
        if (!this.element) return;
        const statusEl = this.element.querySelector('#login-server-status');
        if (statusEl) {
            statusEl.classList.toggle('is-normal', this.serverStatus === 'normal');
            statusEl.classList.toggle('is-loading', this.serverStatus === 'loading');
            statusEl.classList.toggle('is-maintenance', this.serverStatus !== 'normal' && this.serverStatus !== 'loading');
            const textEl = statusEl.querySelector('.login-server-status-text') || statusEl.querySelector('span:last-child');
            if (textEl) textEl.textContent = this.serverStatusText;
        }
        const canLogin = this._canLoginByOperation();
        const tapTapButton = this.element.querySelector('#btn-taptap-login');
        if (tapTapButton) {
            tapTapButton.disabled = !canLogin || this.isSubmitting;
        }
        const guestButton = this.element.querySelector('#btn-guest-login');
        if (guestButton) {
            guestButton.disabled = !canLogin;
            guestButton.classList.toggle('is-disabled', !canLogin);
        }
    }

    _isLoginBlockedByOperation() {
        return !this._canLoginByOperation();
    }

    _canLoginByOperation() {
        return this.serverStatus === 'normal';
    }

    _getOperationRequestCandidates() {
        const candidates = [];
        const seen = new Set();
        const pushBase = (baseUrl) => {
            const normalizedBase = String(baseUrl || '').trim().replace(/\/+$/, '');
            if (!normalizedBase || seen.has(normalizedBase)) return;
            seen.add(normalizedBase);
            candidates.push({
                baseUrl: normalizedBase,
                url: `${normalizedBase}/health/operation`
            });
        };

        const runtimeConfig = window.__SURVIVOR_RUNTIME_CONFIG__ || {};
        const runtimeBaseUrl = String(runtimeConfig.apiBaseUrl || '').trim().replace(/\/+$/, '');
        const currentBaseUrl = String(window.httpClient?.getBaseUrl?.() || '').trim().replace(/\/+$/, '');
        const sameOriginBaseUrl = /^https?:$/i.test(location.protocol)
            ? `${location.origin.replace(/\/+$/, '')}/api`
            : '';
        const isNativeApp = Boolean(window.Capacitor && (
            typeof window.Capacitor.isNativePlatform === 'function'
                ? window.Capacitor.isNativePlatform()
                : true
        ));
        const isLocalWeb = !isNativeApp && (
            location.hostname === 'localhost' || location.hostname === '127.0.0.1'
        );

        if (isNativeApp) {
            pushBase(runtimeBaseUrl);
            pushBase(currentBaseUrl);
        } else {
            pushBase(currentBaseUrl);
            pushBase(runtimeBaseUrl);
            pushBase(sameOriginBaseUrl);
        }

        if (isLocalWeb) {
            pushBase('http://127.0.0.1:9000/api');
            pushBase('http://localhost:9000/api');
            pushBase('http://127.0.0.1:3000/api');
            pushBase('http://localhost:3000/api');
        }

        if (candidates.length === 0) {
            candidates.push({ baseUrl: '', url: '/api/health/operation' });
        }

        return candidates;
    }

    async _requestOperationConfig(signal) {
        const candidates = this._getOperationRequestCandidates();
        let lastError = null;
        const debugAttempts = [];

        for (const candidate of candidates) {
            if (signal?.aborted) {
                break;
            }
            const controller = typeof AbortController === 'function' ? new AbortController() : null;
            const timeoutId = controller
                ? window.setTimeout(() => controller.abort(), 8000)
                : 0;
            let abortHandler = null;
            try {
                if (controller && signal?.addEventListener) {
                    abortHandler = () => controller.abort();
                    signal.addEventListener('abort', abortHandler, { once: true });
                }
                const requestOptions = { cache: 'no-store' };
                if (controller) {
                    requestOptions.signal = controller.signal;
                } else if (signal) {
                    requestOptions.signal = signal;
                }
                const response = await fetch(candidate.url, requestOptions);
                window.serverClock?.updateFromResponse?.(response);
                const responseText = await response.text();
                let payload = {};
                try {
                    payload = responseText ? JSON.parse(responseText) : {};
                } catch (_) {
                    payload = { rawText: responseText };
                }
                debugAttempts.push({
                    url: candidate.url,
                    baseUrl: candidate.baseUrl,
                    status: response.status,
                    body: responseText,
                    errorName: ''
                });
                if (!response.ok) {
                    throw new Error(payload?.message || `请求失败：${response.status}`);
                }
                if (candidate.baseUrl && window.httpClient?.setBaseUrl) {
                    window.httpClient.setBaseUrl(candidate.baseUrl);
                }
                return payload?.config || payload || {};
            } catch (error) {
                lastError = error;
                debugAttempts.push({
                    url: candidate.url,
                    baseUrl: candidate.baseUrl,
                    error: error?.message || String(error),
                    errorName: error?.name || 'Error',
                    status: error?.name === 'AbortError' ? 'ABORT' : 'ERR',
                    body: ''
                });
                console.warn('[LoginView] operation endpoint failed:', candidate.url, error?.message || error);
                if (signal?.aborted) {
                    break;
                }
            } finally {
                if (timeoutId) {
                    window.clearTimeout(timeoutId);
                }
                if (abortHandler && signal?.removeEventListener) {
                    signal.removeEventListener('abort', abortHandler);
                }
            }
        }

        this._showOperationDebugModal({
            finalStatus: 'failed',
            finalUrl: debugAttempts[debugAttempts.length - 1]?.url || '',
            finalError: lastError?.message || 'unknown',
            onlineState: navigator.onLine ? 'online' : 'offline',
            attempts: debugAttempts
        });
        throw lastError || new Error('获取服务器状态失败');
    }

    async _loadOperationConfig() {
        if (this.operationConfigLoadingPromise) {
            return this.operationConfigLoadingPromise;
        }

        const requestToken = ++this.operationFetchToken;
        const controller = typeof AbortController === 'function' ? new AbortController() : null;
        const timeout = window.setTimeout(() => controller?.abort?.(), 15000);

        if (!this.operationConfigLoaded) {
            this._setOperationStatus('loading', '连接中');
        }

        this.operationConfigLoadingPromise = (async () => {
            try {
                const config = await this._requestOperationConfig(controller ? controller.signal : undefined);
                if (requestToken !== this.operationFetchToken) {
                    return;
                }
                this.operationConfig = this._normalizeOperationConfig(config);
                this.operationConfigLoaded = true;
                this._setOperationStatus(
                    this.operationConfig.gameStatus === 'normal' ? 'normal' : 'maintenance',
                    this.operationConfig.gameStatus === 'normal' ? '正常' : '维护中'
                );
            } catch (error) {
                if (requestToken !== this.operationFetchToken) {
                    return;
                }
                this.operationConfig = { gameStatus: 'unknown', announcements: [] };
                this.operationConfigLoaded = false;
                this._setOperationStatus('loading', '连接中');
            } finally {
                window.clearTimeout(timeout);
                this.operationConfigLoadingPromise = null;
                this._updateOperationStatusUI();
                this._updateAnnouncementBadge();
            }
        })();

        return this.operationConfigLoadingPromise;
    }
    _normalizeOperationConfig(config) {
        const announcements = Array.isArray(config?.announcements) ? config.announcements : [];
        const allowedTypes = new Set(['update', 'activity', 'maintenance', 'notice']);
        return {
            gameStatus: String(config?.gameStatus || '').trim() === 'normal' ? 'normal' : 'maintenance',
            announcements: announcements
                .slice(0, 3)
                .map((entry, index) => {
                    const rawType = String(entry?.type || '').trim().toLowerCase();
                    return {
                        id: String(entry?.id || `announcement_${index + 1}`).trim(),
                        title: String(entry?.title || '').trim(),
                        content: String(entry?.content || '').trim(),
                        type: allowedTypes.has(rawType) ? rawType : 'notice',
                        publishedAt: String(entry?.publishedAt || entry?.publishTime || '').trim(),
                        order: Number.isFinite(Number(entry?.order)) ? Number(entry.order) : index + 1
                    };
                })
                .filter((entry) => entry.title || entry.content)
                .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
        };
    }

    _setGameChromeVisible(visible) {
        const topBar = document.getElementById('top-bar');
        const tabBar = document.getElementById('tab-bar');
        if (topBar) {
            topBar.style.display = visible ? '' : 'none';
        }
        if (tabBar) {
            tabBar.style.display = visible ? '' : 'none';
        }
    }

    render() {
        if (!this.element) return;

        const savedAccount = localStorage.getItem(this.KEY_ACCOUNT) || '';
        const savedPwd = localStorage.getItem(this.KEY_PASSWORD) || '';
        const rememberChecked = localStorage.getItem(this.KEY_REMEMBER_PWD) === 'true';

        if (this.mode === 'login') {
            this._renderLogin(savedAccount, savedPwd, rememberChecked);
        } else {
            this._renderRegister(savedAccount);
        }
    }

    _renderNotice() {
        if (!this.sessionNotice) {
            return '';
        }
        return `
            <div class="login-session-notice">
                <div class="login-session-notice-title">登录状态已失效</div>
                <div class="login-session-notice-text">${this._escapeAttr(this.sessionNotice)}</div>
                <button class="login-session-notice-btn" id="login-session-notice-btn">重新登录</button>
            </div>
        `;
    }

    _renderVersionBadge() {
        const version = window.VersionManager?.buildVersion || window.__SURVIVOR_BUILD_VERSION__ || 'dev';
        return `<div class="login-version-badge">v${this._escapeAttr(version)}</div>`;
    }

    _renderHudTopBar() {
        const announcements = this.operationConfig.announcements || [];
        const broadcast = announcements.length > 0
            ? `> 信号侦测：${announcements[0].title || '终端公告'}`
            : '> // SYSTEM ONLINE  ::  AWAITING IDENTITY VERIFICATION';
        return `
            <div class="login-hud-topbar">
                <div class="login-hud-left">
                    <span class="login-hud-status-dot" aria-hidden="true"></span>
                    ${this._renderVersionBadge()}
                </div>
                <div class="login-hud-broadcast" aria-live="polite">
                    <div class="login-hud-broadcast-track">
                        <span>${this._escapeAttr(broadcast)}</span>
                        <span aria-hidden="true">${this._escapeAttr(broadcast)}</span>
                    </div>
                </div>
                <button class="login-announcement-button" id="btn-login-announcement" type="button">
                    <span class="login-announcement-button-icon" aria-hidden="true"></span>
                    <span class="login-announcement-button-text">公告</span>
                </button>
            </div>
            <div class="login-hud-bottomline" aria-hidden="true"></div>
            <div class="login-rec-stamp" id="login-rec-stamp" aria-hidden="true">
                <span class="login-rec-dot"></span>
                <span class="login-rec-text">REC 00:00 末日纪元</span>
            </div>
        `;
    }

    _startRecClock() {
        this._stopRecClock();
        const update = () => {
            const el = document.querySelector('#login-rec-stamp .login-rec-text');
            if (!el) return;
            const d = new Date();
            const pad = (n) => String(n).padStart(2, '0');
            el.textContent = `REC ${pad(d.getHours())}:${pad(d.getMinutes())} 末日纪元`;
        };
        update();
        this._recClockTimer = window.setInterval(update, 30000);
    }

    _stopRecClock() {
        if (this._recClockTimer) {
            window.clearInterval(this._recClockTimer);
            this._recClockTimer = null;
        }
    }

    _renderVersionPolicyNotice() {
        const policy = window.versionCheckService?.getState?.() || this.versionPolicy;
        if (!policy?.checked || !window.versionCheckService?.hasUpdateNotice?.()) {
            return '';
        }

        const title = policy.forceUpdate ? '发现强制更新' : '发现新版本';
        const description = policy.message
            || (policy.forceUpdate
                ? `当前版本 ${policy.currentVersion} 已停止支持，请更新到 ${policy.latestVersion || policy.minSupportedVersion}。`
                : `当前版本 ${policy.currentVersion} 不是最新版本，建议更新到 ${policy.latestVersion}。`);
        const actionText = policy.downloadUrl ? '前往更新' : '我知道了';

        return `
            <div class="login-version-notice ${policy.forceUpdate ? 'is-force' : ''}">
                <div class="login-version-notice-title">${title}</div>
                <div class="login-version-notice-text">${this._escapeAttr(description)}</div>
                <button class="login-version-notice-btn" id="login-version-notice-btn">${actionText}</button>
            </div>
        `;
    }

    _renderAnnouncementContent() {
        const announcements = this.operationConfig.announcements || [];
        const activeIndex = announcements.length > 0
            ? Math.max(0, Math.min(this.activeAnnouncementIndex, announcements.length - 1))
            : 0;
        const active = announcements[activeIndex] || null;
        const readSet = this._getReadAnnouncementIds();
        const tabs = announcements.length === 0
            ? '<button class="login-announcement-tab is-empty" type="button" disabled>暂无</button>'
            : announcements.map((item, index) => {
                const isActive = index === activeIndex;
                const isUnread = !readSet.has(item.id);
                return `
                    <button class="login-announcement-tab type-${item.type} ${isActive ? 'active' : ''} ${isUnread ? 'is-unread' : ''}" data-announcement-index="${index}" type="button">
                        <span class="login-announcement-tab-type" aria-hidden="true"></span>
                        <span class="login-announcement-tab-title">${this._escapeAttr(item.title || `公告${index + 1}`)}</span>
                    </button>
                `;
            }).join('');

        const typeLabelMap = {
            update: '版本更新',
            activity: '活动',
            maintenance: '维护',
            notice: '公告'
        };

        const detail = active ? `
            <div class="login-announcement-meta">
                <span class="login-announcement-badge-tag type-${active.type}">${typeLabelMap[active.type] || '公告'}</span>
                ${active.publishedAt ? `<span class="login-announcement-time">${this._escapeAttr(active.publishedAt)}</span>` : ''}
            </div>
            <h3>${this._escapeAttr(active.title || '公告')}</h3>
            <div class="login-announcement-text">${this._escapeAttr(active.content || '暂无公告内容')}</div>
        ` : '<div class="login-announcement-empty">// SIGNAL LOST —— 暂无公告</div>';

        return `
            <div class="login-announcement-shell">
                <div class="login-announcement-scanline" aria-hidden="true"></div>
                <div class="login-announcement-tabs" role="tablist">${tabs}</div>
                <div class="login-announcement-detail" id="login-announcement-detail">
                    ${detail}
                </div>
            </div>
        `;
    }

    openAnnouncementModal() {
        if (this.announcementModal?.isShown()) {
            this.announcementModal.setContent(this._renderAnnouncementContent());
        } else {
            this.announcementModal = new Modal({
                title: '终端通讯 // BROADCAST',
                className: 'login-announcement-modal',
                overlayClassName: 'login-announcement-overlay',
                content: this._renderAnnouncementContent(),
                onClose: () => {
                    this.announcementModal = null;
                    this._announcementTouch = null;
                    this._updateAnnouncementBadge();
                }
            });
            this.announcementModal.show();
        }
        this._bindAnnouncementModalEvents();
        this._markActiveAnnouncementRead();
    }

    _markActiveAnnouncementRead() {
        const list = this.operationConfig.announcements || [];
        const active = list[this.activeAnnouncementIndex];
        if (active) this._markAnnouncementRead(active.id);
    }

    _bindAnnouncementModalEvents() {
        const root = this.announcementModal?.element;
        if (!root) return;

        root.querySelectorAll('[data-announcement-index]').forEach((button) => {
            button.addEventListener('click', () => {
                this.activeAnnouncementIndex = Number(button.dataset.announcementIndex) || 0;
                this.announcementModal?.setContent(this._renderAnnouncementContent());
                this._bindAnnouncementModalEvents();
                this._markActiveAnnouncementRead();
            });
        });

        // 左右滑动切换公告（已取消下滑关闭手势）
        const overlay = this.announcementModal?.overlay;
        const sheet = root;
        if (!overlay || !sheet) return;

        const announcements = this.operationConfig.announcements || [];

        const onStart = (e) => {
            const t = e.touches ? e.touches[0] : e;
            this._announcementTouch = {
                startX: t.clientX,
                startY: t.clientY,
                startedAt: Date.now(),
                axis: null
            };
        };

        const onMove = (e) => {
            if (!this._announcementTouch) return;
            const t = e.touches ? e.touches[0] : e;
            const dx = t.clientX - this._announcementTouch.startX;
            const dy = t.clientY - this._announcementTouch.startY;
            if (!this._announcementTouch.axis) {
                if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                    this._announcementTouch.axis = Math.abs(dy) > Math.abs(dx) ? 'y' : 'x';
                }
            }
        };

        const onEnd = (e) => {
            if (!this._announcementTouch) return;
            const touch = this._announcementTouch;
            this._announcementTouch = null;

            const t = e.changedTouches ? e.changedTouches[0] : e;
            const dx = t.clientX - touch.startX;

            if (touch.axis === 'x' && announcements.length > 1) {
                const threshold = 60;
                if (dx < -threshold && this.activeAnnouncementIndex < announcements.length - 1) {
                    this.activeAnnouncementIndex += 1;
                    this.announcementModal?.setContent(this._renderAnnouncementContent());
                    this._bindAnnouncementModalEvents();
                    this._markActiveAnnouncementRead();
                } else if (dx > threshold && this.activeAnnouncementIndex > 0) {
                    this.activeAnnouncementIndex -= 1;
                    this.announcementModal?.setContent(this._renderAnnouncementContent());
                    this._bindAnnouncementModalEvents();
                    this._markActiveAnnouncementRead();
                }
            }
        };

        const detail = sheet.querySelector('#login-announcement-detail');
        if (detail) {
            detail.addEventListener('touchstart', onStart, { passive: true });
            detail.addEventListener('touchmove', onMove, { passive: true });
            detail.addEventListener('touchend', onEnd);
        }

        // 点击 overlay 空白处关闭
        overlay.addEventListener('click', (ev) => {
            if (ev.target === overlay) this.announcementModal?.close?.();
        });
    }

    _renderHealthAdvice() {
        return `
            <div class="game-health-advice login-health-advice">
                <div>抵制不良游戏，拒绝盗版游戏。</div>
                <div>注意自我保护，谨防受骗上当。</div>
                <div>适度游戏益脑，沉迷游戏伤身。</div>
                <div>合理安排时间，享受健康生活。</div>
            </div>
        `;
    }

    _renderLogin(savedAccount, savedPwd, rememberChecked) {
        const loginDisabled = this._isLoginBlockedByOperation();
        const tapTapLoginButton = this._canUseTapTapLogin() ? `
                    <button class="login-btn login-btn-taptap login-entry-btn" id="btn-taptap-login" onclick="window.loginView.handleTapTapLogin()" ${loginDisabled ? 'disabled' : ''}>
                        <span class="btn-text">TapTap &#30331;&#24405;</span>
                        <span class="btn-loading" style="display:none;">TapTap &#25480;&#26435;&#20013;...</span>
                    </button>
        ` : '';
        const guestLoginButton = this._shouldShowGuestLogin() ? `
                    <div class="login-entry-actions">
                        <button class="login-guest-link" id="btn-guest-login" type="button" ${loginDisabled ? 'disabled' : ''}>
                            &#28216;&#23458;&#30331;&#24405;
                        </button>
                    </div>
        ` : '';

        this.element.innerHTML = `
            <div class="login-backdrop">
                <div class="login-particles"></div>
                <div class="login-grid-overlay"></div>
                <div class="login-glitch-bar" aria-hidden="true"></div>
            </div>
            ${this._renderHudTopBar()}
            <div class="login-container">
                <div class="login-top-stack">
                    ${this._renderNotice()}
                    ${this._renderVersionPolicyNotice()}
                </div>
                <div class="login-logo">
                    <h1 class="login-title glitch" data-text="&#20113;&#22659;">&#20113;&#22659;</h1>
                    <p class="login-subtitle">// YUNJING.SYS &#8226; v2.0.7</p>
                </div>

                <div class="login-server-status ${this.serverStatus === 'normal' ? 'is-normal' : (this.serverStatus === 'loading' ? 'is-loading' : 'is-maintenance')}" id="login-server-status">
                    <span class="login-server-status-dot"></span>
                    <span class="login-server-status-text">${this._escapeAttr(this.serverStatusText)}</span>
                </div>

                <div class="login-form-panel login-form-panel-hidden" id="login-form-panel" aria-hidden="true"></div>

                <div class="login-entry-panel">
                    ${tapTapLoginButton}
                    ${guestLoginButton}
                </div>
            </div>
            ${this._renderHealthAdvice()}
        `;

        this._bindLoginEntryEvents();
        const announcementButton = document.getElementById('btn-login-announcement');
        if (announcementButton) {
            announcementButton.addEventListener('click', () => this.openAnnouncementModal());
        }
        const noticeButton = document.getElementById('login-session-notice-btn');
        if (noticeButton) {
            noticeButton.addEventListener('click', () => {
                this.sessionNotice = '';
                this.render();
            });
        }
        const versionButton = document.getElementById('login-version-notice-btn');
        if (versionButton) {
            versionButton.addEventListener('click', () => {
                if (!window.versionCheckService?.openUpdateLink?.()) {
                    versionButton.blur();
                }
            });
        }
        this._startRecClock();
        this._updateAnnouncementBadge();
    }

    _bindLoginEntryEvents() {
        const guestButton = this.element?.querySelector('#btn-guest-login');
        if (!guestButton) {
            return;
        }

        let handledAt = 0;
        const openGuestLogin = (event) => {
            event?.preventDefault?.();
            event?.stopPropagation?.();
            if (!this._canLoginByOperation()) {
                return;
            }
            const now = Date.now();
            if (now - handledAt < 350) {
                return;
            }
            handledAt = now;
            this.openGuestLoginModal();
        };

        guestButton.addEventListener('pointerup', openGuestLogin);
        guestButton.addEventListener('click', openGuestLogin);
    }

    _buildGuestLoginContent(savedAccount, savedPwd, rememberChecked) {
        return `
            <div class="login-panel-accent" aria-hidden="true"></div>
            <div class="login-error-tip" id="login-error" style="display:none;"></div>

            <div class="login-field">
                <label class="login-label" for="login-account">
                    <span class="field-icon field-icon-account" aria-hidden="true"></span>&#36134;&#21495;
                </label>
                <input type="text" id="login-account" class="login-input"
                       value="${this._escapeAttr(savedAccount)}"
                       placeholder="&#35831;&#36755;&#20837;&#36134;&#21495;" autocomplete="username" />
            </div>

            <div class="login-field">
                <label class="login-label" for="login-password">
                    <span class="field-icon field-icon-password" aria-hidden="true"></span>&#23494;&#30721;
                </label>
                <input type="password" id="login-password" class="login-input"
                       value="${rememberChecked ? this._escapeAttr(savedPwd) : ''}"
                       placeholder="&#35831;&#36755;&#20837;&#23494;&#30721;" autocomplete="current-password" />
            </div>

            <div class="login-options">
                <label class="login-remember">
                    <input type="checkbox" id="login-remember" ${rememberChecked ? 'checked' : ''} />
                    <span class="checkmark"></span>
                    &#35760;&#20303;&#23494;&#30721;
                </label>
            </div>

            <button class="login-btn login-btn-primary" id="btn-login" onclick="window.loginView.handleLogin()">
                <span class="btn-text">&#30331;&#24405;</span>
                <span class="btn-loading" style="display:none;">&#30331;&#24405;&#20013;...</span>
            </button>
        `;
    }

    openGuestLoginModal() {
        if (this.isSubmitting) return;
        if (!this._canLoginByOperation()) {
            Toast?.info?.(this._getOperationBlockedMessage());
            return;
        }

        const savedAccount = localStorage.getItem(this.KEY_ACCOUNT) || '';
        const savedPwd = localStorage.getItem(this.KEY_PASSWORD) || '';
        const rememberChecked = localStorage.getItem(this.KEY_REMEMBER_PWD) === 'true';

        if (this.guestLoginModal?.isShown()) {
            this.guestLoginModal.setContent(this._buildGuestLoginContent(savedAccount, savedPwd, rememberChecked));
        } else {
            this.guestLoginModal = new Modal({
                title: '\u6e38\u5ba2\u767b\u5f55',
                className: 'login-guest-modal',
                content: this._buildGuestLoginContent(savedAccount, savedPwd, rememberChecked),
                onClose: () => {
                    this.guestLoginModal = null;
                }
            });
            this.guestLoginModal.show();
        }

        this._bindGuestLoginEvents();
    }

    _bindGuestLoginEvents() {
        const passwordInput = document.getElementById('login-password');
        if (passwordInput) {
            passwordInput.addEventListener('keydown', e => {
                if (e.key === 'Enter') this.handleLogin();
            });
        }
        const accountInput = document.getElementById('login-account');
        if (accountInput) {
            accountInput.addEventListener('keydown', e => {
                if (e.key === 'Enter') {
                    const pwdInput = document.getElementById('login-password');
                    if (pwdInput) pwdInput.focus();
                }
            });
        }
    }

    _renderRegister(savedAccount) {
        this.element.innerHTML = `
            <div class="login-backdrop">
                <div class="login-particles"></div>
                <div class="login-grid-overlay"></div>
                <div class="login-glitch-bar" aria-hidden="true"></div>
            </div>
            ${this._renderHudTopBar()}
            <div class="login-container">
                <div class="login-top-stack">
                    ${this._renderVersionPolicyNotice()}
                </div>
                <div class="login-logo">
                    <h1 class="login-title glitch" data-text="&#20113;&#22659;">&#20113;&#22659;</h1>
                    <p class="login-subtitle">// YUNJING.SYS &#8226; v2.0.7</p>
                </div>

                <div class="login-form-panel" id="register-form-panel">
                    <div class="login-panel-accent" aria-hidden="true"></div>
                    <div class="login-error-tip" id="register-error" style="display:none;"></div>

                    <div class="login-field">
                        <label class="login-label" for="reg-account">
                            <span class="field-icon field-icon-account" aria-hidden="true"></span>&#36134;&#21495;
                        </label>
                        <input type="text" id="reg-account" class="login-input"
                               value="${this._escapeAttr(savedAccount)}"
                               placeholder="&#35831;&#36755;&#20837;&#36134;&#21495;&#65288;3-20&#20301;&#23383;&#27597;&#25110;&#25968;&#23383;&#65289;" autocomplete="username" />
                    </div>

                    <div class="login-field">
                        <label class="login-label" for="reg-nickname">
                            <span class="field-icon field-icon-nickname" aria-hidden="true"></span>&#26165;&#31216;
                        </label>
                        <input type="text" id="reg-nickname" class="login-input"
                               placeholder="&#35831;&#36755;&#20837;&#26165;&#31216;" autocomplete="nickname" />
                    </div>

                    <div class="login-field">
                        <label class="login-label" for="reg-password">
                            <span class="field-icon field-icon-password" aria-hidden="true"></span>&#23494;&#30721;
                        </label>
                        <input type="password" id="reg-password" class="login-input"
                               placeholder="&#35831;&#36755;&#20837;&#23494;&#30721;&#65288;&#33267;&#23569;6&#20301;&#65289;" autocomplete="new-password" />
                    </div>

                    <div class="login-field">
                        <label class="login-label" for="reg-password-confirm">
                            <span class="field-icon field-icon-password" aria-hidden="true"></span>&#30830;&#35748;&#23494;&#30721;
                        </label>
                        <input type="password" id="reg-password-confirm" class="login-input"
                               placeholder="&#20877;&#27425;&#36755;&#20837;&#23494;&#30721;" autocomplete="new-password" />
                    </div>

                    <button class="login-btn login-btn-primary" id="btn-register" onclick="window.loginView.handleRegister()">
                        <span class="btn-text">&#27880;&#20876;</span>
                        <span class="btn-loading" style="display:none;">&#27880;&#20876;&#20013;...</span>
                    </button>

                    <div class="login-switch">
                        &#24050;&#26377;&#36134;&#21495;&#65311;<a href="javascript:void(0)" id="link-to-login" onclick="window.loginView.switchToLogin()">&#36820;&#22238;&#30331;&#24405;</a>
                    </div>
                </div>
            </div>
            ${this._renderHealthAdvice()}
        `;

        const confirmInput = document.getElementById('reg-password-confirm');
        if (confirmInput) {
            confirmInput.addEventListener('keydown', e => {
                if (e.key === 'Enter') this.handleRegister();
            });
        }
        const announcementButton = document.getElementById('btn-login-announcement');
        if (announcementButton) {
            announcementButton.addEventListener('click', () => this.openAnnouncementModal());
        }
        const versionButton = document.getElementById('login-version-notice-btn');
        if (versionButton) {
            versionButton.addEventListener('click', () => {
                if (!window.versionCheckService?.openUpdateLink?.()) {
                    versionButton.blur();
                }
            });
        }
        this._startRecClock();
        this._updateAnnouncementBadge();
    }

    switchToRegister() {
        this.mode = 'register';
        this.render();
    }

    switchToLogin() {
        this.mode = 'login';
        this.render();
        this._loadOperationConfig();
    }

    _getTapTapPlugin() {
        return window.Capacitor?.Plugins?.TapTapAuth || null;
    }

    _triggerTapTapUpdateCheck() {
        if (this.tapTapUpdateCheckTriggered) {
            return;
        }
        const service = window.tapTapUpdateService;
        if (!service || typeof service.checkOnLogin !== 'function') {
            return;
        }
        if (!service.isSupported?.()) {
            return;
        }
        this.tapTapUpdateCheckTriggered = true;
        try {
            // Fire-and-forget：SDK 自己弹原生对话框，登录页不阻塞渲染
            Promise.resolve(service.checkOnLogin()).catch((error) => {
                console.warn('[LoginView] TapTap update check failed:', error?.message || error);
            });
        } catch (error) {
            console.warn('[LoginView] TapTap update check threw:', error?.message || error);
        }
    }

    _getTapTapCompliancePlugin() {
        return window.Capacitor?.Plugins?.TapTapCompliance || null;
    }

    _canUseTapTapLogin() {
        return Boolean(this._getTapTapPlugin()?.login);
    }

    _isNativeApp() {
        return Boolean(window.Capacitor && (
            typeof window.Capacitor.isNativePlatform === 'function'
                ? window.Capacitor.isNativePlatform()
                : true
        ));
    }

    _shouldShowGuestLogin() {
        if (!this._isNativeApp()) {
            return true;
        }
        return localStorage.getItem('survivor_allow_guest_login') === 'true';
    }

    _getTapTapUserIdentifier(tapTapResult) {
        return String(tapTapResult?.unionId || tapTapResult?.openId || '').trim();
    }

    async _verifyTapTapCompliance(tapTapResult) {
        const compliancePlugin = this._getTapTapCompliancePlugin();
        if (!this._isNativeApp() || !compliancePlugin?.startup) {
            return;
        }

        const userIdentifier = this._getTapTapUserIdentifier(tapTapResult);
        if (!userIdentifier) {
            throw new Error('TapTap 防沉迷认证缺少用户标识');
        }

        await this._withTimeout(
            compliancePlugin.startup({ userIdentifier }),
            20000,
            'TapTap 防沉迷认证超时，请重试'
        );
    }

    _withTimeout(promise, timeoutMs, message) {
        let timer = null;
        const timeout = new Promise((_, reject) => {
            timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
        });
        return Promise.race([promise, timeout]).finally(() => {
            window.clearTimeout(timer);
        });
    }

    _getLoginErrorMessage(error, fallbackMessage) {
        return error?.payload?.message || error?.message || fallbackMessage;
    }

    _isBannedLoginError(error) {
        const code = String(error?.payload?.code || '').trim().toUpperCase();
        if (code === 'ACCOUNT_BANNED') {
            return true;
        }

        const message = `${error?.payload?.message || ''} ${error?.message || ''}`;
        return ['封禁', '禁止使用', '存档异常'].some(keyword => message.includes(keyword));
    }

    _showBannedLoginModal() {
        if (this.bannedLoginModal?.isShown()) {
            return;
        }

        this.bannedLoginModal = new Modal({
            title: '登录提示',
            className: 'login-ban-modal',
            content: `<div class="login-ban-message">${this._escapeAttr('该账号被检测到异常已被禁止使用,请联系管理员')}</div>`,
            buttons: [
                {
                    text: '我知道了',
                    className: 'btn-primary',
                    onClick: () => this.bannedLoginModal?.close?.()
                }
            ],
            onClose: () => {
                this.bannedLoginModal = null;
            }
        });
        this.bannedLoginModal.show();
    }

    _handleLoginError(error, fallbackMessage, options = {}) {
        const msg = this._getLoginErrorMessage(error, fallbackMessage);
        if (options.toast) {
            Toast?.error?.(msg);
        }
        this._showError('login-error', msg);
        if (this._isBannedLoginError(error)) {
            this._showBannedLoginModal();
        }
        this._shakePanel();
    }

    async handleLogin() {
        if (this.isSubmitting) return;
        if (!this._canLoginByOperation()) {
            this._showError('login-error', this._getOperationBlockedMessage());
            this._shakePanel();
            return;
        }
        if (window.versionCheckService?.isBlocked?.()) {
            this._showError('login-error', '当前版本已停止支持，请先更新客户端');
            this._shakePanel();
            return;
        }

        const account = (document.getElementById('login-account').value || '').trim();
        const password = document.getElementById('login-password').value || '';
        const remember = document.getElementById('login-remember').checked;

        const error = this._validateLogin(account, password);
        if (error) {
            this._showError('login-error', error);
            this._shakePanel();
            return;
        }

        this._hideError('login-error');
        this._setLoading('btn-login', true);
        this.isSubmitting = true;

        try {
            await authService.login(account, password);

            localStorage.setItem(this.KEY_ACCOUNT, account);
            if (remember) {
                localStorage.setItem(this.KEY_PASSWORD, password);
                localStorage.setItem(this.KEY_REMEMBER_PWD, 'true');
            } else {
                localStorage.removeItem(this.KEY_PASSWORD);
                localStorage.removeItem(this.KEY_REMEMBER_PWD);
            }

            window.game?.showGameLoadingOverlay?.({
                title: '\u6b63\u5728\u8fdb\u5165\u4e91\u5883',
                message: '\u9a8c\u8bc1\u6210\u529f\uff0c\u6b63\u5728\u51c6\u5907\u6570\u636e',
                progress: 8
            });
            this.guestLoginModal?.close?.();
            this.hide();
            eventManager.emit('loginSuccess');
        } catch (err) {
            this._handleLoginError(err, '登录失败，请检查网络连接');
        } finally {
            this._setLoading('btn-login', false);
            this.isSubmitting = false;
        }
    }

    async handleTapTapLogin() {
        if (this.isSubmitting) return;
        if (!this._canLoginByOperation()) {
            Toast?.info?.(this._getOperationBlockedMessage());
            return;
        }
        if (window.versionCheckService?.isBlocked?.()) {
            this._showError('login-error', '\u5f53\u524d\u7248\u672c\u5df2\u505c\u6b62\u652f\u6301\uff0c\u8bf7\u5148\u66f4\u65b0\u5ba2\u6237\u7aef');
            this._shakePanel();
            return;
        }

        const tapTapPlugin = this._getTapTapPlugin();
        if (!tapTapPlugin?.login) {
            this._showError('login-error', '\u8bf7\u5728 TapTap \u5b89\u5353\u5ba2\u6237\u7aef\u5185\u4f7f\u7528 TapTap \u767b\u5f55');
            this._shakePanel();
            return;
        }

        this._hideError('login-error');
        this._setLoading('btn-taptap-login', true);
        this.isSubmitting = true;

        try {
            const tapTapResult = await this._withTimeout(
                tapTapPlugin.login(),
                20000,
                'TapTap 授权超时，请重试'
            );
            await this._verifyTapTapCompliance(tapTapResult || {});
            await authService.tapTapLogin(tapTapResult || {});
            authService.setTapTapComplianceActive?.(true);
            localStorage.removeItem(this.KEY_PASSWORD);
            localStorage.removeItem(this.KEY_REMEMBER_PWD);
            window.game?.showGameLoadingOverlay?.({
                title: '\u6b63\u5728\u8fdb\u5165\u4e91\u5883',
                message: 'TapTap \u6388\u6743\u6210\u529f\uff0c\u6b63\u5728\u51c6\u5907\u6570\u636e',
                progress: 8
            });
            this.guestLoginModal?.close?.();
            this.hide();
            eventManager.emit('loginSuccess');
        } catch (err) {
            this._handleLoginError(err, 'TapTap 登录失败，请重试', { toast: true });
        } finally {
            const tapTapButton = document.getElementById('btn-taptap-login');
            if (tapTapButton) {
                tapTapButton.disabled = false;
            }
            this._setLoading('btn-taptap-login', false);
            this.isSubmitting = false;
        }
    }

    async handleRegister() {
        if (this.isSubmitting) return;
        if (window.versionCheckService?.isBlocked?.()) {
            this._showError('register-error', '当前版本已停止支持，请先更新客户端');
            this._shakePanel();
            return;
        }

        const account = (document.getElementById('reg-account').value || '').trim();
        const nickname = (document.getElementById('reg-nickname').value || '').trim();
        const password = document.getElementById('reg-password').value || '';
        const confirmPassword = document.getElementById('reg-password-confirm').value || '';

        const error = this._validateRegister(account, nickname, password, confirmPassword);
        if (error) {
            this._showError('register-error', error);
            this._shakePanel();
            return;
        }

        this._hideError('register-error');
        this._setLoading('btn-register', true);
        this.isSubmitting = true;

        try {
            await authService.register({ account, password, nickname });
            localStorage.setItem(this.KEY_ACCOUNT, account);
            window.game?.showGameLoadingOverlay?.({
                title: '\u6b63\u5728\u8fdb\u5165\u4e91\u5883',
                message: '\u6ce8\u518c\u6210\u529f\uff0c\u6b63\u5728\u521d\u59cb\u5316\u6570\u636e',
                progress: 8
            });
            this.hide();
            eventManager.emit('loginSuccess');
        } catch (err) {
            const msg = err?.message || '注册失败，请检查网络连接';
            this._showError('register-error', msg);
            this._shakePanel();
        } finally {
            this._setLoading('btn-register', false);
            this.isSubmitting = false;
        }
    }

    _validateLogin(account, password) {
        if (!account) return '请输入账号';
        if (!password) return '请输入密码';
        if (account.length < 3 || account.length > 20) return '账号长度应为 3-20 位';
        return null;
    }

    _validateRegister(account, nickname, password, confirmPassword) {
        if (!account) return '请输入账号';
        if (account.length < 3 || account.length > 20) return '账号长度应为 3-20 位';
        if (!/^[a-zA-Z0-9]+$/.test(account)) return '账号只能包含字母和数字';
        if (!nickname) return '请输入昵称';
        if (nickname.length < 2 || nickname.length > 12) return '昵称长度应为 2-12 位';
        if (!password) return '请输入密码';
        if (password.length < 6) return '密码至少 6 位';
        if (password !== confirmPassword) return '两次密码输入不一致';
        return null;
    }

    _showError(elementId, message) {
        const el = document.getElementById(elementId);
        if (el) {
            const codeMap = {
                'login-error': 'ERR_AUTH_001',
                'register-error': 'ERR_REG_002'
            };
            const code = codeMap[elementId] || 'ERR_SYS_999';
            el.innerHTML = `<span class="login-error-code">[${code}]</span> <span class="login-error-msg"></span>`;
            const msgEl = el.querySelector('.login-error-msg');
            if (msgEl) msgEl.textContent = message;
            el.style.display = 'block';
            // 重触发故障动画
            el.classList.remove('is-flash');
            void el.offsetWidth;
            el.classList.add('is-flash');
        }
    }

    _hideError(elementId) {
        const el = document.getElementById(elementId);
        if (el) el.style.display = 'none';
    }

    _shakePanel() {
        const panel = document.querySelector('.login-guest-modal') || this.element?.querySelector('.login-form-panel');
        if (panel) {
            panel.classList.remove('login-shake');
            void panel.offsetWidth;
            panel.classList.add('login-shake');
        }
    }

    _setLoading(btnId, loading) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        const blockedByStatus = (btnId === 'btn-login' || btnId === 'btn-taptap-login') && !this._canLoginByOperation();
        btn.disabled = loading || blockedByStatus;
        const textEl = btn.querySelector('.btn-text');
        const loadEl = btn.querySelector('.btn-loading');
        if (textEl) textEl.style.display = loading ? 'none' : '';
        if (loadEl) loadEl.style.display = loading ? '' : 'none';
    }

    _escapeAttr(str) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }
}

const loginView = new LoginView();
window.loginView = loginView;
