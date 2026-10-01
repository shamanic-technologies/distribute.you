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

Step 4's newsletter charts are RE-LAID before they are rastered (`blog-data/narrow-chart.mjs`).
The article's chart is an 800-unit viewBox built for a page, and a mail client shows it at
about 324 CSS px on a phone, which puts its row labels at 5.7px and its count lines at 4.5px
beside 16px body copy. The re-lay reads the article's own emitted bytes, puts the label above
its bar on a 420-unit box, and carries every figure, label, count line and the aria-label
across verbatim, so the email and the page still state the same figures by construction. Run
it after every article re-render; `tests/unit/newsletter-chart-legibility.test.ts` fails if a
glyph runs past the box or lands under 9px on a phone.

Then `pnpm --filter @distribute/landing test`, which pins the copy rules, the dataset's
coherence and the editorial rules for both pages.

## Research (dashboard v2, staff)

The Research page in dashboard v2 (`/v2/.../research`) reads
`apps/dashboard/src/lib/research/research.json`, written from the SAME fact table as the
articles, so a study and an article cannot state two figures for one population. Every
study is fleet-wide (all orgs) but scoped to ONE leg of the channel (campaign-service
`leg_key`, via `campaign-legs.csv`): Herald reads `start_to_conversation` emails only, Scout
the link-carrying `start_to_website_visit` emails only, and a campaign stating no leg belongs
to neither. Each (workflow version, leg) is priced on its own spend (`spend-legs.csv`, per
campaign and per day), cut at its leg's cutoff like the emails it divides. Labels and the
catalogue's last-runs lists are per crew too. The articles keep the fleet-wide, all-legs
population on purpose: the leg scope lives only in the `research` block. To refresh it:

```sh
apps/landing/scripts/blog-data/extract.sh 2026-04-15 <today> /tmp/research-data
apps/landing/scripts/blog-data/pixel/extract-pixel.sh <today minus 21 days> "$PWD/apps/landing/scripts/blog-data/pixel/pixel.research.snapshot.json"
node --max-old-space-size=8192 apps/landing/scripts/blog-data/derive.mjs /tmp/research-data > /tmp/research-data/facts.json
node apps/landing/scripts/blog-data/research.mjs /tmp/research-data/facts.json apps/dashboard/src/lib/research > /tmp/research.json && mv /tmp/research.json apps/dashboard/src/lib/research/research.json
pnpm --filter @distribute/dashboard test research
```

The second argument receives two side files the workflow and template pages read
(`research-catalog.json`: one entry per workflow, per template and per model, per crew, with its months and
its last runs; `research-templates.json`: the text of every listed template). extract.sh writes
the three inputs they need beside the dumps (`templates.json`, `workflow-runs.json`,
`template-runs.json`, `model-runs.json`). Commit all three JSON files together.

`derive.mjs` adds a `research` block (per LLM, per template, per step, per month, and each
LLM's and template's own month curve); `research.mjs` turns it into one study per question,
with its charts, its one-line result and its conclusion written out, so the page divides
nothing. The open-tracking studies read `pixel/pixel.research.snapshot.json`, cut at least the
rule's duration before the read (research.mjs refuses a snapshot cut any later); the article
keeps its own `pixel.snapshot.json`. Do NOT re-render the
two articles from a refreshed extract unless you mean to move their published figures.

## Emails too young to count (two rules, one per surface)

An email sent today has not had time to earn its click or its reply, so counting it makes every
price read too high and every rate too low. The two surfaces hold different rules on purpose.

