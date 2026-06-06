package com.survivor.game;

import android.content.Context;
import android.util.Log;

import com.taptap.sdk.compliance.option.TapTapComplianceOptions;
import com.taptap.sdk.core.TapTapRegion;
import com.taptap.sdk.core.TapTapSdk;
import com.taptap.sdk.core.TapTapSdkOptions;

import java.util.concurrent.atomic.AtomicBoolean;

public final class TapTapSdkInitializer {
    private static final String TAG = "TapTapSdkInitializer";
    private static final AtomicBoolean INITIALIZED = new AtomicBoolean(false);

    private TapTapSdkInitializer() {
    }

    public static void ensureInitialized(Context context) {
        if (context == null || !INITIALIZED.compareAndSet(false, true)) {
            return;
        }

        try {
            TapTapSdkOptions options = new TapTapSdkOptions(
                    BuildConfig.TAPTAP_CLIENT_ID,
                    BuildConfig.TAPTAP_CLIENT_TOKEN,
                    TapTapRegion.CN
            );
            TapTapComplianceOptions complianceOptions = new TapTapComplianceOptions(true, false);
            TapTapSdk.init(context.getApplicationContext(), options, complianceOptions);
            Log.i(TAG, "TapTap SDK initialized.");
        } catch (Throwable error) {
            INITIALIZED.set(false);
            Log.e(TAG, "TapTap SDK init failed.", error);
            throw error;
        }
    }
}
