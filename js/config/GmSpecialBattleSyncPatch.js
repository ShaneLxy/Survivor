(function() {
    const GmSpecialBattleSync = {
        loaded: false,
        embeddedApplied: false,

        applyEmbeddedConfig() {
            if (this.embeddedApplied) {
                return true;
            }
            const config = window.__SURVIVOR_GM_SPECIAL_BATTLES__;
            if (!config || typeof config !== 'object') {
                return false;
            }
            this.apply(config);
            this.embeddedApplied = true;
            return true;
        },

        async load() {
            if (this.loaded) {
                return true;
            }
            const baseUrl = window.httpClient?.getBaseUrl?.();
            if (!baseUrl || typeof fetch !== 'function') {
                return false;
            }
            try {
                const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/gm/special-battles/public`, {
                    method: 'GET',
                    cache: 'no-store'
                });
                if (!response.ok) {
                    return false;
                }
                const payload = await response.json();
                this.apply(payload?.config || payload || {});
                this.loaded = true;
                return true;
            } catch (error) {
                console.warn('[GmSpecialBattleSync] load failed:', error);
                return false;
            }
        },

        apply(config) {
            window.__SURVIVOR_GM_SPECIAL_BATTLES__ = {
                escortMissions: Array.isArray(config?.escortMissions) ? config.escortMissions : [],
                updatedAt: config?.updatedAt || null
            };
        },

        getMissions() {
            const config = window.__SURVIVOR_GM_SPECIAL_BATTLES__;
            return Array.isArray(config?.escortMissions) ? config.escortMissions : [];
        }
    };

    window.GmSpecialBattleSync = GmSpecialBattleSync;
})();
