/**
 * The `industrial` arm of the homepage A/B test (owner 2026-11-08, HOME-INDUSTRIAL-1108):
 * the SAME homepage (`index-v2.html`), only the hero differs.
 *
 * Built for the target the owner set that day: the solo founder (1-3 people) of a B2B
 * service already making $100k+ a year who wants to scale, and wants something serious.
 * - H1 `Revenue Automation` / `Industrial-Grade`, the second line shimmering with a few
 *   sparkles (first view of a marketing page: the delight tier; CSS only, off under
 *   reduced motion).
 * - The owner's subtitle: "Meet your distribution teammate. ..."
 * - The owner's six words as pills under the form.
 * - No `$190 expected cost per booked meeting` row above the title (owner: sell the
 *   value per dollar, never the cost).
 *
 * Every anchor must match exactly once: a homepage edit that moves one fails loud here
 * (and in its test) instead of serving the control hero under the `industrial` tag.
 *
 * Alias-free: the unit tests call it directly.
 */

const HOT_LEAD_ROW = "__HOT_LEAD_ROW__";
const H1_OPEN = '<h1>Revenue Automation<br><span class="accent">Done For You</span>';
const SUB_RE = /<span class="sub">[^<]*<\/span>\s*<\/h1>/;
const LINKS_END = '<a class="no-site" href="#why">Use it from Claude Code or Grok</a>\n        </div>';

export const INDUSTRIAL_SUBTITLE =
  "Meet your distribution teammate. We bring you meetings, signups and sales, every result measured and auditable.";

export const INDUSTRIAL_PILLS = ["Easy", "Measurable", "Auditable", "Solid", "Fast", "State of the art"] as const;

// Sparkle positions around "Industrial-Grade" (% of the word box) and their delays.
// Fixed, so every visitor of the arm sees the same page.
const SPARKS: ReadonlyArray<[left: number, top: number, delayS: number, sizePx: number]> = [
  [-4, 8, 0, 14],
  [22, -14, 0.5, 10],
  [48, 92, 1.1, 14],
  [70, -10, 1.6, 10],
  [96, 30, 0.8, 14],
  [104, 86, 1.9, 10],
  [36, -18, 2.2, 12],
];

const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0l2.6 9.4L24 12l-9.4 2.6L12 24l-2.6-9.4L0 12l9.4-2.6z"/></svg>';

// A light band sweeps across the blue word, then rests (ease-in-out: on-screen motion);
// sparkles twinkle in place. Transforms, opacity and background-position only.
// `main.js` splits the hero title into `.w` word spans (each with its own transform and
// blur): a clip on `.ig` alone paints nothing through them, so the word carries the clip
// and chains the shine after its own entrance.
export const INDUSTRIAL_STYLE = `<style>
.ig{position:relative;display:inline-block;background:linear-gradient(100deg,#2563eb 0%,#2563eb 38%,#a5c8ff 48%,#fff 50%,#a5c8ff 52%,#2563eb 62%,#2563eb 100%);background-size:250% 100%;background-position:100% 0;-webkit-background-clip:text;background-clip:text;color:transparent;animation:ig-shine 3.2s cubic-bezier(0.77,0,0.175,1) .4s infinite;filter:drop-shadow(0 0 18px rgba(37,99,235,.28))}
@keyframes ig-shine{0%{background-position:100% 0}55%,100%{background-position:0 0}}
.hero h1 .ig>.w{background:inherit;background-size:250% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:word-in .7s cubic-bezier(0.2,0.7,0.2,1) forwards,ig-shine 3.2s cubic-bezier(0.77,0,0.175,1) 1.2s infinite;animation-delay:calc(var(--i,0)*70ms),1.2s}
.ig-spark{position:absolute;pointer-events:none;opacity:0;animation:ig-twinkle 2.4s ease-in-out infinite}
.ig-spark svg{display:block;width:100%;height:100%;fill:#f5b301}
@keyframes ig-twinkle{0%,100%{opacity:0;transform:scale(.2) rotate(0deg)}40%{opacity:1;transform:scale(1) rotate(45deg)}70%{opacity:0;transform:scale(.4) rotate(90deg)}}
.ig-pills{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px;padding:0;list-style:none}
@media (max-width:1100px){.ig-pills{justify-content:center}}
.ig-pills li{font-size:13px;line-height:1;padding:7px 12px;border:1px solid #e5e7eb;border-radius:999px;background:#fff;color:#111827}
@media (prefers-reduced-motion:reduce){.ig{animation:none;background-position:0 0}.ig-spark{display:none}}
</style>`;

function sparks(): string {
  return SPARKS.map(
    ([l, t, d, s]) =>
      `<span class="ig-spark" aria-hidden="true" style="left:${l}%;top:${t}%;width:${s}px;height:${s}px;animation-delay:${d}s">${STAR}</span>`,
  ).join("");
}

function once(html: string, needle: string | RegExp, what: string): void {
  const n = typeof needle === "string" ? html.split(needle).length - 1 : (html.match(new RegExp(needle, "g")) ?? []).length;
  if (n !== 1) throw new Error(`[landing] industrial hero: expected one ${what} in the homepage, found ${n}`);
}

export function withIndustrialHero(html: string): string {
  once(html, HOT_LEAD_ROW, "hot-lead row token");
  once(html, H1_OPEN, "control H1");
  once(html, SUB_RE, "hero subtitle");
  once(html, LINKS_END, "hero links block");
  const pills = `<ul class="ig-pills">${INDUSTRIAL_PILLS.map((p) => `<li>${p}</li>`).join("")}</ul>`;
  return html
    .replace(HOT_LEAD_ROW, INDUSTRIAL_STYLE)
    .replace(H1_OPEN, `<h1>Revenue Automation<br><span class="accent ig">Industrial-Grade${sparks()}</span>`)
    .replace(SUB_RE, `<span class="sub">${INDUSTRIAL_SUBTITLE}</span>\n        </h1>`)
    .replace(LINKS_END, `${LINKS_END}\n        ${pills}`);
}
