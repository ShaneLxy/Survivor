const CdkeyApi = {
    redeem(code) {
        return httpClient.post('/cdkey/redeem', { code });
    }
};

window.CdkeyApi = CdkeyApi;
