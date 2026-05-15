/**
 * 认证接口
 */
const AuthApi = {
    register(payload) {
        return httpClient.post('/auth/register', payload);
    },

    login(payload) {
        return httpClient.post('/auth/login', payload);
    },

    getProfile() {
        return httpClient.get('/auth/me');
    },

    wechatLogin(payload) {
        return httpClient.post('/auth/wechat/login', payload);
    },

    tapTapLogin(payload) {
        return httpClient.post('/auth/taptap/login', payload);
    }
};

window.AuthApi = AuthApi;
