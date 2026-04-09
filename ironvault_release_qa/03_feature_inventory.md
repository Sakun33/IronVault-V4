# Feature Inventory

| Route | Purpose | Dependencies | Admin Controls | Status |
|-------|---------|-------------|----------------|--------|
| / (login) | Vault unlock / create | IndexedDB, Supabase auth | — | untested |
| /dashboard | Overview widgets, quick actions | Vault unlocked | Customer data visible in admin | untested |
| /passwords | Password manager CRUD | Vault unlocked | — | untested |
| /notes | Secure notes CRUD | Vault unlocked | — | untested |
| /reminders | Date reminders CRUD | Vault unlocked | — | untested |
| /subscriptions | Subscription tracker CRUD | Vault unlocked, Pro plan | — | untested |
| /expenses | Expense tracker CRUD + CSV import | Vault unlocked, Pro plan | — | untested |
| /bank-statements | Bank statement tracker | Vault unlocked, Pro plan | — | untested |
| /investments | Investment tracker | Vault unlocked, Pro plan | — | untested |
| /goals | Goals tracker | Vault unlocked, Pro plan | — | untested |
| /documents | Document records CRUD | Vault unlocked, Pro plan | — | untested |
| /api-keys | API key manager CRUD | Vault unlocked, Pro plan | — | untested |
| /profile | User profile, change pw, delete account | Vault unlocked | Plan visible/editable in admin | untested |
| /settings | Themes, auto-lock, notifications | Vault unlocked | — | untested |
| /pricing | Plan comparison, upgrade | — | Plan management in admin | untested |
| /vaults | Multi-vault management | Vault unlocked | — | untested |
| /logging | Activity audit log | Vault unlocked | — | untested |
| /info/blog | Blog landing page | — | — | untested |
| /info/changelog | Changelog page | — | — | untested |
| /info/status | System status page | — | — | untested |
| Admin: / | Dashboard stats | admin auth | Customer counts, plan breakdown | untested |
| Admin: /customers | Customer list | admin auth | Plan changes, delete | untested |
| Admin: /tickets | Support tickets | admin auth | Respond, close | untested |
| Admin: /email | Email center / broadcasts | admin auth | Send emails | untested |
| Admin: /promotions | Promo code management | admin auth | CRUD codes | untested |
| Admin: /activity | Activity log | admin auth | Read-only | untested |
| Admin: /settings | System settings, email config | admin auth | Update settings | untested |
