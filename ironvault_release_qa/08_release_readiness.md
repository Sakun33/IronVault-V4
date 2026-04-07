# Release Readiness Checklist

| Area | Check | Status | Notes |
|------|-------|--------|-------|
| Auth | Unlock/create/lock works | GREEN | e2e tests pass |
| Auth | Wrong password rejected | GREEN | e2e tests pass |
| Auth | Session persists on refresh | GREEN | e2e tests pass |
| Data Safety | Vault data encrypted in IndexedDB | GREEN | e2e tests pass |
| Data Safety | No plain-text secrets in localStorage | UNTESTED | |
| Export/Import | JSON export works | GREEN | e2e tests pass |
| Export/Import | JSON import works | GREEN | e2e tests pass |
| Backup/Restore | Backup creates valid file | GREEN | e2e tests pass |
| Backup/Restore | Restore from backup works | GREEN | e2e tests pass |
| Passwords | Full CRUD works | GREEN | e2e tests pass |
| Notes | Full CRUD works | GREEN | e2e tests pass |
| Reminders | Full CRUD works | GREEN | e2e tests pass |
| Subscriptions | Full CRUD works | GREEN | e2e tests pass (pro-gated) |
| Expenses | Full CRUD + CSV import | GREEN | e2e tests pass |
| Bank Statements | Full CRUD works | UNTESTED | |
| Investments/Goals | Full CRUD works | UNTESTED | |
| Documents | Full CRUD works | UNTESTED | |
| API Keys | Full CRUD works | UNTESTED | |
| Profile | Opens, edits save | GREEN | BUG-001 FIXED — sidebar nav now accessible |
| Settings | Theme switcher works on all platforms | UNTESTED | KNOWN PARITY BUG on Android |
| Pricing | All 4 plans display correctly | GREEN | e2e tests pass |
| Pricing | Free limits enforced | GREEN | e2e tests pass |
| Pricing | Pro-gated routes gated | GREEN | e2e tests pass |
| Admin | Login works | GREEN | Verified via Chrome MCP |
| Admin | Customer list visible | GREEN | BUG-007 FIXED |
| Admin | Plan display correct (Lifetime/Free/Pro) | GREEN | BUG-008 FIXED — saketsuman33 shows Lifetime |
| Admin | Plan changes sync to frontend | UNTESTED | |
| Admin↔Frontend | User visible after creation | UNTESTED | |
| Mobile UX | No horizontal overflow at 390px | YELLOW | Code audit: overflow-x-hidden on mobile main; grid-cols-1/2 responsive layouts; no fixed wide elements found. Visual 390px test blocked by browser resize limits. |
| Mobile UX | Bottom content not hidden | GREEN | Code confirms `pb-[calc(96px+env(safe-area-inset-bottom))]` padding on mobile main content. Mobile bottom nav visible in DOM at all viewports. |
| Mobile UX | Touch targets ≥ 44px | UNTESTED | |
| Notifications | Push/local notifications | UNTESTED | needs keys |
| Payment | Stripe/RevenueCat integration | UNTESTED | needs keys |
| Privacy | Privacy policy link present | GREEN | BUG-003 FIXED — /privacy renders without auth |
| Privacy | Terms of service link present | GREEN | BUG-003 FIXED — /terms renders without auth |
| Privacy | Account deletion path exists | UNTESTED | |
| Performance | Dashboard loads < 3s | UNTESTED | |
| Crash Resistance | Error boundary catches JS errors | UNTESTED | |
| Landing Page | Renders correctly | GREEN | BUG-004 FIXED — marketing landing page at / with hero, pricing, FAQ, footer |
| Store Submission | App icon, splash screen | UNTESTED | |
| Store Submission | No console errors on first load | UNTESTED | |
| Store Submission | HTTPS only | GREEN | Verified (https://www.ironvault.app) |
| Branding | Admin console IronVault branding | GREEN | BUG-005 FIXED |
| Navigation | Sidebar active state shows current route | GREEN | BUG-002 FIXED |
| Navigation | All bottom nav items accessible | GREEN | BUG-001 FIXED |
