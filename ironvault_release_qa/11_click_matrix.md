# IronVault Click Matrix

**Format:** page | element | action | viewport | result | pass/fail | bug id  
**Last updated:** 2026-04-08  
**Test account:** qa-pro@ironvault.app (pro plan)  
**Production URL:** https://www.ironvault.app

Legend: ✅ PASS | ❌ FAIL | ⚠️ PARTIAL | 🔄 PENDING

---

## 1 · Expenses

| Element | Action | Desktop | Mobile | Result | P/F | Bug |
|---------|--------|---------|--------|--------|-----|-----|
| Page load | Navigate to /expenses | ✅ | ✅ | Pro page renders, no UpgradeGate | ✅ | — |
| Add button (toolbar) | Click → modal opens | ✅ | ✅ | Dialog opens | ✅ | — |
| Add form: title input | Fill + submit | ✅ | ✅ | Record appears in list | ✅ | — |
| Add form: amount input | Fill numeric value | ✅ | ✅ | Saves correctly | ✅ | — |
| Add form: category combobox | Select option | ✅ | ✅ | Category applied | ✅ | — |
| Add form: Save/Add Expense btn | Click | ✅ | ✅ | Record created | ✅ | — |
| Templates button | Click → modal opens | ✅ | ✅ | Template modal renders | ✅ | — |
| Search input | Type query → filter | ✅ | ✅ | Results filter correctly | ✅ | — |
| Date filter: Week/Month/Year/All | Click each | ✅ | ✅ | List updates without crash | ✅ | — |
| Categories tab | Click | ✅ | ✅ | Chart renders | ✅ | — |
| Trends tab | Click | ✅ | ✅ | Tab renders without crash | ✅ | — |
| Delete expense | Click trash icon → confirm | ✅ | ✅ | Record removed | ✅ | — |
| Edit expense | Click edit → update title → save | ✅ | ✅ | Updated title shown | ✅ | — |
| Category filter dropdown | Select category | ✅ | ✅ | List filters by category | ✅ | — |
| Recurring toggle | Toggle on/off | ✅ | ✅ | Toggle responds without crash | ✅ | — |
| Export button | Click | ✅ | ✅ | Export triggered or DOM present | ✅ | — |
| Overview stats | View totals | ✅ | ✅ | Stats render with data | ✅ | — |

---

## 2 · Passwords

| Element | Action | Desktop | Mobile | Result | P/F | Bug |
|---------|--------|---------|--------|--------|-----|-----|
| Page load | Navigate to /passwords | ✅ | ✅ | Page renders with seeded data | ✅ | — |
| Search input | Type "Amazon" → filter | ✅ | ✅ | Results filter correctly | ✅ | — |
| Copy password button | Click → feedback | ✅ | ✅ | Copy feedback visible | ✅ | — |
| Show/hide password | Click eye icon | ✅ | ✅ | Password revealed/hidden | ✅ | — |
| Add password | Fill form + save | ✅ | ✅ | Record created | ✅ | — |
| Edit password | Click edit → update title → save | ✅ | ✅ | Updated title shown | ✅ | — |
| Delete password | Click delete → confirm | ✅ | ✅ | Record removed or count decreased | ✅ | — |
| Password generator | Click → modal opens | ✅ | ✅ | Generator opens | ✅ | — |
| Import passwords | Click → modal opens | ✅ | ✅ | Import modal renders | ✅ | — |
| Category filter | Select category | ✅ | ✅ | Filters without crash | ✅ | — |
| Sort options | Click sort if available | ✅ | ✅ | Sort applies without crash | ✅ | — |

---

## 3 · Notes

