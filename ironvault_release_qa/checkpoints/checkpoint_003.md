# Checkpoint 003 — BUG-004 Fixed, All Bugs Resolved, QA Program Complete

**Timestamp**: 2026-04-07
**Phase**: QA Program Complete — GO state
**Previous checkpoint**: checkpoint_002.md

---

## What was accomplished

### BUG-004: Marketing Landing Page — FIXED

**Root cause**: Router returned `<Login />` for all unauthenticated routes. No marketing landing page existed for new visitors at `/`.

**Fix**: Merged Phase 2 landing page work from `claude/elegant-cohen` branch into `claude/fervent-mclaren`:

**Files added:**
- `client/src/pages/landing.tsx` — Full marketing landing page (hero, trust strip, features, security, pricing, FAQ, CTA band, footer)
- `client/src/pages/info/blog.tsx` — Blog placeholder page
- `client/src/pages/info/changelog.tsx` — Changelog with version history
- `client/src/pages/info/status.tsx` — Status page
- `client/public/robots.txt` — SEO robots.txt with AI crawler allowlist
- `client/public/sitemap.xml` — Sitemap for all 13 public URLs
- `package.json`: `framer-motion@^12.38.0` dependency added

**Files modified:**
- `client/src/App.tsx` — Router `!isUnlocked` branch now returns LandingPage at `/` plus all public info routes; catch-all also returns LandingPage
- `client/index.html` — Updated meta tags, Open Graph image, Organization schema JSON-LD

**Conflict resolution**: `App.tsx` had a merge conflict between BUG-003 fix (PUBLIC_PATHS approach) and the Phase 2 Router pattern. Resolved by taking Phase 2 pattern (superset: includes all public routes from BUG-003 fix plus the LandingPage at `/`).

**E2E test updates** (`tests/e2e/full-sweep.spec.ts`):
- Tests 1.1 and 1.2 now navigate to `/auth/login` instead of BASE_URL
- `unlockVault` helper navigates to `/auth/login` before vault UI interaction
- `navigate` helper detects landing page as re-login state and navigates to `/auth/login`

### Deployment
- `vercel --prod --yes --force` from worktree root
- Aliased to `www.ironvault.app`
- New deployment: `fervent-mclaren-lgz06wo41-saket-sumans-projects-1f5ede07.vercel.app`

### Live Verification
Visited `https://www.ironvault.app` in Chrome (logged-out session) — landing page renders with:
- Navigation: Features, Pricing, Security, FAQ, Download, Log in, Get started free ✓
- Hero: "Your passwords, finances, and secrets — vaulted." ✓
- Trust strip: 5 trust indicators ✓
- Features section ✓
- Security section (zero-knowledge, Argon2id, AES-256-GCM) ✓
- Pricing: Free / Pro / Family / Lifetime plans ✓
- FAQ accordion (8 questions) ✓
- CTA band ✓
- Footer with Company / Product / Resources / Support links ✓

### E2E Regression Test
**73/73 PASS** — no regressions

---

## Final Bug Scorecard

| Bug ID | Severity | Resolution | Status |
|--------|----------|------------|--------|
| BUG-001 | High/P0 | Sidebar scrollable + pinned bottom | FIXED |
| BUG-002 | Medium/P1 | Sidebar active state via useLocation | FIXED |
| BUG-003 | Critical/P0 | PUBLIC_PATHS → LandingPage router | FIXED |
| BUG-004 | Medium/P1 | Marketing landing page at / | FIXED |
| BUG-005 | High/P0 | Admin console IronVault branding | FIXED |
| BUG-006 | High/P1 | 24h JWT session — expected behavior | CLOSED (N/A) |
| BUG-007 | Medium/P1 | Customer list total count | FIXED |
| BUG-008 | Low/P2 | admin-data.json plan_name | FIXED |

**All P0 bugs**: 3/3 FIXED
**All P1 bugs**: 4/4 resolved (BUG-006 N/A)
**All P2 bugs**: 1/1 FIXED
**E2E suite**: 73/73 PASS across all test runs

---

## Release Verdict

### **GO** ✓

All functional bugs resolved. App deployed and verified in production. Automated test coverage passing. The only remaining pre-submission step is **physical device testing** on iOS/Android (Xcode Simulator / Android Studio Emulator or real devices).
