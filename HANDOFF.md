# Distribute Lead AI — Handoff

## Context

Marketing site for distribute.you — AI cold email tool for SaaS founders. Static HTML/CSS/JS, deployed on Vercel (`website` branch → auto-deploy).

**ICP:** solo AI founders + bootstrapped micro-SaaS.  
**Core claim:** AI reads each prospect's site, writes unique emails. $0.07/contact, 27% open rate.

---

## File Structure

```
/Users/adam/Distribute Lead AI/
├── index.html                          # Main landing page
├── css/styles.css                      # Single shared stylesheet (OKLCH tokens, light/dark)
├── js/
│   ├── components.js                   # Shared nav + footer (synchronous injection)
│   └── main.js                         # Reading progress bar + TOC scroll-spy
├── vercel.json                         # cleanUrls, trailingSlash:false, 301 redirects
├── cold-email-cost-guide/
│   ├── index.html                      # Pillar page
│   ├── cold-email-cost-per-contact.html
│   └── linkedin-inmail-cost-vs-cold-email.html
└── cold-email-for-saas-founders/
    ├── index.html                      # Pillar page
    └── ai-cold-email-saas-founders.html
```

---

## Stack

- Pure HTML/CSS/JS — no build tool, no framework
- Google Fonts: **Inter** (body) + **JetBrains Mono** (labels/data/meta)
- OKLCH color tokens (light + dark themes via `data-theme` on `<html>`)
- `localStorage` key `dt` for theme persistence
- Intersection Observer for scroll reveal
- `window.scroll` for reading progress bar + TOC scroll-spy

---

## Design System

### Color Tokens (CSS custom properties, light theme default via `[data-theme="light"]`)

Key tokens:
- `--bg`, `--bg-alt`, `--surface`, `--surface-hi`
- `--text`, `--sub`, `--muted`
- `--accent` (blue, OKLCH), `--accent-dim`, `--accent-brd`
- `--green`, `--green-dim`, `--green-brd`
- `--border`, `--border-hi`
- `--shadow-card`

Full token set in `css/styles.css` lines ~12–47.

### Font size variables
`--fs-xs`, `--fs-sm`, `--fs-md`, `--fs-lg` — defined in `:root`.

### Layout
- `.wrap` — max-width 1100px, `padding: 0 2rem`

---

## Article Template (post pages)

### HTML structure (all 3 article files use this — do NOT revert to old structure)

```html
<body class="page-guide page-post">
  <div class="post-progress" aria-hidden="true"></div>
  <div id="site-nav"></div>
  <script src="/js/components.js"></script>

  <nav class="post-breadcrumb">...</nav>

  <div class="post-layout">           <!-- 2-col grid: 1fr 252px -->
    <div class="post-main">           <!-- left column -->
      <header class="post-header">   <!-- title, kicker, lede, meta -->
      </header>
      <main class="post-body">       <!-- post-section elements -->
      </main>
    </div>
    <aside class="post-sidebar">     <!-- right column, sticky -->
      <nav class="post-toc">...</nav>
    </aside>
  </div>

  <aside class="post-related">...</aside>
  <div id="site-footer"></div>
  <script src="/js/main.js" defer></script>
</body>
```

### Article visual components

| Class | Purpose |
|---|---|
| `.post-key` | Blue callout box (accent-dim bg, no border-left) |
| `.post-tip` | Green tip box (green-dim bg, no border-left) |
| `.post-callout` | Neutral inline callout |
| `.post-cta-inline` | Mid-article CTA aside |
| `.post-stat-row` / `.post-stat` | White stat cards with shadow (NOT accent-dim bg) |
| `.post-table-wrap` / `.post-table` | Data tables with `.pt-good`, `.pt-bad`, `.pt-ok`, `.pt-hl` cell classes |
| `.post-related-grid` | 4-col related articles grid |

### Critical CSS rules (do NOT break)
- **No `border-left/right/top > 1px` as colored accent** on any block — top AI-tell. Use bg tints + full-perimeter 1px borders instead. Applies to `.post-key`, `.post-tip`, `.toc-active`, all callouts, cards.
- `.post-stat` background: `var(--surface)` with `box-shadow: var(--shadow-card)` — NOT accent-dim
- `.post-key` has `margin-top: 2.5rem`
- `.post-section` spacing: `margin-bottom: 0.5rem`
- TOC active state: bg tint + color change only, no side border

---

## SEO URL Structure

Vercel `cleanUrls: true` — `.html` files served without extension.

| URL | File |
|---|---|
| `/cold-email-cost-guide/cold-email-cost-per-contact` | `cold-email-cost-guide/cold-email-cost-per-contact.html` |
| `/cold-email-cost-guide/linkedin-inmail-cost-vs-cold-email` | `cold-email-cost-guide/linkedin-inmail-cost-vs-cold-email.html` |
| `/cold-email-for-saas-founders/ai-cold-email-saas-founders` | `cold-email-for-saas-founders/ai-cold-email-saas-founders.html` |

Old root-level URLs 301-redirect to cluster URLs via `vercel.json`.

---

## JS Behaviors (main.js)

- **Progress bar:** `.post-progress` width = scroll % of page height
- **TOC scroll-spy:** IntersectionObserver-style via `window.scroll` — adds `.toc-active` to matching `post-toc-list a` as sections enter viewport

---

## Next Possible Work

- More SEO cluster articles (e.g. `/cold-email-for-saas-founders/cold-email-subject-lines`)
- Pillar page content (`cold-email-cost-guide/index.html`, `cold-email-for-saas-founders/index.html`)
- Internal linking improvements
- Dark mode CSS audit for article pages
