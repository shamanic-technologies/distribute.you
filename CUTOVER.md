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

## Before you flip: three values are missing

Each is Vercel-`sensitive`, which means the CLI writes `[SENSITIVE]` instead of the value
and the REST API returns an empty string. Everything else was recovered from key-service,
the box, the live bundle, or Neon. These three have no second source, so **copy them out
of the Vercel UI** and add them to the box:

| var | file | what breaks without it |
|---|---|---|
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `env/dashboard-app.env` **and** `env/dashboard-app.build.env` | in-modal card capture (Embedded Checkout) never loads — this one is inlined at build, so it needs a rebuild, not a restart |
| `PARTNERO_API_TOKEN` | `env/dashboard-app.env` | `POST /api/partnero/customer` 500s, so referred signups stop crediting the partner |
| `OUTRANK_WEBHOOK_SECRET` | `env/landing-app.env` | `POST /api/outrank/webhook` throws, so Outrank stops publishing blog articles |

They are left OUT rather than stubbed: each consumer logs a named error when the value is
absent, which is a clearer signal than a placeholder that reaches a vendor and comes back
as a vendor error.

After adding them: `./deploy-admin.sh`-style rebuild for the build-time one —
`cp env/dashboard-app.build.env repos/distribute.you/apps/dashboard/.env.production &&
docker compose build dashboard-app && docker compose up -d dashboard-app`. The two
runtime-only ones need `docker compose up -d --force-recreate <app>`.

## The flip

Three Cloudflare DNS records, zone `df5bdf092c1909940690f66f4519acaf`. All three are
proxied today and stay proxied — Caddy serves the origin with `tls internal`, which is
what Cloudflare's "Full" SSL mode expects.

| record | id | today | after |
|---|---|---|---|
| `distribute.you` | `8733d51282486ea7d678499380996ef1` | `A 216.150.1.1` | `A 167.233.196.79` |
| `dashboard.distribute.you` | `893cbc65c0dbe7ecc97c86ad363d1257` | `CNAME eefd7c4d276b883c.vercel-dns-016.com` | `A 167.233.196.79` |
| `app.distribute.you` | `a3cff948541797ea068fa6ca342cbb9e` | `CNAME 6185729a7fa9cf52.vercel-dns-016.com` | `A 167.233.196.79` |

`app.distribute.you` serves a Vercel 404 today and Caddy already answers it beside
`dashboard.distribute.you`, so it can move with them or be deleted.

Caddy needs the two production hostnames pointed at the containers in the same window.
In `/root/distribute/Caddyfile`, replace the `app.distribute.you, dashboard.distribute.you`
maintenance block and add `distribute.you`, using the same two `reverse_proxy` bodies the
`next.` / `next-landing.` blocks already carry (the dashboard's `flush_interval -1` and
`read_timeout 310s` are load-bearing — see the comments there). Then
`docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile`. Do Caddy FIRST:
serving both hostnames from the box before DNS moves costs nothing, and it means the flip
is a single DNS change with no second step to get wrong.

## Undo

Restore the three records to the "today" column above. Cloudflare TTL is `auto` on a
proxied record, so the edge picks the change up in seconds; there is no cache to wait out.
Both Vercel projects are untouched and still building from `main`, so they resume serving
the moment DNS points back.

## After the flip

- **Delete the two temporary records** (`next.distribute.you` id
  `98e31b39353671b9c58d0b87f83896d7`, `next-landing.distribute.you` id
  `3d8ebe1e8eb85ad10234b9e04c0670c1`) and their Caddy blocks.
- **Turn off the Vercel cron** on `distribute-dashboard` (remove `crons` from
  `apps/dashboard/vercel.json`). The box now runs the same job at the same time. Sends are
  deduped per `outcome-digest:<brandId>:<YYYY-MM-DD>`, so an overlap would mail nobody
  twice — but two crons for one job is a thing to remove, not a thing to rely on.
- **The CORS error on the temporary hostname goes away by itself.** api-service allows
  `https://dashboard.distribute.you` and not `https://next.distribute.you`, so the
  conversion-tracker preflight fails today on the temporary host only. Verified: the
  preflight returns the allow-origin header for `dashboard.distribute.you` and none for
  `next.distribute.you`. Nothing to change — but re-check it once after the flip rather
  than assuming.
- Consider deleting the Vercel projects only after a few days of the box serving. Their
  env is fully recoverable except for the three sensitive values above, so **read those
  out of the UI before deleting anything**.
