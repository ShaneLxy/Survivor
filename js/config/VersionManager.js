(function() {
    const currentBuildVersion = window.__SURVIVOR_BUILD_VERSION__ || '2026.05.16.11';
    const manager = {
        buildVersion: currentBuildVersion,
        assetVersion: currentBuildVersion,
        configVersion: currentBuildVersion,
        saveSchemaVersion: '2.1.0',
        storageKeys: {
            buildVersion: 'survivor_build_version',
            configVersion: 'survivor_config_version'
        },
        buildChanged: false,

        bootstrap() {
            try {
                const previous = localStorage.getItem(this.storageKeys.buildVersion);
                this.buildChanged = Boolean(previous && previous !== this.buildVersion);
                localStorage.setItem(this.storageKeys.buildVersion, this.buildVersion);
                return this.buildChanged;
            } catch (error) {
                console.warn('[VersionManager] bootstrap failed:', error);
                this.buildChanged = false;
                return false;
            }
        },

        withVersion(url, bucket = 'asset') {
            const rawUrl = String(url || '').trim();
            if (!rawUrl) {
                return rawUrl;
            }
            const version = bucket === 'config' ? this.configVersion : this.assetVersion;
            if (!version) {
                return rawUrl;
            }

            const [base, hash = ''] = rawUrl.split('#');
            const separator = base.includes('?') ? '&' : '?';
            const versioned = `${base}${separator}v=${encodeURIComponent(version)}`;
            return hash ? `${versioned}#${hash}` : versioned;
        },

        getVersionedConfigUrl(path) {
            return this.withVersion(path, 'config');
        },

        getVersionedAssetUrl(path) {
            return this.withVersion(path, 'asset');
        },

        normalizeVersion(version) {
            return String(version || '')
                .trim()
                .split('.')
                .map(part => {
                    const match = String(part).match(/\d+/);
                    return match ? Number(match[0]) : 0;
                });
        },

        compareVersions(a, b) {
            const left = this.normalizeVersion(a);
            const right = this.normalizeVersion(b);
            const maxLength = Math.max(left.length, right.length);
            for (let i = 0; i < maxLength; i += 1) {
                const leftValue = left[i] || 0;
                const rightValue = right[i] || 0;
                if (leftValue > rightValue) {
                    return 1;
                }
                if (leftValue < rightValue) {
                    return -1;
                }
            }
            return 0;
        },

        detectPlatform() {
            const userAgent = navigator.userAgent || '';
            const isNativeApp = Boolean(window.Capacitor && (
                typeof window.Capacitor.isNativePlatform === 'function'
                    ? window.Capacitor.isNativePlatform()
                    : true
            ));
            if (isNativeApp || /Android/i.test(userAgent)) {
                return 'android';
            }
            if (window.__wxjs_environment === 'miniprogram') {
                return 'wechatMiniProgram';
            }
            if (/MicroMessenger/i.test(userAgent)) {
                return 'wechatWeb';
            }
            return 'web';
        },

        isConfigStale() {
            try {
                return localStorage.getItem(this.storageKeys.configVersion) !== this.configVersion;
            } catch (error) {
                return true;
            }
        },

        markConfigFresh() {
            try {
                localStorage.setItem(this.storageKeys.configVersion, this.configVersion);
            } catch (error) {
                console.warn('[VersionManager] markConfigFresh failed:', error);
            }
        }
    };

    window.VersionManager = manager;
})();


