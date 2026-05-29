package com.ironvault.app;

import android.app.PendingIntent;
import android.app.assist.AssistStructure;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.CancellationSignal;
import android.service.autofill.AutofillService;
import android.service.autofill.Dataset;
import android.service.autofill.FillCallback;
import android.service.autofill.FillContext;
import android.service.autofill.FillResponse;
import android.service.autofill.SaveCallback;
import android.service.autofill.SaveInfo;
import android.service.autofill.SaveRequest;
import android.text.InputType;
import android.util.Log;
import android.view.autofill.AutofillId;
import android.view.autofill.AutofillValue;
import android.widget.RemoteViews;

import androidx.annotation.NonNull;

import java.util.ArrayList;
import java.util.List;

/**
 * IronVaultAutofillService — system-wide Android Autofill provider.
 *
 * Flow:
 *   1. Android calls {@link #onFillRequest} when a login form is focused.
 *   2. We parse the {@link AssistStructure} for username/password fields
 *      (autofill hints first, then InputType, then a heuristic pass).
 *   3. We look up matching credentials in {@link AutofillCredentialStore}
 *      (an encrypted on-device mirror written by the host app).
 *   4. If the stored credentials are empty (vault locked, never synced),
 *      we return a single auth dataset pointing at IronVault so the user
 *      can unlock and pick.
 *   5. If we have matches, we return one inline dataset per credential
 *      with biometric-gated auth — tapping a row launches
 *      {@link AutofillFillActivity} which runs the prompt.
 *   6. We attach {@link SaveInfo} so Android offers to save new logins.
 */
public final class IronVaultAutofillService extends AutofillService {

    private static final String TAG = "IronVaultAutofill";
    static final String PREFS_NAME = "ironvault_autofill";
    static final String KEY_PACKAGE = "pending_package";
    static final String KEY_DOMAIN = "pending_domain";
    static final String KEY_FILL_USERNAME = "fill_username";
    static final String KEY_FILL_PASSWORD = "fill_password";
    static final String EXTRA_AUTOFILL_REQUEST = "iv_autofill_request";

    @Override
    public void onFillRequest(@NonNull android.service.autofill.FillRequest request,
                              @NonNull CancellationSignal cancellationSignal,
                              @NonNull FillCallback callback) {
        List<FillContext> contexts = request.getFillContexts();
        if (contexts.isEmpty()) {
            callback.onSuccess(null);
            return;
        }
        AssistStructure structure = contexts.get(contexts.size() - 1).getStructure();
        ParsedForm form = parseStructure(structure);

        if (form.usernameId == null && form.passwordId == null) {
            callback.onSuccess(null);
            return;
        }

        Log.d(TAG, "FillRequest pkg=" + form.packageName + " domain=" + form.webDomain
                + " user=" + (form.usernameId != null) + " pass=" + (form.passwordId != null));

        // Mirror the request to prefs so the existing AutofillPlugin
        // contract (`MainActivity` opens vault in autofill mode) still works.
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        prefs.edit()
                .putString(KEY_PACKAGE, form.packageName == null ? "" : form.packageName)
                .putString(KEY_DOMAIN, form.webDomain == null ? "" : form.webDomain)
                .remove(KEY_FILL_USERNAME)
                .remove(KEY_FILL_PASSWORD)
                .apply();

        List<AutofillCredentialStore.Credential> matches =
                AutofillCredentialStore.matchingCredentials(this, form.webDomain, form.packageName);

        FillResponse response = buildResponse(form, matches);
        callback.onSuccess(response);
    }

