import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { reseedProofCards, type ShowcaseOutcomes } from "../../src/lib/showcase-outcomes";
import { formatCostUsd, formatReturnMultiple } from "../../src/lib/landing-format";

const HTML = readFileSync(join(process.cwd(), "public/landing/index-v2.html"), "utf8");
const LIB = readFileSync(join(process.cwd(), "src/lib/showcase-outcomes.ts"), "utf8");
const STATIC_HTML = readFileSync(join(process.cwd(), "src/lib/static-html.ts"), "utf8");

/** One proof card, in the shape the page ships it. */
function card(
  domain: string,
  cells: Array<[step: string, figure: string, label: string]>,
  roi = "2.2",
  cost = "$1,159",
  costStep = "conversation"
): string {
  const steps = cells
    .map(([step, figure, label]) => `<span data-proof-step="${step}"><b>${figure}</b>${label}</span>`)
    .join("");
  return (
    `<article class="proof-card rv" data-proof-brand="${domain}">` +
    `<div class="proof-roi"><span class="big" data-count="${roi}" data-decimals="1">0<small>x</small></span></div>` +
    `<div class="proof-line" data-proof-cost-step="${costStep}"><span>Cost per positive reply</span><b>${cost}</b></div>` +
    `<div class="proof-funnel">${steps}</div>` +
    `</article>`
  );
}

function payload(
  domain: string,
  steps: Array<[key: string, peopleReached: number | null, costPerReachUsd?: number | null]>,
  measured = true,
  returnPerDollar: number | null = null
): ShowcaseOutcomes {
  return {
    brands: [
      {
        brand: { id: "b-1", name: "A brand", domain },
        outcomes: steps.map(([key, peopleReached, costPerReachUsd]) => ({
          key,
          label: key,
          peopleReached,
          costPerReachUsd: costPerReachUsd ?? null,
        })),
        returnPerDollar,
        measured,
        unmeasuredReason: measured ? null : "no_lead_membership",
      },
    ],
  };
}

