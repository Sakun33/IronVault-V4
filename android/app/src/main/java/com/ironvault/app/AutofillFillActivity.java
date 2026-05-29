package com.ironvault.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.os.Parcel;
import android.os.Parcelable;
import android.service.autofill.Dataset;
import android.text.Editable;
import android.text.TextWatcher;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.autofill.AutofillId;
import android.view.autofill.AutofillManager;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.RemoteViews;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.FragmentActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * AutofillFillActivity — IronVault's native Android credential picker.
 *
 * Launched by {@link IronVaultAutofillService}'s authentication intent
 * when the user taps the "Fill with IronVault" row in the system
 * autofill dropdown. Flow:
 *
 *   1. Receive (usernameId, passwordId, webDomain, packageName) via
 *      intent extras.
 *   2. Run biometric prompt (Face Unlock / fingerprint / device PIN).
 *   3. Show matching credentials, search bar, IronVault branding.
 *   4. User taps a row → build Dataset → setResult(RESULT_OK) → finish.
 *
 * Cancel paths set RESULT_CANCELED so Android knows we declined.
 */
public final class AutofillFillActivity extends FragmentActivity {

    private static final String TAG = "IronVaultAutofillUI";

    static final String EXTRA_USERNAME_ID = "iv_username_id";
    static final String EXTRA_PASSWORD_ID = "iv_password_id";
    static final String EXTRA_WEB_DOMAIN = "iv_web_domain";
    static final String EXTRA_PACKAGE_NAME = "iv_package_name";

    @Nullable private AutofillId usernameId;
    @Nullable private AutofillId passwordId;
    private String webDomain = "";
    private String packageName = "";

    private CredentialAdapter adapter;
    private TextView emptyLabel;
    private TextView subtitleLabel;
    private List<AutofillCredentialStore.Credential> all = new ArrayList<>();
    private List<AutofillCredentialStore.Credential> suggested = new ArrayList<>();

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Intent intent = getIntent();
        if (intent != null) {
            usernameId = intent.getParcelableExtra(EXTRA_USERNAME_ID);
            passwordId = intent.getParcelableExtra(EXTRA_PASSWORD_ID);
            webDomain = intent.getStringExtra(EXTRA_WEB_DOMAIN);
            packageName = intent.getStringExtra(EXTRA_PACKAGE_NAME);
            if (webDomain == null) webDomain = "";
            if (packageName == null) packageName = "";
        }

        setContentView(R.layout.autofill_fill_activity);

        TextView title = findViewById(R.id.autofill_title);
        subtitleLabel = findViewById(R.id.autofill_subtitle);
        emptyLabel = findViewById(R.id.autofill_empty);
        EditText search = findViewById(R.id.autofill_search);
        RecyclerView list = findViewById(R.id.autofill_list);
        View cancel = findViewById(R.id.autofill_cancel);

        title.setText(R.string.autofill_pick_title);
        subtitleLabel.setText(buildSubtitle());

        adapter = new CredentialAdapter(c -> commit(c));
        list.setLayoutManager(new LinearLayoutManager(this));
        list.setAdapter(adapter);

