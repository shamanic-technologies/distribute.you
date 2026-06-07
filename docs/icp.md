# distribute.you — Ideal Customer Profile

**Status:** Living document. Source of truth for landing copy, ads, sales, product decisions.
**Last updated:** 2026-05-22.

---

## ICP #1 — Théo, the Serial Builder

### Identity statement

> "I'm 16-40. CEO-founder, mostly solo. I build non-stop. I always have several SaaS in bench. I don't have time to breathe between newsletter, content, distribute.you campaigns, meetings, monitoring, replies, workflows, and refining the ICP of my own campaigns. I want someone close to me — founder reachable, bugs fixed fast, features shipped fast."

### The dream (never forget this)

> "One of my products is going to take off. I want it to take off because of my marketing, my distribution, my ICP — not because I hired a marketing team or raised a Series A. I want to stay solo. I want to ride one product from $0 to $1M MRR without ever needing to become a 'real company.' distribute.you is the lever that makes that math work."

The dream is **stay solo, go big.** Every product decision, every roadmap item, every line of copy must support this trajectory: a single founder, riding the right product, becoming a millionaire on their own terms. Anything that implies "you're too small for this" or "wait until you're a real company" is wrong.

### Demographics & context

| Dimension | Value |
|---|---|
| Age | 16-40 (modern builders start young — Pieter Levels archetype, Gen Z indie hackers) |
| Status | Solo CEO-founder, sometimes 1-3 ppl max |
| Profile | Marketing-first builder, codes sometimes. CEO-leaning. Distribution + growth obsessed. |
| Portfolio | 3-10 active products at any time. Always testing. |
| Code stack | Cursor / Claude Code / Lovable / v0. Not necessarily senior engineer. |
| Primary device | Desktop. Mobile is read-only glance. |
| Notification channel | Email (Gmail). No mobile push. |

### Mindset & strategy

| Dimension | Value |
|---|---|
| Mental model | VC on his own products. Allocates budget per bet. |
| Strategy | A/B channels × A/B products. Kill < 4 weeks if CAC > LTV. Scale 10x if CAC < LTV/3. |
| North-star metric | Real CAC ($/qualified reply, $/paid conversion) |
| Budget | $5-15/day per product × N products. 100% variable. |
| Subscription tolerance | Refused outright. |
| Setup tolerance | < 5 min. Ideally 30 seconds — URL + budget. |

### Time poverty

Théo has **no time** between:

- Writing his newsletter
- Producing content
- Launching distribute.you campaigns across multiple products
- The meetings these generate
- Monitoring campaigns
- Managing qualified replies
- Refining his own workflows / templates / ICPs

He buys **time** and **leverage**, not a tool.

### Infrastructure: what he refuses vs accepts

| Refuses | Accepts |
|---|---|
| Buying a sending domain | Email sent from an agency-style address on his behalf |
| SPF / DKIM / DMARC setup | AI qualifies replies + forwards to his Gmail |
| Warming mailboxes for 6 weeks | Only the "gold" leads reach his inbox |
| Triaging raw replies (spam vs lead) | One 30-second setup, back to building |
| Bounces / blacklists / reputation monitoring | Multi-channel in a single dashboard |

### Pricing & trust

| Dimension | Value |
|---|---|
| Margin tolerance | 2x+ accepted if: public unit prices + no subscription + open source + $25 welcome credits |
| Preferred model | Pay-as-you-go prepaid credits (AWS / OpenAI style) |
| Trust triangle | (1) Public unit prices on 50+ primitives (2) Open source on GitHub, 20+ repos (3) Public CAC at `/performance` |
| Self-host | Knows it exists. Never activates in practice (too complex, 20+ repos). Reassurance is enough. |
| $25 welcome credits | Perfect tasting amount. Covers 1-2 micro preview campaigns. |

### Relationship with the founder

Strong expectation:

- Direct access to distribute.you's founder
- Bug → message → fast patch
- Feature request → heard, prioritized when relevant, shipped in days/weeks
- No enterprise support, no ticketing system
- Twitter DM / GitHub issue / direct email = accepted channels
- Wants to feel he has "the boss's number"

Implications: founder is accessible, roadmap is public, response time is visible.

### Catalog expectations

| Dimension | Value |
|---|---|
| Mental model | A growing marketplace of channels. Stripe analogy taken literally (1 payment method → 50+). |
| Vitality signal | At least one new channel per month |
| FOMO levers | VC Outreach, Accelerators Outreach, Influencers, LinkedIn (coming) |
| Custom workflow | Forks an existing recipe → tunes (prompt / model / sequence) → deploys on his own account → sees his $/outcome |
| Contribution path | PR on a public repo → merged → re-billed for everyone |

### Pricing stack (3 layers)

```
Layer 1 — PRIMITIVES (public, fixed unit price, margin included)
  50+ priced API items

Layer 2 — WORKFLOWS (recipes that combine primitives, forkable)
  Compete on $/outcome

Layer 3 — OUTCOMES (derived, measured a posteriori)
  $/qualified reply, $/paid conversion = CAC components
```

### Vocabulary

| Anti | Pro |
|---|---|
| "synergy" / "enterprise-ready" / "transformation" | "ship" / "MRR" / "ICP" / "CAC" / "BYOK" |
| "book a demo" / "talk to sales" | "self-serve" / "$X credits" / "go" |
| "per-seat pricing" / "monthly minimum" | "pay-as-you-go" / "no subscription" |
| Lock-in / opaque pricing | Open source / unit prices public |

### Acquisition channels (where Théo lives)

- Hacker News front page (Show HN)
- X indie sphere (`@levelsio`, `@swyx`, `@theo`, `@marc_louvion`)
- Indie Hackers
- `/r/SaaS`
- Build-in-public threads
- Founder podcasts
- MCP awesome lists (secondary)

---

## Platform reality check (as of 2026-05-22)

Claims that can be made on landing without "coming soon" caveats:

- 9 channels live (Sales · PR · VC · Hiring · Accelerators · PR Expert Quote · Outlet Discovery · Press Kit · AI Visibility)
- $25 welcome credits
- AI reply qualification + Gmail forwarding (manual on the founder's side today, transparent to users)
- Managed sender infrastructure (warmed agency address)
- Multi-brand UI in the dashboard
- Custom workflow forking inside the dashboard
- Public `/pricing` page listing primitives
- Open source on GitHub (20+ repos)
- Public CAC at `/performance`

Caveat: positive-reply stats on `/performance` currently understate reality because positive-reply qualification is not yet automated end-to-end. To be fixed before pushing the leaderboard hard in copy.

---

## How to use this document

- **Writing landing copy:** target Théo. Every section must answer "is this useful for Théo?". If not, cut.
- **Writing ads:** Théo's vocab pro/anti list above. Channels list = where to run.
- **Prioritizing features:** does this reduce time poverty, increase CAC clarity, expand the catalog, or strengthen founder proximity? If none, deprioritize.
- **Pricing decisions:** keep unit prices public, keep $25 credits, keep no-subscription. Margin can stay 2x+ but never advertised — the price is the price.
- **Roadmap signal:** at least one new channel per month is non-negotiable for retention of this ICP.
