package com.ironvault.app;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Screen protection (FLAG_SECURE) is intentionally disabled in this build.
 * Both enable() and disable() resolve as no-ops so any JavaScript caller
 * succeeds without changing window flags. The blank-screenshot UX caused
 * confusion during demos and screen-sharing; we will re-introduce this
 * behind a user-toggleable Settings switch in a later phase.
 */
@CapacitorPlugin(name = "ScreenProtection")
public class ScreenProtectionPlugin extends Plugin {

    @PluginMethod
    public void enable(PluginCall call) {
        call.resolve();
    }

    @PluginMethod
    public void disable(PluginCall call) {
        call.resolve();
    }
}
