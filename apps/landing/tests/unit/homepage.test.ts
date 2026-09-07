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
    expect(html).toContain('href="/landing/v2/styles.css?v=2"');
    expect(html).toContain('src="/landing/v2/main.js?v=2"');
    expect(html).not.toContain("/landing/css/");
    expect(html).not.toContain("/landing/js/");
    // Nothing may reference the lab's own root paths: those resolved on `lab-distribute`
    // and resolve nowhere here.
    expect(html).not.toMatch(/(href|src)="\/(styles\.css|main\.js|assets\/)/);
  });

  it("carries no unresolved live-figure token", () => {
    // The page states its figures outright. It may grow tokens now that it is on the
    // pipeline (`__CAC_PRICE__` and friends resolve here, unlike on the lab host), but an
    // UNRESOLVED one would ship to a reader as itself.
    expect(html).not.toMatch(/__[A-Z_]+__/);
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

describe("the previous homepage is archived, not deleted", () => {
  const v3 = readFileSync(path.resolve(__dirname, "../../src/app/v3/route.ts"), "utf8");

  it("still serves at /v3, non-indexed", () => {
    expect(v3).toContain('staticResponse("index-v1.html"');
    expect(v3).toContain("noindex, nofollow");
  });

  it("is still on disk, because it is the only page carrying the live-figure machinery", () => {
    // `__CAC_PRICE__`, `__HERO_CONSOLE__`, the ROI calculator and the segment-cost band
    // are used by no other page. Deleting the file makes all of it dead code, and a
    // CI-gated dashboard guard pins this path.
    const previous = readFileSync(path.join(LANDING, "index-v1.html"), "utf8");
    expect(previous).toContain("__CAC_PRICE__");
  });

  it("is absent from the sitemap", () => {
    const sitemap = readFileSync(path.resolve(__dirname, "../../src/app/sitemap.ts"), "utf8");
    expect(sitemap).not.toContain("/v3");
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

  it("names the three customers with the figures features-service served on 2026-09-06", () => {
    // Read off /brands/:id/revenue in prod, not off the whiteboard: ROI, cost per outcome and
    // the funnel counts the live cards are seeded from.
    for (const line of ["Doc Dinners", "Opsfolio", "Shockwave", "2.2", "9.3", "3.8", "12,307", "2,157", "2,875"]) {
      expect(html).toContain(line);
    }
    expect((html.match(/data-live/g) ?? []).length).toBe(3);
  });

  it("quotes only people who said the words, and never a fabricated founder", () => {
    for (const who of ["Ryan W.D. Parenti", "Andrew Becker", "Nazim Zidi", "Christian Lemke", "Katherine Fleishman", "Totoche"]) {
      expect(html).toContain(who);
    }
    // The first cut carried an invented Shockwave quote; nobody there said it.
    expect(html).not.toContain("somebody who asked for a call");
    // Katherine is an expert, not an Opsfolio customer: her quote lives in the quotes grid only.
    const proof = html.slice(html.indexOf('id="proof"'), html.indexOf('id="quotes"'));
    expect(proof).not.toContain("Katherine");
  });

  it("prices the managed plan on the calculator the owner picked", () => {
    expect(html).toContain("Monthly paid acquisition budget");
    expect(js).toContain("var COST_PER_MEETING = 600;");
    expect(js).toContain("var FEE_SHARE = 0.3;");
    // The fee is stated, never called "included".
    expect(html).not.toContain("Our fee, included");
    expect(html).toContain("Paid media budget 100% refunded");
    expect(html).toContain("Agency fee excluded");
  });

  it("promises two minutes, never thirty seconds", () => {
    expect(html).toContain("Start in 2 minutes");
    expect(html).not.toMatch(/30 ?s(econds)?\b/);
  });

  it("counts the people on board from the signups in client-service", () => {
    // 71 real users on 2026-09-06 (`system-` principals excluded); refresh when it moves.
    expect(html).toContain("70+ founders and GTM experts");
    const hero = html.slice(html.indexOf('class="hero"'), html.indexOf('id="proof"'));
    expect(hero).not.toContain("faces-row");
    const footer = html.slice(html.indexOf("<footer>"));
    expect(footer).toContain("faces-row");
    expect((footer.match(/<img src="\/landing\/v2\/assets\/[a-z-]+\.jpe?g"/g) ?? []).length).toBe(6);
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
