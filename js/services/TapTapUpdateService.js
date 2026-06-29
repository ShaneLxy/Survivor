/**
 * TapTap 更新唤起服务
 *
 * 在登录页加载时调用 TapTap Update SDK 检查包更新；
 * SDK 会自行弹出"发现新版本"原生对话框并跳转 TapTap 客户端下载，
 * 我们只需触发并记录结果。
 *
 * 行为约定（与 Android Plugin 对齐）：
 *   - checkUpdate() resolve 立即返回 {status: 'started' | 'unsupported' | 'skipped'}
 *     "started" 表示 SDK 已接管，是否真的有新版本由 SDK 自己判断
 *   - 用户在"未安装 TapTap 客户端"二次提示中点取消时，
 *     Plugin 会派发 'updateCancelled' 事件
 *
 * 仅在原生 Android Capacitor 环境内有效（其它平台直接 noop）。
 * 同一会话内只检查一次，避免重复弹窗。
 */
class TapTapUpdateService {
    constructor() {
        this.checked = false;
        this.lastResult = null;
        this.pending = null;
        this.cancelled = false;
        this._listenerBound = false;
    }

    _getPlugin() {
        return window.Capacitor?.Plugins?.TapTapUpdate || null;
    }

    _readBoolean(value) {
        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            return normalized === '1'
                || normalized === 'true'
                || normalized === 'yes'
                || normalized === 'on';
        }
        return value === true || value === 1;
    }

    isEnabled() {
        return this._readBoolean(window.__SURVIVOR_RUNTIME_CONFIG__?.enableTapTapUpdate);
    }

    _isNativeAndroid() {
        const cap = window.Capacitor;
        if (!cap) return false;
        const isNative = typeof cap.isNativePlatform === 'function'
            ? cap.isNativePlatform()
            : true;
        if (!isNative) return false;
        const platform = typeof cap.getPlatform === 'function' ? cap.getPlatform() : 'android';
        return platform === 'android';
    }

    isSupported() {
        return this.isEnabled() && this._isNativeAndroid() && Boolean(this._getPlugin()?.checkUpdate);
    }

    _bindCancelListener() {
        if (this._listenerBound) return;
        const plugin = this._getPlugin();
        if (!plugin?.addListener) return;
        try {
            plugin.addListener('updateCancelled', (payload) => {
                this.cancelled = true;
                console.info('[TapTapUpdate] user cancelled TapTap install:', payload);
            });
            this._listenerBound = true;
        } catch (error) {
            console.warn('[TapTapUpdate] addListener failed:', error?.message || error);
        }
    }

    /**
     * 在登录页展示时触发；幂等。
     * 返回 { status: 'started' | 'unsupported' | 'skipped' | 'error', ... }
     */
    async checkOnLogin() {
        if (this.checked) {
            return this.lastResult || { status: 'skipped' };
        }
        if (this.pending) {
            return this.pending;
        }
        if (!this.isEnabled()) {
            this.checked = true;
            this.lastResult = { status: 'disabled' };
            return this.lastResult;
        }
        if (!this.isSupported()) {
            this.checked = true;
            this.lastResult = { status: 'unsupported' };
            return this.lastResult;
        }

        this._bindCancelListener();
        const plugin = this._getPlugin();
        this.pending = (async () => {
            try {
                const result = await plugin.checkUpdate();
                this.lastResult = result || { status: 'started' };
                this.checked = true;
                console.info('[TapTapUpdate] check result:', this.lastResult);
                return this.lastResult;
            } catch (error) {
                const message = error?.message || String(error || '');
                this.lastResult = { status: 'error', message };
                this.checked = true;
                console.warn('[TapTapUpdate] check failed:', message);
                return this.lastResult;
            } finally {
                this.pending = null;
            }
        })();

        return this.pending;
    }

    /** 重置内部状态，方便手动"再次检查更新"。 */
    reset() {
        this.checked = false;
        this.lastResult = null;
        this.pending = null;
        this.cancelled = false;
    }

    /** 用户是否在更新流程中取消了安装 TapTap 客户端。 */
    wasCancelled() {
        return this.cancelled;
    }
}

const tapTapUpdateService = new TapTapUpdateService();
window.tapTapUpdateService = tapTapUpdateService;
