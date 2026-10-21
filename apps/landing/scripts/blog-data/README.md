# blog-data

The data articles are derived, not typed: each one's figures come out of `extract.sh` ->
`derive.mjs` and a renderer per article (sections below).

**Spend is MARGINAL per email** (2026-10-03): Instantly's per-email sending charges (`PER_EMAIL_COSTS` in extract.sh) land on the emails Instantly sent; everything bought once per person (the lead, writing the whole sequence, the upload) lands on the first email. A follow-up therefore costs only its own sending, and the follow-up ROI study compares that extra cost with the extra outcomes, against what an outcome costs on a first email.

**A website visit is a HUMAN click** (2026-10-03): a self-send click through our own `/c/` redirect
that the scanner classifier judged human. The provider's webhook clicks carry no IP or user agent,
so they can never be screened, and most decided clicks are link scanners: they are never a visit.
`cost-per-click-cold-email`, `flash-vs-pro-llm-cold-email` and `cold-email-greeting` were taken down
that day (301 to /blog): every click finding they stated rested on provider clicks, and none holds
on human visits. Their renderers and tests went with them.

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

## Research (dashboard v2, staff): served LIVE by features-service

The staff Research page no longer reads anything from this directory (LIVE-RESEARCH-1018, owner
2026-10-18). features-service builds every study, the workflow / template / model catalogue and
the template texts every 15 minutes (`GET /internal/research[/catalog|/templates]?basis=user|actual`,
gateway `/v1/features/research[...]`, staff only), and the dashboard reads them live. The
snapshot pipeline that used to live here (`research.mjs`, `research-diff.mjs`, `refresh.sh`,
`pixel/`, `naming/`, `jev.mjs`, `meeting-before-after.mjs`, the nightly box cron
`research-refresh-cron.sh` and the committed `apps/dashboard/src/lib/research/*.json`) is gone;
its scripts were features-service's reference for the port.

What stays here serves the published ARTICLES only: `extract.sh` -> `derive.mjs` (the fact table
the follow-up article reads) and the per-article folders below with their committed snapshots.
`derive.mjs` still writes its `research` block into `facts.json`; nothing reads it any more.

To read a Research study for an article, save the live file (billed basis) from inside the
features-service container on the box, then hand it to the article's derive script:

```sh
ssh root@<box> 'docker exec distribute-features-service-1 node -e "fetch(\"http://localhost:8080/internal/research?basis=user\",{headers:{\"x-api-key\":process.env.FEATURES_SERVICE_API_KEY}}).then(r=>r.text()).then(t=>process.stdout.write(t))"' > /tmp/research.json
```

## Emails too young to count (two rules, one per surface)

An email sent today has not had time to earn its click or its reply, so counting it makes every
price read too high and every rate too low. The two surfaces hold different rules on purpose.

**The research block of `facts.json` applies features-service's rule, never its own** (features-service#1196).
extract.sh reads `/public/channels` from inside the features-service container into
`maturity.json`: per leg, `durationDays` (21 on the two cold-email entry legs) and
`outcomesRequired` (1 positive reply, 10 website visits). The clock is when the RUN started
(`generations.csv` carries each email's run id, `run-starts.csv` when that run started): an email
counts when its run started at least `durationDays` before the extract's end, with every outcome
it earned since, and a leg's spend is cut at the same date by its own run start. A bucket with
fewer mature outcomes than `outcomesRequired` reads Learning and is still drawn and ranked.
`derive.mjs` writes the rule it applied as `facts.researchMaturity`. An email whose run start is
unknown stays in (the producer's own rule for a missing serve date).

**The articles keep the window they were published on**: `maturation.mjs` measures the time from
the email that earned an outcome to the outcome, at the 95th percentile per outcome, and drops
every email sent within it of the window's end (11 days on the articles). `facts.maturation`
carries it.

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

## The follow-up article

`content/blog/cold-email-follow-up` states the Research page's follow-up study for positive replies
(`cold-email-positive-reply-followups-roi` / `cold-email-positive-reply-followups-rate`): every email of a sequence that asks for a reply,
filed under its place in the sequence, a reply counted for the last email sent before it. The
committed snapshot carries aggregates only.

```sh
# 1. the extract and its fact table (end = today)
apps/landing/scripts/blog-data/extract.sh 2026-04-15 <today> /tmp/research-data
node --max-old-space-size=8192 apps/landing/scripts/blog-data/derive.mjs /tmp/research-data > /tmp/research-data/facts.json

# 2. the steps of the sequence, positive replies
node apps/landing/scripts/blog-data/followups/derive-followups.mjs /tmp/research-data/facts.json > apps/landing/scripts/blog-data/followups/followups.snapshot.json

# 3. render
node apps/landing/scripts/blog-data/followups/render-followups-article.mjs apps/landing/scripts/blog-data/followups/followups.snapshot.json apps/landing/content/blog
```

The renderer refuses a snapshot where the steps sent stop being the first email and two follow-ups,
the follow-ups stop doubling the positive replies, or the second follow-up stops adding less
than the first. The article states lifts (x2, +67%); the counts sit in its Notes.

## The LLM judge article (Jev)

`content/blog/gtm-ai-llm-judge` states the Research page's Typed judgment studies. It reads the
LIVE Research file saved as above (`/tmp/research.json`), never a fresh extract:

```sh
node apps/landing/scripts/blog-data/jev/derive-jev.mjs /tmp/research.json > apps/landing/scripts/blog-data/jev/jev.snapshot.json
node apps/landing/scripts/blog-data/jev/render-jev-article.mjs apps/landing/scripts/blog-data/jev/jev.snapshot.json apps/landing/content/blog
```

derive-jev.mjs refuses a study that is not a `conclusion`; the renderer refuses a snapshot where
"most people turned away", "half the replies" or "Jev is sure most of the time" stopped being true.

## The cost per positive reply article

`content/blog/cold-email-cost-per-positive-reply` states the Research page's two average-cost studies
(`cold-email-positive-reply-cost-over-time`, `cold-email-website-visit-cost-over-time`): what a positive reply and a website visit cost on
average since inception, on what clients were billed. It reads the LIVE Research file saved as above
(`/tmp/research.json`), never a fresh extract:

```sh
node apps/landing/scripts/blog-data/cost/derive-cost.mjs /tmp/research.json > apps/landing/scripts/blog-data/cost/cost.snapshot.json
node apps/landing/scripts/blog-data/cost/render-cost-article.mjs apps/landing/scripts/blog-data/cost/cost.snapshot.json apps/landing/content/blog
```

derive-cost.mjs refuses a study that is not a `conclusion`; the renderer refuses a snapshot where the
running average stopped rising since its first month or the latest month stopped being the dearest.

## The response time article

`content/blog/cold-email-response-time` states the Research study `positive-reply-delay` ("How long
before a first positive reply?") exactly as features-service serves it: the snapshot is the served
study, copied from inside the features-service container, nothing recomputed from a database.

```sh
apps/landing/scripts/blog-data/reply-delay/fetch-reply-delay.sh > apps/landing/scripts/blog-data/reply-delay/reply-delay.snapshot.json
node apps/landing/scripts/blog-data/reply-delay/render-reply-delay-article.mjs apps/landing/scripts/blog-data/reply-delay/reply-delay.snapshot.json apps/landing/content/blog
```

The renderer refuses a study that is not a `conclusion`, a headline that stops saying "at least N%"
(N under 30), a day 2 that stops being empty, or a 10 to 14 day wave that stops standing out. The
waves are signals in the body; exact shares, the 95% range and counts sit in the Notes.
