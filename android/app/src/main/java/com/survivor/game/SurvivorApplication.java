package com.survivor.game;

import android.app.Application;
import android.util.Log;

public class SurvivorApplication extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        try {
            TapTapSdkInitializer.ensureInitialized(this);
        } catch (Throwable error) {
            Log.e("SurvivorApplication", "TapTap SDK init failed.", error);
        }
    }
}
