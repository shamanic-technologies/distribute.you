# Distribute Lead AI — Handoff

## What this is

Marketing site for **distribute.you** — AI cold email outreach tool for SaaS founders / B2B.
Static HTML/CSS/JS. No framework, no build step.

**ICP:** solo AI founders, bootstrapped micro-SaaS.
**Core claim:** AI reads each prospect's site, writes unique emails. $0.07/contact, 27% open rate.

---

## Deployment

- **Vercel project:** `distribute-landing` under team `blooming-generation`
- **`.vercel/project.json`:** `{ "projectId": "prj_Bk1opzmyy6hBaYaDx3yz2849L2C2", "orgId": "team_lYmJIUH6q2rTY6dUfDiYtpAt" }`
- **Production URL:** `https://distribute.you`
- Framework preset: none (static, cleared manually via API)
- `vercel.json`: `cleanUrls: true`, `trailingSlash: false`, 301 redirects for old root URLs + pricing-test

### Deploy workflow (read this before touching Vercel)

**⛔ NEVER run `vercel --prod` or `vercel deploy --prod` locally — ever.**
It uploads a stale local build, hijacks the production domain instantly, AND wipes
the project's build settings (framework, output dir, env). This caused a 404 on
sign-in. `autoAssignCustomDomains: true` means the last prod deploy always wins —
recovery requires manually re-entering all build settings in the Vercel dashboard.

**Ship to production → merge to `main` branch.** Vercel auto-builds and publishes.

**Local preview only (never touches prod domain):**
```bash
vercel deploy   # NO --prod flag → creates a preview URL only
```

**Promote a preview to production without re-uploading:**
```bash
vercel promote <preview-url> --scope blooming-generation
```
Use this after `vercel deploy` (no --prod) builds a READY preview, or to roll back.

**NOTE on branch strategy:** The repo `shamanic-technologies/distribute.you` is a monorepo.
`main` = app code (dashboard, services). `website` = landing site only.
Never merge `website` into `main` — they are independent branches with different histories.

---

## File Structure

```
/Users/adam/Distribute Lead AI/
├── index.html                                          # Main landing page
├── pricing.html                                        # Live pricing page (distribute.you/pricing)
├── pricing-test.html                                   # noindex draft — redirects to /pricing via vercel.json
├── how-it-works.html
├── use-cases.html
├── performance.html
├── privacy.html
├── terms.html
├── sitemap.xml                                         # 20 URLs (includes /pricing)
├── robots.txt                                          # Allow all, Disallow /design-system
├── llms.txt                                            # AI crawler index
├── css/
│   ├── base.css                                        # Tokens + nav + footer + animations + a11y (ALL pages)
│   ├── marketing.css                                   # Hero → integrations, pricing, perf, how-it-works, use-cases
│   └── articles.css                                    # Pillar + article template + legal pages
├── js/
│   ├── components.js                                   # Nav + footer injection (synchronous)
│   └── main.js                                         # Progress bar, TOC spy, related articles shuffle
├── vercel.json
├── cold-email-cost-guide/
│   ├── index.html                                      # Pillar page
│   ├── cold-email-cost-per-contact.html
│   ├── linkedin-inmail-cost-vs-cold-email.html
│   ├── cold-email-roi.html
│   └── cold-email-setup-cost.html
├── cold-email-for-saas-founders/
│   ├── index.html                                      # Pillar page
│   ├── ai-cold-email-saas-founders.html
│   ├── cold-email-subject-lines-saas.html
│   ├── b2b-cold-email-reply-rate.html
│   └── cold-email-personalization-at-scale.html
└── cold-email-vs-linkedin/
    ├── index.html                                      # Pillar page
    ├── cold-email-vs-linkedin-ads.html
    ├── b2b-outbound-channel-comparison.html
    ├── linkedin-connection-request-vs-cold-email.html
    └── multichannel-outreach-strategy.html
```

### CSS split (base / marketing / articles)

`css/styles.css` is the legacy monolith — do not edit it. All pages now load split files:

| File | Pages that load it |
|------|-------------------|
| `css/base.css` | ALL pages |
| `css/marketing.css` | index, use-cases, how-it-works, pricing, pricing-test, performance |
| `css/articles.css` | all pillar/article pages, privacy, terms |

