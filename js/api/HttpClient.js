/**
 * HTTP 请求封装
 */
class HttpClient {
    constructor() {
        this.baseUrlKey = 'survivor_api_base_url';
        this.baseUrl = localStorage.getItem(this.baseUrlKey) || 'http://127.0.0.1:3000/api';
        this.token = null;
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
    }

    clearToken() {
        this.token = null;
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