**The Research page applies features-service's rule, never its own** (features-service#1196).
extract.sh reads `/public/channels` from inside the features-service container into
`maturity.json`: per leg, `durationDays` (21 on the two cold-email entry legs) and
`outcomesRequired` (1 positive reply, 10 website visits). The clock is when the RUN started
(`generations.csv` carries each email's run id, `run-starts.csv` when that run started): an email
counts when its run started at least `durationDays` before the extract's end, with every outcome
it earned since, and a leg's spend is cut at the same date by its own run start. A bucket with
fewer mature outcomes than `outcomesRequired` reads Learning and is still drawn and ranked.
`derive.mjs` writes the rule it applied as `facts.researchMaturity`; research.mjs states it under
every chart. An email whose run start is unknown stays in (the producer's own rule for a missing
serve date).

**The articles keep the window they were published on**: `maturation.mjs` measures the time from
the email that earned an outcome to the outcome, at the 95th percentile per outcome, and drops
every email sent within it of the window's end (11 days on the articles). `facts.maturation`
carries it; the Research page does not read it.

Run the research extract with TODAY as its end, not tomorrow: the end is when outcomes stop being
observed.

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

`scanner-hits.csv` reads the bronze verdicts for the same window so the articles can STATE
what the correction demoted instead of carrying a figure someone typed once: the sweep keeps
classifying, so that number grows. The pages divide by the DECIDED hits, since one still
awaiting its verdict is neither promoted nor demoted.

The correction reaches our own `/c/` redirect and nothing else. That redirect only started
carrying traffic in late August, so the provider's own tracking accounts for nearly every
click either page prices; `volume.clicksBySource` splits the two and the Method paragraph
states the share rather than leaving a reader to assume the bulk was scrubbed.

## The opt-out footer article

`content/blog/cold-email-unsubscribe-link-spam` is rendered from `footer/`, not from the
fact tables above: its data is three placement tests sent on 2026-09-24 to our own Google
Workspace inboxes, so the result lives in those mailboxes, not in a table.

```sh
# re-read the receiving mailboxes (only until ~2026-10-24: Gmail empties spam after 30 days)
apps/landing/scripts/blog-data/footer/extract-footer.sh "$PWD/apps/landing/scripts/blog-data/footer/placement.snapshot.json"
node apps/landing/scripts/blog-data/footer/derive-footer.mjs apps/landing/scripts/blog-data/footer/placement.snapshot.json > /tmp/footer-facts.json
node apps/landing/scripts/blog-data/footer/render-footer-article.mjs /tmp/footer-facts.json apps/landing/content/blog
```

The design file naming the sending and receiving addresses stays on the box
(`/root/blog-data/footer-design.json`); this repository is public and those are live
sending addresses. The committed snapshot carries indices only, and is the record once the
spam folders have been emptied.

## The open-tracking article

`content/blog/cold-email-open-tracking` is rendered from `pixel/`: one aggregate row per
arm (pixel on, pixel off), read from instantly-service's own database. The snapshot carries
counts only.

```sh
# 1. re-read the two arms (exclusive cutoff, 14 days before the read so replies can land)
apps/landing/scripts/blog-data/pixel/extract-pixel.sh 2026-09-13 "$PWD/apps/landing/scripts/blog-data/pixel/pixel.snapshot.json"

# 2. derive rates, lifts and two-proportion p-values
node apps/landing/scripts/blog-data/pixel/derive-pixel.mjs apps/landing/scripts/blog-data/pixel/pixel.snapshot.json > /tmp/pixel-facts.json

# 3. render
node apps/landing/scripts/blog-data/pixel/render-pixel-article.mjs /tmp/pixel-facts.json apps/landing/content/blog
```

An arm is decided by the campaign's FIRST stored config (`open_tracking`); a sequence we sent
ourselves (`self:`) carries no pixel and counts as off. This is an observational comparison of
two periods, not a controlled test, and the article says so.

## The naming-the-client article

`content/blog/cold-email-response-rate` states the Research page's naming study (`herald-naming-rate`
/ `herald-naming-roi`): does a cold email that asks for a reply do better when it names the client,
or when it keeps the name and link back? `naming/naming.mjs` holds the classification (read from
each template version's PROMPT, never its name), the two sides and the p-values, and research.mjs
imports it, so the article and the Research page state the same figures for one extract. The
committed snapshot carries aggregates only.

```sh
# 1. the same extract and facts the Research page is built from (end = today)
apps/landing/scripts/blog-data/extract.sh 2026-04-15 <today> /tmp/research-data
node --max-old-space-size=8192 apps/landing/scripts/blog-data/derive.mjs /tmp/research-data > /tmp/research-data/facts.json

# 2. the two sides, positive-reply leg only
node apps/landing/scripts/blog-data/naming/derive-naming.mjs /tmp/research-data/facts.json > apps/landing/scripts/blog-data/naming/naming.snapshot.json

# 3. render
node apps/landing/scripts/blog-data/naming/render-naming-article.mjs apps/landing/scripts/blog-data/naming/naming.snapshot.json apps/landing/content/blog
```

The renderer refuses a snapshot where the client-not-named side stops winning on rate or on cost,
since the prose names the winner in words.

## The greeting article

`content/blog/cold-email-greeting` states the Research page's two opening studies (`scout-opening-roi`
/ `herald-opening-roi`): how the first email opens (first-email-shape.mjs `openingOf`, a regex, no
model), priced per website visit and per positive reply, all tiers and per tier. The committed
snapshot carries aggregates only.

```sh
# 1. the same extract and facts the Research page is built from (end = today)
apps/landing/scripts/blog-data/extract.sh 2026-04-15 <today> /tmp/research-data
node --max-old-space-size=8192 apps/landing/scripts/blog-data/derive.mjs /tmp/research-data > /tmp/research-data/facts.json

# 2. the opening buckets, both legs
node apps/landing/scripts/blog-data/greeting/derive-greeting.mjs /tmp/research-data/facts.json > apps/landing/scripts/blog-data/greeting/greeting.snapshot.json

# 3. render
node apps/landing/scripts/blog-data/greeting/render-greeting-article.mjs apps/landing/scripts/blog-data/greeting/greeting.snapshot.json apps/landing/content/blog
```

The renderer refuses a snapshot where no greeting stops winning on visits, "Hi" + first name stops
winning on positive replies, or the tier caveats in the limits stop holding.

## Research on two cost bases

The Research page is written twice. The billed snapshot (`research.mjs <facts.json> apps/dashboard/src/lib/research`) is what every reader sees. The staff-only ACTUAL cost snapshot (what the vendors charged us, before our markup) is derived with `COST_BASIS=actual node derive.mjs <dir> > <dir>/facts-actual.json` then `research.mjs <dir>/facts-actual.json apps/dashboard/src/lib/research/actual` (delete the `research-templates.json` it writes there). extract.sh prices every spend row through costs-service's vendor catalogue with runs-service's match rule; a workflow version carrying billed spend no vendor cost prices is left out of the actual figures whole, and the page states how much. The actual files are imported ONLY by the staff route `/api/research/actual`, never by a client module.
