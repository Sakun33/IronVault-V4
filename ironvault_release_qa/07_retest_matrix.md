# Retest Matrix

| bug_id | fix_claimed | retest_steps | result | regression_impact | pass_fail | timestamp |
|--------|-------------|--------------|--------|-------------------|-----------|-----------|
| BUG-001 | App.tsx sidebar split: scrollable primary nav + pinned bottom section (Profile/Activity Logs/Settings/Upgrade) | 1. Unlock vault at 1190x736 viewport 2. Observe sidebar without scrolling | Profile, Activity Logs, Settings, Upgrade to Pro all visible at bottom of sidebar without scroll | 73/73 e2e pass | PASS | 2026-04-07 |
| BUG-002 | App.tsx: capture location from useLocation(); add conditional `bg-accent font-semibold` active class to nav buttons | 1. Unlock vault 2. Land on Dashboard 3. Observe sidebar | Dashboard item highlighted with distinct active background | 73/73 e2e pass | PASS | 2026-04-07 |
| BUG-003 | App.tsx: PUBLIC_PATHS array + public-only Switch branch for unauthenticated users | 1. Open incognito / clear vault state 2. Navigate to /privacy 3. Navigate to /terms | Both pages render without requiring vault unlock | 73/73 e2e pass | PASS | 2026-04-07 |
| BUG-005 | index.html title; Layout.tsx header text; backend email subject | 1. Open admin.ironvault.app 2. Check browser tab title 3. Check sidebar header | Tab: "IronVault Admin Console"; Sidebar: "IronVault Admin" | Admin console independent deploy | PASS | 2026-04-07 |
| BUG-007 | Backend: flat `total` field added alongside pagination; Frontend: `??` chaining to accept both shapes | 1. Log into admin console 2. Go to Customers tab 3. Check list header | Customer List (N total) matches visible row count | Admin console independent deploy | PASS | 2026-04-07 |
| BUG-008 | admin-data.json: plan_name + subscription_plan set to "Lifetime"; total_spent set to 299 | 1. Log into admin console 2. Go to Customers 3. Find saketsuman33@gmail.com 4. Check Plan column | Plan shows "Lifetime" | Admin console independent deploy | PASS | 2026-04-07 |
