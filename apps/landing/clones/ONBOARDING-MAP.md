# Onboarding map: Explee, Gojiberry, Origami, and us

Walked by hand on 2026-09-28 in a real browser, with a throwaway account
(`maria@polaritycourse.com`, website `tidycal.com`, a random company). No card was
entered anywhere. Every screen, every JSON answer from their own API and the bundles
their app loaded are stored under `clones/<slug>/__flow/` and served at
`https://lab-<slug>.distribute.you/__flow/` (same password as the other clones).
Rebuild with `node scripts/har-to-flow.mjs <slug> <capture-dir>`.

**Explee is clickable on `lab-explee.distribute.you`:** type `tidycal.com` in the hero and the six steps replay from the recorded answers, down to the card screen. Any other domain goes nowhere (their analysis runs on their side).

## When they ask for the website, the account and the card

| Screen | Explee | Gojiberry | Origami | distribute.you (today) |
|---|---|---|---|---|
| 1 | Landing: **website** in the hero | Landing: **website** in the hero | Landing: **domain** in the hero | Landing: website in the hero |
| 2 | Step 1 of 6, live: research the company | **Account**: first name, last name, business email, password (or Google) | **Account**: first name, last name, email, Cloudflare captcha, then email code (or Google) | Welcome |
| 3 | Step 2: competitors (14 found) | **Pricing page** (the website typed on the landing is never used) | Captcha, then email code (walk stopped here) | Pick the outcomes |
| 4 | Step 3: six campaigns (segments, pain, criteria, estimated companies) | **Stripe Checkout**: card required, $0 today, $99/month after 7 days | | Returns |
| 5 | Step 4: real companies found | App is gated: every route redirects to `/pricing` until a card is on file | | Loading (site read) |
| 6 | Step 5: real decision makers, with emails and which provider found them | | | Services |
| 7 | Step 6: a real email written to one of them, editable, with the reasoning behind each sentence | | | Audiences |
| 8 | **Email + card on the same screen** ("Claim $30 credits & send", Stripe Payment Element, "You won't be charged yet", countdown "2:44", "Only 7 trial spots left this hour") | | | Consent |
| 9 | | | | 6 offer levers |
| 10 | | | | Recap |
| 11 | | | | **Account** |
| 12 | | | | Pricing / budget |
| 13 | | | | **Stripe** |

- **Explee shows the whole product before asking for anything.** Six steps, about 90
  seconds, no account: the company read, the competitors, six ready campaigns with
  market sizes, companies, people with verified emails, and a written email. The only
  wall is email + card, asked together, on the screen that shows the email ready to go.
- **Creating an Explee account does not get you further.** Sign in, then Create account
  (email + 6-digit code, no password) lands on an empty "Enter your company website"
  page that re-runs the same six steps and ends on the same card screen. Nothing is
  saved to the account until the card is given.
- **Gojiberry asks for the account on screen 2 and the card on screen 4**, and shows
  nothing of the product before both. The website typed on the landing is dropped.
- **Origami asks for the account on screen 2**: first name, last name, email, then a
  Cloudflare "Verify you are human" checkbox before the email code (or Google). The
  domain typed on the landing is not used before the account exists. The walk stopped
  at that checkbox, which a person has to tick; the rest of Origami is still to capture.

## What their API answers (their data model)

- Explee `GET /api/project/<domain>` (`__flow/api/GET-explee.com_api_project_tidycal.com.json`):
  `company`, `determinants` (4 one-line facts), `competitors`, `search_queries`,
  `segments` (label, pain, use case, criteria, negative criteria, keywords, example
  clients, share of market, estimated companies, buyer type, decision maker sentence,
  target geo), `segment_runs`, `domains`, `pipeline_log`.
- Explee `POST /api/draft/generate`: the email, plus `highlights`, one per sentence,
  each tagged `research` or `instructions` with the source it came from. This is what
  the "why this sentence" UI reads.
- Explee companies and people come as parquet files (`/api/agent/<id>/file/_companies.parquet`).
- Gojiberry `/accounts/register`, `/accounts/profile`, `/accounts/get-started-status`,
  `/accounts/should-user-do-onboarding`, `/agents`, `/accounts/subscription`.

## Reading for our rewrite

- Explee's order is the one to copy: website, then real output (companies, people, an
  email), then account + card in one screen. Every step before the wall is a result,
  never a question.
- We ask 10 screens of questions (outcomes, returns, services, audiences, consent, six
  levers) before the account, and show no real output (no company, no person, no email).
- Gojiberry and Origami are the other model: account first, product after. Neither shows
  anything before it.