Each page's `<head>` has:
```html
<link rel="stylesheet" href="/css/base.css">
<link rel="stylesheet" href="/css/marketing.css">   <!-- or articles.css -->
```

---

## Google Ads Tracking

**Tag ID:** `AW-18233267088`

Added to ALL site HTML pages (except design-system, landing page v2, Distribute dashboard).
Injected right after `<meta charset="UTF-8">`:

```html
<!-- Google Ads tag -->
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18233267088"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'AW-18233267088');
</script>
```

### Conversion tracking

Event name: `manual_event_PURCHASE`

Auto-attaches to ALL `app.distribute.you` links via DOMContentLoaded listener.
Fires before navigation, waits max 2000ms for Google to record, then redirects.

```html
<script>
  function gtagSendEvent(url) {
    var callback = function () { if (typeof url === 'string') window.location = url; };
    gtag('event', 'manual_event_PURCHASE', { 'event_callback': callback, 'event_timeout': 2000 });
    return false;
  }
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('a[href^="https://app.distribute.you"]').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); gtagSendEvent(this.href); });
    });
  });
</script>
```

**App URL:** `https://app.distribute.you` (no `/signup` — that page does not exist)

To set up the conversion action in Google Ads:
Tools → Conversions → add action → Website → use event `manual_event_PURCHASE`.

---

## Stack

- Pure HTML/CSS/JS — no build tool
- Google Fonts: **Inter** (body) + **JetBrains Mono** (labels/mono/meta)
- OKLCH color tokens — light mode only (`data-theme="light"` hardcoded)
- Intersection Observer for scroll reveal, `window.scroll` for progress bar + TOC spy

---

## Design System

### Color tokens (light theme in `[data-theme="light"]`)

```css
--bg, --bg-alt, --surface, --surface-hi
--text, --sub, --muted, --body
--accent, --accent-hi, --accent-dim, --accent-brd
--green, --green-dim, --green-brd
--border, --border-hi
--shadow-card
```

Full token set: `css/base.css` lines ~12–95.

### Font size variables (`:root`)

```css
--fs-2xs: 0.625rem
--fs-xs:  0.7rem
--fs-sm:  0.8rem
--fs-base: 0.9rem
--fs-md:  1rem
--fs-lg:  1.1rem
```

### Type scale classes

```css
.t-hero    /* clamp(2.8rem, 6.5vw, 5.25rem)  — main hero headings only */
.t-display /* clamp(2.25rem, 5vw, 3.5rem)    — pricing h1, CTA section title */
.t-h2      /* clamp(1.75rem, 3vw, 2.5rem)    — section headings */
.t-h3      /* var(--fs-lg)                   */
.t-body    /* var(--fs-md)                   */
.t-sm      /* var(--fs-base)                 */
.t-lbl     /* JetBrains Mono, --fs-xs, uppercase */
.t-mono    /* JetBrains Mono, --fs-base      */
```

`.s-cta .t-hero` is overridden to `.t-display` size — CTA titles are NOT as large as hero titles.

### Layout containers

```css
.wrap        /* max-width: 1100px */
.wrap-sm     /* max-width: 700px  */
.wrap-narrow /* max-width: 920px  */
.wrap-faq    /* max-width: 760px  */
```

---

## Absolute Design Rules (never break)

1. **No `border-left/right/top > 1px` as colored accent** on any block element (cards, callouts, list items, alerts). Use background tints + full-perimeter 1px borders, or leading icons, or nothing.
2. **No em-dash `—` (U+2014)** in any user-facing copy. Use `:`, `,`, `.`, or `()` instead.
3. **No emojis** in code/copy unless user explicitly requests.
4. All new user-facing copy must pass humanizer review before shipping.

---

## Dark CTA Section (`.s-cta`)

Used at the bottom of every page. Background: `oklch(6.5% 0.012 264)` with radial gradient glow.

```html
<section class="s-cta">
  <div class="wrap">
    <div class="r">
      <h2 class="t-hero">Your headline here.</h2>
      <p>Supporting line.</p>
      <a href="https://app.distribute.you" class="btn btn-p btn-lg">CTA button</a>
    </div>
  </div>
</section>
```