| Element | Action | Desktop | Mobile | Result | P/F | Bug |
|---------|--------|---------|--------|--------|-----|-----|
| Page load | Navigate to /notes | ✅ | ✅ | Page renders with seeded notes | ✅ | — |
| Add Note button | Click → modal opens | ✅ | ✅ | Add modal opens | ✅ | BUG-029 fixed |
| Add form: title input | Fill title | ✅ | ✅ | Title entered correctly | ✅ | — |
| Add form: body textarea | Fill body | ✅ | ✅ | Body text entered | ✅ | — |
| Add form: Save button | Click → note in list | ✅ | ✅ | Note appears in list | ✅ | — |
| Edit button | Click → update title → save | ✅ | ✅ | Updated title shown | ✅ | BUG-029 fixed |
| Delete button | Click → confirm → removed | ✅ | ✅ | Note removed from list | ✅ | BUG-029 fixed |
| Pin button | Click → pin state changes | ✅ | ✅ | Pin state toggles | ✅ | BUG-029 fixed |
| Search input | Type query → filter | ✅ | ✅ | Notes filter correctly | ✅ | — |
| Notebook filter | Select notebook | ✅ | ✅ | Filter applies without crash | ✅ | — |

---

## 4 · Reminders

| Element | Action | Desktop | Mobile | Result | P/F | Bug |
|---------|--------|---------|--------|--------|-----|-----|
| Page load | Navigate to /reminders | ✅ | ✅ | Page renders with seeded data | ✅ | — |
| Add reminder | Fill title + date → save | ✅ | ✅ | Reminder in list | ✅ | — |
| Mark complete | Click completion button | ✅ | ✅ | State changes | ✅ | — |
| Edit reminder | Click edit → update title → save | ✅ | ✅ | Updated title shown | ✅ | — |
| Delete reminder | Click delete → removed | ✅ | ✅ | Reminder removed | ✅ | — |
| Priority filter | Filter by High priority | ✅ | ✅ | List filters correctly | ✅ | — |

---

## 5 · Subscriptions

| Element | Action | Desktop | Mobile | Result | P/F | Bug |
|---------|--------|---------|--------|--------|-----|-----|
| Page load | Navigate to /subscriptions | ✅ | ✅ | Pro page renders | ✅ | — |
| Add button | Click → modal opens | ✅ | ✅ | Dialog opens | ✅ | — |
| Add form: service name | Fill | ✅ | ✅ | Saves correctly | ✅ | — |
| Add form: cost | Fill numeric | ✅ | ✅ | Saves correctly | ✅ | — |
| Add form: billing date | Pick from calendar | ✅ | ✅ | Date selected | ✅ | — |
| Add form: Save button | Click | ✅ | ✅ | Record created | ✅ | — |
| Search subscriptions | Type → filter | ✅ | ✅ | Results filter | ✅ | — |
| Delete subscription | Click → confirm | ✅ | ✅ | Record removed | ✅ | — |
| Edit subscription | Click edit → update → save | ✅ | ✅ | Updated name shown | ✅ | — |
| Category filter | Select | ✅ | ✅ | Filters without crash | ✅ | — |
| Overview stats | View totals | ✅ | ✅ | Stats render with data | ✅ | — |
| Upcoming renewals | View section | ✅ | ✅ | Renewals render | ✅ | — |

---

## 6 · Bank Statements

| Element | Action | Desktop | Mobile | Result | P/F | Bug |
|---------|--------|---------|--------|--------|-----|-----|
| Page load | Navigate to /bank-statements | ✅ | ✅ | Pro page renders | ✅ | — |
| Add Statement (icon) | Click → creates sample | ✅ | ✅ | Statement added | ✅ | — |
| Overview totals | View | ✅ | ✅ | Totals render | ✅ | — |
| Transactions tab | Click | ✅ | ✅ | Transaction list renders | ✅ | — |
| Categories tab | Click | ✅ | ✅ | Categories section renders | ✅ | — |
| Recurring tab | Click | ✅ | ✅ | Tab renders without crash | ✅ | — |
| Search transactions | Type | ✅ | ✅ | Filters without crash | ✅ | — |
| Delete statement | Click → confirm | ✅ | ✅ | Statement removed | ✅ | — |
| Export button | Click | ✅ | ✅ | Export triggered or DOM present | ✅ | — |
| Import CSV button | Click | ✅ | ✅ | Import button in DOM | ✅ | — |

---

## 7 · Investments / Goals

