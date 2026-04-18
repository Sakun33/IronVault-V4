# IronVault Post-Launch Monitoring Plan
**Scope:** First 24 hours after Play Store public release  
**Generated:** 2026-04-18

---

## 1. Pre-Launch Checklist (T-1h)

- [ ] Confirm `https://www.ironvault.app` returns 200 with correct `<title>`
- [ ] Confirm `https://www.ironvault.app/api/health` returns `{"status":"ok"}`
- [ ] Confirm `https://admin.ironvault.app/api/customers` returns real users (not 0)
- [ ] Confirm Play Store APK listing is live and downloadable
- [ ] Confirm `sw.js` and `manifest.json` both return 200
- [ ] Rotate `ADMIN_PASSWORD`, `JWT_SECRET` to production values in Vercel dashboard
- [ ] Set up Vercel deployment notifications (email or Slack)

---

## 2. T+0h to T+4h — Launch Window (High Alert)

### Check every 30 minutes:

| Check | Method | Target | Action if Failed |
|-------|--------|--------|------------------|
| App availability | `curl -s -o /dev/null -w "%{http_code}" https://www.ironvault.app` | 200 | Check Vercel deploy logs immediately |
| API health | `curl https://www.ironvault.app/api/health` | `{"status":"ok"}` | Check Neon DB connection + Vercel function logs |
| Signup flow | Manual signup with a new email | Account created + vault picker shown | Emergency rollback to last stable deploy |
| Cloud sync | Add item on Browser A, verify on Browser B after 60s | Item syncs | Check `/api/vaults/cloud` endpoint in Vercel function logs |
| Admin console | Check `admin.ironvault.app/api/customers` count | Count increases with real signups | Check vercel.json routing (BUG-034 fix is live) |

### Metrics to watch in Vercel dashboard:
- **Function invocations** (spike = traffic spike, good)
- **Function errors** (target: < 1% error rate)
- **P99 latency** (target: < 2s for all endpoints)
- **Neon DB connections** (alert if saturating pool)

---

## 3. T+4h to T+12h — Stabilization Window

### Check every 2 hours:

| Check | Method | Pass Criteria |
|-------|--------|---------------|
| Error rate in Vercel logs | Vercel dashboard → Functions → Errors | < 1% |
| New signup rate | Admin console customer count delta | Monotonically increasing |
| Play Store crash rate | Play Console → Android vitals → Crash rate | < 1% (target: < 0.5%) |
| Play Store ANR rate | Play Console → Android vitals → ANR rate | < 0.47% (Play Store threshold) |
| License sync for new users | Create free account, check features gated | UpgradeGate on pro features |
| Lifetime user flow | Log in as saketsuman1312@gmail.com | All features unlocked |

### Play Store Android Vitals — critical thresholds:
- **Crash rate:** > 1.09% → Play Store may flag/demote the app
- **ANR rate:** > 0.47% → Play Store may flag/demote the app
- **Startup time P95:** target < 5s cold start on mid-range device

---

## 4. T+12h to T+24h — Full Day Review

### End-of-day checks:

**Functional:**
- [ ] Review all new support emails at support@ironvault.app
- [ ] Check for duplicate account reports (cross-account leakage — BUG-015 regression)
- [ ] Check for data loss reports (sync overwrites — BUG-041 regression)
- [ ] Verify free plan limits holding (no unlimited-use bypasses reported)

**Performance:**
- [ ] P95 response time for `/api/vaults/cloud` (target: < 500ms)
- [ ] Neon DB query times (target: < 200ms avg)
- [ ] Vercel function cold start rate (target: < 10% of invocations)

**Security:**
- [ ] Review Vercel function logs for unusual patterns (repeated 401s from single IP → brute force)
- [ ] Check for XSS probe attempts in ticket subject/description fields (BUG-050 fix should block)
- [ ] Verify CORS is rejecting non-ironvault.app origins (check for CORS violation log entries)

---

## 5. Incident Response Runbook

### Scenario A: App unavailable (www.ironvault.app returns 5xx)
1. Check Vercel dashboard for deployment status
2. Check Neon database status at neon.tech dashboard
3. If Neon DB down: Vercel functions will return 500 on cloud endpoints; local vault still works (offline-first)
4. Rollback deploy: `vercel rollback <previous-deployment-url> --scope ironvault-main`

### Scenario B: Users reporting data loss after sync
1. Immediately check BUG-041 fix: look for `pushPendingRef` guard in deployed `use-cloud-auto-sync.ts`
2. Check server logs for PUT /api/vaults/cloud racing with GET /api/vaults/cloud
3. If regression confirmed: set `cloudSyncEnabled = false` in feature flag; notify users; hotfix + redeploy within 2h

### Scenario C: Signup creating accounts but features show as Free for Lifetime users
1. Check BUG-027/028 fix: `/api/crm/entitlement/:id` must return nested `entitlement` wrapper
2. Curl test: `curl https://www.ironvault.app/api/crm/entitlement/<email>` — verify both `plan` and `entitlement.plan` fields present
3. Check Neon `entitlements` table for the affected email

### Scenario D: Play Store crash rate spike (> 2%)
1. Download symbolicized crash report from Play Console
2. Most likely candidates: biometric plugin (BUG-040 — Capacitor 7 compat), dialog height overflow (BUG-042 — svh fix)
3. If biometric causing crashes: disable biometric CTA with feature flag in client; ship hotfix APK

### Scenario E: Admin console showing 0 customers despite new signups
1. BUG-034 regression check: `curl https://admin.ironvault.app/api/customers`
2. Verify vercel.json `routes` still points to `/api/index` not `server-simple-working.ts`
3. Check Neon `crm_users` table directly for new rows

---

## 6. Escalation Contacts

| Issue | Owner | Action |
|-------|-------|--------|
| Vercel deployment failures | Saket | Check Vercel dashboard + Slack |
| Neon database issues | Saket | Check Neon dashboard; scale compute if needed |
| Play Store policy flags | Saket | Respond within 7 days (Play Store gives 7-day remediation window) |
| Security incident (breach/injection) | Saket | Rotate JWT_SECRET immediately; audit logs; notify users within 72h (GDPR/DPDP) |

---

## 7. T+24h Sign-Off Criteria

The release is considered stable when ALL of these are true:

- [ ] App availability: > 99.5% uptime in first 24h
- [ ] Error rate: < 1% across all API endpoints
- [ ] Zero data loss reports
- [ ] Zero security incidents
- [ ] Play Store crash rate: < 1%
- [ ] Play Store ANR rate: < 0.47%
- [ ] At least 3 complete signups visible in admin console
- [ ] Cloud sync working for at least 1 verified user

**If all criteria met:** Promote to stable; begin Phase 2 features (iOS app, family invite vault sharing, analytics dashboard).  
**If any criterion fails:** Hold promotion; fix P0 issues; re-evaluate at T+48h.

---

## 8. Quick Commands Reference

```bash
# Check app live
curl -s -o /dev/null -w "HTTP %{http_code} | %{time_total}s\n" https://www.ironvault.app

# Check API health
curl https://www.ironvault.app/api/health

# Check admin customer count
curl https://admin.ironvault.app/api/customers | python3 -m json.tool | grep total

# Check entitlement for a user
curl "https://www.ironvault.app/api/crm/entitlement/saketsuman1312@gmail.com"

# Rollback Vercel deploy (replace URL with previous deploy URL)
vercel rollback https://ironvault-main-XXXX.vercel.app --scope ironvault-main

# Tail function logs (requires Vercel CLI)
vercel logs --follow --scope ironvault-main
```
