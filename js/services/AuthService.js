/**
 * 登录态服务
 */
class AuthService {
    constructor() {
        this.tokenKey = 'survivor_auth_token';
        this.userKey = 'survivor_auth_user';
        this.currentUser = null;
        this.token = null;
        this.sessionExpiredHandled = false;
        this.tapTapComplianceActive = false;

        window.addEventListener('survivor:auth-expired', event => {
            this.handleSessionExpired(event?.detail?.message);
        });
        window.Capacitor?.Plugins?.TapTapCompliance?.addListener?.('tapTapComplianceResult', event => {
            this.handleTapTapComplianceResult(event);
        });
    }

    async init() {
        this.token = localStorage.getItem(this.tokenKey) || null;
        const userText = localStorage.getItem(this.userKey);
        if (userText) {
            try {
                this.currentUser = JSON.parse(userText);
            } catch (error) {
                this.currentUser = null;
            }
        }
        httpClient.setToken(this.token);
        if (!this.token) {
            this.sessionExpiredHandled = false;
            return null;
        }
        try {
            const response = await AuthApi.getProfile();
            this.currentUser = response?.user || this.currentUser;
            this.persistSession();
            this.sessionExpiredHandled = false;
            eventManager.emit('authChange', { loggedIn: true, user: this.currentUser });
            return this.currentUser;
        } catch (error) {
            this.clearSession();
            return null;
        }
    }

    persistSession() {
        if (this.token) {
            localStorage.setItem(this.tokenKey, this.token);
            httpClient.setToken(this.token);
        }
        if (this.currentUser) {
            localStorage.setItem(this.userKey, JSON.stringify(this.currentUser));
        }
    }

    setSession(data) {
        this.token = data?.accessToken || data?.token || null;
        this.currentUser = data?.user || null;
        this.sessionExpiredHandled = false;
        this.persistSession();
        eventManager.emit('authChange', { loggedIn: Boolean(this.token), user: this.currentUser });
    }

    clearSession() {
        this.token = null;
        this.currentUser = null;
        this.tapTapComplianceActive = false;
        httpClient.clearToken();
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
        eventManager.emit('authChange', { loggedIn: false, user: null });
    }

    handleSessionExpired(message = '账号已在别处登录，请重新登录') {
        if (this.sessionExpiredHandled) {
            return;
        }
        this.sessionExpiredHandled = true;
        this.clearSession();
        window.game?.handleSessionExpired?.(message);
    }

    handleTapTapComplianceResult(event) {
        const code = Number(event?.code);
        if (!Number.isFinite(code) || code === 500) {
            return;
        }

        const blockingCodes = new Set([1000, 1001, 1030, 1050, 1100, 1200, 9002]);
        if (!blockingCodes.has(code)) {
            return;
        }

        if (!this.tapTapComplianceActive || !this.isLoggedIn()) {
            return;
        }

        this.clearSession();
        window.game?.handleSessionExpired?.(event?.message || '防沉迷限制已生效，请稍后再试');
    }

    setTapTapComplianceActive(active) {
        this.tapTapComplianceActive = Boolean(active);
    }

    async register({ account, password, nickname }) {
        const response = await AuthApi.register({ account, password, nickname });
        this.setSession(response);
        return response;
    }

    async login(account, password) {
        const response = await AuthApi.login({ account, password });
        this.setSession(response);
        return response;
    }

    async tapTapLogin(payload) {
        const response = await AuthApi.tapTapLogin(payload);
        this.setSession(response);
        return response;
    }

    async exitTapTapCompliance() {
        const plugin = window.Capacitor?.Plugins?.TapTapCompliance;
        if (plugin?.exit) {
            try {
                await plugin.exit();
            } catch (error) {
                console.warn('[AuthService] TapTap compliance exit failed:', error);
            }
        }
    }

    logout(options = {}) {
        const exitCompliance = options.exitCompliance !== false;
        if (exitCompliance) {
            this.exitTapTapCompliance();
        }
        this.sessionExpiredHandled = false;
        this.tapTapComplianceActive = false;
        this.clearSession();
    }

    isLoggedIn() {
        return Boolean(this.token);
    }

    getCurrentUser() {
        return this.currentUser;
    }

    getApiBaseUrl() {
        return httpClient.getBaseUrl();
    }

    setApiBaseUrl(baseUrl) {
        httpClient.setBaseUrl(baseUrl);
    }
}

const authService = new AuthService();
window.authService = authService;
