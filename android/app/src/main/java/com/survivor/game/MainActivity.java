package com.survivor.game;

import com.getcapacitor.BridgeActivity;
import com.survivor.game.plugins.DirichletRewardAdPlugin;
import com.survivor.game.plugins.TapTapAuthPlugin;
import com.taptap.sdk.core.TapTapRegion;
import com.taptap.sdk.core.TapTapSdk;
import com.taptap.sdk.core.TapTapSdkOptions;
import android.os.Bundle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TapTapAuthPlugin.class);
        registerPlugin(DirichletRewardAdPlugin.class);
        super.onCreate(savedInstanceState);
        initTapTapSdk();
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat controller = new WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView());
        controller.hide(WindowInsetsCompat.Type.systemBars());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }

    private void initTapTapSdk() {
        TapTapSdkOptions options = new TapTapSdkOptions(
                BuildConfig.TAPTAP_CLIENT_ID,
                BuildConfig.TAPTAP_CLIENT_TOKEN,
                TapTapRegion.CN
        );
        TapTapSdk.init(this, options);
    }
}
