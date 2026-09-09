import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The homepage, served at `/`.
 *
 * It was authored in the lab beside the competitor clones it borrows from, on its own
 * host and behind a password, and promoted to the apex once the owner signed off. It is
 * hand-written HTML, so nothing else in the repo pins its copy: these guards hold the
 * decisions that were made out loud while it was designed, so a later edit cannot
 * quietly undo one.
 */
const LANDING = path.resolve(__dirname, "../../public/landing");
const html = readFileSync(path.join(LANDING, "index-v2.html"), "utf8");
const css = readFileSync(path.join(LANDING, "v2/styles.css"), "utf8");
const js = readFileSync(path.join(LANDING, "v2/main.js"), "utf8");
const route = readFileSync(path.resolve(__dirname, "../../src/app/route.ts"), "utf8");

describe("the homepage is self-contained", () => {
  it("ships its three files and its assets", () => {
    for (const file of ["index-v2.html", "v2/styles.css", "v2/main.js", "v2/assets/logo-mark.svg"]) {
      expect(existsSync(path.join(LANDING, file)), `${file} is missing`).toBe(true);
    }
  });

  it("is what / serves", () => {
    expect(route).toContain('staticResponse("index-v2.html"');
  });

  it("links only its own stylesheet and script, never the previous homepage's", () => {
    // Root-absolute and namespaced under `v2/`: the page was authored at the root of its
    // own lab host, so every reference it carried was root-absolute. Keeping them that
    // way (rather than the `css/` + `js/` form `staticHtml` rewrites) is what stops
    // `main.js` and `styles.css` colliding with the previous homepage's files.
    expect(html).toContain('href="/landing/v2/styles.css?v=11"');
    expect(html).toContain('src="/landing/v2/main.js?v=8"');
    expect(html).not.toContain("/landing/css/");
    expect(html).not.toContain("/landing/js/");
    // Nothing may reference the lab's own root paths: those resolved on `lab-distribute`
    // and resolve nowhere here.
    expect(html).not.toMatch(/(href|src)="\/(styles\.css|main\.js|assets\/)/);
  });

  it("carries no unresolved live-figure token", () => {
    // The page states its figures outright. It may grow tokens now that it is on the
    // pipeline (`__CAC_PRICE__` and friends resolve here, unlike on the lab host), but a
    // token the pipeline does not handle would ship to a reader as itself. So the check
    // is not "no tokens" — it is "every token in the source is one `static-html.ts`
    // replaces".
    const pipeline = readFileSync(path.join(process.cwd(), "src/lib/static-html.ts"), "utf8");
    for (const token of new Set(html.match(/__[A-Z_]+__/g) ?? [])) {
      expect(pipeline, `${token} is in the homepage but nothing resolves it`).toContain(token);
    }
  });

  it("is indexable, canonical, and states its own card", () => {
    expect(html).not.toContain("noindex");
    expect(html).toContain('<link rel="canonical" href="https://distribute.you/">');
    expect(html).toContain('<meta property="og:url" content="https://distribute.you/">');
    expect(html).toContain('content="https://distribute.you/opengraph-image"');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
  });

  it("declares no favicon of its own", () => {
    // `staticHtml` injects the charter icon into every served page. A second
    // `rel="icon"` here would leave which one the browser picks unspecified.
    expect(html).not.toMatch(/<link[^>]+rel="icon"/);
  });
});

/**
 * Prose only. The bans below are about COPY, and a whole-file check would fire on the
 * stylesheet and the script instead.
 */
const copy = html
  .replace(/<style[\s\S]*?<\/style>/g, "")
  .replace(/<script[\s\S]*?<\/script>/g, "");

describe("an existing customer can log in at every width", () => {
  // The pill hid `Log in` below 640px and the footer carries no login link, so on a
  // phone the homepage offered no way back into an account at all. Measured at
  // 320/360/375/390/414: the button renders 55x40 with a real href and the pill does
  // not overflow, so it is shrunk rather than hidden.
  it("keeps the header Log in at every width", () => {
    expect(html).toContain('href="https://dashboard.distribute.you/sign-in">Log in');
    expect(css).not.toMatch(/\.nav-right \.btn-ghost \{[^}]*display:\s*none/);
  });
});

describe("the cost belongs to the client, never to us", () => {
  // The client authorises a daily budget and is charged the budget spent. The measured
  // cost is THEIR cost of acquisition, and our margin sits inside it — so the page may
  // neither call the cost ours nor claim there is no margin.
  it("never frames the cost as ours", () => {
    expect(copy).not.toMatch(/costs? us\b/i);
    expect(copy).not.toMatch(/\bour (?:live )?cost per\b/i);
  });

  it("claims no at-cost or zero-margin pricing, which would be false", () => {
    expect(copy).not.toMatch(/\bat cost\b/i);
    expect(copy).not.toMatch(/\bpass-?through\b/i);
    expect(copy).not.toMatch(/\bno mark-?up\b/i);
  });

  it("promises no result, only the measurement", () => {
    expect(copy).not.toMatch(/\bguaranteed (?:sales )?meetings\b/i);
    expect(copy).not.toMatch(/\bwe guarantee results\b/i);
  });
});

describe("homepage copy discipline", () => {
  it("ships no em-dash", () => {
    expect(copy).not.toContain("\u2014");
  });

  it("carries a cache-buster on the assets it links", () => {
    // `/landing/v2/styles.css?v=N` is its own edge cache key: editing the file without
    // moving N ships nothing to a returning visitor.
    expect(html).toMatch(/styles\.css\?v=\d+/);
    expect(html).toMatch(/main\.js\?v=\d+/);
  });
});

describe("the offer the page states", () => {
  it("leads with revenue, from one dollar a day, and thirty free dollars", () => {
    expect(html).toContain("Get revenue in 24h");
    expect(html).toContain("From $1/day");
    expect(html).toMatch(/First \$30 free/);
    expect(html).toContain("Start free");
  });

  it("says nothing about the $400 credit match", () => {
    // Owner-decided: the match is a gamification lever for the dashboard, not a landing
    // promise. "Start free" and "$30 free" are what converts.
    expect(html).not.toContain("$400");
  });

  it("marks every not-yet-live pricing item as coming soon, and only there", () => {
    const pricing = html.slice(html.indexOf('id="pricing"'), html.indexOf('id="faq"'));
    const flagged = (pricing.match(/data-coming-soon/g) ?? []).length;
    expect(flagged).toBeGreaterThanOrEqual(8);
    const outsidePricing = html.replace(pricing, "");
    expect(outsidePricing).not.toContain("data-coming-soon");
    expect(outsidePricing.toLowerCase()).not.toContain("coming soon");
  });

  it("names the three customers, and states a return read off prod rather than a whiteboard", () => {
    // The RETURN is still the figure read off /brands/:id/revenue in prod on 2026-09-06 and
    // frozen here — the counts-only showcase read cannot answer it, so it is pinned until a
    // per-brand money read exists. The COUNTS beside it are no longer pinned anywhere: they
    // are reseeded from the wire at render, so a literal in this file is a seed, not a claim
    // (proof-cards.test.ts pins the keying that makes that reseed possible).
    for (const line of ["Doc Dinners", "Opsfolio", "Shockwave", "2.2", "9.3", "3.8"]) {
      expect(html).toContain(line);
    }
    expect((html.match(/data-live/g) ?? []).length).toBe(3);
  });

  it("rates every card five stars, hidden from a screen reader", () => {
    // Same five stars on every card, so they are decoration beside a quote that already
    // carries the praise — announcing them before each one is noise. 7 quotes, and the
    // marquee ships the set twice so it can scroll seamlessly.
    const rated = html.match(/<div class="stars" aria-hidden="true">\u2605{5}<\/div>/g) ?? [];
    expect(rated).toHaveLength(14);
    expect(css).toContain(".quote .stars");
  });

  it("sets the quote text bigger than the caption around it", () => {
    expect(css).toContain(".quote blockquote { font-size: 18px;");
  });

  it("quotes only people who said the words, and never a fabricated founder", () => {
    for (const who of ["Ryan W.D. Parenti", "Andrew Becker", "Bohdan Petryshyn", "Nazim Zidi", "Christian Lemke", "Katherine Fleishman", "Christopher Lafay"]) {
      expect(html).toContain(who);
    }
    // A role is the one the person publishes, never the one the company name suggests:
    // bosar.agency's team section states Co-Founder & CTO, and his LinkedIn headline
    // states no title at all, so "Founder" would have been invented.
    expect(html).toContain("Co-Founder &amp; CTO, Bosar Agency");
    // The first cut carried an invented Shockwave quote; nobody there said it.
    expect(html).not.toContain("somebody who asked for a call");
    // Katherine is an expert, not an Opsfolio customer: her quote lives in the quotes grid only.
    const proof = html.slice(html.indexOf('id="proof"'), html.indexOf('id="quotes"'));
    expect(proof).not.toContain("Katherine");
  });

  it("promises two minutes, never thirty seconds", () => {
    expect(html).toContain("Start in 2 minutes");
    expect(html).not.toMatch(/30 ?s(econds)?\b/);
  });

  it("counts the people on board from the signups in client-service", () => {
    // 71 real users on 2026-09-06 (`system-` principals excluded); refresh when it moves.
    expect(html).toContain("Loved by 70+ founders");
    // Two rows: one under the live showcase cards (explee's trust caption), one in the footer.
    // Each carries six people and no person appears in both, so twelve faces page-wide.
    const hero = html.slice(html.indexOf('class="hero"'), html.indexOf('id="proof"'));
    const footer = html.slice(html.indexOf("<footer>"));
    const facesOf = (part: string) => part.match(/<img src="\/landing\/v2\/assets\/[a-z-]+\.jpe?g"/g) ?? [];
    expect(hero.match(/faces-row/g)?.length).toBe(1);
    expect(footer.match(/faces-row/g)?.length).toBe(1);
    const heroRow = hero.slice(hero.indexOf("faces-row"), hero.indexOf("faces-text"));
    const footerRow = footer.slice(footer.indexOf("faces-row"), footer.indexOf("faces-text"));
    expect(facesOf(heroRow).length).toBe(6);
    expect(facesOf(footerRow).length).toBe(6);
    expect(new Set([...facesOf(heroRow), ...facesOf(footerRow)]).size).toBe(12);
    // The showcase row sits inside the showcase block, right under the four cards.
    expect(hero.indexOf('id="live-cards"')).toBeLessThan(hero.indexOf("faces-showcase"));
  });

  it("draws no funnel step whose value is zero", () => {
    // A `0 Closed won` states nothing a reader can act on, so the label and the number
    // are not drawn. Conditional render via a display class, never the `hidden`
    // attribute: an author `display` on the flex row outranks the UA stylesheet.
    const showcase = html.slice(html.indexOf('id="live-cards"'), html.indexOf("faces-showcase"));
    // Only the cells that are DRAWN: a `data-zero` one is in the DOM and not on screen.
    for (const [, step] of showcase.matchAll(/<span class="sf"><b[^>]*>([^<]+)<\/b>/g)) {
      expect(step).not.toBe("0");
    }
    expect(showcase).toMatch(/<span class="sf" data-zero>/);
    expect(css).toContain(".sf[data-zero] { display: none; }");
    expect(css).not.toMatch(/\.sf\[data-zero\][^{]*\{[^}]*hidden/);
    // The cell stays in the DOM: the counter keeps climbing in `data-steps`, so the tick
    // that lands the first one has to be able to reveal it.
    expect(js).toContain('el.parentElement.removeAttribute("data-zero")');
  });

  it("keeps a stacked card's corner sheen INSIDE the card on mobile", () => {
    // The card is `position: sticky` on desktop, so its ::after (position:absolute,
    // inset:0) is bounded by the card. The <=960px block set `position: static`, which
    // stops the stacking AND stops the card being a containing block - so each card's
    // tinted sheen resolved against `section.framed` and washed the whole section,
    // heading included, in the card's tone. Light text on light pink, mobile only.
    // `relative` does not stick either and keeps the sheen where it belongs.
    expect(css).toContain("padding: 24px; position: relative; }");
    expect(css).not.toMatch(/\.stack-card \{[^}]*position: static/);
  });

  it("states no budget calculator - the owner cut it", () => {
    // It priced a managed plan against a slider; the page sells one thing now and the
    // card was the last surface arguing a second one. Its JS and CSS went with it, so a
    // markup-only revival would render unstyled and inert.
    for (const gone of ["calc-slider", "Monthly paid acquisition budget", "Our services", "Meetings booked / month"]) {
      expect(html).not.toContain(gone);
    }
    expect(js).not.toContain("COST_PER_MEETING");
    expect(css).not.toContain(".slider {");
  });

  it("calls a booked meeting a booked meeting, everywhere it is a label", () => {
    // "Meetings" alone does not say which step of the funnel it counts.
    expect(html).not.toMatch(/<small>Meetings<\/small>/);
    expect(html).not.toMatch(/<th>Meetings<\/th>/);
    expect(html).not.toMatch(/<div class="k">Meetings<\/div>/);
    expect(html).toContain("<small>Meetings booked</small>");
    expect(html).toContain("<th>Meetings booked</th>");
  });

  it("puts a named person on every proof card, never a company logo", () => {
    const proof = html.slice(html.indexOf('id="proof"'), html.indexOf('id="quotes"'));
    expect(proof).not.toContain("img.logo.dev");
    expect((proof.match(/<img class="face" src="\/landing\/v2\/assets\/[a-z-]+\.jpe?g"/g) ?? []).length).toBe(3);
    for (const person of ["Ryan W.D. Parenti", "Shahid Shah", "David Tucker"]) expect(proof).toContain(person);
    for (const role of ["Founder, Doc Dinners", "CEO Netspective, Opsfolio", "Cofounder, Shockwave Centers"]) expect(proof).toContain(role);
    expect(css).toContain(".proof-top img.face { border-radius: 50%; }");
  });

  it("states the reply-handling feature, and no channel map", () => {
    expect(html).toContain("Answers interested leads ourselves, until the meeting is booked");
    // The 36-channel hub read as far-fetched and was cut; the #1 channel row carries the best ROI.
    expect(html).not.toContain('id="channels"');
    expect(html).toContain('<span class="win">Sales cold email</span></td><td></td><td class="roi">10.2x</td>');
  });
});

describe("the third pipeline card shows the calendar filling up", () => {
  // The dream outcome is a calendar full of meetings, not the A/B test that produced
  // them, so the third stacked card draws a week calendar rather than a ranking table.
  // The recipe is gojiberry's "books demos" visual: five states, one second each, each
  // one fuller than the last, looping. Ours is DOM rather than five stacked PNGs.
  const pipeline = html.slice(html.indexOf('id="pipeline"'), html.indexOf('id="features"'));
  const third = pipeline.slice(pipeline.lastIndexOf("<article"));

  it("is the third stacked card, and it draws a calendar, not a table", () => {
    expect(third).toContain('class="cal"');
    expect(third).not.toContain("roi-table");
    expect(pipeline).not.toContain("Learns what works");
  });

  it("states the outcome, and no acquisition-testing vocabulary", () => {
    expect(third).toContain("<h3>Your calendar fills up</h3>");
    expect(third).not.toMatch(/doubles down|winners|A\/B/);
  });

  it("carries five fill stages, weekdays only, and no vendor's copy", () => {
    for (const stage of [1, 2, 3, 4, 5]) expect(third).toContain(`data-stage="${stage}"`);
    expect(third).not.toMatch(/data-stage="[06-9]"/);
    for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri"]) expect(third).toContain(`<span>${day}</span>`);
    expect(third).not.toMatch(/Gojiberry|Hubspot|Sat|Sun/);
  });

  it("names companies, never a person", () => {
    // A calendar full of invented people is the fabricated-testimonial trap. Every
    // event names the offer and the company already used on the two cards above it.
    const events = [...third.matchAll(/<b>([^<]+)<\/b><span>([^<]+)<\/span>/g)];
    expect(events.length).toBe(20);
    for (const [, kind, who] of events) {
      expect(kind).toMatch(/^(Demo|Intro call|Follow-up|Kickoff)$/);
      expect(who).toMatch(/^[A-Z][A-Za-z]+( [A-Z][A-Za-z]+)*$/);
      expect(who).toMatch(/Health|Clinic|Group|PT|Orthopedics|Care|Opsfolio/);
    }
  });

  it("advances one stage a second and loops, unless motion is reduced", () => {
    const block = js.slice(js.indexOf("/* Calendar fills up"));
    expect(block).toContain("CAL_STAGE_MS = 1000");
    expect(block).toContain("cal.setAttribute(\"data-cal-stage\"");
    expect(block).toContain("% 5) + 1");
    expect(block).toContain("reduced");
  });

  it("has a stylesheet for every stage and a fade for each event", () => {
    expect(css).toContain(".cal-ev { ");
    expect(css).toContain("transition: opacity 0.4s");
    for (const s of [1, 2, 3, 4, 5]) expect(css).toContain(`.cal[data-cal-stage="${s}"]`);
  });
});

describe("colour rhythm", () => {
  // The page read as white plus grey plus one blue on hairlines. These pin the bands and
  // the recipes that broke that: a tinted wash, a dark band, a lit hero, tones per card.
  it("declares a secondary and a tertiary beside the charter blue", () => {
    expect(css).toContain("--secondary: #7c3aed;");
    expect(css).toContain("--tertiary: #ea580c;");
    expect(css).toContain("--accent: #2563eb;");
  });

  it("alternates section backgrounds: tint, dark, tint", () => {
    expect(html).toContain('<section class="framed tint" id="proof">');
    expect(html).toContain('<section class="framed dark">');
    expect(html).toContain('<section class="framed tint tint-both" id="pricing">');
    expect(css).toMatch(/section\.tint \{ background: linear-gradient\(180deg, #ffffff 0%, var\(--accent-50\) 100%\); \}/);
    expect(css).toMatch(/section\.dark \{ background: radial-gradient/);
    // A "+" on white cannot straddle a dark edge.
    expect(css).toContain("section.dark.framed::before, section.dark.framed::after { display: none; }");
  });

  it("lights the hero with a breathing dual-hue blob and reveals the headline per word", () => {
    expect(html).toContain('<div class="hero-glow" aria-hidden="true"></div>');
    expect(css).toMatch(/\.hero-glow \{[\s\S]*?rgba\(37, 99, 235, 0\.22\)[\s\S]*?rgba\(124, 58, 237, 0\.1\)/);
    expect(css).toContain("animation: hero-glow 6s ease-in-out infinite;");
    expect(js).toContain('w.className = "w";');
    expect(css).toContain(".hero h1 .w { display: inline-block; opacity: 0.001; filter: blur(10px);");
    // Reduced motion shows the finished state and never moves.
    expect(css).toMatch(/prefers-reduced-motion: reduce\)[^\n]*\.hero-glow \{ animation: none; \}[^\n]*\.hero h1 \.w \{ animation: none; opacity: 1;/);
  });

  it("gives each pipeline card its own tone, blue then purple then orange", () => {
    expect(css).toContain(".stack-card { --tone: var(--accent); --tone-50: var(--accent-50);");
    expect(css).toContain(".stack-card:nth-child(2) { top: 108px; --tone: var(--secondary);");
    expect(css).toContain(".stack-card:nth-child(3) { top: 124px; --tone: var(--tertiary);");
    // The cap is a 1px gradient hairline, never a thick coloured border.
    expect(css).toMatch(/\.stack-card::before \{[^\n]*height: 1px;/);
    expect(css).not.toMatch(/border-(top|left|right): [2-9]px solid var\(--(accent|secondary|tertiary)\)/);
  });

  it("closes on a dark CTA slab lit by the accent", () => {
    expect(css).toMatch(/\.cta-box \{[\s\S]*?var\(--dark\);[\s\S]*?color: #fff;/);
    expect(css).toContain(".cta-box h2 .accent { color: #6ea0ff; }");
  });

  it("staggers scroll reveals through a CSS variable set by the observer", () => {
    expect(css).toContain("transition-delay: var(--d, 0s);");
    expect(js).toContain('e.target.style.setProperty("--d", Math.min(batch, 4) * 70 + "ms");');
  });
});

