/**
 * The homepage names whichever clients the producer picked, and renders them.
 *
 * These are REAL unit tests over the real renderers rather than substring guards on the
 * page, because the cards are BUILT here now: the markup a visitor gets is this module's
 * output, so asserting the module is asserting the page.
 *
 * The fixtures are production-shaped — the payload probed off
 * production on 2026-09-22, in the `/v1/public/features/showcase-outcomes` shape (one
 * entry per step), with the grouped picks the
 * producer states — so a reader that drifts from the wire fails here rather than on the
 * apex page.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  HERO_STEPS,
  hasDrawnOutcome,
  hasHeroOutcome,
  MIN_DRAWN_OUTCOME,
  PODIUM_ORDER,
  podium,
  pricedStep,
  renderProofCard,
  renderShowcaseCard,
} from "@/lib/showcase-cards";
import {
  renderProofSelection,
  renderShowcaseSelection,
  pickedBrands,
  type ShowcaseBrand,
} from "@/lib/showcase-outcomes";
import { personFor, SHOWCASE_PEOPLE } from "@/lib/showcase-people";

/** Doc Dinners, as production served it on 2026-09-22. */
const docDinners: ShowcaseBrand = {
  brand: { id: "75d7e3e8", name: "Doc Dinners", domain: "docdinners.com" },
  returnPerDollar: 1.6145003659534165,
  outcomes: [
    { key: "contacted", label: "Contacted", peopleReached: 16951, costPerReachUsd: 0.30145 },
    { key: "conversation", label: "Positive reply", peopleReached: 22, costPerReachUsd: 232.27 },
    { key: "meeting_booked", label: "Meeting booked", peopleReached: 3, costPerReachUsd: 1703.31 },
    { key: "meeting_attended", label: "Meeting attended", peopleReached: 0, costPerReachUsd: null },
    { key: "paid_client", label: "Paid client", peopleReached: 0, costPerReachUsd: null },
  ],
  measured: true,
  unmeasuredReason: null,
};

/**
 * Opsfolio, the fleet's highest return on the same read, and every outcome past outreach a
 * website visit. Since 2026-10-19 a website visit is never drawn (owner), so this client is
 * the fixture for "visits only": drawn nowhere, priced nowhere.
 */
const opsfolio: ShowcaseBrand = {
  brand: { id: "6e21bb6c", name: "Opsfolio", domain: "opsfolio.com" },
  returnPerDollar: 55.64163966755881,
  outcomes: [
    { key: "contacted", label: "Contacted", peopleReached: 2808, costPerReachUsd: 0.1264 },
    { key: "website_visit", label: "Website visit", peopleReached: 160, costPerReachUsd: 2.2184375 },
    { key: "form_submitted", label: "Form submitted", peopleReached: 0, costPerReachUsd: null },
    { key: "paid_client", label: "Paid client", peopleReached: 0, costPerReachUsd: null },
  ],
  measured: true,
  unmeasuredReason: null,
};

/** Shockwave Centers: interested leads past the proof floor, no meeting booked yet. */
const shockwave: ShowcaseBrand = {
  brand: { id: "5c0", name: "Shockwave Centers", domain: "shockwavecenters.com" },
  returnPerDollar: 3.8,
  outcomes: [
    { key: "contacted", label: "Contacted", peopleReached: 2875, costPerReachUsd: 0.13 },
    { key: "website_visit", label: "Website visit", peopleReached: 41, costPerReachUsd: 9.1 },
    { key: "conversation", label: "Positive reply", peopleReached: 8, costPerReachUsd: 95.2 },
    { key: "meeting_booked", label: "Meeting booked", peopleReached: 0, costPerReachUsd: null },
  ],
  measured: true,
  unmeasuredReason: null,
};

/** A client nobody has photographed — the case the dynamic pick makes ordinary. */
const labcritics: ShowcaseBrand = {
  brand: { id: "9f0", name: "Labcritics", domain: "labcritics.com" },
  returnPerDollar: 43.42,
  outcomes: [
    { key: "contacted", label: "Contacted", peopleReached: 1204, costPerReachUsd: 0.11 },
    { key: "conversation", label: "Positive reply", peopleReached: 9, costPerReachUsd: 14.7 },
    { key: "meeting_booked", label: "Meeting booked", peopleReached: 0, costPerReachUsd: null },
  ],
  measured: true,
  unmeasuredReason: null,
};

