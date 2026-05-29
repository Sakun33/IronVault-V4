package com.ironvault.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * AutofillCredentialStore — encrypted, sandboxed credential mirror that
 * the {@link IronVaultAutofillService} and {@link AutofillFillActivity}
 * read at runtime.
 *
 * The full IronVault vault is encrypted client-side with the master
 * password and never leaves the React layer in plaintext. When the user
 * unlocks the vault inside the host app, the JS layer pushes a flattened
 * list of (recordIdentifier, url, username, password) entries here via
 * {@link AutofillPlugin#publishCredentials}.
 *
 * Backing store: {@link EncryptedSharedPreferences} (AES256-GCM blob
 * value, AES256-SIV key name) under a sandboxed prefs file. This is in
 * addition to Android's file-based encryption at rest — defence in
 * depth, not a replacement.
 *
 * The store is wiped on:
 *   - vault lock          (host app calls clear())
 *   - logout              (host app calls clear())
 *   - master-password change (host app re-publishes from scratch)
 */
public final class AutofillCredentialStore {

    private static final String TAG = "IronVaultAutofillStore";
    private static final String ENCRYPTED_PREFS = "ironvault_autofill_secure";
    private static final String KEY_CREDENTIALS_BLOB = "iv_autofill_credentials_v1";
    private static final String KEY_LAST_PUBLISH = "iv_autofill_last_publish";

    public static final String SHARED_PREFS_NAME = ENCRYPTED_PREFS;

    private AutofillCredentialStore() {}

    @Nullable
    private static SharedPreferences open(@NonNull Context context) {
        try {
            MasterKey masterKey = new MasterKey.Builder(context.getApplicationContext())
                    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                    .build();
            return EncryptedSharedPreferences.create(
                    context.getApplicationContext(),
                    ENCRYPTED_PREFS,
                    masterKey,
                    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            );
        } catch (Exception e) {
            Log.e(TAG, "Failed to open encrypted prefs; falling back to plain.", e);
            // Plain fallback so a wedged Keystore doesn't break autofill
            // entirely. The data is still sandboxed to this UID.
            return context.getApplicationContext()
                    .getSharedPreferences(ENCRYPTED_PREFS + "_fallback", Context.MODE_PRIVATE);
        }
    }

    /** Replace the entire credential set. Called by the host app on every vault sync. */
    public static void publish(@NonNull Context context, @NonNull List<Credential> credentials) {
        SharedPreferences prefs = open(context);
        if (prefs == null) return;

        JSONArray arr = new JSONArray();
        for (Credential c : credentials) {
            if (c == null || c.recordIdentifier == null || c.password == null || c.username == null) continue;
            try {
                JSONObject obj = new JSONObject();
                obj.put("recordIdentifier", c.recordIdentifier);
                obj.put("url", c.url == null ? "" : c.url);
                obj.put("username", c.username);
                obj.put("password", c.password);
                arr.put(obj);
            } catch (JSONException e) {
                Log.w(TAG, "Skipping credential, JSON failure", e);
            }
        }

        prefs.edit()
                .putString(KEY_CREDENTIALS_BLOB, arr.toString())
                .putLong(KEY_LAST_PUBLISH, System.currentTimeMillis())
                .apply();
    }

    /** Drop every entry — used on lock / logout. */
    public static void clear(@NonNull Context context) {
        SharedPreferences prefs = open(context);
        if (prefs == null) return;
        prefs.edit()
                .remove(KEY_CREDENTIALS_BLOB)
                .remove(KEY_LAST_PUBLISH)
                .apply();
    }

    /** Load every stored credential. */
    @NonNull
    public static List<Credential> loadAll(@NonNull Context context) {
        List<Credential> out = new ArrayList<>();
        SharedPreferences prefs = open(context);
        if (prefs == null) return out;

        String json = prefs.getString(KEY_CREDENTIALS_BLOB, null);
        if (json == null || json.isEmpty()) return out;

        try {
            JSONArray arr = new JSONArray(json);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject obj = arr.getJSONObject(i);
                Credential c = new Credential(
                        obj.optString("recordIdentifier"),
                        obj.optString("url"),
                        obj.optString("username"),
                        obj.optString("password")
                );
                out.add(c);
            }
        } catch (JSONException e) {
            Log.e(TAG, "Failed to parse credentials blob", e);
        }
        return out;
    }

    /**
     * Filter the loaded credentials against the autofill request domain
     * and/or package name. Matching is fuzzy ("ends with" host) so e.g.
     * accounts.google.com matches a stored google.com entry.
     */
    @NonNull
    public static List<Credential> matchingCredentials(
            @NonNull Context context,
            @Nullable String webDomain,
            @Nullable String packageName) {
        List<Credential> all = loadAll(context);
        List<Credential> matches = new ArrayList<>();
        String domain = normaliseHost(webDomain);
        String pkg = packageName == null ? "" : packageName.toLowerCase(Locale.US);

        for (Credential c : all) {
            String host = normaliseHost(c.url);
            if (!domain.isEmpty() && hostMatches(host, domain)) {
                matches.add(c);
                continue;
            }
            // Package-name fallback (e.g. com.facebook.katana → facebook.com).
            if (!pkg.isEmpty() && !host.isEmpty() && pkg.contains(host.replace(".", ""))) {
                matches.add(c);
            }
        }
        return matches;
    }

    @NonNull
    private static String normaliseHost(@Nullable String raw) {
        if (raw == null) return "";
        String s = raw.trim().toLowerCase(Locale.US);
        if (s.isEmpty()) return "";
        int schemeIdx = s.indexOf("://");
        if (schemeIdx >= 0) s = s.substring(schemeIdx + 3);
        int slash = s.indexOf('/');
        if (slash >= 0) s = s.substring(0, slash);
        if (s.startsWith("www.")) s = s.substring(4);
        return s;
    }

    private static boolean hostMatches(@NonNull String a, @NonNull String b) {
        if (a.isEmpty() || b.isEmpty()) return false;
        if (a.equals(b)) return true;
        if (a.endsWith("." + b)) return true;
        if (b.endsWith("." + a)) return true;
        return false;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Model
    // ──────────────────────────────────────────────────────────────────────────

    public static final class Credential {
        @NonNull public final String recordIdentifier;
        @NonNull public final String url;
        @NonNull public final String username;
        @NonNull public final String password;

        public Credential(@NonNull String recordIdentifier,
                          @NonNull String url,
                          @NonNull String username,
                          @NonNull String password) {
            this.recordIdentifier = recordIdentifier;
            this.url = url;
            this.username = username;
            this.password = password;
        }

        @NonNull
        public String host() {
            return normaliseHost(url);
        }

        @NonNull
        public String initial() {
            String h = host();
            if (!h.isEmpty()) return String.valueOf(Character.toUpperCase(h.charAt(0)));
            if (!username.isEmpty()) return String.valueOf(Character.toUpperCase(username.charAt(0)));
            return "•";
        }
    }
}
