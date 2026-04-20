const MailApi = {
    list() {
        return httpClient.get('/mail');
    },

    markRead(mailId) {
        return httpClient.post(`/mail/${mailId}/read`, {});
    },

    claim(mailId) {
        return httpClient.post(`/mail/${mailId}/claim`, {});
    },

    claimAll() {
        return httpClient.post('/mail/claim-all', {});
    }
};

window.MailApi = MailApi;
