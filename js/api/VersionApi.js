/**
 * 版本策略接口
 */
const VersionApi = {
    getVersionPolicy() {
        return httpClient.get('/health/version');
    }
};

window.VersionApi = VersionApi;
