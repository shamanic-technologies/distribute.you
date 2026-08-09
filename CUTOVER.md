# Cutover: landing and dashboard from Vercel to the Hetzner box

Both apps already run on the box as containers, behind Caddy, deployed by the same
5-minute cron as the rest of the fleet. Only DNS still points at Vercel. This file is
the one remaining step and how to undo it.

**Nothing here has been executed.** Flipping `dashboard.distribute.you` takes the product
down for every customer at once if it goes wrong, so it is the owner's to take.

## What is already true

| | landing | dashboard |
|---|---|---|
| container | `landing-app` | `dashboard-app` |
| image | `apps/landing/Dockerfile`, built from the repo root | `apps/dashboard/Dockerfile`, same |
| clone on the box | `/root/distribute/repos/distribute.you` (shared with `admin-app`) | same |
| runtime env | `env/landing-app.env` | `env/dashboard-app.env` |
| build env (`NEXT_PUBLIC_*`) | `env/landing-app.build.env` | `env/dashboard-app.build.env` |
| deployed by | `./deploy.sh landing-app` / `--all` / the 5-min cron | same |
| health | `/api/public/health`, asked from inside the container | same |
| temporary hostname | `next-landing.distribute.you` | `next.distribute.you` |

`admin-app` is the third app in that group and moves with them — one clone, one lock, one
commit sha. `deploy-admin.sh` still exists and still works; it is now a wrapper around
`./deploy.sh admin-app --force`.

## Before you flip: two values are missing

Vercel-`sensitive` vars cannot be read back — the CLI writes `[SENSITIVE]` instead of the
value and the REST API returns an empty string. Everything else was recovered from
key-service, the box, the live bundle or Neon. **Two have no second source and must come
from a human:**

| var | file | where to get it | what breaks without it |
|---|---|---|---|
| `PARTNERO_API_TOKEN` | `env/dashboard-app.env` | Partnero dashboard → program `KHV3KEHI` → API, or the Vercel UI | `POST /api/partnero/customer` 500s, so referred signups stop crediting the partner |
| `OUTRANK_WEBHOOK_SECRET` | `env/landing-app.env` | Outrank's webhook settings (it holds the matching half, so it can also be ROTATED rather than recovered), or the Vercel UI | `POST /api/outrank/webhook` throws, so Outrank stops publishing blog articles |

They are left OUT rather than stubbed: each consumer logs a named error when the value is
absent, which is a clearer signal than a placeholder that reaches a vendor and comes back
as a vendor error. `./cutover.sh --check` exits non-zero while either is missing.

**`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is already set and needed nobody.** It is a
publishable key, so it is inlined into the client bundle and public by construction — it
was simply not on the sign-in page, because the billing chunk is lazy. Reading it off the
live production billing page recovered it, and Stripe confirms both it and the secret key
carry `51T50gYEnlXMXdaZa`, i.e. `acct_1T50gYEnlXMXdaZa` / "Distribute.you". Generalise:
before asking a human for a `NEXT_PUBLIC_*` value, remember it is already being served to
every visitor of the page that uses it.

After adding them: the build-time one needs a rebuild, which is what `--force` is for —
`./deploy.sh dashboard-app --force` (it writes the build env into the clone, rebuilds,
health-checks, and rolls back if that fails). The two runtime-only ones need only
`docker compose up -d --force-recreate <app>`. Then re-run `./cutover.sh --check`.

## The flip

On the box, `/root/distribute/cutover.sh` does it in four steps. They are separate on
purpose: the first two are free and reversible and can run days early, and only `--dns`
is the one that reaches customers.

```
./cutover.sh --check     # read-only. Containers, the three secrets, Caddy, who serves what.
./cutover.sh --caddy     # serve the production hostnames from here. DNS still on Vercel.
./cutover.sh --dns       # flip the three records.   ← the one that can break things
./cutover.sh --verify    # read back what each hostname is actually served by
./rollback-cutover.sh    # put all three records back exactly as they were
```

`--dns` and the rollback need `CLOUDFLARE_API_TOKEN` exported with `DNS:Edit` on the
zone; nothing else does. `--check` exits non-zero while anything is missing, so it is the
gate rather than a summary — today it exits 1 on the three secrets below.

The records it touches, zone `df5bdf092c1909940690f66f4519acaf`. All three are proxied
today and stay proxied — Caddy serves the origin with `tls internal`, which is what
Cloudflare's "Full" SSL mode expects.

| record | id | today | after |
|---|---|---|---|
| `distribute.you` | `8733d51282486ea7d678499380996ef1` | `A 216.150.1.1` | `A 167.233.196.79` |
| `dashboard.distribute.you` | `893cbc65c0dbe7ecc97c86ad363d1257` | `CNAME eefd7c4d276b883c.vercel-dns-016.com` | `A 167.233.196.79` |
| `app.distribute.you` | `a3cff948541797ea068fa6ca342cbb9e` | `CNAME 6185729a7fa9cf52.vercel-dns-016.com` | `A 167.233.196.79` |

`app.distribute.you` serves a Vercel 404 today and Caddy already answers it beside
`dashboard.distribute.you`, so it can move with them or be deleted.

`--caddy` is what points those hostnames at the containers, and it runs FIRST for a
reason: serving them from the box while DNS still points at Vercel costs nothing and
reaches nobody, and doing it early means the flip is one DNS change with no second step to
get wrong. It backs the Caddyfile up, reuses the exact `reverse_proxy` bodies the
`next.` / `next-landing.` blocks already prove (the dashboard's `flush_interval -1` and
`read_timeout 310s` are load-bearing — see the comments there), validates before
reloading, and restores the backup if validation fails.

## Undo

`./rollback-cutover.sh` restores the three records to the "today" column above. Cloudflare
TTL is `auto` on a proxied record, so the edge picks the change up in seconds; there is no
cache to wait out. Both Vercel projects are untouched and still building from `main`, so
they resume serving the moment DNS points back.

It leaves Caddy alone on purpose: serving the production hostnames from the box costs
nothing while DNS points elsewhere, and leaving it means a re-flip is one command instead
of two. To undo that half as well, restore the newest `Caddyfile.pre-cutover.*.bak`.

## After the flip

- **Delete the two temporary records** (`next.distribute.you` id
  `98e31b39353671b9c58d0b87f83896d7`, `next-landing.distribute.you` id
  `3d8ebe1e8eb85ad10234b9e04c0670c1`) and their Caddy blocks.
- **Turn off the Vercel cron** on `distribute-dashboard` (remove `crons` from
  `apps/dashboard/vercel.json`). It is deliberately still there: the box has run the same
  job since 2026-08-08 and both fire at 01:00 UTC, but while Vercel is the host that
  serves customers it is also the rollback target, and a rollback should not land on a
  dashboard whose only cron was deleted. Sends are deduped per
  `outcome-digest:<brandId>:<YYYY-MM-DD>`, so the overlap mails nobody twice. Remove it
  once the box has served for a few days — `./cutover.sh --verify` prints the reminder.
- **The CORS error on the temporary hostname goes away by itself.** api-service allows
  `https://dashboard.distribute.you` and not `https://next.distribute.you`, so the
  conversion-tracker preflight fails today on the temporary host only. Verified: the
  preflight returns the allow-origin header for `dashboard.distribute.you` and none for
  `next.distribute.you`. Nothing to change — but re-check it once after the flip rather
  than assuming.
- Consider deleting the Vercel projects only after a few days of the box serving. Their
  env is fully recoverable except for the three sensitive values above, so **read those
  out of the UI before deleting anything**.
