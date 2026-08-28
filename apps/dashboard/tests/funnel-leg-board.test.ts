import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildLegBoardCards,
  legBoardColumns,
  legBoardSideFor,
  LEG_BOARD_COLUMN_CAP,
  type LegBoardLead,
} from "../src/lib/funnel-leg-board";
import { leadFunnelStages, WRITABLE_STAGE_KEYS } from "../src/lib/lead-funnel-stages";

const read = (rel: string) => readFileSync(join(__dirname, "..", "src", rel), "utf8");

/** From `marker` forward, far enough to cover the block that starts there. */
const sliceFrom = (src: string, marker: string, len: number) => {
  const at = src.indexOf(marker);
  expect(at).toBeGreaterThan(-1);
  return src.slice(at, at + len);
};
const stages = leadFunnelStages("reply_meeting");

const lead = (over: Partial<LegBoardLead> & { id: string }): LegBoardLead => ({
  name: "Jerry Clark",
  orgName: "Alpine Spinal Rehab",
  orgDomain: "alpinespinalrehab.com",
  contacted: true,
  reached: {},
  ...over,
});

describe("legBoardColumns — the two sides of one arrow", () => {
  it("bases the FIRST arrow on Contacted, which is a step of no funnel", () => {
    const cols = legBoardColumns(stages, 0);
    // A contacted lead is on no funnel step yet — it is the base every funnel converts
    // from, so it carries no stage of its own.
    expect(cols?.from).toEqual({ stage: null, label: "Contacted" });
    expect(cols?.to.stage).toBe("positive_reply");
  });

  it("bases every later arrow on the funnel's own previous step", () => {
    expect(legBoardColumns(stages, 2)?.from.stage).toBe("meeting_booked");
    expect(legBoardColumns(stages, 2)?.to.stage).toBe("meeting_attended");
    expect(legBoardColumns(stages, 3)?.to.stage).toBe("sale");
  });

  it("answers null for an arrow this funnel does not have", () => {
    // A URL naming another funnel's arrow is a page to state, not an error to throw.
    expect(legBoardColumns(stages, 9)).toBeNull();
  });
});

describe("legBoardSideFor — which side of the arrow a lead is on", () => {
  const cols = legBoardColumns(stages, 2)!; // meeting_booked -> meeting_attended

  it("puts a lead who crossed on the far side", () => {
    expect(legBoardSideFor(lead({ id: "a", reached: { meeting_attended: true } }), cols)).toBe("to");
  });

  it("keeps a crossed lead on the far side even with the earlier step unrecorded", () => {
    // The crossing is the stronger statement: a funnel that lost the earlier evidence
    // does not un-attend a meeting.
    expect(
      legBoardSideFor(lead({ id: "a", contacted: false, reached: { meeting_attended: true } }), cols),
    ).toBe("to");
  });

  it("puts a lead who reached the step before on the near side", () => {
    expect(legBoardSideFor(lead({ id: "b", reached: { meeting_booked: true } }), cols)).toBe("from");
  });

  it("draws no card for a lead on neither side", () => {
    // A board is a partition of the people it is ABOUT, not of everybody.
    expect(legBoardSideFor(lead({ id: "c" }), cols)).toBeNull();
  });

  it("reads Contacted as the base of the first arrow", () => {
    const first = legBoardColumns(stages, 0)!;
    expect(legBoardSideFor(lead({ id: "d", contacted: true }), first)).toBe("from");
    expect(legBoardSideFor(lead({ id: "e", contacted: false }), first)).toBeNull();
    expect(
      legBoardSideFor(lead({ id: "f", contacted: true, reached: { positive_reply: true } }), first),
    ).toBe("to");
  });
});

