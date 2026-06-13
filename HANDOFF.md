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
- `vercel.json`: `cleanUrls: true`, `trailingSlash: false`, 301 redirects for old root URLs

### Deploy workflow (read this before touching Vercel)

**NEVER run `vercel --prod` locally.** It uploads a local build and hijacks the domain
instantly, overriding the real GitHub-triggered build. `autoAssignCustomDomains: true`
means the last production deploy always wins — your stale local build will freeze the
live site for hours.

**Ship to production → push to `website` branch:**
```bash
git push origin website
```
Vercel's `productionBranch` must be set to `website` for this to auto-promote.
Change it at: https://vercel.com/blooming-generation/distribute-landing/settings/git
(Production Branch field → change `main` to `website`)

**Local preview (safe, never touches the production domain):**
```bash
vercel   # no --prod flag → creates a preview URL only
```

**Promote a preview to production without re-uploading:**
```bash
vercel promote <preview-url> --scope blooming-generation
```
Use this after `vercel` (no --prod) builds a READY preview, or to roll back to any previous build.

**NOTE on branch strategy:** The repo `shamanic-technologies/distribute.you` is a monorepo.
`main` = app code (dashboard, services). `website` = landing site only.
Never merge `website` into `main` — they are independent branches with different histories.

---

## File Structure

```
/Users/adam/Distribute Lead AI/
├── index.html                                          # Main landing page
├── pricing-test.html                                   # Pricing page (noindex, draft)
├── privacy.html                                        # Privacy policy
├── terms.html                                          # Terms of service
├── sitemap.xml                                         # 19 URLs
├── robots.txt                                          # Allow all, Disallow /design-system
├── llms.txt                                            # AI crawler index (Perplexity, ChatGPT, Bing)
├── css/styles.css                                      # Single shared stylesheet
├── js/
│   ├── components.js                                   # Nav + footer injection (synchronous)
│   └── main.js                                         # Progress bar, TOC spy, related articles shuffle
├── vercel.json
├── cold-email-cost-guide/
│   ├── index.html                                      # Pillar page
│   ├── cold-email-cost-per-contact.html
│   ├── linkedin-inmail-cost-vs-cold-email.html
│   └── cold-email-setup-cost.html
├── cold-email-for-saas-founders/
│   ├── index.html                                      # Pillar page
│   ├── ai-cold-email-saas-founders.html
│   └── cold-email-personalization-at-scale.html
└── cold-email-vs-linkedin/
    ├── index.html                                      # Pillar page
    ├── cold-email-vs-linkedin-ads.html
    ├── b2b-outbound-channel-comparison.html
    ├── linkedin-connection-request-vs-cold-email.html
    └── multichannel-outreach-strategy.html
```

**12 articles total** — 4 per pillar page.

---

## Stack

- Pure HTML/CSS/JS — no build tool
- Google Fonts: **Inter** (body) + **JetBrains Mono** (labels/mono/meta)
- OKLCH color tokens — light mode only (`data-theme="light"` hardcoded, `localStorage` key `dt` unused)
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

Full token set: `css/styles.css` lines ~12–95.

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
      <a href="..." class="btn btn-p btn-lg">CTA button</a>
    </div>
  </div>
</section>
```

The `.t-hero` inside `.s-cta` is automatically downsized to `.t-display` via CSS override.

---

## FAQ Style (all pages)

Use `<details>`/`<summary>` with class `.guide-faq-item` (pillar pages) or `.faq-item` (pricing-test).
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

**JSON-LD schema** on all 12 articles: `Article` + `BreadcrumbList` in `@graph`, injected in `<head>`.

---

## Related Articles (JS)

`js/main.js` contains a self-contained IIFE that:
- Holds a pool of 12 articles (url, tag, title, desc)
- Filters out the current page
- Fisher-Yates shuffles the pool
- Renders 3 random `.post-related-card` links into `.post-related-grid`
- Runs on every page (not restricted to `page-post`)

**To add new articles:** append to the `ARTICLES` array in main.js and add an empty `<div class="post-related-grid"></div>` in the article HTML.

---

## Legal Pages

`privacy.html` and `terms.html` — body class `page-legal`.
CSS in `styles.css` under `/* ── Legal pages ──*/`.
Uses `var(--fs-lg)` for h2, `var(--fs-md)` for body text.

---

## SEO Files

- `sitemap.xml` — 19 URLs, priorities: homepage 1.0, pillar 0.9, articles 0.8, other 0.7
- `robots.txt` — allow all, disallow `/design-system`, points to sitemap
- `llms.txt` — AI crawler friendly index of all content

---

## Pricing Page (draft)

`pricing-test.html` — `noindex`. URL: `https://distribute.you/pricing-test`.
Prices are provisional placeholders. Rename to `pricing.html` + remove `noindex` when prices confirmed.
Has its own `<style>` block (page-specific CSS). Uses `.t-display` for h1, `.s-cta` for CTA section.

---

## Old Vercel Project (deprecated)

Previous deploys went to `distribute-lead-ai` under `adam-atomic-gits-projects`.
That project still exists but is no longer updated. All future deploys go to `distribute-landing` / `blooming-generation`.
