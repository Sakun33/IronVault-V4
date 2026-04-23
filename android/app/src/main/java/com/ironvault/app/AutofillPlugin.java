package com.ironvault.app;

import android.content.Intent;
import android.content.SharedPreferences;
import android.service.autofill.Dataset;
import android.util.Log;
import android.view.autofill.AutofillManager;
import android.view.autofill.AutofillValue;
import android.widget.RemoteViews;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * AutofillPlugin — Capacitor bridge for the Android Autofill Service.
 *
 * JS API:
 *
 *   AutofillPlugin.getAutofillRequest()
 *     → { isAutofillRequest: boolean, packageName: string, webDomain: string }
 *
 *   AutofillPlugin.commitAutofill({ username: string, password: string })
 *     → commits the selected credential back to the waiting AutofillService.
 *
 *   AutofillPlugin.cancelAutofill()
 *     → signals that the user cancelled the credential picker.
 */
@CapacitorPlugin(name = "AutofillPlugin")
public class AutofillPlugin extends Plugin {

    private static final String TAG = "AutofillPlugin";

    /**
     * Returns the pending autofill request metadata (if any).
     * The JS layer calls this on app start to detect autofill mode.
     */
    @PluginMethod
    public void getAutofillRequest(PluginCall call) {
        Intent intent = getActivity().getIntent();
        boolean isAutofill = intent != null
                && intent.getBooleanExtra(IronVaultAutofillService.EXTRA_AUTOFILL_REQUEST, false);

        JSObject result = new JSObject();
        result.put("isAutofillRequest", isAutofill);

        if (isAutofill) {
            String pkg = intent.getStringExtra(IronVaultAutofillService.KEY_PACKAGE);
            String domain = intent.getStringExtra(IronVaultAutofillService.KEY_DOMAIN);
            result.put("packageName", pkg != null ? pkg : "");
            result.put("webDomain", domain != null ? domain : "");
            Log.d(TAG, "Autofill request: pkg=" + pkg + " domain=" + domain);
        }

        call.resolve(result);
    }

    /**
     * Called by JS after the user selects a credential.
     * Stores the credential and signals success back to the AutofillService
     * via setResult so Android can deliver the fill.
     */
    @PluginMethod
    public void commitAutofill(PluginCall call) {
        String username = call.getString("username", "");
        String password = call.getString("password", "");

        if (username == null) username = "";
        if (password == null) password = "";

        // Store in SharedPreferences so the service can read it
        SharedPreferences prefs = getContext().getSharedPreferences(
                IronVaultAutofillService.PREFS_NAME, android.content.Context.MODE_PRIVATE);
        prefs.edit()
                .putString(IronVaultAutofillService.KEY_FILL_USERNAME, username)
                .putString(IronVaultAutofillService.KEY_FILL_PASSWORD, password)
                .apply();

        // Build a Dataset result to return via the authentication flow
        try {
            RemoteViews presentation = new RemoteViews(
                    getContext().getPackageName(), android.R.layout.simple_list_item_1);
            presentation.setTextViewText(android.R.id.text1, "IronVault");

            Dataset.Builder builder = new Dataset.Builder(presentation);

            // Retrieve the autofill IDs stored in prefs if available
            // (In production, pass them through the intent extras for precise filling)
            // For now we rely on the system matching by autofill hints / input type

            Dataset dataset = builder.build();

            Intent replyIntent = new Intent();
            replyIntent.putExtra(AutofillManager.EXTRA_AUTHENTICATION_RESULT, dataset);

            getActivity().setResult(android.app.Activity.RESULT_OK, replyIntent);
            getActivity().finish();

            Log.d(TAG, "Autofill committed for username=" + username);
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "commitAutofill failed", e);
            call.reject("Failed to commit autofill: " + e.getMessage());
        }
    }

    /**
     * Called when the user cancels the credential picker.
     */
    @PluginMethod
    public void cancelAutofill(PluginCall call) {
        getActivity().setResult(android.app.Activity.RESULT_CANCELED);
        getActivity().finish();
        call.resolve();
    }
}