The `.t-hero` inside `.s-cta` is automatically downsized to `.t-display` via CSS override.

---

## FAQ Style (all pages)

Use `<details>`/`<summary>` with class `.guide-faq-item` (pillar pages) or `.faq-item` (pricing).
Both render as cards with shadow + full border. No flat bordered lists.

```html
<div class="guide-faq r">
  <details class="guide-faq-item">
    <summary><span class="guide-faq-q">Question text</span><svg class="guide-faq-chevron">...</svg></summary>
    <p class="guide-faq-a">Answer text.</p>
  </details>
</div>
```

---

## Pricing Page

**Live URL:** `https://distribute.you/pricing` — file: `pricing.html`
`pricing-test.html` still exists (noindex) and 301-redirects to `/pricing` via `vercel.json`.

### Calculator (Google Ads style)

Budget slider $20–$1000 with quick buttons ($20/$50/$100/$250/$500).
Live outputs: contacts / opens / replies / qualified leads / cost per lead.

Math constants:
```js
COST = 0.07        // $ per contact
OPEN_RATE = 0.35
REPLY_RATE = 0.05
QUALIFY = 0.40
```

At $100: ~1,428 contacts / 499 opens / 71 replies / 28 qualified leads / $3.57 CPL.

---

## Article Template

**Body classes:** `page-guide page-post`

**Structure:**
```html
<body class="page-guide page-post">
  <div class="post-progress" aria-hidden="true"></div>
  <div id="site-nav"></div>
  <script src="/js/components.js"></script>
  <nav class="post-breadcrumb">...</nav>
  <div class="post-layout">             <!-- grid: 1fr 252px -->
    <div class="post-main">
      <header class="post-header">...</header>
      <main class="post-body">
        <!-- .post-section elements -->
      </main>
    </div>
    <aside class="post-sidebar">
      <nav class="post-toc">...</nav>
    </aside>
  </div>
  <aside class="post-related">
    <div class="post-related-inner">
      <div class="post-related-grid"></div>  <!-- JS fills 3 random cards -->
    </div>
  </aside>
  <div id="site-footer"></div>
  <script src="/js/main.js" defer></script>
</body>
```

**Article components:**

| Class | Purpose |
|---|---|
| `.post-key` | Blue callout (accent-dim bg, full border — no side accent) |
| `.post-tip` | Green tip box |
| `.post-callout` | Neutral inline callout |
| `.post-cta-inline` | Mid-article CTA |
| `.post-stat-row` / `.post-stat` | Stat cards with shadow, `var(--surface)` bg |
| `.post-table-wrap` / `.post-table` | Data tables with `.pt-good`, `.pt-bad`, `.pt-ok`, `.pt-hl` |
| `.post-related-grid` | Filled by JS — leave empty in HTML |

**JSON-LD schema** on all articles: `Article` + `BreadcrumbList` in `@graph`, injected in `<head>`.

---

## Related Articles (JS)

`js/main.js` contains a self-contained IIFE that:
- Holds a pool of all articles (url, tag, title, desc)
- Filters out the current page
- Fisher-Yates shuffles the pool
- Renders 3 random `.post-related-card` links into `.post-related-grid`

**To add new articles:** append to the `ARTICLES` array in main.js and add an empty `<div class="post-related-grid"></div>` in the article HTML.

---

## Legal Pages

`privacy.html` and `terms.html` — body class `page-legal`.
CSS in `css/articles.css` under `/* ── Legal pages ──*/`.
Uses `var(--fs-lg)` for h2, `var(--fs-md)` for body text.

---

## SEO Files

- `sitemap.xml` — 20 URLs, priorities: homepage 1.0, pillar 0.9, articles 0.8, other 0.7
- `robots.txt` — allow all, disallow `/design-system`, points to sitemap
- `llms.txt` — AI crawler friendly index of all content

---

## Old Vercel Project (deprecated)

Previous deploys went to `distribute-lead-ai` under `adam-atomic-gits-projects`.
That project still exists but is no longer updated. All future deploys go to `distribute-landing` / `blooming-generation`.
