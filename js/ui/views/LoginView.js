/**
 * 登录/注册视图 - 全屏启动画面风格
 */
class LoginView {
    constructor() {
        this.mode = 'login'; // 'login' | 'register'
        this.isSubmitting = false;
        this.element = null;

        // 缓存键名
        this.KEY_ACCOUNT = 'survivor_remember_account';
        this.KEY_PASSWORD = 'survivor_remember_password';
        this.KEY_REMEMBER_PWD = 'survivor_remember_pwd_checked';
    }

    /**
     * 显示登录页（全屏覆盖）
     */
    show() {
        this._ensureContainer();
        this.mode = 'login';
        this.render();
        this._fadeIn();

        // 隐藏游戏主界面
        const appEl = document.getElementById('app');
        if (appEl) appEl.style.display = 'none';
        this._setGameChromeVisible(false);

        // 隐藏 modal 和 toast 容器（登录期间不需要）
        const modalContainer = document.getElementById('modal-container');
        const toastContainer = document.getElementById('toast-container');
        if (modalContainer) modalContainer.style.display = 'none';
        if (toastContainer) toastContainer.style.display = 'none';
    }

    /**
     * 隐藏登录页，显示游戏界面
     */
    hide() {
        if (this.element) {
            this.element.classList.add('login-fade-out');
            setTimeout(() => {
                if (this.element && this.element.parentNode) {
                    this.element.remove();
                }
                this.element = null;
            }, 400);
        }

        // 显示游戏主界面
        const appEl = document.getElementById('app');
        if (appEl) appEl.style.display = '';
        this._setGameChromeVisible(true);

        // 显示 modal 和 toast
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
            topBar.style.display = visible ? 'flex' : 'none';
        }
        if (tabBar) {
            tabBar.style.display = visible ? 'flex' : 'none';
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

    _renderLogin(savedAccount, savedPwd, rememberChecked) {
        this.element.innerHTML = `
            <div class="login-backdrop">
                <div class="login-particles"></div>
                <div class="login-grid-overlay"></div>
            </div>
            <div class="login-container">
                <div class="login-logo">
                    <div class="login-logo-icon">☢️</div>
                    <h1 class="login-title">末日生存</h1>
                    <p class="login-subtitle">SURVIVOR</p>
                </div>

                <div class="login-form-panel" id="login-form-panel">
                    <div class="login-error-tip" id="login-error" style="display:none;"></div>

                    <div class="login-field">
                        <label class="login-label" for="login-account">
                            <span class="field-icon">👤</span>账号
                        </label>
                        <input type="text" id="login-account" class="login-input"
                               value="${this._escapeAttr(savedAccount)}"
                               placeholder="请输入账号" autocomplete="username" />
                    </div>

                    <div class="login-field">
                        <label class="login-label" for="login-password">
                            <span class="field-icon">🔒</span>密码
                        </label>
                        <input type="password" id="login-password" class="login-input"
                               value="${rememberChecked ? this._escapeAttr(savedPwd) : ''}"
                               placeholder="请输入密码" autocomplete="current-password" />
                    </div>

                    <div class="login-options">
                        <label class="login-remember">
                            <input type="checkbox" id="login-remember" ${rememberChecked ? 'checked' : ''} />
                            <span class="checkmark"></span>
                            记住密码
                        </label>
                    </div>

                    <button class="login-btn login-btn-primary" id="btn-login" onclick="window.loginView.handleLogin()">
                        <span class="btn-text">登 录</span>
                        <span class="btn-loading" style="display:none;">登录中...</span>
                    </button>

                    <div class="login-switch">
                        没有账号？<a href="javascript:void(0)" id="link-to-register" onclick="window.loginView.switchToRegister()">立即注册</a>
                    </div>
                </div>
            </div>
        `;

        // 绑定回车键提交
        const passwordInput = document.getElementById('login-password');
        if (passwordInput) {
            passwordInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.handleLogin();
            });
        }
        const accountInput = document.getElementById('login-account');
        if (accountInput) {
            accountInput.addEventListener('keydown', (e) => {
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
            </div>
            <div class="login-container">
                <div class="login-logo">
                    <div class="login-logo-icon">☢️</div>
                    <h1 class="login-title">末日生存</h1>
                    <p class="login-subtitle">SURVIVOR</p>
                </div>

                <div class="login-form-panel" id="register-form-panel">
                    <div class="login-error-tip" id="register-error" style="display:none;"></div>

                    <div class="login-field">
                        <label class="login-label" for="reg-account">
                            <span class="field-icon">👤</span>账号
                        </label>
                        <input type="text" id="reg-account" class="login-input"
                               value="${this._escapeAttr(savedAccount)}"
                               placeholder="请输入账号（3-20位字母或数字）" autocomplete="username" />
                    </div>

                    <div class="login-field">
                        <label class="login-label" for="reg-nickname">
                            <span class="field-icon">⭐</span>昵称
                        </label>
                        <input type="text" id="reg-nickname" class="login-input"
                               placeholder="请输入昵称" autocomplete="nickname" />
                    </div>

                    <div class="login-field">
                        <label class="login-label" for="reg-password">
                            <span class="field-icon">🔒</span>密码
                        </label>
                        <input type="password" id="reg-password" class="login-input"
                               placeholder="请输入密码（6位以上）" autocomplete="new-password" />
                    </div>

                    <div class="login-field">
                        <label class="login-label" for="reg-password-confirm">
                            <span class="field-icon">🔒</span>确认密码
                        </label>
                        <input type="password" id="reg-password-confirm" class="login-input"
                               placeholder="再次输入密码" autocomplete="new-password" />
                    </div>

                    <button class="login-btn login-btn-primary" id="btn-register" onclick="window.loginView.handleRegister()">
                        <span class="btn-text">注 册</span>
                        <span class="btn-loading" style="display:none;">注册中...</span>
                    </button>

                    <div class="login-switch">
                        已有账号？<a href="javascript:void(0)" id="link-to-login" onclick="window.loginView.switchToLogin()">返回登录</a>
                    </div>
                </div>
            </div>
        `;

        // 回车键绑定
        const confirmInput = document.getElementById('reg-password-confirm');
        if (confirmInput) {
            confirmInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.handleRegister();
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

    async handleLogin() {
        if (this.isSubmitting) return;

        const account = (document.getElementById('login-account').value || '').trim();
        const password = document.getElementById('login-password').value || '';
        const remember = document.getElementById('login-remember').checked;

        // 前端校验
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

            // 保存缓存
            localStorage.setItem(this.KEY_ACCOUNT, account);
            if (remember) {
                localStorage.setItem(this.KEY_PASSWORD, password);
                localStorage.setItem(this.KEY_REMEMBER_PWD, 'true');
            } else {
                localStorage.removeItem(this.KEY_PASSWORD);
                localStorage.removeItem(this.KEY_REMEMBER_PWD);
            }

            // 登录成功，通知 Game 进入游戏
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

    async handleRegister() {
        if (this.isSubmitting) return;

        const account = (document.getElementById('reg-account').value || '').trim();
        const nickname = (document.getElementById('reg-nickname').value || '').trim();
        const password = document.getElementById('reg-password').value || '';
        const confirmPassword = document.getElementById('reg-password-confirm').value || '';

        // 前端校验
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

            // 注册成功也保存账号
            localStorage.setItem(this.KEY_ACCOUNT, account);

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

    // ---- 校验方法 ----

    _validateLogin(account, password) {
        if (!account) return '请输入账号';
        if (!password) return '请输入密码';
        if (account.length < 3 || account.length > 20) return '账号长度应为3-20位';
        return null;
    }

    _validateRegister(account, nickname, password, confirmPassword) {
        if (!account) return '请输入账号';
        if (account.length < 3 || account.length > 20) return '账号长度应为3-20位';
        if (!/^[a-zA-Z0-9]+$/.test(account)) return '账号只能包含字母和数字';
        if (!nickname) return '请输入昵称';
        if (nickname.length < 2 || nickname.length > 12) return '昵称长度应为2-12位';
        if (!password) return '请输入密码';
        if (password.length < 6) return '密码至少6位';
        if (password !== confirmPassword) return '两次密码不一致';
        return null;
    }

    // ---- UI 辅助方法 ----

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
            void panel.offsetWidth; // 触发 reflow
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
