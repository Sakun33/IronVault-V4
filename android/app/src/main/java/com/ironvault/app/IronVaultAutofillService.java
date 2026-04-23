package com.ironvault.app;

import android.app.PendingIntent;
import android.app.assist.AssistStructure;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.CancellationSignal;
import android.service.autofill.AutofillService;
import android.service.autofill.Dataset;
import android.service.autofill.FillCallback;
import android.service.autofill.FillContext;
import android.service.autofill.FillRequest;
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
 * IronVault Autofill Service
 *
 * Detects username/password fields in any app or browser and offers to fill
 * them with credentials from the IronVault password manager.
 *
 * Flow:
 * 1. Android calls onFillRequest when a login form is focused.
 * 2. Service parses AssistStructure to find username/password fields.
 * 3. Returns a Dataset with an authentication PendingIntent → MainActivity.
 * 4. User unlocks IronVault and selects a credential.
 * 5. MainActivity (via AutofillPlugin) calls setAutofillResult() which stores
 *    the selected credential in SharedPreferences.
 * 6. MainActivity calls setResult(RESULT_OK) so Android delivers the fill.
 */
public class IronVaultAutofillService extends AutofillService {

    private static final String TAG = "IronVaultAutofill";
    static final String PREFS_NAME = "ironvault_autofill";
    static final String KEY_PACKAGE = "pending_package";
    static final String KEY_DOMAIN = "pending_domain";
    static final String KEY_FILL_USERNAME = "fill_username";
    static final String KEY_FILL_PASSWORD = "fill_password";
    static final String EXTRA_AUTOFILL_REQUEST = "iv_autofill_request";

    @Override
    public void onFillRequest(@NonNull FillRequest request,
                              @NonNull CancellationSignal cancellationSignal,
                              @NonNull FillCallback callback) {
        List<FillContext> contexts = request.getFillContexts();
        AssistStructure structure = contexts.get(contexts.size() - 1).getStructure();

        ParsedForm form = parseStructure(structure);

        if (form.usernameId == null && form.passwordId == null) {
            callback.onSuccess(null);
            return;
        }

        Log.d(TAG, "Autofill request for pkg=" + form.packageName + " domain=" + form.webDomain);

        // Store the pending request so the app can display a relevant credential list
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        prefs.edit()
                .putString(KEY_PACKAGE, form.packageName)
                .putString(KEY_DOMAIN, form.webDomain)
                .remove(KEY_FILL_USERNAME)
                .remove(KEY_FILL_PASSWORD)
                .apply();

        // PendingIntent launches IronVault to authenticate + pick a credential
        Intent authIntent = new Intent(this, MainActivity.class);
        authIntent.putExtra(EXTRA_AUTOFILL_REQUEST, true);
        authIntent.putExtra(KEY_PACKAGE, form.packageName);
        authIntent.putExtra(KEY_DOMAIN, form.webDomain);
        authIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                form.packageName.hashCode(),
                authIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE
        );

        // Presentation shown in the autofill dropdown
        RemoteViews presentation = buildPresentation("Fill with IronVault");

        Dataset.Builder datasetBuilder = new Dataset.Builder(presentation)
                .setAuthentication(pendingIntent.getIntentSender());

        if (form.usernameId != null) {
            datasetBuilder.setValue(form.usernameId, AutofillValue.forText(""), presentation);
        }
        if (form.passwordId != null) {
            datasetBuilder.setValue(form.passwordId, AutofillValue.forText(""), presentation);
        }

        // Build save info so Android also offers to save new credentials
        SaveInfo.Builder saveInfoBuilder = new SaveInfo.Builder(SaveInfo.SAVE_DATA_TYPE_PASSWORD, new AutofillId[0]);
        List<AutofillId> requiredIds = new ArrayList<>();
        if (form.usernameId != null) requiredIds.add(form.usernameId);
        if (form.passwordId != null) requiredIds.add(form.passwordId);

        FillResponse.Builder responseBuilder = new FillResponse.Builder()
                .addDataset(datasetBuilder.build());

        if (!requiredIds.isEmpty()) {
            responseBuilder.setSaveInfo(
                    new SaveInfo.Builder(SaveInfo.SAVE_DATA_TYPE_PASSWORD,
                            requiredIds.toArray(new AutofillId[0]))
                            .build()
            );
        }

        callback.onSuccess(responseBuilder.build());
    }

    @Override
    public void onSaveRequest(@NonNull SaveRequest request, @NonNull SaveCallback callback) {
        // TODO: persist new/updated credentials back into the IronVault encrypted vault
        callback.onSuccess();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────────

    private RemoteViews buildPresentation(String text) {
        RemoteViews view = new RemoteViews(getPackageName(), android.R.layout.simple_list_item_1);
        view.setTextViewText(android.R.id.text1, text);
        return view;
    }

    private static class ParsedForm {
        AutofillId usernameId;
        AutofillId passwordId;
        String packageName = "";
        String webDomain = "";
    }

    private ParsedForm parseStructure(AssistStructure structure) {
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

        // Capture web domain if present
        String domain = node.getWebDomain();
        if (domain != null && !domain.isEmpty()) {
            form.webDomain = domain;
        }

        // Check autofill hints first (most reliable)
        String[] hints = node.getAutofillHints();
        if (hints != null) {
            for (String hint : hints) {
                switch (hint.toLowerCase()) {
                    case "username":
                    case "email":
                    case "emailaddress":
                        if (form.usernameId == null) form.usernameId = node.getAutofillId();
                        break;
                    case "password":
                    case "current-password":
                    case "new-password":
                        if (form.passwordId == null) form.passwordId = node.getAutofillId();
                        break;
                }
            }
        }

        // Fall back to InputType inspection
        int inputType = node.getInputType();
        int typeClass = inputType & InputType.TYPE_MASK_CLASS;
        int typeVariation = inputType & InputType.TYPE_MASK_VARIATION;

        if (typeClass == InputType.TYPE_CLASS_TEXT) {
            if (typeVariation == InputType.TYPE_TEXT_VARIATION_PASSWORD
                    || typeVariation == InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD
                    || typeVariation == InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD) {
                if (form.passwordId == null) {
                    form.passwordId = node.getAutofillId();
                }
            } else if (typeVariation == InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
                    || typeVariation == InputType.TYPE_TEXT_VARIATION_WEB_EMAIL_ADDRESS) {
                if (form.usernameId == null) {
                    form.usernameId = node.getAutofillId();
                }
            }
        }

        // Recurse
        for (int i = 0; i < node.getChildCount(); i++) {
            traverseNode(node.getChildAt(i), form);
        }
    }
}
