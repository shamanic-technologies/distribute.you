# blog-data

The data articles are derived, not typed: each one's figures come out of `extract.sh` ->
`derive.mjs` and a renderer per article (sections below).

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
rule's duration before the read (research.mjs refuses a snapshot cut any later). Do NOT re-render the
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

## Meeting booked: one leg, and one OUTCOME section across every leg

`meetings.mjs` (called by research.mjs, unit-tested in `tests/unit/research-meetings.test.ts`) writes two studies from
four extract.sh dumps (`meetings.csv`, `pilot-acted.csv`, `meeting-campaigns.csv`, `meeting-spend.csv`):
- `pilot-cost` (the positive reply -> meeting booked leg, `conversation_to_meeting_booked`): that leg's spend over the
  meetings lead-service credits to our outreach AND booked on or after the leg first acted on the person.
- `meeting-cost` (the Meeting booked OUTCOME section, `crew: null, outcome: "meeting"`, listed in the file's
  `outcomes`): every dollar charged on cold email + meeting booking over every credited meeting, on the brands that
  REPORT meetings only (any live `meeting_booked` row; owner pick 2026-10-03: a brand with no CRM import or tracker
  reads zero meetings by construction). Its `population` line says how many brands that is.
Learning comes from features-service's rule for `conversation_to_meeting_booked` / `start_to_meeting_booked`
(maturity.json); research.mjs throws if the catalogue states none. Spend is billed gross (actual rows); the actual
basis states "not measured on vendor cost yet" instead of a figure.

## Open tracking and naming the client: Research only

Both studies live on the Research page only (`pixel/pixel.research.snapshot.json` via `pixel/derive-pixel.mjs`,
and `naming/naming.mjs`). Their articles (`cold-email-open-tracking`, `cold-email-response-rate`)
were taken down on 2026-10-02: each headline was a signal, not a conclusion (`verdict.mjs`).

## The follow-up article

`content/blog/cold-email-follow-up` states the Research page's follow-up study for positive replies
(`herald-followups-roi` / `herald-followups-rate`): every email of a sequence that asks for a reply,
filed under its place in the sequence, a reply counted for the last email sent before it. The
committed snapshot carries aggregates only.

```sh
# 1. the same extract and facts the Research page is built from (end = today)
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

## Research on two cost bases

The Research page is written twice. The billed snapshot (`research.mjs <facts.json> apps/dashboard/src/lib/research`) is the default view. The staff-only ACTUAL cost snapshot (what the vendors charged us, before our markup) is derived with `COST_BASIS=actual node derive.mjs <dir> > <dir>/facts-actual.json` then `research.mjs <dir>/facts-actual.json apps/dashboard/src/lib/research/actual` (delete the `research-templates.json` it writes there). extract.sh prices every spend row through costs-service's vendor catalogue with runs-service's match rule; a workflow version carrying billed spend no vendor cost prices is left out of the actual figures whole, and the page states how much. Every research JSON (billed and actual) is imported ONLY by the staff route `/api/research/{basis}/{part}`, never by a client module.

## The cost per positive reply article

`content/blog/cold-email-cost-per-positive-reply` states the Research page's two average-cost studies
(`herald-cost-over-time`, `scout-cost-over-time`): what a positive reply and a website visit cost on
average since inception, on what clients were billed. It reads the committed `research.json`, never a
fresh extract, so refresh the Research page first (above), then:

```sh
node apps/landing/scripts/blog-data/cost/derive-cost.mjs apps/dashboard/src/lib/research/research.json > apps/landing/scripts/blog-data/cost/cost.snapshot.json
node apps/landing/scripts/blog-data/cost/render-cost-article.mjs apps/landing/scripts/blog-data/cost/cost.snapshot.json apps/landing/content/blog
```

derive-cost.mjs refuses a study that is not a `conclusion`; the renderer refuses a snapshot where the
running average stopped rising since its first month or the latest month stopped being the dearest.