| Element | Action | Desktop | Mobile | Result | P/F | Bug |
|---------|--------|---------|--------|--------|-----|-----|
| Page load (/investments) | Navigate | ✅ | ✅ | Pro page renders | ✅ | — |
| Portfolio tab | Click | ✅ | ✅ | Value cards render | ✅ | — |
| Add Investment button | Click → custom overlay | ✅ | ✅ | Overlay renders | ✅ | — |
| Add investment form | Fill + save | ✅ | ✅ | Investment in list | ✅ | — |
| Edit investment | Click edit → update → save | ✅ | ✅ | Updated record shown | ✅ | — |
| Delete investment | Click delete → removed | ✅ | ✅ | Record removed | ✅ | — |
| Performance metrics | View section | ✅ | ✅ | Metrics render | ✅ | — |
| Page load (/goals) | Navigate | ✅ | ✅ | Pro page renders | ✅ | — |
| Goals tab | Click | ✅ | ✅ | Goals tab renders | ✅ | — |
| Add Goal button | Click → dialog | ✅ | ✅ | Dialog opens | ✅ | — |

---

## 8 · Documents

| Element | Action | Desktop | Mobile | Result | P/F | Bug |
|---------|--------|---------|--------|--------|-----|-----|
| Page load | Navigate to /documents | ✅ | ✅ | Pro page renders | ✅ | — |
| Upload Documents button | Click | ✅ | ✅ | In DOM | ✅ | — |
| New Folder button | Click → enter name → save | ✅ | ✅ | Folder appears in list | ✅ | — |
| Navigate into folder | Click folder | ✅ | ✅ | Folder contents view | ✅ | — |
| Back navigation | Click back | ✅ | ✅ | Returns to parent | ✅ | — |
| Search documents | Type query | ✅ | ✅ | Filters without crash | ✅ | — |
| Folder operations | Rename/delete folder | ✅ | ✅ | Operations work | ✅ | — |

---

## 9 · API Keys

| Element | Action | Desktop | Mobile | Result | P/F | Bug |
|---------|--------|---------|--------|--------|-----|-----|
| Page load | Navigate to /api-keys | ✅ | ✅ | Pro page renders with seeded data | ✅ | — |
| Add API Key button | Click → modal | ✅ | ✅ | Dialog opens | ✅ | — |
| Add form: fill + save | Submit | ✅ | ✅ | Record created | ✅ | — |
| Copy key | Click copy → feedback | ✅ | ✅ | Copy feedback visible | ✅ | — |
| Toggle visibility | Click eye → reveal/hide | ✅ | ✅ | Key revealed/hidden | ✅ | — |
| Edit API key | Click edit → update → save | ✅ | ✅ | Updated record shown | ✅ | — |
| Delete API key | Click → confirm | ✅ | ✅ | Record removed | ✅ | — |
| Filter keys | Select filter | ✅ | ✅ | Filters without crash | ✅ | — |

---

## 10 · Dashboard

| Element | Action | Desktop | Mobile | Result | P/F | Bug |
|---------|--------|---------|--------|--------|-----|-----|
| Page load | Navigate to / | ✅ | ✅ | Dashboard h1 renders | ✅ | — |
| Summary widgets | View | ✅ | ✅ | Widgets render with data | ✅ | — |
| Quick stats | View totals | ✅ | ✅ | Stats render | ✅ | — |
| Recent transactions | View section | ✅ | ✅ | Transactions listed | ✅ | — |
| Sidebar navigation | Click each nav item | ✅ | ✅ | Routes work | ✅ | — |
| Dark/light toggle | Toggle theme | ✅ | ✅ | Theme switches | ✅ | — |

---

## 11 · Profile

| Element | Action | Desktop | Mobile | Result | P/F | Bug |
|---------|--------|---------|--------|--------|-----|-----|
| Page load | Navigate to /profile | ✅ | ✅ | Page renders | ✅ | — |
| Overview tab | View name/email | ✅ | ✅ | User details displayed | ✅ | — |
| Plan tab | Click | ✅ | ✅ | Plan info renders | ✅ | — |
| Security tab | Click | ✅ | ✅ | Security section renders | ✅ | — |
| Support tab | Click | ✅ | ✅ | Support section renders | ✅ | — |
| Submit support ticket | Fill + submit | ✅ | ✅ | Success feedback shown | ✅ | — |

---

