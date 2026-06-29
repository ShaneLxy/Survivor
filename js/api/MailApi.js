const MailApi = {
    /**
     * 获取邮件列表
     * @param {Object} [options]
     * @param {number} [options.recent] - 限制"已领取"和"已过期"两类各最近 N 封
     *                                    (服务端兜底,上限 100)。不传则不限制。
     */
    list(options = {}) {
        const params = new URLSearchParams();
        if (options.recent != null) {
            params.set('recent', String(options.recent));
        }
        const query = params.toString();
        return httpClient.get(`/mail${query ? `?${query}` : ''}`);
    },

    markRead(mailId) {
        return httpClient.post(`/mail/${mailId}/read`, {});
    },

    claim(mailId) {
        return httpClient.post(`/mail/${mailId}/claim`, {});
    },

    claimAll(options = {}) {
        const params = new URLSearchParams();
        if (options.recent != null) {
            params.set('recent', String(options.recent));
        }
        const query = params.toString();
        return httpClient.post(`/mail/claim-all${query ? `?${query}` : ''}`, {});
    }
};

window.MailApi = MailApi;
