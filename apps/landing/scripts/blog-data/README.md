# blog-data

The two cold-email data articles are derived, not typed.

- `apps/landing/content/blog/cost-per-click-cold-email`
- `apps/landing/content/blog/flash-vs-pro-llm-cold-email`

Each one is an `article.template.html` holding the prose, with every figure, every
bar and every table cell as a token the renderer fills from production data. Running
the three steps below reproduces both `article.html` files byte for byte, which is what
makes a correction to production a re-run rather than a rewrite.

```sh
# 1. pull the fact tables (read-only, over ssh to the Hetzner box)
apps/landing/scripts/blog-data/extract.sh 2026-04-15 2026-09-12 /tmp/blog-data

# 2. derive every bucket, every cut and the best workflow per outcome
node --max-old-space-size=8192 apps/landing/scripts/blog-data/derive.mjs /tmp/blog-data > /tmp/blog-data/facts.json

# 3. render both articles from their templates
node apps/landing/scripts/blog-data/render-articles.mjs /tmp/blog-data/facts.json apps/landing/content/blog

# 4. re-render the covers and, for the Flash article, the newsletter's PNG charts
cd apps/landing
node scripts/render-blog-hero.mjs cost-per-click-cold-email
node scripts/render-blog-hero.mjs flash-vs-pro-llm-cold-email
node scripts/render-newsletter-charts.mjs flash-vs-pro-llm-cold-email 2,3,4,18,20,21,23,26,35
```

Then `pnpm --filter @distribute/landing test`, which pins the copy rules, the dataset's
coherence and the editorial rules for both pages.

## What the window is

The articles state 15 April to 11 September 2026, read on 11 September 2026, and the
extract is run with an exclusive end of `2026-09-12`. Both articles share one fact table
so they cannot state different totals for the same population.

## What is not in here

The figures the page quotes from someone else (a competitor's pricing page, a published
reply-rate study, a vendor's list price per million tokens) are read by hand from the
source on the date printed beside them, and live in the template as plain copy. We
compute nothing from them.

## The scanner correction

Self-send `/c/` click hits are classified in production before they can count as a
website visit: a HEAD request, a known scanner user agent, a Chrome user agent carrying
a full build number (real Chrome reports `Chrome/142.0.0.0` under user-agent reduction),
or the same lead fetching the unsubscribe link within 60 seconds. There is no time
threshold. `instantly_events` therefore already holds only promoted hits, and
`clicks.csv` needs no filter of its own.
