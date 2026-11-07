/**
 * The homepage hero names whichever clients the producer picked, and renders them. The proof
 * section's return-ranked pick is gone with the client return (ROI-CONSISTENCY-1103).
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
import { HERO_STEPS, hasHeroOutcome, renderShowcaseCard } from "@/lib/showcase-cards";
import { renderShowcaseSelection, pickedBrands, type ShowcaseBrand } from "@/lib/showcase-outcomes";

/** Doc Dinners, as production served it on 2026-09-22. */
const docDinners: ShowcaseBrand = {
  brand: { id: "75d7e3e8", name: "Doc Dinners", domain: "docdinners.com" },
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
 * Opsfolio: every outcome past outreach a website visit. Since 2026-10-19 a website visit is never drawn (owner), so this client is
 * the fixture for "visits only": drawn nowhere, priced nowhere.
 */
const opsfolio: ShowcaseBrand = {
  brand: { id: "6e21bb6c", name: "Opsfolio", domain: "opsfolio.com" },
  outcomes: [
    { key: "contacted", label: "Contacted", peopleReached: 2808, costPerReachUsd: 0.1264 },
    { key: "website_visit", label: "Website visit", peopleReached: 160, costPerReachUsd: 2.2184375 },
    { key: "form_submitted", label: "Form submitted", peopleReached: 0, costPerReachUsd: null },
    { key: "paid_client", label: "Paid client", peopleReached: 0, costPerReachUsd: null },
  ],
  measured: true,
  unmeasuredReason: null,
};

/** Shockwave Centers: interested leads, no meeting booked yet. */
const shockwave: ShowcaseBrand = {
  brand: { id: "5c0", name: "Shockwave Centers", domain: "shockwavecenters.com" },
  outcomes: [
    { key: "contacted", label: "Contacted", peopleReached: 2875, costPerReachUsd: 0.13 },
    { key: "website_visit", label: "Website visit", peopleReached: 41, costPerReachUsd: 9.1 },
    { key: "conversation", label: "Positive reply", peopleReached: 8, costPerReachUsd: 95.2 },
    { key: "meeting_booked", label: "Meeting booked", peopleReached: 0, costPerReachUsd: null },
  ],
  measured: true,
  unmeasuredReason: null,
};

/** A third drawable client, so a pick can fill the three hero slots. */
const third: ShowcaseBrand = {
  ...shockwave,
  brand: { id: "7a1", name: "PressBeat", domain: "pressbeat.io" },
};

/** A client with a few interested leads and no meeting. */
const labcritics: ShowcaseBrand = {
  brand: { id: "9f0", name: "Labcritics", domain: "labcritics.com" },
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

  it("never renders a SHORT group: the hero always names three clients (owner 2026-11-07)", () => {
    const short = { ...measured([shockwave]), qualifyingCount: 1 };
    expect(pickedBrands(short, "recentlyStarted")).toBeNull();
    expect(pickedBrands(measured([docDinners, shockwave]), "recentlyStarted")).toBeNull();
    expect(pickedBrands(measured([docDinners, shockwave, third, docDinners]), "recentlyStarted")).toHaveLength(3);
  });

  it("takes a client with ONE meeting booked, never a visits-only one", () => {
    const oneMeeting: ShowcaseBrand = {
      ...labcritics,
      brand: { id: "om", name: "One Meeting", domain: "onemeeting.com" },
      outcomes: [
        { key: "contacted", label: "Contacted", peopleReached: 300, costPerReachUsd: 0.2 },
        { key: "conversation", label: "Positive reply", peopleReached: 0, costPerReachUsd: null },
        { key: "meeting_booked", label: "Meeting booked", peopleReached: 1, costPerReachUsd: 60 },
      ],
    };
    expect(pickedBrands(measured([oneMeeting, docDinners, shockwave]), "recentlyStarted", hasHeroOutcome)).toEqual([oneMeeting, docDinners, shockwave]);
    expect(pickedBrands(measured([opsfolio]), "recentlyStarted", hasHeroOutcome)).toBeNull();
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
  });

  it("refuses a client with only website visits, or nothing past outreach", () => {
    expect(hasHeroOutcome(brand(0, 0, 160))).toBe(false);
    expect(hasHeroOutcome(brand(null, null, 160))).toBe(false);
    expect(hasHeroOutcome(brand(0, 0))).toBe(false);
    expect(hasHeroOutcome(opsfolio)).toBe(false);
  });
});