        search.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override public void onTextChanged(CharSequence s, int start, int before, int count) {}
            @Override public void afterTextChanged(Editable s) {
                applyFilter(s == null ? "" : s.toString());
            }
        });

        cancel.setOnClickListener(v -> cancel());

        // Default cancel if back-pressed
        getOnBackPressedDispatcher().addCallback(this,
                new androidx.activity.OnBackPressedCallback(true) {
                    @Override
                    public void handleOnBackPressed() {
                        cancel();
                    }
                });

        // 1. Biometric, 2. then unlock the data
        AutofillBiometricGate.evaluate(this, new AutofillBiometricGate.Callback() {
            @Override public void onSuccess() {
                loadCredentials();
            }
            @Override public void onError(@NonNull String reason) {
                Log.w(TAG, "Biometric error: " + reason);
                cancel();
            }
            @Override public void onCancelled() {
                cancel();
            }
        });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Data
    // ──────────────────────────────────────────────────────────────────────────

    private void loadCredentials() {
        all = AutofillCredentialStore.loadAll(this);
        suggested = AutofillCredentialStore.matchingCredentials(this, webDomain, packageName);
        applyFilter("");
    }

    private void applyFilter(@NonNull String query) {
        String q = query.trim().toLowerCase(Locale.US);
        List<AutofillCredentialStore.Credential> rows = new ArrayList<>();

        if (q.isEmpty()) {
            rows.addAll(suggested);
            for (AutofillCredentialStore.Credential c : all) {
                if (!suggested.contains(c)) rows.add(c);
            }
        } else {
            for (AutofillCredentialStore.Credential c : all) {
                if (c.host().contains(q)
                        || c.username.toLowerCase(Locale.US).contains(q)
                        || c.url.toLowerCase(Locale.US).contains(q)) {
                    rows.add(c);
                }
            }
        }

        adapter.submit(rows, suggested);
        emptyLabel.setVisibility(rows.isEmpty() ? View.VISIBLE : View.GONE);
    }

    private String buildSubtitle() {
        String label = !webDomain.isEmpty()
                ? webDomain
                : (!packageName.isEmpty() ? packageName : "");
        if (label.isEmpty()) return getString(R.string.autofill_pick_subtitle_generic);
        return getString(R.string.autofill_pick_subtitle, label);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Result wiring
    // ──────────────────────────────────────────────────────────────────────────

    private void commit(@NonNull AutofillCredentialStore.Credential credential) {
        try {
            RemoteViews presentation = AutofillDataset.buildPresentation(
                    this,
                    credential.username.isEmpty() ? "IronVault" : credential.username,
                    credential.host()
            );
            Dataset dataset = AutofillDataset.buildFilledDataset(
                    this,
                    usernameId,
                    passwordId,
                    credential.username,
                    credential.password,
                    presentation
            );
            Intent result = new Intent();
            result.putExtra(AutofillManager.EXTRA_AUTHENTICATION_RESULT, dataset);
            setResult(Activity.RESULT_OK, result);
            finish();
        } catch (Exception e) {
            Log.e(TAG, "Failed to commit credential", e);
            cancel();
        }
    }

    private void cancel() {
        setResult(Activity.RESULT_CANCELED);
        finish();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Adapter
    // ──────────────────────────────────────────────────────────────────────────

    interface OnSelect {
        void onSelect(@NonNull AutofillCredentialStore.Credential credential);
    }

    static final class CredentialAdapter extends RecyclerView.Adapter<CredentialAdapter.VH> {
        private final OnSelect onSelect;
        private final List<AutofillCredentialStore.Credential> data = new ArrayList<>();
        private final List<AutofillCredentialStore.Credential> suggested = new ArrayList<>();

        CredentialAdapter(@NonNull OnSelect onSelect) { this.onSelect = onSelect; }

        void submit(@NonNull List<AutofillCredentialStore.Credential> rows,
                    @NonNull List<AutofillCredentialStore.Credential> suggestedRows) {
            data.clear();
            data.addAll(rows);
            suggested.clear();
            suggested.addAll(suggestedRows);
            notifyDataSetChanged();
        }

        @NonNull
        @Override
        public VH onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            View v = LayoutInflater.from(parent.getContext())
                    .inflate(R.layout.autofill_credential_item, parent, false);
            return new VH(v);
        }

        @Override
        public void onBindViewHolder(@NonNull VH holder, int position) {
            AutofillCredentialStore.Credential c = data.get(position);
            holder.avatar.setText(c.initial());
            holder.username.setText(c.username.isEmpty() ? "—" : c.username);
            holder.host.setText(c.host());
            holder.suggested.setVisibility(suggested.contains(c) ? View.VISIBLE : View.GONE);
            holder.itemView.setOnClickListener(v -> onSelect.onSelect(c));
        }

        @Override
        public int getItemCount() { return data.size(); }

        static final class VH extends RecyclerView.ViewHolder {
            final TextView avatar;
            final TextView username;
            final TextView host;
            final TextView suggested;

            VH(@NonNull View v) {
                super(v);
                avatar = v.findViewById(R.id.autofill_item_avatar);
                username = v.findViewById(R.id.autofill_item_username);
                host = v.findViewById(R.id.autofill_item_host);
                suggested = v.findViewById(R.id.autofill_item_suggested);
            }
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Convenience launcher for the service
    // ──────────────────────────────────────────────────────────────────────────

    @NonNull
    static Intent buildLaunchIntent(@NonNull Context ctx,
                                    @Nullable AutofillId usernameId,
                                    @Nullable AutofillId passwordId,
                                    @Nullable String webDomain,
                                    @Nullable String packageName) {
        Intent i = new Intent(ctx, AutofillFillActivity.class);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        if (usernameId != null) i.putExtra(EXTRA_USERNAME_ID, (Parcelable) usernameId);
        if (passwordId != null) i.putExtra(EXTRA_PASSWORD_ID, (Parcelable) passwordId);
        i.putExtra(EXTRA_WEB_DOMAIN, webDomain == null ? "" : webDomain);
        i.putExtra(EXTRA_PACKAGE_NAME, packageName == null ? "" : packageName);
        return i;
    }
}
