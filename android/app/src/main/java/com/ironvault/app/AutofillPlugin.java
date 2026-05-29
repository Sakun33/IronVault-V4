package com.ironvault.app;

import android.content.Intent;
import android.content.SharedPreferences;
import android.service.autofill.Dataset;
import android.util.Log;
import android.view.autofill.AutofillManager;
import android.view.autofill.AutofillValue;
import android.widget.RemoteViews;

import androidx.annotation.NonNull;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * AutofillPlugin — Capacitor bridge for the Android Autofill Service.
 *
 * Two responsibilities:
 *
 *  1. Push the credential list from the unlocked vault into
 *     {@link AutofillCredentialStore} so the native service and picker
 *     activity can read it without re-prompting for the master password.
 *
 *  2. Handle the "user picked a credential inside the host app" flow
 *     (the existing flow that launches MainActivity in autofill mode).
 *
 * JS API:
 *   AutofillPlugin.publishCredentials({ credentials: [...] })
 *   AutofillPlugin.clearCredentials()
 *   AutofillPlugin.getAutofillRequest()      → existing
 *   AutofillPlugin.commitAutofill({ ... })   → existing
 *   AutofillPlugin.cancelAutofill()          → existing
 *   AutofillPlugin.getPendingSave()          → new: read save-request capture
 *   AutofillPlugin.clearPendingSave()        → new
 */
@CapacitorPlugin(name = "AutofillPlugin")
public class AutofillPlugin extends Plugin {

    private static final String TAG = "AutofillPlugin";

    // ──────────────────────────────────────────────────────────────────────────
    // Credential publishing
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Replace the entire credential mirror used by the autofill service.
     * Called by the host React app on:
     *   - vault unlock
     *   - vault sync push (after edits)
     *   - settings save (autofill enabled toggle)
     *
     * Payload:
     *   { credentials: [{ recordIdentifier, url, username, password }] }
     */
    @PluginMethod
    public void publishCredentials(PluginCall call) {
        JSArray credentialsArr = call.getArray("credentials");
        if (credentialsArr == null) {
            call.reject("credentials array required");
            return;
        }
        List<AutofillCredentialStore.Credential> creds = new ArrayList<>();
        for (int i = 0; i < credentialsArr.length(); i++) {
            try {
                JSONObject obj = credentialsArr.getJSONObject(i);
                String id = obj.optString("recordIdentifier", "");
                String url = obj.optString("url", "");
                String username = obj.optString("username", "");
                String password = obj.optString("password", "");
                if (id.isEmpty() || password.isEmpty() || username.isEmpty()) continue;
                creds.add(new AutofillCredentialStore.Credential(id, url, username, password));
            } catch (JSONException e) {
                Log.w(TAG, "skipping malformed credential", e);
            }
        }
        try {
            AutofillCredentialStore.publish(getContext(), creds);
            // A fresh publish invalidates any cached biometric approval
            // so the next pick re-prompts.
            AutofillBiometricGate.resetApproval(getContext());

            JSObject res = new JSObject();
            res.put("count", creds.size());
            call.resolve(res);
        } catch (Exception e) {
            Log.e(TAG, "publishCredentials failed", e);
            call.reject("Failed to publish credentials: " + e.getMessage());
        }
    }

    /** Wipe the credential mirror. Called on lock / logout. */
    @PluginMethod
    public void clearCredentials(PluginCall call) {
        try {
            AutofillCredentialStore.clear(getContext());
            AutofillBiometricGate.resetApproval(getContext());
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "clearCredentials failed", e);
            call.reject("Failed to clear credentials: " + e.getMessage());
        }
    }

    /** True if the native autofill service is currently the default provider. */
    @PluginMethod
    public void isAutofillEnabled(PluginCall call) {
        JSObject res = new JSObject();
        try {
            AutofillManager mgr = getContext().getSystemService(AutofillManager.class);
            boolean enabled = mgr != null
                    && mgr.isAutofillSupported()
                    && mgr.hasEnabledAutofillServices();
            res.put("enabled", enabled);
            res.put("supported", mgr != null && mgr.isAutofillSupported());
        } catch (Exception e) {
            res.put("enabled", false);
            res.put("supported", false);
        }
        call.resolve(res);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Existing autofill request flow (kept verbatim for backward compat)
    // ──────────────────────────────────────────────────────────────────────────

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

    @PluginMethod
    public void commitAutofill(PluginCall call) {
        String username = call.getString("username", "");
        String password = call.getString("password", "");
        if (username == null) username = "";
        if (password == null) password = "";

        SharedPreferences prefs = getContext().getSharedPreferences(
                IronVaultAutofillService.PREFS_NAME, android.content.Context.MODE_PRIVATE);
        prefs.edit()
                .putString(IronVaultAutofillService.KEY_FILL_USERNAME, username)
                .putString(IronVaultAutofillService.KEY_FILL_PASSWORD, password)
                .apply();

        try {
            RemoteViews presentation = new RemoteViews(
                    getContext().getPackageName(), android.R.layout.simple_list_item_1);
            presentation.setTextViewText(android.R.id.text1, "IronVault");

            Dataset.Builder builder = new Dataset.Builder(presentation);
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

    @PluginMethod
    public void cancelAutofill(PluginCall call) {
        getActivity().setResult(android.app.Activity.RESULT_CANCELED);
        getActivity().finish();
        call.resolve();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Save-request inbox
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Return any pending "user submitted a login form on $domain with these
     * credentials" capture from the AutofillService. The host app prompts
     * the user to add it to their vault, then calls clearPendingSave.
     */
    @PluginMethod
    public void getPendingSave(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(
                IronVaultAutofillService.PREFS_NAME, android.content.Context.MODE_PRIVATE);

        String domain = prefs.getString("save_pending_domain", "");
        String pkg = prefs.getString("save_pending_package", "");
        String username = prefs.getString("save_pending_username", "");
        String password = prefs.getString("save_pending_password", "");

        JSObject result = new JSObject();
        boolean hasPending = password != null && !password.isEmpty();
        result.put("hasPending", hasPending);
        if (hasPending) {
            result.put("webDomain", domain == null ? "" : domain);
            result.put("packageName", pkg == null ? "" : pkg);
            result.put("username", username == null ? "" : username);
            result.put("password", password);
        }
        call.resolve(result);
    }

    @PluginMethod
    public void clearPendingSave(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(
                IronVaultAutofillService.PREFS_NAME, android.content.Context.MODE_PRIVATE);
        prefs.edit()
                .remove("save_pending_domain")
                .remove("save_pending_package")
                .remove("save_pending_username")
                .remove("save_pending_password")
                .apply();
        call.resolve();
    }
}
