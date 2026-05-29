package com.ironvault.app;

import android.content.Context;
import android.os.Build;
import android.service.autofill.Dataset;
import android.service.autofill.Field;
import android.service.autofill.Presentations;
import android.service.autofill.SaveInfo;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.view.View;
import android.view.autofill.AutofillId;
import android.view.autofill.AutofillValue;
import android.widget.RemoteViews;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import java.util.List;

/**
 * AutofillDataset — small toolkit of helpers for building the dataset
 * presentations and saved-credential SaveInfo objects we hand back to
 * Android's framework autofill API.
 *
 * Centralised here so the service and the picker activity share one set
 * of presentation styles and AutofillId wiring.
 */
final class AutofillDataset {

    private AutofillDataset() {}

    /**
     * Build the row that appears inside the keyboard-anchored autofill
     * dropdown.
     *
     *  ┌───────────────────────────────┐
     *  │  🔐 IronVault — username       │  ← label
     *  │     example.com                │  ← subtext
     *  └───────────────────────────────┘
     */
    @NonNull
    static RemoteViews buildPresentation(@NonNull Context ctx,
                                         @NonNull String label,
                                         @Nullable String subtext) {
        RemoteViews views = new RemoteViews(ctx.getPackageName(), R.layout.autofill_remote_item);
        views.setTextViewText(R.id.autofill_remote_label, label);
        if (subtext != null && !subtext.isEmpty()) {
            views.setTextViewText(R.id.autofill_remote_sub, subtext);
            views.setViewVisibility(R.id.autofill_remote_sub, View.VISIBLE);
        } else {
            views.setViewVisibility(R.id.autofill_remote_sub, View.GONE);
        }
        return views;
    }

    /**
     * "Unlock IronVault to autofill" — shown as the auth-required row.
     */
    @NonNull
    static RemoteViews buildAuthPresentation(@NonNull Context ctx) {
        SpannableString brand = new SpannableString("IronVault");
        brand.setSpan(new ForegroundColorSpan(0xFF35C7D9), 0, brand.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        return buildPresentation(ctx, "🔐 Unlock IronVault to autofill", null);
    }

    /**
     * Build a dataset that fills the resolved username/password into the
     * page once the user has picked it.
     */
    @NonNull
    @SuppressWarnings("deprecation")
    static Dataset buildFilledDataset(@NonNull Context ctx,
                                      @Nullable AutofillId usernameId,
                                      @Nullable AutofillId passwordId,
                                      @NonNull String username,
                                      @NonNull String password,
                                      @NonNull RemoteViews presentation) {
        Dataset.Builder builder;
        if (Build.VERSION.SDK_INT >= 33) {
            Presentations.Builder presBuilder = new Presentations.Builder()
                    .setMenuPresentation(presentation);
            builder = new Dataset.Builder(presBuilder.build());
            if (usernameId != null) {
                builder.setField(usernameId, new Field.Builder()
                        .setValue(AutofillValue.forText(username))
                        .build());
            }
            if (passwordId != null) {
                builder.setField(passwordId, new Field.Builder()
                        .setValue(AutofillValue.forText(password))
                        .build());
            }
        } else {
            builder = new Dataset.Builder(presentation);
            if (usernameId != null) {
                builder.setValue(usernameId, AutofillValue.forText(username), presentation);
            }
            if (passwordId != null) {
                builder.setValue(passwordId, AutofillValue.forText(password), presentation);
            }
        }
        return builder.build();
    }

    /**
     * Build the SaveInfo describing which fields Android should prompt
     * to save back into our vault.
     */
    @Nullable
    static SaveInfo buildSaveInfo(@NonNull List<AutofillId> ids) {
        if (ids.isEmpty()) return null;
        return new SaveInfo.Builder(
                SaveInfo.SAVE_DATA_TYPE_PASSWORD,
                ids.toArray(new AutofillId[0])
        ).build();
    }
}
