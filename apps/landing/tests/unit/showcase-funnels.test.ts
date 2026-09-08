import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { reseedShowcaseCards, type ShowcaseFunnels } from "@/lib/showcase-funnels";

/**
 * The homepage's three named clients state counts we READ, not counts we pasted in.
 *
 * Real unit tests rather than source-substring guards because the module is
 * alias-free at runtime — keep it that way.
 */

const HOMEPAGE = readFileSync(
  join(__dirname, "..", "..", "public", "landing", "index-v2.html"),
  "utf8",
);

/** The producer's own shape, as production serves it. */
const SERVED: ShowcaseFunnels = {
  brands: [
    {
      brand: { id: "b1", name: "Doc Dinners", domain: "docdinners.com" },
      measured: true,
      unmeasuredReason: null,
      funnels: [
        {
          funnelKey: "sales_meetings_from_conversation",
          funnelName: "Sales Meeting from Conversation",
          steps: [
            { key: "contacted", label: "Contacted", peopleReached: 12999 },
            { key: "start_to_conversation", label: "Positive reply", peopleReached: 27 },
            { key: "conversation_to_meeting_booked", label: "Meeting booked", peopleReached: 5 },
            { key: "meeting_booked_to_meeting_attended", label: "Meeting attended", peopleReached: 4 },
            { key: "meeting_attended_to_paid_client", label: "Paid client", peopleReached: 2 },
          ],
        },
      ],
    },
  ],
};

function cardFor(html: string, domain: string): string {
  const at = html.indexOf(`data-brand="${domain}"`);
  expect(at, `${domain} card must exist`).toBeGreaterThan(-1);
  return html.slice(at, html.indexOf("</a>", at));
}

function withStep(key: string, peopleReached: number | null): ShowcaseFunnels {
  const brand = SERVED.brands[0];
  return {
    brands: [
      {
        ...brand,
        funnels: [
          {
            ...brand.funnels[0],
            steps: brand.funnels[0].steps.map((s) =>
              s.key === key ? { ...s, peopleReached } : s,
            ),
          },
        ],
      },
    ],
  };
}

describe("showcase funnel reseed", () => {
  it("writes the served count into each cell", () => {
    const card = cardFor(reseedShowcaseCards(HOMEPAGE, SERVED), "docdinners.com");
    expect(card).toContain('data-step="contacted"><b data-n="0">12,999</b>');
    expect(card).toContain('data-step="start_to_conversation"><b data-n="1">27</b>');
  });

  it("joins on the producer's KEY, never on position", () => {
    // The card draws FOUR cells for a FIVE-step funnel: it shows Closed won and skips
    // Meeting attended. An index join would put 4 (attended) under Closed won, which
    // renders perfectly and is a different number entirely.
    const card = cardFor(reseedShowcaseCards(HOMEPAGE, SERVED), "docdinners.com");
    expect(card).toContain('data-step="meeting_attended_to_paid_client"><b data-n="3">2</b>');
    expect(card).not.toContain('<b data-n="3">4</b>');
  });

  it("keeps the card's data-steps in step with what is rendered", () => {
    const card = cardFor(reseedShowcaseCards(HOMEPAGE, SERVED), "docdinners.com");
    expect(card).toContain('data-steps="12999,27,5,2"');
  });

  it("hides a step measured at zero, and reveals one that has landed", () => {
    const zero = cardFor(
      reseedShowcaseCards(HOMEPAGE, withStep("meeting_attended_to_paid_client", 0)),
      "docdinners.com",
    );
    expect(zero).toContain('data-step="meeting_attended_to_paid_client" data-zero>');
    // The shipped page has that cell at zero; a served 2 must take the marker OFF.
    const landed = cardFor(reseedShowcaseCards(HOMEPAGE, SERVED), "docdinners.com");
    expect(landed).toContain('data-step="meeting_attended_to_paid_client"><b');
  });

  it("leaves a step the producer could not measure exactly as the page ships it", () => {
    // null is "we have no figure", never zero — writing 0 would say nobody reached the
    // step, which the card then HIDES, deleting a real number from the page.
    const card = cardFor(
      reseedShowcaseCards(HOMEPAGE, withStep("start_to_conversation", null)),
      "docdinners.com",
    );
    expect(card).toContain('data-step="start_to_conversation"><b data-n="1">20</b>');
    expect(card).toContain('data-steps="12999,20,5,2"');
  });

  it("leaves a brand the producer does not answer for untouched", () => {
    expect(cardFor(reseedShowcaseCards(HOMEPAGE, SERVED), "opsfolio.com")).toBe(
      cardFor(HOMEPAGE, "opsfolio.com"),
    );
  });

  it("leaves the whole page untouched on an empty payload", () => {
    expect(reseedShowcaseCards(HOMEPAGE, { brands: [] })).toBe(HOMEPAGE);
  });

  it("never takes a cell's LABEL from the producer", () => {
    // "Sales interests" is our word for what the producer calls a positive reply.
    const card = cardFor(reseedShowcaseCards(HOMEPAGE, SERVED), "docdinners.com");
    expect(card).toContain("<small>Sales interests</small>");
    expect(card).not.toContain("Positive reply");
  });

  it("every live card carries a brand, and every cell a producer step key", () => {
    // A card with no `data-brand`, or a cell with no `data-step`, is one the reseed
    // silently skips forever — which is the frozen-literal bug coming back.
    const liveCards = HOMEPAGE.match(/<a class="show-card" href="#proof" data-live[^>]*>/g) ?? [];
    expect(liveCards.length).toBeGreaterThan(0);
    for (const card of liveCards) expect(card).toMatch(/data-brand="[^"]+"/);
    // Scoped to the LIVE cards: the "Your company" card is a signup placeholder with
    // no client behind it, so its cells carry no producer step and never should.
    for (const domain of ["docdinners.com", "opsfolio.com", "shockwavecenters.com"]) {
      const cells = cardFor(HOMEPAGE, domain).match(/<span class="sf"[^>]*>/g) ?? [];
      expect(cells.length, `${domain} must draw cells`).toBeGreaterThan(0);
      for (const cell of cells) expect(cell).toMatch(/data-step="[a-z_]+"/);
    }
  });
});