describe("reseedProofCards", () => {
  it("rewrites a cell from the count the producer states", () => {
    const html = card("docdinners.com", [["contacted", "12,307", "contacted"]]);
    const out = reseedProofCards(html, payload("docdinners.com", [["contacted", 12552]]));
    expect(out).toContain("<b>12,552</b>contacted");
    expect(out).not.toContain("12,307");
  });

  it("joins by STEP KEY, never by position", () => {
    // The producer is free to state its steps in any order; a card draws its own
    // subset of them. An index join would put one step's count under another's label.
    const html = card("docdinners.com", [
      ["contacted", "12,307", "contacted"],
      ["conversation", "20", "positive replies"],
      ["meeting_booked", "3", "meetings booked"],
    ]);
    const out = reseedProofCards(
      html,
      payload("docdinners.com", [
        ["meeting_booked", 7],
        ["contacted", 12552],
        ["conversation", 31],
      ])
    );
    expect(out).toContain("<b>12,552</b>contacted");
    expect(out).toContain("<b>31</b>positive replies");
    expect(out).toContain("<b>7</b>meetings booked");
  });

  it("keeps the label the page ships, never the producer's own word for the step", () => {
    const html = card("docdinners.com", [["conversation", "20", "positive replies"]]);
    const out = reseedProofCards(html, payload("docdinners.com", [["conversation", 31]]));
    expect(out).toContain("<b>31</b>positive replies");
    expect(out).not.toContain("start_to_conversation</span>");
  });

  it("leaves a card alone when the read does not name its brand", () => {
    const html = card("shockwavecenters.com", [["contacted", "2,875", "contacted"]]);
    expect(reseedProofCards(html, payload("docdinners.com", [["contacted", 99]]))).toBe(html);
  });

  it("leaves a cell alone when the read does not answer for its step", () => {
    const html = card("docdinners.com", [
      ["contacted", "12,307", "contacted"],
      ["meeting_booked", "3", "meetings booked"],
    ]);
    const out = reseedProofCards(html, payload("docdinners.com", [["contacted", 12552]]));
    expect(out).toContain("<b>12,552</b>contacted");
    expect(out).toContain("<b>3</b>meetings booked");
  });

  it("leaves a cell alone on a null count — that is 'we have no figure', not zero", () => {
    const html = card("docdinners.com", [["contacted", "12,307", "contacted"]]);
    const out = reseedProofCards(html, payload("docdinners.com", [["contacted", null]]));
    expect(out).toContain("<b>12,307</b>contacted");
    expect(out).not.toContain("<b>0</b>contacted");
  });

  it("writes a real zero, because 0 is measured", () => {
    const html = card("docdinners.com", [["meeting_booked", "3", "meetings booked"]]);
    const out = reseedProofCards(
      html,
      payload("docdinners.com", [["meeting_booked", 0]])
    );
    expect(out).toContain("<b>0</b>meetings booked");
  });

  it("keeps an unmeasured brand's shipped figures", () => {
    const html = card("docdinners.com", [["contacted", "12,307", "contacted"]]);
    const data = payload("docdinners.com", [], false);
    expect(reseedProofCards(html, data)).toBe(html);
  });

  it("one brand's absence never blanks the others", () => {
    const html =
      card("docdinners.com", [["contacted", "12,307", "contacted"]]) +
      card("opsfolio.com", [["contacted", "2,157", "contacted"]]);
    const out = reseedProofCards(html, payload("opsfolio.com", [["contacted", 2318]]));
    expect(out).toContain("<b>12,307</b>contacted");
    expect(out).toContain("<b>2,318</b>contacted");
  });

  it("states the return the producer serves, with the decimals it will animate to", () => {
    const html = card("docdinners.com", [["contacted", "12,307", "contacted"]], "2.2");
    const out = reseedProofCards(
      html,
      payload("docdinners.com", [["contacted", 12552]], true, 2.1112218935072433)
    );
    expect(out).toContain('data-count="2.1" data-decimals="1"');
    expect(out).not.toContain('data-count="2.2"');
  });

  it("drops the decimal on a return past 10x, and moves data-decimals with it", () => {
    // A stale `1` there would animate every frame to a decimal the figure no longer
    // states.
    const html = card("docdinners.com", [["contacted", "1", "contacted"]], "2.2");
    const out = reseedProofCards(html, payload("docdinners.com", [], true, 12.4));
    expect(out).toContain('data-count="12" data-decimals="0"');
  });

  it("prices the ONE step the card names, joined by that step's own key", () => {
    // Doc Dinners' card names the POSITIVE-REPLY step: it shipped pointing at the
    // meeting-booked key once (#4180 renamed the label without moving the key) and
    // stated $1,501 where the positive reply had cost $225. This test mirrors the
    // shipped shape, so the fixture must carry the same key the page carries.
    const html = card("docdinners.com", [], "2.2", "$1,159");
    const out = reseedProofCards(
      html,
      payload(
        "docdinners.com",
        [
          ["meeting_booked", 3, 1223.62],
          ["conversation", 20, 183.543],
        ],
        true,
        2.1
      )
    );
    expect(out).toContain("<b>$184</b>");
    // the sibling step's price is served and must NOT land on this line
    expect(out).not.toContain("$1,224");
  });

  it("keeps a decimal on a price under $10, exactly as the page shipped it", () => {
    const html = card("opsfolio.com", [], "9.3", "$3.4", "website_visit");
    const out = reseedProofCards(
      html,
      payload(
        "opsfolio.com",
        [["website_visit", 148, 4.148716216216216]],
        true,
        7.509853259718874
      )
    );
    expect(out).toContain("<b>$4.1</b>");
    expect(out).toContain('data-count="7.5"');
  });

  it("leaves the return alone when the producer states none", () => {
    const html = card("docdinners.com", [["contacted", "12,307", "contacted"]], "2.2");
    const out = reseedProofCards(html, payload("docdinners.com", [["contacted", 12552]], true, null));
    expect(out).toContain('data-count="2.2"');
  });

  it("leaves the price alone on a null cost — never a $0", () => {
    // A step nobody reached carries a measured 0 count beside a null price. A $0
    // there would read as this client's customers having been free.
    const html = card("docdinners.com", [["meeting_booked", "3", "meetings"]], "2.2", "$1,159");
    const out = reseedProofCards(
      html,
      payload("docdinners.com", [["meeting_booked", 0, null]], true, 2.1)
    );
    expect(out).toContain("<b>0</b>meetings");
    expect(out).toContain("<b>$1,159</b>");
    expect(out).not.toContain("$0");
  });

  it("states the brand's own return, across everything it ran", () => {
    // The outcome read carries ONE realized return per client, the figure their own
    // dashboard states. No per-path return is chosen or blended here.
    const html = card("docdinners.com", [["contacted", "12,307", "contacted"]], "2.2", "$1,159");
    const out = reseedProofCards(html, payload("docdinners.com", [["contacted", 12552]], true, 2.1));
    expect(out).toContain("<b>12,552</b>contacted");
    expect(out).toContain('data-count="2.1"');
  });

  it("returns the page untouched when the read carries no brand at all", () => {
    const html = card("docdinners.com", [["contacted", "12,307", "contacted"]]);
    expect(reseedProofCards(html, { brands: [] })).toBe(html);
  });

  it("divides nothing", () => {
    // Every figure on this page is read, never computed — the one rule the whole
    // surface exists to keep.
    expect(LIB).not.toMatch(/\/\s*(count|spend|total|reached)/i);
  });
});

