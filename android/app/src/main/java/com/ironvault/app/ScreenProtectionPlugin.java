package com.ironvault.app;

import android.view.WindowManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ScreenProtection")
public class ScreenProtectionPlugin extends Plugin {

    @PluginMethod
    public void enable(PluginCall call) {
        try {
            getActivity().runOnUiThread(() -> {
                getActivity().getWindow().setFlags(
                    WindowManager.LayoutParams.FLAG_SECURE,
                    WindowManager.LayoutParams.FLAG_SECURE
                );
            });
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to enable screen protection: " + e.getMessage());
        }
    }

    @PluginMethod
    public void disable(PluginCall call) {
        try {
            getActivity().runOnUiThread(() -> {
                getActivity().getWindow().clearFlags(
                    WindowManager.LayoutParams.FLAG_SECURE
                );
            });
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to disable screen protection: " + e.getMessage());
        }
    }
}
