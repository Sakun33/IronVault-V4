# DNS Fixes — Manual Steps Required (Namecheap)

These items cannot be fixed in code. They require DNS edits in the
Namecheap "Advanced DNS" panel for `ironvault.app`.

## BUG-001 (HIGH) — Two SPF records on ironvault.app

RFC 7208 §3.2 states a domain MUST publish at most one SPF (`v=spf1`)
TXT record. Receivers may reject mail or fail SPF entirely when more
than one is present.

Currently published:

- `v=spf1 include:zoho.in ~all` (Zoho — what we send through)
- `v=spf1 include:spf0001.neo.space -all` (Neo / leftover; not used by us)

**Action:** delete the `spf0001.neo.space` TXT record in Namecheap.
If we ever switch ESPs, merge the new include into the single Zoho
record rather than publishing a second `v=spf1` line, e.g.
`v=spf1 include:zoho.in include:other.example -all`.

## BUG-002 (MEDIUM) — DMARC policy is `p=none`

DMARC `p=none` collects telemetry but takes no action against spoofed
mail. Once SPF/DKIM alignment is confirmed clean (which it is now —
see SendPulse memory), the policy should be tightened.

Current TXT at `_dmarc.ironvault.app`:

```
v=DMARC1; p=none; rua=mailto:dmarc@ironvault.app
```

**Action:** in Namecheap, update the `_dmarc` TXT to:

```
v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc@ironvault.app; ruf=mailto:dmarc@ironvault.app; fo=1
```

After ~7 days at quarantine with no aggregate-report failures, escalate
to `p=reject`.

## Verifying after the change

```sh
dig +short TXT ironvault.app | grep -i spf
dig +short TXT _dmarc.ironvault.app
```

Only one `v=spf1 …` line should come back, and `_dmarc` should show
`p=quarantine`.
