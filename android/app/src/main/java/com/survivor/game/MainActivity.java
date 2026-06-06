package com.survivor.game;

import android.os.Bundle;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;
import com.survivor.game.plugins.DirichletRewardAdPlugin;
import com.survivor.game.plugins.TapTapAuthPlugin;
import com.survivor.game.plugins.TapTapCompliancePlugin;
import com.survivor.game.plugins.TapTapUpdatePlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TapTapAuthPlugin.class);
        registerPlugin(TapTapCompliancePlugin.class);
        registerPlugin(TapTapUpdatePlugin.class);
        registerPlugin(DirichletRewardAdPlugin.class);
        super.onCreate(savedInstanceState);

        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat controller = new WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView());
        controller.hide(WindowInsetsCompat.Type.systemBars());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}
