# Checkpoint 024 — BUG-037 fix deployed
**Date:** 2026-04-09 ~20:40 UTC
**Branch:** claude/fervent-mclaren → main (bcca560)
**Deploy:** ironvault-main-fgc6dm5i8 (www.ironvault.app)
**Bundle:** index-ab452011.js

## What was done
- Implemented auto-sync: `vault:item:saved` CustomEvent dispatched from `storage.ts`
- `useCloudAutoSync` hook debounces 3s, re-exports and pushes vault to cloud
- Cloud-synced registry helpers in `cloud-vault-sync.ts`
- Same-device login now clears and re-imports from cloud
- Domains moved from `ironvault` project to `ironvault-main` (permanent fix)

## Status
BUG-037: LIVE ✅
All previous bugs: LIVE ✅
