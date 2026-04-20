(function() {
    const loader = {
        data: null,
        loadingPromise: null,
        sourcePath: 'data/unit-catalog.json',

        getSourceUrl() {
            return window.VersionManager?.getVersionedConfigUrl?.(this.sourcePath) || this.sourcePath;
        },

        async load() {
            if (this.data) {
                return this.data;
            }
            if (this.loadingPromise) {
                return this.loadingPromise;
            }

            this.loadingPromise = fetch(this.getSourceUrl(), { cache: 'no-store' })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Failed to load unit catalog: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    this.data = data || {};
                    window.VersionManager?.markConfigFresh?.();
                    return this.data;
                })
                .catch(error => {
                    console.error('[UnitCatalogLoader] load failed:', error);
                    this.data = this.data || { professions: {}, heroes: [], enemies: {} };
                    return this.data;
                });

            return this.loadingPromise;
        },

        getData() {
            return this.data;
        },

        getHeroes() {
            return Array.isArray(this.data?.heroes) ? this.data.heroes : [];
        },

        getEnemies() {
            return this.data?.enemies || {};
        },

        getProfessions() {
            return this.data?.professions || {};
        }
    };

    window.UnitCatalogLoader = loader;
})();
