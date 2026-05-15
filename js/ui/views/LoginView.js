/**
 * 登录 / 注册视图
 */
class LoginView {
    constructor() {
        this.mode = 'login';
        this.isSubmitting = false;
        this.element = null;
        this.sessionNotice = '';
        this.versionPolicy = null;

        this.KEY_ACCOUNT = 'survivor_remember_account';
        this.KEY_PASSWORD = 'survivor_remember_password';
        this.KEY_REMEMBER_PWD = 'survivor_remember_pwd_checked';
    }

    show() {
        Modal.closeAll();
        document.body?.classList.remove('app-boot-hidden');
        this._ensureContainer();
        this.mode = 'login';
        this.render();
        this._fadeIn();
        window.audioManager?.playSceneBgm?.('login');

        const appEl = document.getElementById('app');
        if (appEl) appEl.style.display = 'none';
        this._setGameChromeVisible(false);

        const modalContainer = document.getElementById('modal-container');
        const toastContainer = document.getElementById('toast-container');
        if (modalContainer) modalContainer.style.display = 'none';
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

        const modalContainer = document.getElementById('modal-container');
        const toastContainer = document.getElementById('toast-container');
        if (modalContainer) modalContainer.style.display = '';
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
        return `<div class="login-version-badge">版本 ${this._escapeAttr(version)}</div>`;
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

    _renderLogin(savedAccount, savedPwd, rememberChecked) {
        const tapTapLoginButton = this._canUseTapTapLogin() ? `
                    <div class="login-divider"><span>TapTap</span></div>
                    <button class="login-btn login-btn-taptap" id="btn-taptap-login" onclick="window.loginView.handleTapTapLogin()">
                        <span class="btn-text">TapTap &#30331;&#24405;</span>
                        <span class="btn-loading" style="display:none;">TapTap &#25480;&#26435;&#20013;...</span>
                    </button>
        ` : '';

        this.element.innerHTML = `
            <div class="login-backdrop">
                <div class="login-particles"></div>
                <div class="login-grid-overlay"></div>
            </div>
            ${this._renderVersionBadge()}
            <div class="login-container">
                ${this._renderNotice()}
                ${this._renderVersionPolicyNotice()}
                <div class="login-logo">
                    <div class="login-logo-icon" aria-hidden="true">
                        <span class="login-logo-core"></span>
                    </div>
                    <h1 class="login-title">&#20113;&#22659;</h1>
                    <p class="login-subtitle">YUNJING</p>
                </div>

                <div class="login-form-panel" id="login-form-panel">
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
                    ${tapTapLoginButton}

                    <div class="login-switch">
                        &#27809;&#26377;&#36134;&#21495;&#65311;<a href="javascript:void(0)" id="link-to-register" onclick="window.loginView.switchToRegister()">&#31435;&#21363;&#27880;&#20876;</a>
                    </div>
                </div>
            </div>
        `;

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
    }

    _renderRegister(savedAccount) {
        this.element.innerHTML = `
            <div class="login-backdrop">
                <div class="login-particles"></div>
                <div class="login-grid-overlay"></div>
            </div>
            ${this._renderVersionBadge()}
            <div class="login-container">
                ${this._renderVersionPolicyNotice()}
                <div class="login-logo">
                    <div class="login-logo-icon" aria-hidden="true">
                        <span class="login-logo-core"></span>
                    </div>
                    <h1 class="login-title">&#20113;&#22659;</h1>
                    <p class="login-subtitle">YUNJING</p>
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
        `;

        const confirmInput = document.getElementById('reg-password-confirm');
        if (confirmInput) {
            confirmInput.addEventListener('keydown', e => {
                if (e.key === 'Enter') this.handleRegister();
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
    }

    switchToRegister() {
        this.mode = 'register';
        this.render();
    }

    switchToLogin() {
        this.mode = 'login';
        this.render();
    }

    _getTapTapPlugin() {
        return window.Capacitor?.Plugins?.TapTapAuth || null;
    }

    _canUseTapTapLogin() {
        return Boolean(this._getTapTapPlugin()?.login);
    }

    async handleLogin() {
        if (this.isSubmitting) return;
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
            this.hide();
            eventManager.emit('loginSuccess');
        } catch (err) {
            const msg = err?.message || '登录失败，请检查网络连接';
            this._showError('login-error', msg);
            this._shakePanel();
        } finally {
            this._setLoading('btn-login', false);
            this.isSubmitting = false;
        }
    }

    async handleTapTapLogin() {
        if (this.isSubmitting) return;
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
            const tapTapResult = await tapTapPlugin.login();
            await authService.tapTapLogin(tapTapResult || {});
            localStorage.removeItem(this.KEY_PASSWORD);
            localStorage.removeItem(this.KEY_REMEMBER_PWD);
            window.game?.showGameLoadingOverlay?.({
                title: '\u6b63\u5728\u8fdb\u5165\u4e91\u5883',
                message: 'TapTap \u6388\u6743\u6210\u529f\uff0c\u6b63\u5728\u51c6\u5907\u6570\u636e',
                progress: 8
            });
            this.hide();
            eventManager.emit('loginSuccess');
        } catch (err) {
            const msg = err?.message || '\u0054\u0061\u0070\u0054\u0061\u0070 \u767b\u5f55\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5';
            this._showError('login-error', msg);
            this._shakePanel();
        } finally {
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
            el.textContent = message;
            el.style.display = 'block';
        }
    }

    _hideError(elementId) {
        const el = document.getElementById(elementId);
        if (el) el.style.display = 'none';
    }

    _shakePanel() {
        const panel = this.element.querySelector('.login-form-panel');
        if (panel) {
            panel.classList.remove('login-shake');
            void panel.offsetWidth;
            panel.classList.add('login-shake');
        }
    }

    _setLoading(btnId, loading) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        btn.disabled = loading;
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
