package com.survivor.game.plugins;

import android.app.Activity;

import androidx.annotation.Nullable;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.survivor.game.TapTapSdkInitializer;
import com.taptap.sdk.compliance.TapTapCompliance;
import com.taptap.sdk.compliance.TapTapComplianceCallback;
import com.taptap.sdk.compliance.constants.ComplianceMessage;

import java.util.Map;

@CapacitorPlugin(name = "TapTapCompliance")
public class TapTapCompliancePlugin extends Plugin {
    private PluginCall pendingStartupCall;
    private boolean callbackRegistered = false;

    @Override
    public void load() {
        ensureCallbackRegistered();
    }

    private void ensureCallbackRegistered() {
        if (callbackRegistered) {
            return;
        }
        try {
            if (getContext() == null) {
                return;
            }
            TapTapSdkInitializer.ensureInitialized(getContext());
            TapTapCompliance.registerComplianceCallback(new TapTapComplianceCallback() {
                @Override
                public void onComplianceResult(int code, @Nullable Map<String, ?> extra) {
                    handleComplianceResult(code, extra);
                }
            });
            callbackRegistered = true;
        } catch (Throwable ignored) {
            // startup() will retry initialization and return the actual error to JS.
        }
    }

    @PluginMethod
    public void startup(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("TapTap compliance requires an Android activity.");
            return;
        }

        String userIdentifier = call.getString("userIdentifier", "");
        if (userIdentifier == null || userIdentifier.trim().isEmpty()) {
            call.reject("TapTap compliance userIdentifier is required.");
            return;
        }

        try {
            TapTapSdkInitializer.ensureInitialized(activity.getApplicationContext());
            ensureCallbackRegistered();
            pendingStartupCall = call;
            TapTapCompliance.startup(activity, userIdentifier.trim());
        } catch (Throwable error) {
            pendingStartupCall = null;
            call.reject("TapTap 防沉迷初始化失败：" + getErrorMessage(error));
        }
    }

    @PluginMethod
    public void exit(PluginCall call) {
        try {
            TapTapSdkInitializer.ensureInitialized(getContext());
            TapTapCompliance.exit();
            call.resolve();
        } catch (Throwable error) {
            call.reject("TapTap 防沉迷退出失败：" + getErrorMessage(error));
        }
    }

    private void handleComplianceResult(int code, @Nullable Map<String, ?> extra) {
        JSObject result = new JSObject();
        result.put("code", code);
        result.put("message", getMessage(code));
        if (extra != null) {
            JSObject extraObject = new JSObject();
            for (Map.Entry<String, ?> entry : extra.entrySet()) {
                Object value = entry.getValue();
                if (value != null) {
                    extraObject.put(entry.getKey(), String.valueOf(value));
                }
            }
            result.put("extra", extraObject);
        }

        notifyListeners("tapTapComplianceResult", result);

        if (pendingStartupCall == null) {
            return;
        }

        if (code == ComplianceMessage.LOGIN_SUCCESS) {
            pendingStartupCall.resolve(result);
            pendingStartupCall = null;
            return;
        }

        if (isBlockingCode(code)) {
            pendingStartupCall.reject(getMessage(code));
            pendingStartupCall = null;
        }
    }

    private boolean isBlockingCode(int code) {
        return code == ComplianceMessage.EXITED
                || code == ComplianceMessage.SWITCH_ACCOUNT
                || code == ComplianceMessage.PERIOD_RESTRICT
                || code == ComplianceMessage.DURATION_LIMIT
                || code == ComplianceMessage.AGE_LIMIT
                || code == ComplianceMessage.INVALID_CLIENT_OR_NETWORK_ERROR
                || code == ComplianceMessage.REAL_NAME_STOP;
    }

    private String getMessage(int code) {
        switch (code) {
            case ComplianceMessage.LOGIN_SUCCESS:
                return "防沉迷认证通过";
            case ComplianceMessage.EXITED:
                return "已退出防沉迷认证";
            case ComplianceMessage.SWITCH_ACCOUNT:
                return "请切换账号后重新登录";
            case ComplianceMessage.PERIOD_RESTRICT:
                return "当前时段无法进入游戏";
            case ComplianceMessage.DURATION_LIMIT:
                return "今日可玩时长已用完";
            case ComplianceMessage.AGE_LIMIT:
                return "当前账号不满足适龄要求";
            case ComplianceMessage.INVALID_CLIENT_OR_NETWORK_ERROR:
                return "防沉迷认证失败，请检查网络或 TapTap 应用配置";
            case ComplianceMessage.REAL_NAME_STOP:
                return "实名流程已关闭，请完成实名后进入游戏";
            default:
                return "防沉迷状态变更";
        }
    }

    private String getErrorMessage(Throwable error) {
        String message = error == null ? "" : error.getMessage();
        return message == null || message.trim().isEmpty() ? "请检查 TapTap 应用配置" : message;
    }
}
