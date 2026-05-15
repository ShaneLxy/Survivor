package com.survivor.game.plugins;

import android.app.Activity;

import androidx.annotation.Nullable;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.taptap.sdk.kit.internal.callback.TapTapCallback;
import com.taptap.sdk.kit.internal.exception.TapTapException;
import com.taptap.sdk.login.Scopes;
import com.taptap.sdk.login.TapTapAccount;
import com.taptap.sdk.login.TapTapLogin;

import java.lang.reflect.Field;
import java.lang.reflect.Method;

@CapacitorPlugin(name = "TapTapAuth")
public class TapTapAuthPlugin extends Plugin {
    @PluginMethod
    public void login(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("TapTap login requires an Android activity.");
            return;
        }

        TapTapLogin.loginWithScopes(activity, new String[]{Scopes.SCOPE_PUBLIC_PROFILE}, new TapTapCallback<TapTapAccount>() {
            @Override
            public void onSuccess(TapTapAccount account) {
                JSObject result = new JSObject();
                putString(result, "openId", readString(account, "getOpenId", "openId"));
                putString(result, "unionId", readString(account, "getUnionId", "unionId"));
                putString(result, "nickname", readString(account, "getName", "name", "nickname"));
                putString(result, "avatar", readString(account, "getAvatar", "avatar"));

                Object accessToken = readObject(account, "getAccessToken", "accessToken");
                if (accessToken != null) {
                    JSObject token = new JSObject();
                    putString(token, "kid", readString(accessToken, "getKid", "kid"));
                    putString(token, "tokenType", readString(accessToken, "getTokenType", "tokenType"));
                    putString(token, "macKey", readString(accessToken, "getMacKey", "macKey"));
                    putString(token, "macAlgorithm", readString(accessToken, "getMacAlgorithm", "macAlgorithm"));
                    putString(token, "scopeSet", readString(accessToken, "getScopeSet", "scopeSet"));
                    result.put("accessToken", token);
                }

                call.resolve(result);
            }

            @Override
            public void onCancel() {
                call.reject("TapTap login was cancelled.");
            }

            @Override
            public void onFail(TapTapException throwable) {
                String message = throwable == null ? "TapTap login failed." : throwable.getMessage();
                call.reject(message == null ? "TapTap login failed." : message);
            }
        });
    }

    private void putString(JSObject object, String key, @Nullable String value) {
        if (value != null && !value.isEmpty()) {
            object.put(key, value);
        }
    }

    @Nullable
    private String readString(Object target, String... names) {
        Object value = readObject(target, names);
        return value == null ? null : String.valueOf(value);
    }

    @Nullable
    private Object readObject(Object target, String... names) {
        if (target == null) {
            return null;
        }

        Class<?> type = target.getClass();
        for (String name : names) {
            try {
                Method method = type.getMethod(name);
                Object value = method.invoke(target);
                if (value != null) {
                    return value;
                }
            } catch (Exception ignored) {
                // TapSDK has changed accessors across versions; fall through to fields.
            }

            try {
                Field field = type.getDeclaredField(name);
                field.setAccessible(true);
                Object value = field.get(target);
                if (value != null) {
                    return value;
                }
            } catch (Exception ignored) {
                // Try the next possible property name.
            }
        }

        return null;
    }
}
