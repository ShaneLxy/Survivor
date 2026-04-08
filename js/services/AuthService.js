/**
 * 登录态服务
 */
class AuthService {
    constructor() {
        this.tokenKey = 'survivor_auth_token';
        this.userKey = 'survivor_auth_user';
        this.currentUser = null;
        this.token = null;
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
            return null;
        }
        try {
            const response = await AuthApi.getProfile();
            this.currentUser = response?.user || this.currentUser;
            this.persistSession();
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
        this.persistSession();
        eventManager.emit('authChange', { loggedIn: Boolean(this.token), user: this.currentUser });
    }

    clearSession() {
        this.token = null;
        this.currentUser = null;
        httpClient.clearToken();
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
        eventManager.emit('authChange', { loggedIn: false, user: null });
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

    logout() {
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
