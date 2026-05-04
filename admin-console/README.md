# IronVault Admin Console

Internal operations console for IronVault. Lives at **admin.ironvault.app** as a separate Vercel project.

## What it does

- **Customer management** — search users, view subscription state, create / suspend accounts, change plans manually, refund or cancel subscriptions.
- **Tickets** — Zoho Desk inbox view; reply, assign, close.
- **Plans** — define pricing tiers and feature flags surfaced to the main app.
- **Audit log** — every admin action is recorded with actor, target, and timestamp.

It is deliberately **not** a customer-facing surface. CORS is locked to `admin.ironvault.app` and the admin API uses an admin-only API key separate from the main app's `JWT_SECRET`.

## Layout

```
admin-console/
├── api/         Express handlers deployed as Vercel Functions
└── frontend/    Vite + React UI
```

## Deploy (Vercel)

Set up as a **separate Vercel project** rooted at `admin-console/`:

1. Create a new Vercel project pointing at this repo.
2. Set the **Root Directory** to `admin-console`.
3. Configure the env vars below.
4. Add `admin.ironvault.app` as a custom domain.

The bundled `vercel.json` wires the API routes and the Vite frontend build.

## Environment variables

```bash
DATABASE_URL=postgres://...      # Same Neon database as the main app
JWT_SECRET=                       # Long random string (NOT the same as the main API)
ADMIN_USERNAME=                   # Admin sign-in username
ADMIN_PASSWORD=                   # Admin sign-in password (scrypt-hashed at rest)
ADMIN_API_KEY=                    # Required by privileged admin-only endpoints
```

> The admin console's `JWT_SECRET` and `ADMIN_API_KEY` must be **distinct** from the main app's `JWT_SECRET`. Reusing them defeats the boundary between user and admin trust.

## Local development

```bash
cd admin-console
npm install
npm run dev          # Frontend dev server
```

To exercise the admin API locally, run `vercel dev` from the `admin-console/` directory after `vercel link`.

## Security

- Admin login uses scrypt-hashed credentials with timing-safe comparison.
- All admin-only endpoints validate `ADMIN_API_KEY` in addition to a logged-in admin session.
- CORS is pinned to `https://admin.ironvault.app`.
- Every mutating action writes an audit-log row.
