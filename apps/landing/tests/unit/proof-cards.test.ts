import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { reseedProofCards, type ShowcaseFunnels } from "../../src/lib/showcase-funnels";

const HTML = readFileSync(join(process.cwd(), "public/landing/index-v2.html"), "utf8");
const LIB = readFileSync(join(process.cwd(), "src/lib/showcase-funnels.ts"), "utf8");
const STATIC_HTML = readFileSync(join(process.cwd(), "src/lib/static-html.ts"), "utf8");

/** One proof card, in the shape the page ships it. */
function card(
  domain: string,
  cells: Array<[step: string, figure: string, label: string]>,
  roi = "2.2",
  cost = "$1,159"
): string {
  const funnel = cells
    .map(([step, figure, label]) => `<span data-proof-step="${step}"><b>${figure}</b>${label}</span>`)
    .join("");
  return (
    `<article class="proof-card rv" data-proof-brand="${domain}">` +
    `<div class="proof-roi"><span class="big" data-count="${roi}" data-decimals="1">0<small>x</small></span></div>` +
    `<div class="proof-line"><span>Cost per meeting booked</span><b>${cost}</b></div>` +
    `<div class="proof-funnel">${funnel}</div>` +
    `</article>`
  );
}

function payload(
  domain: string,
  steps: Array<[key: string, peopleReached: number | null]>,
  measured = true
): ShowcaseFunnels {
  return {
    brands: [
      {
        brand: { id: "b-1", name: "A brand", domain },
        funnels: [
          {
            funnelKey: "sales_meetings_from_conversation",
            funnelName: "Sales meetings from conversation",
            steps: steps.map(([key, peopleReached]) => ({ key, label: key, peopleReached })),
          },
        ],
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
    // The producer is free to state its rungs in any order; a card draws its own
    // subset of them. An index join would put one rung's count under another's label.
    const html = card("docdinners.com", [
      ["contacted", "12,307", "contacted"],
      ["start_to_conversation", "20", "sales interests"],
      ["conversation_to_meeting_booked", "3", "meetings booked"],
    ]);
    const out = reseedProofCards(
      html,
      payload("docdinners.com", [
        ["conversation_to_meeting_booked", 7],
        ["contacted", 12552],
        ["start_to_conversation", 31],
      ])
    );
    expect(out).toContain("<b>12,552</b>contacted");
    expect(out).toContain("<b>31</b>sales interests");
    expect(out).toContain("<b>7</b>meetings booked");
  });

  it("keeps the label the page ships, never the producer's own word for the rung", () => {
    const html = card("docdinners.com", [["start_to_conversation", "20", "sales interests"]]);
    const out = reseedProofCards(html, payload("docdinners.com", [["start_to_conversation", 31]]));
    expect(out).toContain("<b>31</b>sales interests");
    expect(out).not.toContain("start_to_conversation</span>");
  });

  it("leaves a card alone when the read does not name its brand", () => {
    const html = card("shockwavecenters.com", [["contacted", "2,875", "contacted"]]);
    expect(reseedProofCards(html, payload("docdinners.com", [["contacted", 99]]))).toBe(html);
  });

  it("leaves a cell alone when the read does not answer for its step", () => {
    const html = card("docdinners.com", [
      ["contacted", "12,307", "contacted"],
      ["conversation_to_meeting_booked", "3", "meetings booked"],
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
    const html = card("docdinners.com", [["conversation_to_meeting_booked", "3", "meetings booked"]]);
    const out = reseedProofCards(
      html,
      payload("docdinners.com", [["conversation_to_meeting_booked", 0]])
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

  it("touches NEITHER the return NOR the cost per outcome", () => {
    // Counts-only read; those two lines are the producer's to state and it does not
    // yet. Deriving either here would be a metric invented by a consumer.
    const html = card("docdinners.com", [["contacted", "12,307", "contacted"]], "2.2", "$1,159");
    const out = reseedProofCards(html, payload("docdinners.com", [["contacted", 12552]]));
    expect(out).toContain('data-count="2.2"');
    expect(out).toContain("<b>$1,159</b>");
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

  it("keys every funnel cell by a step, so none can be joined by position", () => {
    const cells = PROOF.match(/<span data-proof-step="[a-z_]+"><b>/g) ?? [];
    expect(cells).toHaveLength(7);
    // A bare cell would silently keep its frozen literal forever.
    expect(PROOF).not.toMatch(/<div class="proof-funnel"><span><b>/);
  });

  it("reseeds both surfaces from ONE read", () => {
    const body = STATIC_HTML.slice(
      STATIC_HTML.indexOf("async function withShowcaseFunnels("),
      STATIC_HTML.indexOf("async function fetchFleetReturn(")
    );
    expect(body).toContain("reseedProofCards(reseedShowcaseCards(html, data), data)");
    expect((body.match(/await fetchShowcaseFunnels\(\)/g) ?? []).length).toBe(1);
  });
});
