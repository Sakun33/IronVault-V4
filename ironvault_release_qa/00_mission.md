# IronVault QA Mission

## Objective
Drive IronVault to a near-defect-free state for release on Google Play Store and Apple App Store.

## Environments
| Env | URL | Credentials |
|-----|-----|-------------|
| Frontend (prod) | https://www.ironvault.app | vault pw: 12121212, email: saketsuman33+test@gmail.com |
| Admin Console | https://admin.ironvault.app (TBD — may be local only) | admin / admin123 |
| Admin (local) | http://localhost:5174 (frontend) + http://localhost:3001 (backend) | admin / admin123 |
| Local dev | http://localhost:5001 | same vault pw |

## Scope
- Full frontend: auth, dashboard, all vault modules, settings, profile, pricing, info pages
- Admin console: all admin pages and operations
- Frontend ↔ Admin connectivity
- Mobile readiness: iOS (Safari), Android (Chrome), PWA signals, responsive layout
- Security basics: session handling, brute force, data exposure
- Store-submission readiness: privacy, terms, account deletion, subscription disclosures

## Definition of Done
- No unresolved Critical defects
- No unresolved High defects without explicit owner approval
- All core flows pass (auth, CRUD on all modules, import/export/backup)
- Frontend ↔ Admin sync verified
- Release readiness checklist substantially green
- Final reports complete

## Release Criteria
1. Auth: unlock/create/lock work reliably
2. CRUD: all vault modules functional (passwords, notes, reminders, subscriptions, expenses, bank statements, investments, goals, documents, API keys)
3. Export/Import: JSON export and re-import verified
4. Backup/Restore: verified
5. Pricing page: plans display correctly, upgrade flow reachable
6. Profile: opens, edits save
7. Settings: theme switcher, all options functional
8. Admin: customer list, plan management, tickets, broadcasts functional
9. Mobile: no layout breaks on 390px viewport (iPhone), no overflow
10. Security: no auth bypass, sessions expire correctly

## Known Starting Issues (to reproduce and fix)
- Profile section not opening
- Bottom content hidden / unable to scroll up
- Landing page not rendering as designed
- Feature parity gaps: theme option missing on Android emulator vs web
