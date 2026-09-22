/**
 * The homepage names whichever clients the producer picked, and renders them.
 *
 * These are REAL unit tests over the real renderers rather than substring guards on the
 * page, because the cards are BUILT here now: the markup a visitor gets is this module's
 * output, so asserting the module is asserting the page.
 *
 * The fixtures are production-shaped — the payload probed off
 * `/v1/public/features/showcase-funnels` on 2026-09-22, with the grouped picks the
 * producer states — so a reader that drifts from the wire fails here rather than on the
 * apex page.
 */
import { describe, expect, it } from "vitest";
import {
  cardFunnel,
  PODIUM_ORDER,
  podium,
  pricedStep,
  renderProofCard,
  renderShowcaseCard,
} from "@/lib/showcase-cards";
import {
  renderProofSelection,
  renderShowcaseSelection,
  selectionFrom,
  type ShowcaseBrand,
} from "@/lib/showcase-funnels";
import { personFor, SHOWCASE_PEOPLE } from "@/lib/showcase-people";

/** Doc Dinners, as production served it on 2026-09-22. */
const docDinners: ShowcaseBrand = {
  brand: { id: "75d7e3e8", name: "Doc Dinners", domain: "docdinners.com" },
  funnels: [
    {
      funnelKey: "sales_meetings_from_conversation",
      funnelName: "Sales Meeting from Positive Reply",
      returnPerDollar: 1.6145003659534165,
      steps: [
        { key: "contacted", label: "Contacted", peopleReached: 16951, costPerReachUsd: 0.30145 },
        { key: "start_to_conversation", label: "Positive reply", peopleReached: 22, costPerReachUsd: 232.27 },
        { key: "conversation_to_meeting_booked", label: "Meeting booked", peopleReached: 3, costPerReachUsd: 1703.31 },
        { key: "meeting_booked_to_meeting_attended", label: "Meeting attended", peopleReached: 0, costPerReachUsd: null },
        { key: "meeting_attended_to_paid_client", label: "Paid client", peopleReached: 0, costPerReachUsd: null },
      ],
    },
  ],
  measured: true,
  unmeasuredReason: null,
};

/** Opsfolio, the fleet's highest return on the same read. */
const opsfolio: ShowcaseBrand = {
  brand: { id: "6e21bb6c", name: "Opsfolio", domain: "opsfolio.com" },
  funnels: [
    {
      funnelKey: "form_magnet",
      funnelName: "Form Magnet",
      returnPerDollar: 55.64163966755881,
      steps: [
        { key: "contacted", label: "Contacted", peopleReached: 2808, costPerReachUsd: 0.1264 },
        { key: "start_to_website_visit", label: "Website visit", peopleReached: 160, costPerReachUsd: 2.2184375 },
        { key: "website_visit_to_form_submitted", label: "Form submitted", peopleReached: 0, costPerReachUsd: null },
        { key: "form_submitted_to_paid_client", label: "Paid client", peopleReached: 0, costPerReachUsd: null },
      ],
    },
  ],
  measured: true,
  unmeasuredReason: null,
};

/** A client nobody has photographed — the case the dynamic pick makes ordinary. */
const labcritics: ShowcaseBrand = {
  brand: { id: "9f0", name: "Labcritics", domain: "labcritics.com" },
  funnels: [
    {
      funnelKey: "sales_meetings_from_conversation",
      funnelName: "Sales Meeting from Positive Reply",
      returnPerDollar: 43.42,
      steps: [
        { key: "contacted", label: "Contacted", peopleReached: 1204, costPerReachUsd: 0.11 },
        { key: "start_to_conversation", label: "Positive reply", peopleReached: 9, costPerReachUsd: 14.7 },
        { key: "conversation_to_meeting_booked", label: "Meeting booked", peopleReached: 0, costPerReachUsd: null },
      ],
    },
  ],
  measured: true,
  unmeasuredReason: null,
};

