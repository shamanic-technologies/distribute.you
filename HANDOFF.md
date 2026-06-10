# Distribute Lead AI — Handoff

## Context

Co-founder pitch dossier for distribute.you. Deliverable: standalone HTML landing page demonstrating Design + Growth + Product. Sent to founders to close co-founder deal.

**Their 3 confirmed problems:** low conversion, comprehension gap, weak SEO.  
**ICP:** solo AI founders + bootstrapped micro-SaaS (NOT agencies).

---

## File Structure

```
/Users/adam/Distribute Lead AI/
├── index.html          # 58KB standalone — no build tool, no framework
└── logo/
    └── logo-distribute-2.svg   # 750×750 SVG, dark bg + blue "D" glyph
```

---

## Stack

- Pure HTML/CSS/JS — no Tailwind, no bundler
- Google Fonts: **Plus Jakarta Sans** (body) + **JetBrains Mono** (labels/data)
- `localStorage` for light/dark theme persistence
- Intersection Observer for scroll reveal (`.r` → `.on`)
- Counter animation on stats scroll-in

---

## Design System

### Color Tokens (CSS custom properties on `<html class="light|dark">`)

| Token | Light | Dark |
|---|---|---|
| `--bg` | `#F8F8F6` | `#0A0A0F` |
| `--bg-alt` | `#F1F1EE` | `#0F0F16` |
| `--surface` | `#FFFFFF` | `#131319` |
| `--surface-hi` | `#F5F5F2` | `#1A1A24` |
| `--text` | `#0E0E14` | `#EEEEF3` |
| `--muted` | `#606070` | `#8080A4` |
| `--sub` | `#3E3E50` | `#ABABC2` |
| `--accent` | `#2563EB` | `#4A7DFF` |

### Type Scale

| Class | Size | Use |
|---|---|---|
| `.t-hero` | `clamp(3rem, 7vw, 5.5rem)` | Hero headline |
| `.t-h2` | `clamp(1.875rem, 3.5vw, 2.75rem)` | Section titles |
| `.t-h3` | `1.1rem` | Card titles, step headers |
| `.t-body` | `1rem` | Body copy, CTAs, nav |
| `.t-sm` | `0.85rem` | Secondary text, footnotes |
| `.t-lbl` | `0.7rem` (JetBrains Mono) | Chips, badges, category labels |
| `.t-mono` | `0.85rem` (JetBrains Mono) | Code/data display |

### Layout

- Max-width: `1100px` via `.wrap`
- Section padding: `6rem 0`
- Alternating backgrounds: `section` = `--surface`, `section.alt` = `--bg-alt`

---

## Key Sections

1. **Nav** — sticky, blur backdrop, logo + beta chip, theme toggle
2. **Hero** — headline + sub + CTA pair + hero note
3. **Stats** — contained dark card (`.stats-card`) inside white section (`.stats-outer`), 4 counters
4. **How it works** — 3-step process with step numbers
5. **Channels** — 9 channel chips with color-coded categories
6. **Who ships with Distribute** — ICP section (dark `.ai-block`)
7. **Compare** — side-by-side "before/after" grid
8. **Pricing** — pay-as-you-go card + $25 CTA
9. **Integrations** — Gmail, Slack, Zapier, etc.
10. **Footer** — logo, links, legal

---

## Accessibility

- WCAG AA contrast on all text
- `focus-visible` outlines on all interactive elements
- `prefers-reduced-motion` disables all animations
- Semantic HTML throughout

---

## What Was Improved vs distribute.you

| Problem | Fix |
|---|---|
| Headline too abstract ("Stripe of leads") | Concrete: "$1.42/reply. Drop a URL, get qualified leads in Gmail." |
| Workflow not concrete | 3-step How it works with specific outputs |
| Not niched | ICP section explicitly targets solo founders |
| No SEO signals | Title tag with price, meta desc, JSON-LD schema |
| Low visual hierarchy | 5-level type scale, alternating section backgrounds |
| Gray-on-gray illegibility | Token-level contrast fix + surface/bg-alt structure |
