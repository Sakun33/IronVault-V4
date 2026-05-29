package com.ironvault.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import java.util.concurrent.Executor;

/**
 * AutofillBiometricGate — thin wrapper around androidx.biometric so the
 * native picker activity can require Face Unlock / fingerprint before
 * revealing a credential, with a short cache so the user doesn't have
 * to authenticate twice in a row (matches the iOS 60s window).
 *
 * Falls back to device credentials (PIN / pattern / password) when no
 * biometric is enrolled.
 */
final class AutofillBiometricGate {

    private static final String TAG = "IronVaultAutofillGate";
    private static final String PREFS = "ironvault_autofill_biometric";
    private static final String KEY_LAST_APPROVAL = "last_approval_ms";
    private static final long CACHE_MS = 60_000L;

    interface Callback {
        void onSuccess();
        void onError(@NonNull String reason);
        void onCancelled();
    }

    private AutofillBiometricGate() {}

    /** True if the user authenticated within the last 60s. */
    static boolean isApprovalFresh(@NonNull Context ctx) {
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        long last = prefs.getLong(KEY_LAST_APPROVAL, 0L);
        if (last <= 0) return false;
        return System.currentTimeMillis() - last <= CACHE_MS;
    }

    static void markApproved(@NonNull Context ctx) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putLong(KEY_LAST_APPROVAL, System.currentTimeMillis())
                .apply();
    }

    static void resetApproval(@NonNull Context ctx) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .remove(KEY_LAST_APPROVAL)
                .apply();
    }

    /** Whether any auth method (biometric or device credential) is usable. */
    static boolean canAuthenticate(@NonNull Context ctx) {
        BiometricManager bm = BiometricManager.from(ctx);
        int allowed = BiometricManager.Authenticators.BIOMETRIC_WEAK
                | BiometricManager.Authenticators.DEVICE_CREDENTIAL;
        return bm.canAuthenticate(allowed) == BiometricManager.BIOMETRIC_SUCCESS;
    }

    /**
     * Run the system biometric prompt. The callback is dispatched on
     * the activity's main thread.
     */
    static void evaluate(@NonNull FragmentActivity activity, @NonNull Callback callback) {
        if (isApprovalFresh(activity)) {
            callback.onSuccess();
            return;
        }

        Executor executor = ContextCompat.getMainExecutor(activity);
        BiometricPrompt prompt = new BiometricPrompt(activity, executor,
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                        markApproved(activity);
                        callback.onSuccess();
                    }

                    @Override
                    public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                        switch (errorCode) {
                            case BiometricPrompt.ERROR_USER_CANCELED:
                            case BiometricPrompt.ERROR_NEGATIVE_BUTTON:
                            case BiometricPrompt.ERROR_CANCELED:
                                callback.onCancelled();
                                return;
                            default:
                                Log.w(TAG, "Auth error " + errorCode + ": " + errString);
                                callback.onError(errString.toString());
                        }
                    }

                    @Override
                    public void onAuthenticationFailed() {
                        // Single failed attempt — don't bail; system UI will allow retry.
                    }
                });

        BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                .setTitle("Unlock IronVault")
                .setSubtitle("Authenticate to autofill your saved credentials")
                .setAllowedAuthenticators(
                        BiometricManager.Authenticators.BIOMETRIC_WEAK
                                | BiometricManager.Authenticators.DEVICE_CREDENTIAL)
                .setConfirmationRequired(false)
                .build();
        prompt.authenticate(info);
    }
}