## 12 · Settings

| Element | Action | Desktop | Mobile | Result | P/F | Bug |
|---------|--------|---------|--------|--------|-----|-----|
| Page load | Navigate to /settings | ✅ | ✅ | Page renders | ✅ | — |
| Theme selector | Click different theme | ✅ | ✅ | Theme applies | ✅ | — |
| Currency selector | Change currency | ✅ | ✅ | Currency updates | ✅ | — |
| Auto-lock setting | Change value | ✅ | ✅ | Setting updates | ✅ | — |
| Backup button | Click | ✅ | ✅ | Backup triggered or modal | ✅ | — |
| Clear All Data | Click → React dialog | ✅ | ✅ | Confirmation dialog renders | ✅ | BUG-030 fixed |
| Notification toggles | View section | ✅ | ✅ | Toggles render | ✅ | — |

---

## 13 · Activity Log

| Element | Action | Desktop | Mobile | Result | P/F | Bug |
|---------|--------|---------|--------|--------|-----|-----|
| Page load | Navigate to /logging | ✅ | ✅ | Activity Logs heading renders | ✅ | — |
| Log entries | View from prior activity | ✅ | ✅ | Entries visible | ✅ | — |
| Filter logs | Select filter type | ✅ | ✅ | Filters without crash | ✅ | — |
| Clear logs button | Click | ✅ | ✅ | Confirmation dialog appears | ✅ | — |

---

## 14 · Pricing / Upgrade

| Element | Action | Desktop | Mobile | Result | P/F | Bug |
|---------|--------|---------|--------|--------|-----|-----|
| Page load | Navigate to /pricing | ✅ | ✅ | Pricing page renders | ✅ | — |
| Free plan card | View | ✅ | ✅ | Card visible | ✅ | — |
| Pro plan card | View price | ✅ | ✅ | Price shown | ✅ | — |
| Billing toggle | Click monthly/yearly | ✅ | ✅ | Prices update | ✅ | — |

---

## 15 · Vault Picker / Account Home

| Element | Action | Desktop | Mobile | Result | P/F | Bug |
|---------|--------|---------|--------|--------|-----|-----|
| Vault picker | Load with account session | ✅ | ✅ | Lists vaults for correct account | ✅ | BUG-015 fixed |
| Vault switcher dropdown | Click → open | ✅ | ✅ | Radix dropdown opens above content | ✅ | BUG-016 fixed |
| Create vault CTA | View when at limit | ✅ | ✅ | Upgrade prompt shown when at limit | ✅ | BUG-022 fixed |
| Cross-account isolation | Switch accounts | ✅ | ✅ | Each account sees only own vaults | ✅ | BUG-015 fixed |
| Logout button | Click | ✅ | ✅ | Returns to landing page | ✅ | — |

---

## 17 · Vault Management (/vaults)

| Element | Action | Desktop | Mobile | Result | P/F | Bug |
|---------|--------|---------|--------|--------|-----|-----|
| Page load | Navigate to /vaults | ✅ | ✅ | Vault Management heading renders | ✅ | — |
| Vault card | View existing vault | ✅ | ✅ | Default vault card renders | ✅ | — |
| New Vault button | Click | ✅ | ✅ | Button present or upgrade prompt | ✅ | — |
| Vault options menu | Click MoreVertical | ✅ | ✅ | Open/Rename/Delete menu items | ✅ | — |
| Biometric toggle | View | ✅ | ✅ | Toggle renders per vault | ✅ | — |
| Multi-vault info card | View bottom card | ✅ | ✅ | "About Multi-Vault" renders | ✅ | — |

---

## 18 · Global Search

| Element | Action | Desktop | Mobile | Result | P/F | Bug |
|---------|--------|---------|--------|--------|-----|-----|
| Search input | Visible in header | ✅ | ⚠️ | Desktop: visible; Mobile: hidden (individual pages have own search) | ✅ | — |
| Type query | Fill "amazon" | ✅ | ✅ | No crash, page stable | ✅ | — |
| Clear search | Fill then empty | ✅ | ✅ | Stable after clear | ✅ | — |

---

## 19 · Upgrade Route (/upgrade) + Account Home

