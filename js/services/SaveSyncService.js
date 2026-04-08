/**
 * 云存档同步服务
 */
class SaveSyncService {
    constructor() {
        this.syncTimer = null;
    }

    getSaveTimestamp(saveWrapper) {
        return Number(saveWrapper?.data?.lastSaveTime || saveWrapper?.timestamp || 0);
    }

    buildCurrentSaveWrapper() {
        return {
            version: '2.0.0',
            timestamp: Date.now(),
            data: saveManager.collectGameData()
        };
    }

    async resolveInitialSave(localSave) {
        if (!authService.isLoggedIn()) {
            return localSave;
        }
        try {
            const remoteResponse = await SaveApi.getSave();
            const remoteSave = remoteResponse?.saveData || null;
            if (!remoteSave) {
                if (localSave) {
                    await this.syncNow(localSave);
                }
                return localSave;
            }

            const localTimestamp = this.getSaveTimestamp(localSave);
            const remoteTimestamp = this.getSaveTimestamp(remoteSave);
            if (!localSave || remoteTimestamp > localTimestamp) {
                localStorage.setItem(saveManager.saveKey, JSON.stringify(remoteSave));
                return remoteSave;
            }
            if (localTimestamp > remoteTimestamp) {
                await this.syncNow(localSave);
            }
            return localSave;
        } catch (error) {
            console.warn('[SaveSyncService] resolveInitialSave failed:', error);
            return localSave;
        }
    }

    async syncNow(saveWrapper) {
        if (!authService.isLoggedIn() || !saveWrapper) {
            return false;
        }
        try {
            await SaveApi.save(saveWrapper);
            return true;
        } catch (error) {
            console.warn('[SaveSyncService] syncNow failed:', error);
            return false;
        }
    }

    queueSync(saveWrapper) {
        if (!authService.isLoggedIn() || !saveWrapper) {
            return;
        }
        clearTimeout(this.syncTimer);
        this.syncTimer = setTimeout(() => {
            this.syncNow(saveWrapper);
        }, 400);
    }

    async uploadCurrentSave() {
        const currentSave = this.buildCurrentSaveWrapper();
        return this.syncNow(currentSave);
    }

    async downloadRemoteSaveToGame() {
        const remoteResponse = await SaveApi.getSave();
        const remoteSave = remoteResponse?.saveData || null;
        if (!remoteSave?.data) {
            throw new Error('云端暂无存档');
        }
        localStorage.setItem(saveManager.saveKey, JSON.stringify(remoteSave));
        window.game.loadFromSave(remoteSave);
        window.game.refreshRuntimeUI();
        return remoteSave;
    }

    async handleLoginSync() {
        const localSave = saveManager.load();
        const resolvedSave = await this.resolveInitialSave(localSave);
        if (resolvedSave?.data && this.getSaveTimestamp(resolvedSave) > this.getSaveTimestamp(localSave)) {
            window.game.loadFromSave(resolvedSave);
            window.game.refreshRuntimeUI();
            return { source: 'remote', saveData: resolvedSave };
        }
        if (!resolvedSave?.data) {
            await this.uploadCurrentSave();
            return { source: 'local', saveData: null };
        }
        return { source: 'local', saveData: resolvedSave };
    }
}

const saveSyncService = new SaveSyncService();
window.saveSyncService = saveSyncService;
