/**
 * HTTP 请求封装
 */
class ServerClock {
    constructor() {
        this.serverEpochMs = Date.now();
        this.anchorPerfMs = this.getPerfNow();
        this.initialized = false;
    }

    getPerfNow() {
        return typeof performance !== 'undefined' && typeof performance.now === 'function'
            ? performance.now()
            : Date.now();
    }

    sync(serverTime) {
        const parsedMs = Date.parse(serverTime);
        if (!Number.isFinite(parsedMs)) {
            return false;
        }
        this.serverEpochMs = parsedMs;
        this.anchorPerfMs = this.getPerfNow();
        this.initialized = true;
        return true;
    }

    updateFromResponse(response) {
        if (!response?.headers?.get) {
            return false;
        }
        const headerTime = response.headers.get('X-Server-Time') || response.headers.get('Date');
        if (!headerTime) {
            return false;
        }
        return this.sync(headerTime);
    }

    now() {
        const elapsed = this.getPerfNow() - this.anchorPerfMs;
        return new Date(this.serverEpochMs + Math.max(0, elapsed));
    }

    todayKey() {
        return this.now().toDateString();
    }

    monthKey() {
        const now = this.now();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
}

const serverClock = window.serverClock || new ServerClock();
window.serverClock = serverClock;

class HttpClient {
    constructor() {
        this.baseUrlKey = 'survivor_api_base_url';
        const runtimeConfig = window.__SURVIVOR_RUNTIME_CONFIG__ || {};
        const isNativeApp = Boolean(window.Capacitor && (
            typeof window.Capacitor.isNativePlatform === 'function'
                ? window.Capacitor.isNativePlatform()
                : true
        ));
        const isLocal = !isNativeApp && (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
        const configuredUrl = String(runtimeConfig.apiBaseUrl || '').trim().replace(/\/+$/, '');
        const sameOriginUrl = /^https?:$/i.test(location.protocol)
            ? `${location.origin.replace(/\/+$/, '')}/api`
            : '';
        const defaultUrl = configuredUrl || (isLocal ? 'http://127.0.0.1:3000/api' : sameOriginUrl);
        const storedUrl = localStorage.getItem(this.baseUrlKey);
        this.baseUrl = storedUrl || defaultUrl;
        if (isNativeApp && /127\.0\.0\.1:3000\/api$/i.test(this.baseUrl) && configuredUrl) {
            this.baseUrl = configuredUrl;
            localStorage.setItem(this.baseUrlKey, configuredUrl);
        }
        this.token = null;
        this.authExpiredNotified = false;
    }

    setBaseUrl(baseUrl) {
        const normalized = String(baseUrl || '').trim().replace(/\/+$/, '');
        if (!normalized) {
            return;
        }
        this.baseUrl = normalized;
        localStorage.setItem(this.baseUrlKey, normalized);
    }

    getBaseUrl() {
        return this.baseUrl;
    }

    setToken(token) {
        this.token = token || null;
        if (this.token) {
            this.authExpiredNotified = false;
        }
    }

    clearToken() {
        this.token = null;
        this.authExpiredNotified = false;
    }

    notifyAuthExpired(error) {
        if (this.authExpiredNotified) {
            return;
        }
        this.authExpiredNotified = true;
        window.dispatchEvent(new CustomEvent('survivor:auth-expired', {
            detail: {
                message: error?.payload?.message || error?.message || '登录状态已失效，请重新登录'
            }
        }));
    }

    buildUrl(path) {
        if (/^https?:\/\//i.test(path)) {
            return path;
        }
        const normalizedPath = String(path || '').startsWith('/') ? path : `/${path}`;
        return `${this.baseUrl}${normalizedPath}`;
    }

    async request(path, options = {}) {
        const url = this.buildUrl(path);
        const headers = {
            ...(options.headers || {})
        };
        const config = {
            method: options.method || 'GET',
            headers
        };

        if (this.token) {
            headers.Authorization = `Bearer ${this.token}`;
        }

        if (options.body !== undefined && options.body !== null) {
            if (options.body instanceof FormData) {
                config.body = options.body;
            } else {
                headers['Content-Type'] = 'application/json';
                config.body = JSON.stringify(options.body);
            }
        }

        const response = await fetch(url, config);
        window.serverClock?.updateFromResponse?.(response);
        const rawText = await response.text();
        let payload = null;
        if (rawText) {
            try {
                payload = JSON.parse(rawText);
            } catch (error) {
                payload = { message: rawText };
            }
        }

        if (!response.ok) {
            const error = new Error(payload?.message || `请求失败：${response.status}`);
            error.status = response.status;
            error.payload = payload;
            if (response.status === 401 && this.token) {
                this.notifyAuthExpired(error);
            }
            throw error;
        }

        return payload;
    }

    get(path, options = {}) {
        return this.request(path, { ...options, method: 'GET' });
    }

    post(path, body, options = {}) {
        return this.request(path, { ...options, method: 'POST', body });
    }

    put(path, body, options = {}) {
        return this.request(path, { ...options, method: 'PUT', body });
    }

    delete(path, options = {}) {
        return this.request(path, { ...options, method: 'DELETE' });
    }
}

const httpClient = new HttpClient();
window.httpClient = httpClient;