describe("the homepage's proof cards are keyed for that reseed", () => {
  const PROOF = HTML.slice(HTML.indexOf('<div class="proof-grid">'), HTML.indexOf('id="quotes"'));

  it("keys all three cards by the same domain their live card uses", () => {
    const proof = [...PROOF.matchAll(/data-proof-brand="([^"]+)"/g)].map((m) => m[1]);
    expect(proof).toEqual(["docdinners.com", "opsfolio.com", "shockwavecenters.com"]);
    for (const domain of proof) expect(HTML).toContain(`data-brand="${domain}"`);
  });

  it("names no sales funnel: a card is keyed by brand and by step only", () => {
    expect(PROOF).not.toContain("data-proof-funnel");
    expect(HTML).not.toMatch(/data-(proof-)?(cost-)?step="[a-z]+_to_[a-z_]+"/);
  });

  it("keys every cost line by the ONE step its own words name", () => {
    const priced = [...PROOF.matchAll(/data-proof-cost-step="([a-z_]+)"/g)].map((m) => m[1]);
    // Both cards labelled "Cost per positive reply" must key the step their words
    // name. Doc Dinners shipped pointing at the meeting-booked step once and stated
    // $1,501 where the positive reply had cost $225.
    expect(priced).toEqual(["conversation", "website_visit", "conversation"]);
    // Every card prices exactly one step; a second unkeyed cost line would freeze.
    expect((PROOF.match(/<div class="proof-line"><span>Cost per/g) ?? []).length).toBe(0);
  });

  it("keys every outcome cell by a step, so none can be joined by position", () => {
    const cells = PROOF.match(/<span data-proof-step="[a-z_]+"><b>/g) ?? [];
    expect(cells).toHaveLength(7);
    // A bare cell would silently keep its frozen literal forever.
    expect(PROOF).not.toMatch(/<div class="proof-funnel"><span><b>/);
  });

  it("reseeds both surfaces from ONE read", () => {
    const body = STATIC_HTML.slice(
      STATIC_HTML.indexOf("async function withShowcaseOutcomes("),
      STATIC_HTML.indexOf("async function fetchFleetReturn(")
    );
    // The INVARIANT is one read behind both surfaces, not the shape of the call. It used to
    // pin the nested `reseedProofCards(reseedShowcaseCards(...))` literal, which went red the
    // day the producer started picking WHICH clients the page names and each surface gained
    // its own branch — a guard freezing the instrument alongside the rule.
    expect((body.match(/await fetchShowcaseOutcomes\(\)/g) ?? []).length).toBe(1);
    // Both surfaces are still covered by that one read, whichever branch each one takes: the
    // producer's pick when it answered, the shipped clients' figures reseeded when it did not.
    expect(body).toContain("renderShowcaseSelection(");
    expect(body).toContain("renderProofSelection(");
    expect(body).toContain("reseedShowcaseCards(out, data)");
    expect(body).toContain("reseedProofCards(out, data)");
  });
});
