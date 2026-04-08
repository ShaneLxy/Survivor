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

    deleteSave() {
        return httpClient.delete('/save');
    }
};

window.SaveApi = SaveApi;