describe("the producer picks, this page renders", () => {
  it("takes a pick only when BOTH groups are answered", () => {
    expect(selectionFrom({ brands: [] })).toBeNull();
    expect(selectionFrom({ brands: [], recent: [docDinners] })).toBeNull();
    expect(selectionFrom({ brands: [], topReturn: [opsfolio] })).toBeNull();
    expect(selectionFrom({ brands: [], recent: [], topReturn: [opsfolio] })).toBeNull();
    expect(
      selectionFrom({ brands: [], recent: [docDinners], topReturn: [opsfolio] })
    ).toEqual({ recent: [docDinners], topReturn: [opsfolio] });
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
    expect(card).toContain('data-steps="16951,22,3,0"');
    expect(card).toContain('<b data-n="0">16,951</b>');
    expect(card).toContain('<b data-n="3">0</b>');
    expect(card).toContain("<em data-status>Sending</em>");
  });

  it("hides a rung nobody reached rather than dropping it", () => {
    // main.js reveals the cell the first time its counter lands, so the cell has to be in
    // the DOM carrying `data-zero` — removing it leaves the counter climbing with nowhere
    // to render and the step never comes back.
    expect(card).toContain('data-step="meeting_booked_to_meeting_attended" data-zero');
    expect(card).not.toContain('data-step="contacted" data-zero');
  });

  it("says the page's own words, not the producer's", () => {
    // The producer labels the rung "Positive reply"; the page says "Sales interests".
    expect(card).toContain("<small>Sales interests</small>");
    expect(card).not.toContain("Positive reply");
  });

  it("leaves out a rung the producer could not measure", () => {
    const unmeasured: ShowcaseBrand = {
      ...docDinners,
      funnels: [
        {
          ...docDinners.funnels[0],
          steps: [
            { key: "contacted", label: "Contacted", peopleReached: 500, costPerReachUsd: 1 },
            { key: "start_to_conversation", label: "Positive reply", peopleReached: null, costPerReachUsd: null },
          ],
        },
      ],
    };
    const rendered = renderShowcaseCard(unmeasured)!;
    // A zero here would read as a fact about the client instead of a gap in our reading.
    expect(rendered).toContain('data-steps="500"');
    expect(rendered).not.toContain("start_to_conversation");
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

  it("prices the funnel's first conversion, in the page's own words", () => {
    expect(pricedStep(cardFunnel(docDinners))!.key).toBe("start_to_conversation");
    expect(renderProofCard(docDinners)!).toContain(
      '<div class="proof-line" data-proof-cost-step="start_to_conversation"><span>Cost per sales interest</span><b>$232</b></div>'
    );
    expect(renderProofCard(opsfolio)!).toContain(
      '<span>Cost per website visit</span><b>$2.2</b>'
    );
  });

  it("states no rung nobody reached", () => {
    const card = renderProofCard(opsfolio)!;
    expect(card).toContain("<b>2,808</b>contacted");
    expect(card).toContain("<b>160</b>website visits");
    // Nobody submitted a form; a card that printed a zero would state that as a result.
    expect(card).not.toContain("form_submitted");
  });

  it("renders nothing for a client with no stated return", () => {
    const noReturn: ShowcaseBrand = {
      ...opsfolio,
      funnels: [{ ...opsfolio.funnels[0], returnPerDollar: null }],
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
        <a class="show-card yours" href="https://dashboard.distribute.you/start">YOURS</a>
      </div>
      <div class="proof-grid">
      <article class="proof-card rv" data-proof-brand="old.com" data-proof-funnel="x">OLD</article>
      </div>`;

  it("replaces the client cards and keeps Your company last", () => {
    const out = renderShowcaseSelection(page, [docDinners, opsfolio]);
    expect(out).toContain('data-brand="docdinners.com"');
    expect(out).toContain('data-brand="opsfolio.com"');
    expect(out).not.toContain('data-brand="old.com"');
    // The last card is the page's own call to action, not a client — it must stay last.
    expect(out.indexOf("show-card yours")).toBeGreaterThan(out.indexOf("opsfolio.com"));
  });

  it("lays the proof row out best, third, second", () => {
    const out = renderProofSelection(page, [opsfolio, labcritics, docDinners]);
    const first = out.indexOf("opsfolio.com");
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