describe("the producer picks, this page renders", () => {
  const measured = (brands: ShowcaseBrand[]) => ({
    brands,
    measured: true,
    unmeasuredReason: null,
    requestedCount: 3,
    qualifyingCount: 10,
  });

  it("honours a group the producer declined to answer", () => {
    // Production answers exactly this for the recent group today
    // (`measured: false`, `no_qualifying_clients`). The section keeps its shipped clients.
    expect(
      pickedBrands(
        { brands: [], measured: false, unmeasuredReason: "no_qualifying_clients", requestedCount: 3, qualifyingCount: 0 },
        "recentlyStarted"
      )
    ).toBeNull();
    expect(pickedBrands(undefined, "recentlyStarted")).toBeNull();
  });

  it("reads each group on its own, so one silence does not gag the other", () => {
    // The two answer different questions and were never meant to name the same clients — the
    // producer says so outright. Requiring both would have shipped the podium as dead code.
    expect(pickedBrands(measured([shockwave]), "highestReturn")).toEqual([shockwave]);
  });

  it("renders a SHORT group rather than refusing it", () => {
    // The producer states how many qualified, so fewer than three is an answer, not a gap.
    const short = { ...measured([shockwave]), qualifyingCount: 1 };
    expect(pickedBrands(short, "highestReturn")).toEqual([shockwave]);
  });

  it("filters each group by the predicate its section draws by", () => {
    // The hero takes a client with ONE meeting booked; the proof section keeps its floor of 5.
    const oneMeeting: ShowcaseBrand = {
      ...labcritics,
      brand: { id: "om", name: "One Meeting", domain: "onemeeting.com" },
      outcomes: [
        { key: "contacted", label: "Contacted", peopleReached: 300, costPerReachUsd: 0.2 },
        { key: "conversation", label: "Positive reply", peopleReached: 0, costPerReachUsd: null },
        { key: "meeting_booked", label: "Meeting booked", peopleReached: 1, costPerReachUsd: 60 },
      ],
    };
    expect(pickedBrands(measured([oneMeeting]), "recentlyStarted", hasHeroOutcome)).toEqual([oneMeeting]);
    expect(pickedBrands(measured([oneMeeting]), "highestReturn")).toBeNull();
    // A visits-only client enters neither section.
    expect(pickedBrands(measured([opsfolio]), "recentlyStarted", hasHeroOutcome)).toBeNull();
    expect(pickedBrands(measured([opsfolio]), "highestReturn")).toBeNull();
  });

  it("keeps the producer's order and only decides where each card sits", () => {
    // Best on the left, third in the middle, second on the right.
    expect(PODIUM_ORDER).toEqual([0, 2, 1]);
    expect(podium(["first", "second", "third"])).toEqual(["first", "third", "second"]);
    // A row that is not three is laid out as served rather than reshuffled on a guess.
    expect(podium(["only"])).toEqual(["only"]);
    expect(podium(["a", "b", "c", "d"])).toEqual(["a", "b", "c", "d"]);
  });
});