describe("buildLegBoardCards — capped, and honest about the cap", () => {
  const cols = legBoardColumns(stages, 0)!;

  it("caps a column and still reports the real total", () => {
    // The base column is every lead the brand ever contacted — 9,166 on the brand this
    // was built against. A column that draws 60 and says nothing claims the funnel is
    // smaller than it is.
    const many = Array.from({ length: 200 }, (_, i) => lead({ id: `l${i}` }));
    const board = buildLegBoardCards({ leads: many, columns: cols });
    expect(board.from.length).toBe(LEG_BOARD_COLUMN_CAP);
    expect(board.totals.from).toBe(200);
  });

  it("counts each lead on exactly one side", () => {
    const board = buildLegBoardCards({
      leads: [
        lead({ id: "a", reached: { positive_reply: true } }),
        lead({ id: "b" }),
        lead({ id: "c", contacted: false }),
      ],
      columns: cols,
    });
    expect(board.totals).toEqual({ from: 1, to: 1 });
    expect(board.to.map((c) => c.id)).toEqual(["a"]);
    expect(board.from.map((c) => c.id)).toEqual(["b"]);
  });

  it("keeps the module alias-free so it carries real unit tests", () => {
    const src = read("lib/funnel-leg-board.ts");
    expect(src).not.toMatch(/^import (?!type ).*from "@\//m);
  });
});

describe("the arrow board writes a STEP STATEMENT, not a reply kind", () => {
  const board = read("components/funnels/funnel-leg-board.tsx");
  const page = read("components/funnels/funnel-leg-page.tsx");
  const table = read("components/campaigns/campaigns-table.tsx");

  it("is its own board, because the write is its own", () => {
    // The Leads page's board states a REPLY KIND against a campaign. Crossing a funnel
    // arrow states a step statement, which lead-service refuses without a cost — and
    // that board's own comment says it has nowhere to ask for one.
    expect(board).toContain("StageStatementForm");
    expect(board).not.toContain("ReplyKind");
    expect(page).toContain("useSetAnyLeadStepStatement");
  });

  it("asks before it writes, because a move is a statement", () => {
    // A board that wrote on drop would meet lead-service's refusal after the card had
    // already moved.
    const drop = sliceFrom(board, "onDrop: (card, columnKey)", 200);
    expect(drop).toContain("setPending(card)");
    expect(drop).not.toContain("onCross(");
    expect(board).toContain('data-testid="leg-board-cross-form"');
  });

  it("runs the ONE shared gesture the Leads board runs", () => {
    // Hold to lift, tap to open, a live ghost, a dashed slot either side. A person who
    // learned the board on the Leads page has learned this one.
    expect(board).toContain("useBoardDrag<LegBoardCard>");
    expect(board).toContain("board.cardHandlers(card)");
    expect(board).toContain('data-board-column={side}');
    // And no HTML5 drag, which fires on no touch device and paints a square ghost.
    expect(board).not.toContain("draggable=");
    expect(board).not.toContain("onDragStart");
  });

  it("offers the same move without a pointer, on the tag's own row", () => {
    // A labelled Move button cost the card a whole line and read as a second way of
    // doing the thing the card already does; the ellipsis is what the Leads board taught.
    expect(board).not.toMatch(/>\s*Move\s*</);
    expect(board).toContain("&#8943;");
    expect(board).toContain('aria-label={`Move ${card.name} to ${columns.to.label}`}');
  });

  it("says on the card WHERE the lead is", () => {
    // A board sorted by status whose cards state none makes the reader hold the column
    // headers in their head, and the ghost under the pointer has no column at all.
    expect(board).toContain('data-testid="leg-board-card-tag"');
    expect(board).toContain("crossed ? columns.to.label : columns.from.label");
  });

  it("leaves an outline where the card was and opens one where it is going", () => {
    expect(board).toContain('<BoardSlot variant="origin" />');
    expect(board).toContain('<BoardSlot variant="target" />');
    expect(board).toContain("board.showsSlot(side)");
  });

  it("says what it is not drawing rather than truncating in silence", () => {
    expect(board).toContain("Showing the first");
    // The number DRAWN, never the cap: they coincide in the app, and stating the cap is
    // the wrong number on the one case where they do not.
    expect(board).toContain("{list.length} of {total.toLocaleString");
  });

  it("offers no control on a step lead-service will not take a statement on", () => {
    // A positive reply is a fact about a message and a website visit is measured by the
    // delivery layer: a button that cannot write is worse than no button.
    expect(page).toContain("isWritableStage");
    expect(WRITABLE_STAGE_KEYS).not.toContain("positive_reply");
    expect(WRITABLE_STAGE_KEYS).not.toContain("website_visit");
  });

  it("renders the refusal from lead-service, never the raw error", () => {
    // `apiCall` sets `err.message` to the whole downstream body verbatim.
    expect(page).toContain("leadStepErrorMessage(err)");
    expect(page).not.toContain("err.message");
  });
});

describe("the leg page, and what it deliberately does not show", () => {
  const page = read("components/funnels/funnel-leg-page.tsx");
  const table = read("components/campaigns/campaigns-table.tsx");

  it("exists at the route a Done by you row opens", () => {
    expect(
      existsSync(
        join(
          __dirname,
          "..",
          "src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/offers/[offerId]/funnels/[funnelKey]/legs/[legKey]/page.tsx",
        ),
      ),
    ).toBe(true);
    // The CALL SITE, not just the page: a route nothing links to is reachable only by
    // typing it.
    expect(table).toContain("openLeg(leg.toKey)");
    expect(table).toContain("/legs/");
  });

  it("sends an arrow WE run to its campaign instead", () => {
    // That page has a budget, a status and settings a leg page has nothing to say about.
    expect(table).toContain("campaign ? () => open(campaign) : () => openLeg(leg.toKey)");
  });

  it("reads the figures FIRST and puts the board under them", () => {
    // The same order the campaign pages read in: what happened, how it has moved, then
    // the thing you do about it.
    expect(page.indexOf("<ScoreCard")).toBeLessThan(page.indexOf("<FunnelLegBoard"));
  });

  it("states the rung it converts from, the rung it converts to, and what you spent", () => {
    expect(page).toContain("step.fromRecipientsReached.toLocaleString");
    expect(page).toContain("step.recipientsReached.toLocaleString");
    // The conversion sits INSIDE the rung's own card: they are one statement.
    expect(page).toContain("step.conversionFromPreviousPct.toFixed(1)}% of");
    expect(page).toContain("label={`Cost per ${columns.to.label.toLowerCase()}`}");
  });

  it("charts the arrow's OWN outcome, never the whole funnel's return", () => {
    // A return is the whole funnel's — the money bought every rung of it — so charting
    // it under one arrow's name states a wider scope's answer here.
    expect(page).toContain("<OutcomeTrendCard");
    expect(page).not.toContain("RoiTrendCard");
    // A step with no dated series says so rather than drawing an empty chart, which
    // reads as "nobody crossed".
    expect(page).toContain("OUTCOME_SERIES_BY_STEP_KEY");
    expect(page).toContain("const chartable =");
  });

  it("shows no outreach chart and no cost per outcome of OUR spend", () => {
    // An arrow the brand works itself sends nothing, and the only per-step cost served
    // divides the whole funnel's spend — none of which was spent on this arrow.
    expect(page).not.toContain("PipelineActivityChart");
    expect(page).not.toContain("costPerReachCents");
  });

  it("reads the funnel page's own keys, so arriving here costs no request", () => {
    expect(page).toContain('["offerFunnelRevenue", brandId, offerId, wanted ?? "none"]');
    expect(page).toContain('["brandLeads", brandId]');
  });

  it("reveals on SETTLE, never holding a skeleton on a failed read", () => {
    expect(page).toContain("isPending && !revenue.isError");
    expect(page).toContain("isPending && !leadsQ.isError");
  });
});
