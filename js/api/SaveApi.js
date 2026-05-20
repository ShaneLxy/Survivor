/**
 * 云存档接口
 */
const SaveApi = {
    getSave() {
        return httpClient.get('/save');
    },

    save(saveData) {
        return httpClient.put('/save', { saveData });
    },

    purchaseShopItem(shopItemId, quantity) {
        return httpClient.put('/save/shop/purchase', { shopItemId, quantity });
    },

    claimDailyCheckin() {
        return httpClient.put('/save/checkin/claim', {});
    },

    claimWelfareGift(giftId, options = {}) {
        return httpClient.put('/save/welfare/claim', {
            giftId,
            useAdSkipCard: Boolean(options.useAdSkipCard)
        });
    },

    claimMonthCard(cardId) {
        return httpClient.put('/save/month-card/claim', { cardId });
    },

    deleteSave() {
        return httpClient.delete('/save');
    }
};

window.SaveApi = SaveApi;
