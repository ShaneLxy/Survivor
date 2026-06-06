package com.survivor.game.plugins;

import android.app.Activity;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.survivor.game.TapTapSdkInitializer;
import com.taptap.sdk.update.TapTapUpdate;
import com.taptap.sdk.update.TapTapUpdateCallback;

/**
 * TapTap "更新唤起" 插件桥接（Android）。
 *
 * 对接 com.taptap.sdk:tap-update 4.x：
 *   - {@link TapTapUpdate#updateGame(Activity, TapTapUpdateCallback)}
 *     游戏内中断更新场景。SDK 自行接管所有 UI（弹窗 / 跳转 TapTap），
 *     回调只有一个 {@code onCancel()}，仅当"未安装 TapTap 客户端且用户拒绝下载"时才触发。
 *   - {@link TapTapUpdate#checkForceUpdate()}
 *     启动时强制更新场景。无回调。
 *
 * 注意：SDK 自己判断版本，无更新时不会展示新版本弹窗；
 * 是否检查到更新对 app 是黑盒，所以这里 resolve 一个统一的"checked"状态，
 * 取消下载 TapTap 时通过 onCancel 上报 "cancelled"。
 */
@CapacitorPlugin(name = "TapTapUpdate")
public class TapTapUpdatePlugin extends Plugin {
    private static final String TAG = "TapTapUpdatePlugin";

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", true);
        call.resolve(result);
    }

    /**
     * 游戏内提示更新（推荐入口）。
     * SDK 会唤起 TapTap 客户端引导更新；用户在"未安装 TapTap 客户端"二次提示中
     * 点取消时回调 onCancel。其它情况下不会回调。
     *
     * 为兼容前端 Promise 语义，这里在 onCancel 时 resolve {status: 'cancelled'}；
     * 如果 onCancel 始终未触发（理论正常更新流程），调用方应当不依赖回调，
     * 直接视作"已交给 TapTap 处理"。
     */
    @PluginMethod
    public void checkUpdate(final PluginCall call) {
        final Activity activity = getActivity();
        if (activity == null) {
            call.reject("TapTap update requires an Android activity.");
            return;
        }

        try {
            TapTapSdkInitializer.ensureInitialized(activity.getApplicationContext());
        } catch (Throwable error) {
            call.reject("TapTap SDK 初始化失败：" + safeMessage(error));
            return;
        }

        // SDK UI 必须在 main 线程；Capacitor PluginMethod 默认就在主线程
        try {
            TapTapUpdate.updateGame(activity, new TapTapUpdateCallback() {
                @Override
                public void onCancel() {
                    Log.i(TAG, "TapTap updateGame onCancel (user declined installing TapTap client).");
                    JSObject data = new JSObject();
                    data.put("reason", "user_declined_taptap_install");
                    notifyListeners("updateCancelled", data);
                }
            });
            // SDK 已接管，立即返回 started；正常完成流程没有回调，
            // 仅在用户取消"安装 TapTap 客户端"时通过 updateCancelled 事件上报。
            JSObject result = new JSObject();
            result.put("status", "started");
            call.resolve(result);
        } catch (Throwable error) {
            call.reject("TapTap 更新检查启动失败：" + safeMessage(error));
        }
    }

    /**
     * 启动前强制更新（非推荐入口；游戏启动早期、未就绪 Activity 时调用更合适）。
     */
    @PluginMethod
    public void checkForceUpdate(PluginCall call) {
        try {
            Activity activity = getActivity();
            if (activity != null) {
                TapTapSdkInitializer.ensureInitialized(activity.getApplicationContext());
            }
            TapTapUpdate.checkForceUpdate();
            JSObject result = new JSObject();
            result.put("status", "ok");
            call.resolve(result);
        } catch (Throwable error) {
            call.reject("TapTap 强制更新检查失败：" + safeMessage(error));
        }
    }

    private String safeMessage(Throwable error) {
        String msg = error == null ? "" : error.getMessage();
        return (msg == null || msg.isEmpty()) ? "未知错误" : msg;
    }
}