describe("a hero card", () => {
  const card = renderShowcaseCard(docDinners)!;

  it("carries every attribute main.js drives it by", () => {
    expect(card).toContain('data-live data-brand="docdinners.com"');
    expect(card).toContain('data-steps="22,3"');
    expect(card).toContain('<b data-n="0">22</b>');
    expect(card).toContain('<b data-n="1">3</b>');
    expect(card).toContain("<em data-status>Sending</em>");
  });

  it("states exactly two figures: Interested leads, then Meetings booked", () => {
    // Owner 2026-10-19: no Contacted, no attended meeting, no paid client on a hero card.
    expect(HERO_STEPS).toEqual([
      { key: "conversation", label: "Interested leads" },
      { key: "meeting_booked", label: "Meetings booked" },
    ]);
    const cells = [...card.matchAll(/data-step="([a-z_]+)"[^>]*><b data-n="(\d+)">[^<]*<\/b><small>([^<]*)<\/small>/g)].map(
      (m) => [m[1], m[2], m[3]]
    );
    expect(cells).toEqual([
      ["conversation", "0", "Interested leads"],
      ["meeting_booked", "1", "Meetings booked"],
    ]);
    expect(card).not.toMatch(/contacted|meeting_attended|paid_client/);
  });

  it("hides a step nobody reached rather than dropping it", () => {
    // main.js reveals the cell the first time its counter lands, so the cell has to be in
    // the DOM carrying `data-zero` — removing it leaves the counter climbing with nowhere
    // to render and the step never comes back.
    const rendered = renderShowcaseCard(shockwave)!;
    expect(rendered).toContain('data-step="meeting_booked" data-zero><b data-n="1">0</b>');
    expect(rendered).toContain('data-steps="8,0"');
    expect(rendered).not.toContain('data-step="conversation" data-zero');
  });

  it("says the page's own words, not the producer's", () => {
    // The producer labels the step "Positive reply"; the hero says "Interested leads".
    expect(card).toContain("<small>Interested leads</small>");
    expect(card).toContain("<small>Meetings booked</small>");
    expect(card).not.toContain("Positive repl");
    expect(card).not.toContain("Meeting booked<");
  });

  it("leaves out a step the producer could not measure", () => {
    const unmeasured: ShowcaseBrand = {
      ...docDinners,
      outcomes: [
        { key: "contacted", label: "Contacted", peopleReached: 500, costPerReachUsd: 1 },
        { key: "conversation", label: "Positive reply", peopleReached: null, costPerReachUsd: null },
        { key: "meeting_booked", label: "Meeting booked", peopleReached: 2, costPerReachUsd: 250 },
      ],
    };
    const rendered = renderShowcaseCard(unmeasured)!;
    // A zero here would read as a fact about the client instead of a gap in our reading.
    expect(rendered).toContain('data-steps="2"');
    expect(rendered).toContain('data-step="meeting_booked"><b data-n="0">2</b>');
    expect(rendered).not.toContain("conversation");
  });

  it("renders nothing when both figures are zero or unmeasured", () => {
    const zeros: ShowcaseBrand = {
      ...docDinners,
      outcomes: [
        { key: "contacted", label: "Contacted", peopleReached: 900, costPerReachUsd: 0.3 },
        { key: "conversation", label: "Positive reply", peopleReached: 0, costPerReachUsd: null },
        { key: "meeting_booked", label: "Meeting booked", peopleReached: null, costPerReachUsd: null },
      ],
    };
    expect(renderShowcaseCard(zeros)).toBeNull();
  });

  it("never draws a website visit", () => {
    // Opsfolio's only outcome past outreach is 160 visits: no hero card at all.
    expect(renderShowcaseCard(opsfolio)).toBeNull();
    const withVisits = renderShowcaseCard(shockwave)!;
    expect(withVisits).not.toMatch(/website_visit|Website visit/);
    expect(withVisits).not.toContain(">41<");
  });
});

describe("who enters the hero row", () => {
  const brand = (conversation: number | null, meeting: number | null, visits = 0): ShowcaseBrand => ({
    brand: { id: "h", name: "Hero", domain: "hero.com" },
    returnPerDollar: null,
    outcomes: [
      { key: "contacted", label: "Contacted", peopleReached: 400, costPerReachUsd: 0.2 },
      { key: "website_visit", label: "Website visit", peopleReached: visits, costPerReachUsd: 3 },
      { key: "conversation", label: "Positive reply", peopleReached: conversation, costPerReachUsd: null },
      { key: "meeting_booked", label: "Meeting booked", peopleReached: meeting, costPerReachUsd: null },
    ],
    measured: true,
    unmeasuredReason: null,
  });

  it("takes a client with one meeting booked, or one interested lead", () => {
    expect(hasHeroOutcome(brand(0, 1))).toBe(true);
    expect(hasHeroOutcome(brand(1, 0))).toBe(true);
    expect(hasHeroOutcome(brand(null, 1))).toBe(true);
    // Under the proof floor of 5, and still a hero client.
    expect(hasDrawnOutcome(brand(1, 1))).toBe(false);
  });

  it("refuses a client with only website visits, or nothing past outreach", () => {
    expect(hasHeroOutcome(brand(0, 0, 160))).toBe(false);
    expect(hasHeroOutcome(brand(null, null, 160))).toBe(false);
    expect(hasHeroOutcome(brand(0, 0))).toBe(false);
    expect(hasHeroOutcome(opsfolio)).toBe(false);
  });
});

