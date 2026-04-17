package com.ironvault.app;

import android.os.Bundle;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerPlugin(ScreenProtectionPlugin.class);

        // Enable edge-to-edge so the WebView fills the full screen including
        // status bar and navigation bar.  env(safe-area-inset-*) CSS variables
        // will then be populated correctly by the WebView.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    }
}
