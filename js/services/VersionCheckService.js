/**
 * 版本检查服务
 */
class VersionCheckService {
    constructor() {
        this.state = {
            checked: false,
            currentVersion: window.VersionManager?.buildVersion || window.__SURVIVOR_BUILD_VERSION__ || 'dev',
            platform: 'web',
            latestVersion: '',
            minSupportedVersion: '',
            needsUpdate: false,
            forceUpdate: false,
            message: '',
            downloadUrl: ''
        };
    }

    async check() {
        this.state.currentVersion = window.VersionManager?.buildVersion || window.__SURVIVOR_BUILD_VERSION__ || 'dev';
        this.state.platform = window.VersionManager?.detectPlatform?.() || 'web';

        try {
            const response = await VersionApi.getVersionPolicy();
            const policy = response?.platforms?.[this.state.platform] || response?.platforms?.web || null;
            if (!policy) {
                this.state.checked = true;
                return this.state;
            }

            const latestVersion = String(policy.latestVersion || '').trim();
            const minSupportedVersion = String(policy.minSupportedVersion || latestVersion || '').trim();
            const forceUpdate = Boolean(policy.forceUpdate);

            const compareLatest = window.VersionManager?.compareVersions?.(this.state.currentVersion, latestVersion) ?? 0;
            const compareMin = window.VersionManager?.compareVersions?.(this.state.currentVersion, minSupportedVersion) ?? 0;
            const needsUpdate = Boolean(latestVersion) && compareLatest < 0;
            const blockedByMin = Boolean(minSupportedVersion) && compareMin < 0;

            this.state = {
                ...this.state,
                checked: true,
                latestVersion,
                minSupportedVersion,
                needsUpdate,
                forceUpdate: forceUpdate || blockedByMin,
                message: String(policy.message || '').trim(),
                downloadUrl: String(policy.downloadUrl || '').trim()
            };
        } catch (error) {
            console.warn('[VersionCheckService] check failed:', error);
            this.state = {
                ...this.state,
                checked: true
            };
        }

        eventManager?.emit?.('versionPolicyReady', { ...this.state });
        return this.state;
    }

    getState() {
        return { ...this.state };
    }

    isBlocked() {
        return Boolean(this.state.forceUpdate);
    }

    hasUpdateNotice() {
        return Boolean(this.state.needsUpdate || this.state.forceUpdate);
    }

    openUpdateLink() {
        if (!this.state.downloadUrl) {
            return false;
        }
        window.open(this.state.downloadUrl, '_blank', 'noopener');
        return true;
    }
}

const versionCheckService = new VersionCheckService();
window.versionCheckService = versionCheckService;