describe("a proof card", () => {
  it("leads with the person when we have met them", () => {
    const card = renderProofCard(docDinners)!;
    expect(card).toContain("/landing/v2/assets/ryan-parenti.jpg");
    expect(card).toContain("Ryan W.D. Parenti");
    expect(card).toContain('data-count="1.6" data-decimals="1"');
  });

  it("leads with the COMPANY when we have not, and invents nobody", () => {
    const card = renderProofCard(labcritics)!;
    expect(personFor("labcritics.com")).toBeNull();
    expect(card).toContain("img.logo.dev/labcritics.com");
    expect(card).toContain(">Labcritics<");
    expect(card).toContain(">labcritics.com<");
    // No placeholder person, no invented role.
    expect(card).not.toMatch(/Founder|CEO|Cofounder/);
  });

  it("prices the first outcome after outreach, in the page's own words", () => {
    expect(pricedStep(docDinners)!.key).toBe("conversation");
    expect(renderProofCard(docDinners)!).toContain(
      '<div class="proof-line" data-proof-cost-step="conversation"><span>Cost per positive reply</span><b>$232</b></div>'
    );
    // The visit comes first on the wire and is priced, and is skipped all the same.
    expect(pricedStep(shockwave)!.key).toBe("conversation");
    expect(renderProofCard(shockwave)!).toContain("<span>Cost per positive reply</span><b>$95</b>");
  });

  it("never prices nor draws a website visit", () => {
    // Owner 2026-10-19: a visit proves attention, not demand.
    expect(pricedStep(opsfolio)).toBeNull();
    for (const card of [renderProofCard(opsfolio)!, renderProofCard(shockwave)!]) {
      expect(card).not.toMatch(/website_visit|website visit/i);
      expect(card).not.toContain("Cost per website");
    }
    expect(renderProofCard(opsfolio)!).not.toContain("data-proof-cost-step");
  });

  it("states no step nobody reached", () => {
    const card = renderProofCard(shockwave)!;
    expect(card).toContain("<b>2,875</b>contacted");
    expect(card).toContain("<b>8</b>positive replies");
    // Nobody booked a meeting yet; a card that printed a zero would state that as a result.
    expect(card).not.toContain("meeting_booked");
  });

  it("renders nothing for a client with no stated return", () => {
    const noReturn: ShowcaseBrand = {
      ...opsfolio,
      returnPerDollar: null,
    };
    // The card's headline IS the return, so there is no honest card without one.
    expect(renderProofCard(noReturn)).toBeNull();
  });

  it("escapes a name the customer wrote", () => {
    const hostile: ShowcaseBrand = {
      ...labcritics,
      brand: { id: "x", name: 'Smith & Co "<script>"', domain: "smith.com" },
    };
    const card = renderProofCard(hostile)!;
    expect(card).not.toContain("<script>");
    expect(card).toContain("Smith &amp; Co");
  });
});

describe("rendering the pick into the page", () => {
  const page = `<div class="showcase-grid" id="live-cards">
        <a class="show-card" href="#proof" data-live data-brand="old.com" data-steps="1"><b data-n="0">1</b></a>
        <a class="show-card yours" href="https://dashboard.distribute.you/get-started">YOURS</a>
      </div>
      <div class="proof-grid">
      <article class="proof-card rv" data-proof-brand="old.com">OLD</article>
      </div>`;

  it("replaces the client cards and keeps Your company last", () => {
    const out = renderShowcaseSelection(page, [docDinners, shockwave, opsfolio]);
    expect(out).toContain('data-brand="docdinners.com"');
    expect(out).toContain('data-brand="shockwavecenters.com"');
    // Visits only: never a hero client.
    expect(out).not.toContain('data-brand="opsfolio.com"');
    expect(out).not.toContain('data-brand="old.com"');
    // The last card is the page's own call to action, not a client — it must stay last.
    expect(out.indexOf("show-card yours")).toBeGreaterThan(out.indexOf("shockwavecenters.com"));
  });

  it("lays the proof row out best, third, second", () => {
    const out = renderProofSelection(page, [shockwave, labcritics, docDinners]);
    const first = out.indexOf("shockwavecenters.com");
    const middle = out.indexOf("docdinners.com");
    const last = out.indexOf("labcritics.com");
    expect(first).toBeGreaterThan(-1);
    expect(first).toBeLessThan(middle);
    expect(middle).toBeLessThan(last);
  });

  it("keeps the shipped page when nothing renders", () => {
    // A payload naming clients we cannot draw leaves the page exactly as it ships: the
    // last answer we know landed beats an empty hero or an empty proof section.
    expect(renderShowcaseSelection(page, [])).toBe(page);
    expect(renderProofSelection(page, [])).toBe(page);
  });
});

