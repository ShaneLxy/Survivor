package com.survivor.game.plugins;

import android.app.Activity;
import android.content.Context;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.survivor.game.BuildConfig;
import com.tapsdk.tapad.AdRequest;
import com.tapsdk.tapad.TapAdConfig;
import com.tapsdk.tapad.TapAdManager;
import com.tapsdk.tapad.TapAdNative;
import com.tapsdk.tapad.TapAdSdk;
import com.tapsdk.tapad.TapRewardVideoAd;

import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "DirichletRewardAd")
public class DirichletRewardAdPlugin extends Plugin {
    private static final AtomicBoolean SDK_INITIALIZED = new AtomicBoolean(false);

    @PluginMethod
    public void showRewardVideo(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Reward video requires an Android Activity.");
            return;
        }

        activity.runOnUiThread(() -> loadAndShowRewardVideo(activity, call));
    }

    private void loadAndShowRewardVideo(Activity activity, PluginCall call) {
        try {
            ensureSdkInitialized(activity.getApplicationContext());

            long spaceId = readLong(call, "spaceId", 0L);
            if (spaceId <= 0L) {
                call.reject("Reward video spaceId is invalid.");
                return;
            }

            AdRequest request = new AdRequest.Builder()
                    .withSpaceId(spaceId)
                    .withUserId(call.getString("userId", "guest"))
                    .withRewardName(call.getString("rewardName", "reward"))
                    .withRewardAmount(readInt(call, "rewardAmount", 1))
                    .withExtra1(call.getString("extra", ""))
                    .build();

            TapAdNative adNative = TapAdManager.get().createAdNative(activity);
            adNative.loadRewardVideoAd(request, new TapAdNative.RewardVideoAdListener() {
                private boolean resolved = false;

                @Override
                public void onRewardVideoAdLoad(TapRewardVideoAd ad) {
                    showAd(activity, call, adNative, ad);
                }

                @Override
                public void onRewardVideoCached(TapRewardVideoAd ad) {
                    showAd(activity, call, adNative, ad);
                }

                @Override
                public void onError(int code, String message) {
                    if (resolved) {
                        return;
                    }
                    resolved = true;
                    adNative.dispose();
                    call.reject(message == null || message.isEmpty()
                            ? "Reward video load failed: " + code
                            : message);
                }

                private void showAd(Activity showActivity, PluginCall pluginCall, TapAdNative nativeAd, TapRewardVideoAd ad) {
                    if (resolved || ad == null) {
                        return;
                    }
                    resolved = true;
                    ad.setRewardAdInteractionListener(new RewardInteractionListener(pluginCall, nativeAd, ad));
                    ad.showRewardVideoAd(showActivity);
                }
            });
        } catch (Throwable error) {
            call.reject("Reward video init failed: " + error.getMessage());
        }
    }

    private void ensureSdkInitialized(Context context) {
        if (!SDK_INITIALIZED.compareAndSet(false, true)) {
            return;
        }

        TapAdConfig config = new TapAdConfig.Builder()
                .withMediaId(BuildConfig.DIRICHLET_MEDIA_ID)
                .withMediaName(BuildConfig.DIRICHLET_MEDIA_NAME)
                .withMediaKey(BuildConfig.DIRICHLET_MEDIA_KEY)
                .enableDebug(BuildConfig.DEBUG)
                .build();
        TapAdSdk.init(context, config);
    }

    private long readLong(PluginCall call, String key, long fallback) {
        Object value = call.getData().opt(key);
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        try {
            return value == null ? fallback : Long.parseLong(String.valueOf(value));
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private int readInt(PluginCall call, String key, int fallback) {
        Object value = call.getData().opt(key);
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        try {
            return value == null ? fallback : Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private static class RewardInteractionListener implements TapRewardVideoAd.RewardAdInteractionListener {
        private final PluginCall call;
        private final TapAdNative adNative;
        private final TapRewardVideoAd ad;
        private boolean rewardVerified = false;
        private boolean completed = false;
        private boolean settled = false;
        private boolean cleanedUp = false;

        RewardInteractionListener(PluginCall call, TapAdNative adNative, TapRewardVideoAd ad) {
            this.call = call;
            this.adNative = adNative;
            this.ad = ad;
        }

        @Override
        public void onAdShow(TapRewardVideoAd ad) {
        }

        @Override
        public void onAdClose(TapRewardVideoAd ad) {
            resolveIfNeeded();
        }

        @Override
        public void onVideoComplete(TapRewardVideoAd ad) {
            completed = true;
        }

        @Override
        public void onVideoError(TapRewardVideoAd ad) {
            if (completed || rewardVerified) {
                resolveIfNeeded();
                return;
            }
            rejectIfNeeded("Reward video play failed.");
        }

        @Override
        public void onRewardVerify(TapRewardVideoAd ad, boolean rewardVerify, int rewardAmount, String rewardName, int code, String message) {
            rewardVerified = rewardVerify;
        }

        @Override
        public void onSkippedVideo(TapRewardVideoAd ad) {
            rewardVerified = false;
        }

        @Override
        public void onAdClick(TapRewardVideoAd ad) {
        }

        @Override
        public void onAdValidShow(TapRewardVideoAd ad) {
        }

        private void resolveIfNeeded() {
            if (settled) {
                return;
            }
            settled = true;
            boolean rewardGranted = rewardVerified || completed;
            JSObject result = new JSObject();
            result.put("rewardVerify", rewardVerified);
            result.put("videoComplete", completed);
            result.put("rewardGranted", rewardGranted);
            result.put("message", rewardGranted ? "Reward video completed." : "Reward video was not completed.");
            cleanup();
            call.resolve(result);
        }

        private void rejectIfNeeded(String message) {
            if (settled) {
                return;
            }
            settled = true;
            cleanup();
            call.reject(message);
        }

        private void cleanup() {
            if (cleanedUp) {
                return;
            }
            cleanedUp = true;
            ad.dispose();
            adNative.dispose();
        }
    }
}