    @Override
    public void onSaveRequest(@NonNull SaveRequest request, @NonNull SaveCallback callback) {
        // We accept the save signal and surface the captured creds to the
        // host app via a known intent + extras. The React side reads these
        // and prompts the user to add the new entry into the vault on
        // next launch. Until then we acknowledge the save so Android
        // doesn't keep nagging.
        List<FillContext> ctxs = request.getFillContexts();
        if (!ctxs.isEmpty()) {
            ParsedForm form = parseStructure(ctxs.get(ctxs.size() - 1).getStructure());
            String username = readValue(form.usernameId, ctxs.get(ctxs.size() - 1).getStructure());
            String password = readValue(form.passwordId, ctxs.get(ctxs.size() - 1).getStructure());
            if (password != null && !password.isEmpty()) {
                getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit()
                        .putString("save_pending_domain", form.webDomain == null ? "" : form.webDomain)
                        .putString("save_pending_package", form.packageName == null ? "" : form.packageName)
                        .putString("save_pending_username", username == null ? "" : username)
                        .putString("save_pending_password", password)
                        .apply();
            }
        }
        callback.onSuccess();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Response building
    // ──────────────────────────────────────────────────────────────────────────

    private FillResponse buildResponse(@NonNull ParsedForm form,
                                       @NonNull List<AutofillCredentialStore.Credential> matches) {
        FillResponse.Builder responseBuilder = new FillResponse.Builder();

        // SaveInfo so Android offers to save new credentials.
        List<AutofillId> required = new ArrayList<>();
        if (form.usernameId != null) required.add(form.usernameId);
        if (form.passwordId != null) required.add(form.passwordId);
        SaveInfo saveInfo = AutofillDataset.buildSaveInfo(required);
        if (saveInfo != null) responseBuilder.setSaveInfo(saveInfo);

        if (matches.isEmpty()) {
            responseBuilder.addDataset(buildUnlockDataset(form));
            return responseBuilder.build();
        }

        // Up to 8 inline rows — anything beyond that the user can pick
        // from the full IronVault picker activity.
        int cap = Math.min(matches.size(), 8);
        for (int i = 0; i < cap; i++) {
            AutofillCredentialStore.Credential c = matches.get(i);
            responseBuilder.addDataset(buildCredentialDataset(form, c));
        }
        // Final row: "Show all in IronVault" — opens the full picker.
        responseBuilder.addDataset(buildOpenPickerDataset(form));
        return responseBuilder.build();
    }

    private Dataset buildCredentialDataset(@NonNull ParsedForm form,
                                           @NonNull AutofillCredentialStore.Credential cred) {
        RemoteViews presentation = AutofillDataset.buildPresentation(
                this,
                cred.username.isEmpty() ? cred.host() : cred.username,
                cred.host()
        );
        // Each row is authenticated independently: tapping it opens the
        // FillActivity which runs the biometric prompt and writes the
        // final dataset back to Android.
        Intent fillIntent = AutofillFillActivity.buildLaunchIntent(
                this, form.usernameId, form.passwordId, form.webDomain, form.packageName
        );
        fillIntent.putExtra("iv_record_identifier", cred.recordIdentifier);
        PendingIntent pi = PendingIntent.getActivity(
                this,
                cred.recordIdentifier.hashCode(),
                fillIntent,
                pendingIntentFlags()
        );

        Dataset.Builder builder = new Dataset.Builder(presentation)
                .setAuthentication(pi.getIntentSender());
        if (form.usernameId != null) {
            builder.setValue(form.usernameId, AutofillValue.forText(""), presentation);
        }
        if (form.passwordId != null) {
            builder.setValue(form.passwordId, AutofillValue.forText(""), presentation);
        }
        return builder.build();
    }

    /** Used when no credentials match — leads the user into the picker to unlock. */
    private Dataset buildUnlockDataset(@NonNull ParsedForm form) {
        RemoteViews presentation = AutofillDataset.buildPresentation(
                this, "Unlock IronVault to autofill", form.webDomain);

        Intent fillIntent = AutofillFillActivity.buildLaunchIntent(
                this, form.usernameId, form.passwordId, form.webDomain, form.packageName);
        PendingIntent pi = PendingIntent.getActivity(
                this, form.packageName != null ? form.packageName.hashCode() : 0,
                fillIntent, pendingIntentFlags());

        Dataset.Builder builder = new Dataset.Builder(presentation)
                .setAuthentication(pi.getIntentSender());
        if (form.usernameId != null) builder.setValue(form.usernameId, AutofillValue.forText(""), presentation);
        if (form.passwordId != null) builder.setValue(form.passwordId, AutofillValue.forText(""), presentation);
        return builder.build();
    }

    /** Trailing row that opens the full IronVault picker. */
    private Dataset buildOpenPickerDataset(@NonNull ParsedForm form) {
        RemoteViews presentation = AutofillDataset.buildPresentation(
                this, "Show all credentials", "IronVault");

        Intent fillIntent = AutofillFillActivity.buildLaunchIntent(
                this, form.usernameId, form.passwordId, form.webDomain, form.packageName);
        PendingIntent pi = PendingIntent.getActivity(
                this, ("picker:" + form.packageName).hashCode(),
                fillIntent, pendingIntentFlags());

        Dataset.Builder builder = new Dataset.Builder(presentation)
                .setAuthentication(pi.getIntentSender());
        if (form.usernameId != null) builder.setValue(form.usernameId, AutofillValue.forText(""), presentation);
        if (form.passwordId != null) builder.setValue(form.passwordId, AutofillValue.forText(""), presentation);
        return builder.build();
    }

    private int pendingIntentFlags() {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            flags |= PendingIntent.FLAG_MUTABLE;
        }
        return flags;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Structure parsing
    // ──────────────────────────────────────────────────────────────────────────

    static final class ParsedForm {
        AutofillId usernameId;
        AutofillId passwordId;
        String packageName = "";
        String webDomain = "";
    }

    private ParsedForm parseStructure(@NonNull AssistStructure structure) {
        ParsedForm form = new ParsedForm();
        int windowCount = structure.getWindowNodeCount();
        for (int i = 0; i < windowCount; i++) {
            AssistStructure.WindowNode window = structure.getWindowNodeAt(i);
            if (window.getTitle() != null) {
                form.packageName = window.getTitle().toString();
            }
            traverseNode(window.getRootViewNode(), form);
        }
        return form;
    }

    private void traverseNode(AssistStructure.ViewNode node, ParsedForm form) {
        if (node == null) return;

        String domain = node.getWebDomain();
        if (domain != null && !domain.isEmpty()) {
            form.webDomain = domain;
        }

        String[] hints = node.getAutofillHints();
        if (hints != null) {
            for (String hint : hints) {
                if (hint == null) continue;
                switch (hint.toLowerCase()) {
                    case "username":
                    case "email":
                    case "emailaddress":
                    case "phone":
                        if (form.usernameId == null) form.usernameId = node.getAutofillId();
                        break;
                    case "password":
                    case "current-password":
                    case "new-password":
                        if (form.passwordId == null) form.passwordId = node.getAutofillId();
                        break;
                    default: // ignore
                }
            }
        }

        int inputType = node.getInputType();
        int typeClass = inputType & InputType.TYPE_MASK_CLASS;
        int typeVariation = inputType & InputType.TYPE_MASK_VARIATION;

        if (typeClass == InputType.TYPE_CLASS_TEXT) {
            if (typeVariation == InputType.TYPE_TEXT_VARIATION_PASSWORD
                    || typeVariation == InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD
                    || typeVariation == InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD) {
                if (form.passwordId == null) form.passwordId = node.getAutofillId();
            } else if (typeVariation == InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
                    || typeVariation == InputType.TYPE_TEXT_VARIATION_WEB_EMAIL_ADDRESS) {
                if (form.usernameId == null) form.usernameId = node.getAutofillId();
            }
        }

        // Heuristic — look at hint / idEntry / contentDescription text
        if (form.usernameId == null) {
            String hint = node.getHint() == null ? "" : node.getHint().toString().toLowerCase();
            String idEntry = node.getIdEntry() == null ? "" : node.getIdEntry().toLowerCase();
            if (hint.contains("email") || hint.contains("user") || idEntry.contains("user") || idEntry.contains("email")) {
                form.usernameId = node.getAutofillId();
            }
        }

        for (int i = 0; i < node.getChildCount(); i++) {
            traverseNode(node.getChildAt(i), form);
        }
    }

    private String readValue(AutofillId target, AssistStructure structure) {
        if (target == null) return null;
        int windowCount = structure.getWindowNodeCount();
        for (int i = 0; i < windowCount; i++) {
            String v = findValue(target, structure.getWindowNodeAt(i).getRootViewNode());
            if (v != null) return v;
        }
        return null;
    }

    private String findValue(@NonNull AutofillId target, AssistStructure.ViewNode node) {
        if (node == null) return null;
        if (target.equals(node.getAutofillId())) {
            AutofillValue v = node.getAutofillValue();
            if (v != null && v.isText()) return v.getTextValue().toString();
            return null;
        }
        for (int i = 0; i < node.getChildCount(); i++) {
            String v = findValue(target, node.getChildAt(i));
            if (v != null) return v;
        }
        return null;
    }
}