describe("the people map", () => {
  it("names only clients somebody has actually met", () => {
    // Adding an entry is a commit carrying a real face, a real name and a real role.
    for (const [domain, person] of Object.entries(SHOWCASE_PEOPLE)) {
      expect(domain).toMatch(/^[a-z0-9.-]+\.[a-z]{2,}$/);
      expect(person.photo).toMatch(/^\/landing\/v2\/assets\/[a-z-]+\.jpg$/);
      expect(person.name.trim().length).toBeGreaterThan(0);
      expect(person.role.trim().length).toBeGreaterThan(0);
    }
  });

  it("answers null for a domain it does not name", () => {
    expect(personFor("nobody.com")).toBeNull();
    expect(personFor(null)).toBeNull();
    expect(personFor(undefined)).toBeNull();
  });
});

describe("regressions from the first ship of the pick (#4353)", () => {
  const page = readFileSync(join(__dirname, "../../public/landing/index-v2.html"), "utf8");

  /** livingvital.ch as production served it on 2026-09-24: picked, and nothing past outreach. */
  const livingVital: ShowcaseBrand = {
    brand: { id: "lv", name: "Living Vital", domain: "livingvital.ch" },
    returnPerDollar: 0,
    outcomes: [
      { key: "contacted", label: "Contacted", peopleReached: 183, costPerReachUsd: 0.3 },
      { key: "conversation", label: "Positive reply", peopleReached: 0, costPerReachUsd: null },
      { key: "meeting_booked", label: "Meeting booked", peopleReached: 0, costPerReachUsd: null },
    ],
    measured: true,
    unmeasuredReason: null,
  };

  it("replacing the proof cards keeps every section after the proof grid", () => {
    const out = renderProofSelection(page, [shockwave, labcritics, docDinners]);
    for (const id of ['id="quotes"', 'id="pricing"', "</footer>"]) {
      if (page.includes(id)) expect(out).toContain(id);
    }
    const proofGrid = (html: string) => html.slice(html.indexOf('<div class="proof-grid">'), html.indexOf('id="quotes"'));
    const shipped = proofGrid(page).match(/<\/article>/g)!.length;
    expect(proofGrid(out).match(/<\/article>/g)!.length).toBe(3);
    expect(page.match(/<\/article>/g)!.length - shipped + 3).toBe(out.match(/<\/article>/g)!.length);
  });

  it("a client whose drawn outcomes show nothing past outreach is never named", () => {
    expect(hasDrawnOutcome(livingVital)).toBe(false);
    expect(hasHeroOutcome(livingVital)).toBe(false);
    expect(hasDrawnOutcome(docDinners)).toBe(true);
    const out = renderShowcaseSelection(page, [livingVital, docDinners]);
    expect(out).not.toContain('data-brand="livingvital.ch"');
    expect(out).toContain('data-brand="docdinners.com"');
    expect(pickedBrands({ brands: [livingVital], measured: true, unmeasuredReason: null }, "t")).toBeNull();
  });

  it("a client whose best drawn outcome is under 5 is never named in the proof section", () => {
    const outcome = (n: number): ShowcaseBrand => ({
      brand: { id: "lg", name: "Legistai", domain: "legistai.com" },
      returnPerDollar: 0,
      outcomes: [
        { key: "contacted", label: "Contacted", peopleReached: 385, costPerReachUsd: 0.3 },
        { key: "conversation", label: "Positive reply", peopleReached: n, costPerReachUsd: 50 },
      ],
      measured: true,
      unmeasuredReason: null,
    });
    expect(MIN_DRAWN_OUTCOME).toBe(5);
    expect(hasDrawnOutcome(outcome(1))).toBe(false);
    expect(hasDrawnOutcome(outcome(4))).toBe(false);
    expect(hasDrawnOutcome(outcome(5))).toBe(true);
    const proof = renderProofSelection(page, [outcome(1), docDinners]);
    expect(proof).not.toContain('data-proof-brand="legistai.com"');
    expect(proof).toContain('data-proof-brand="docdinners.com"');
    // The hero lifted that floor on 2026-10-19: one interested lead is enough there.
    expect(hasHeroOutcome(outcome(1))).toBe(true);
    expect(renderShowcaseSelection(page, [outcome(1), docDinners])).toContain('data-brand="legistai.com"');
  });
});