describe("rendering the pick into the page", () => {
  const page = `<div class="showcase-grid" id="live-cards">
        <a class="show-card" href="#proof" data-live data-brand="old.com" data-steps="1"><b data-n="0">1</b></a>
        <a class="show-card yours" href="https://dashboard.distribute.you/get-started">YOURS</a>
      </div>`;

  it("replaces the client cards and keeps Your company last", () => {
    const out = renderShowcaseSelection(page, [docDinners, shockwave, opsfolio, third]);
    expect(out).toContain('data-brand="docdinners.com"');
    expect(out).toContain('data-brand="shockwavecenters.com"');
    // Visits only: never a hero client.
    expect(out).not.toContain('data-brand="opsfolio.com"');
    expect(out).not.toContain('data-brand="old.com"');
    // The last card is the page's own call to action, not a client — it must stay last.
    expect(out.indexOf("show-card yours")).toBeGreaterThan(out.indexOf("shockwavecenters.com"));
  });

  it("keeps the shipped page when nothing renders", () => {
    // A payload naming clients we cannot draw leaves the page exactly as it ships: the
    // last answer we know landed beats an empty hero.
    expect(renderShowcaseSelection(page, [])).toBe(page);
  });

  it("keeps the shipped page when fewer than three cards render (owner 2026-11-07)", () => {
    expect(renderShowcaseSelection(page, [docDinners, shockwave])).toBe(page);
  });
});

describe("regressions from the first ship of the pick (#4353)", () => {
  const page = readFileSync(join(__dirname, "../../public/landing/index-v2.html"), "utf8");

  /** livingvital.ch as production served it on 2026-09-24: picked, and nothing past outreach. */
  const livingVital: ShowcaseBrand = {
    brand: { id: "lv", name: "Living Vital", domain: "livingvital.ch" },
    outcomes: [
      { key: "contacted", label: "Contacted", peopleReached: 183, costPerReachUsd: 0.3 },
      { key: "conversation", label: "Positive reply", peopleReached: 0, costPerReachUsd: null },
      { key: "meeting_booked", label: "Meeting booked", peopleReached: 0, costPerReachUsd: null },
    ],
    measured: true,
    unmeasuredReason: null,
  };

  it("a client whose drawn outcomes show nothing past outreach is never named", () => {
    expect(hasHeroOutcome(livingVital)).toBe(false);
    expect(hasHeroOutcome(docDinners)).toBe(true);
    const out = renderShowcaseSelection(page, [livingVital, docDinners]);
    expect(out).not.toContain('data-brand="livingvital.ch"');
    expect(out).toContain('data-brand="docdinners.com"');
    expect(pickedBrands({ brands: [livingVital], measured: true, unmeasuredReason: null }, "t")).toBeNull();
  });

  it("one interested lead is enough for the hero (2026-10-19)", () => {
    const legistai: ShowcaseBrand = {
      brand: { id: "lg", name: "Legistai", domain: "legistai.com" },
      outcomes: [
        { key: "contacted", label: "Contacted", peopleReached: 385, costPerReachUsd: 0.3 },
        { key: "conversation", label: "Positive reply", peopleReached: 1, costPerReachUsd: 50 },
      ],
      measured: true,
      unmeasuredReason: null,
    };
    expect(hasHeroOutcome(legistai)).toBe(true);
    expect(renderShowcaseSelection(page, [legistai, docDinners, shockwave])).toContain('data-brand="legistai.com"');
  });
});