| Element | Action | Desktop | Mobile | Result | P/F | Bug |
|---------|--------|---------|--------|--------|-----|-----|
| /upgrade route | Navigate | ✅ | ✅ | Pricing content renders | ✅ | — |
| Plan cards | View prices | ✅ | ✅ | Free/Pro/Lifetime present | ✅ | — |
| Vault switcher | Click in header | ✅ | ✅ | Dropdown responds without crash | ✅ | — |

---

## 20 · Profile Extended Tabs

| Element | Action | Desktop | Mobile | Result | P/F | Bug |
|---------|--------|---------|--------|--------|-----|-----|
| Vaults tab | Click | ✅ | ✅ | VaultManagementSection renders | ✅ | — |
| Subscription tab | Click | ✅ | ✅ | Pro/Lifetime plan details shown | ✅ | — |
| Data tab | Click | ✅ | ✅ | AES-256 encryption info renders | ✅ | — |
| All 6 tabs | Click each sequentially | ✅ | ✅ | All 6 tabs navigate without crash | ✅ | — |

---

## 16 · Admin Console (admin.ironvault.app)

| Element | Action | Desktop | Mobile | Result | P/F | Bug |
|---------|--------|---------|--------|--------|-----|-----|
| Login page | Navigate + login (token injection) | ✅ | — | Login works via API + localStorage | ✅ | — |
| Dashboard | Load stats page | ✅ | — | Stats/cards render | ✅ | — |
| Sidebar navigation | All links visible | ✅ | — | Customers/Support/Analytics links present | ✅ | — |
| Customer list | View with data | ✅ | — | 5 customers listed | ✅ | — |
| Customer search | Type email fragment | ✅ | — | Search filters list | ✅ | — |
| Customer filter | Select plan filter | ✅ | — | Combobox filters without crash | ✅ | — |
| Customer detail | Click row to view | ✅ | — | Navigates to detail page | ✅ | — |
| Customer create | Fill form and submit | ✅ | — | Form submits without crash | ✅ | — |
| Customer export CSV | Click export | ✅ | — | Export triggered | ✅ | — |
| Customer detail tabs | Click each tab | ✅ | — | Tabs render (overview/tickets/notes/comms) | ✅ | — |
| Edit customer | Change name and save | ✅ | — | Update persists | ✅ | — |
| Plan change in detail | Select plan dropdown | ✅ | — | Plan combobox responds | ✅ | — |
| Internal note | Add note and save | ✅ | — | Note textarea + save works | ✅ | — |
| Support tickets | Page loads | ✅ | — | Tickets page renders | ✅ | — |
| Ticket filter | Click status filter | ✅ | — | Filter responds | ✅ | — |
| Ticket detail | Click first ticket | ✅ | — | Detail view opens | ✅ | — |
| Plans page | Load plan cards | ✅ | — | Free/Pro/Lifetime cards visible | ✅ | — |
| Analytics page | Load charts/stats | ✅ | — | Page renders without crash | ✅ | — |
| Email Center | Page load | ✅ | — | Email templates/compose renders | ✅ | — |
| Notifications | Page load | ✅ | — | Notifications page renders | ✅ | — |
| Promotions | Page load | ✅ | — | Promotions page renders | ✅ | — |
| Activity Log | Page load + entries | ✅ | — | Log entries visible | ✅ | — |
| Settings | Page load | ✅ | — | Settings sections render | ✅ | — |

---

## Frontend ↔ Admin Connectivity

| Action | Frontend result | Admin result | P/F | Bug |
|--------|----------------|--------------|-----|-----|
| Admin API health check | — | 200 OK `{status:'ok'}` | ✅ | — |
| Admin login returns JWT | — | JWT token returned | ✅ | — |
| Customer list API | — | Returns 5 customers array | ✅ | — |
| Plan change via admin API (PUT /customers/:id) | Plan updated in DB | Updated plan_name returned | ✅ | — |
| Main app entitlement for pro account | Pro/Lifetime plan confirmed | — | ✅ | — |
| Support ticket from frontend → admin tickets API | Ticket submitted | Admin GET /tickets returns 200 | ✅ | — |
