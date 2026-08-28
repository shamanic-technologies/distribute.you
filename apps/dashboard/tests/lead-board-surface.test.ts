import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (rel: string) => readFileSync(join(__dirname, "..", "src", rel), "utf8");

const board = read("components/leads/lead-board.tsx");
const page = read("components/audiences/engaged-leads-page.tsx");

/** From `marker` forward, far enough to cover the JSX element that starts there. */
const sliceFrom = (src: string, marker: string, len: number) => {
  const at = src.indexOf(marker);
  expect(at).toBeGreaterThan(-1);
  return src.slice(at, at + len);
};

describe("the leads board is wired, not merely written", () => {
  it("is mounted by the page with the cards the page derives", () => {
    // A guard on the component alone passes forever over a page that never renders it.
    const mount = sliceFrom(page, "<LeadBoard", 1800);
    expect(mount).toContain("cards={boardCards}");
    expect(mount).toContain("canMove={Boolean(campaignId)}");
    expect(mount).toContain("onMove={");
    expect(mount).toContain("onOpen={");
    // The columns are the module's own now — a funnel decides nothing here.
    expect(mount).not.toContain("columns={");
  });

  it("draws the board at EVERY scope, since triage needs no funnel to order it", () => {
    expect(page).toContain('const showBoard = view === "board";');
    expect(page).not.toContain("const boardAvailable");
    expect(page).not.toContain("leadBoardColumns(");
  });

  it("places every card from the lead row plus ONE campaign-scoped read", () => {
    const cards = sliceFrom(page, "const boardCards: LeadBoardCard[]", 1300);
    expect(cards).toContain("leadBoardColumnFor(");
    expect(cards).toContain("lead.unsubscribed === true");
    expect(cards).toContain("lead.replyClassification ?? null");
    // A board of N cards must never be N requests.
    expect(cards).not.toContain("useAuthQuery");
  });

  it("reads the stated reply kinds ONCE for the campaign and joins them by email", () => {
    const read1 = sliceFrom(page, 'useAuthQuery(\n    ["campaignReplyKinds"', 700);
    expect(read1).toContain("listManualQualifications({ campaignId, limit: MAX_REPLY_KINDS })");
    expect(read1).toContain("enabled: Boolean(campaignId)");
    // The producer caps one read; a campaign past that cap says so rather than letting
    // its older cards fall silently back to the machine's classification.
    expect(page).toContain("const MAX_REPLY_KINDS = 500;");
    expect(page).toContain("rows.length >= MAX_REPLY_KINDS");
    expect(page).toContain("console.warn(");
  });

  it("spans the whole population rather than the active tab's slice", () => {
    // A partition scoped to one tab draws a board with most of its cards missing.
    const cards = sliceFrom(page, "const boardCards: LeadBoardCard[]", 1300);
    expect(cards).toContain("of searchedLeads");
    expect(cards).not.toContain("of filteredLeads");
    expect(cards).not.toContain("of pagedLeads");
  });

  it("keeps ONE search predicate for the table and the board", () => {
    expect(page).toContain("const matchesSearch = (l: Lead, q: string): boolean =>");
    expect(page).toContain("activeList.filter((l) => matchesSearch(l, q))");
    expect(page).toContain("coveredLeads.filter((l) => matchesSearch(l, q))");
  });
});

describe("a move states a reply KIND, and it asks which", () => {
  it("writes the reply kind, never a funnel-step statement", () => {
    // The funnel columns are gone, and with them the cost/value form they needed. A
    // triage move is the same write the lead panel makes.
    expect(page).toContain("setManualQualification({ campaignId: campaignId as string, email, status: kind })");
    expect(board).not.toContain("StageStatementForm");
    expect(board).not.toContain("stageRequiresValue");
    expect(page).not.toContain("useSetAnyLeadStepStatement()");
  });

  it("never writes straight from a drop", () => {
    // "Sales interest" is three different things a prospect can have said; recording
    // the wrong one is worse than recording nothing.
    const drop = sliceFrom(board, "onDrop={", 320);
    expect(drop).toContain("startMove(dragging, column)");
    expect(drop).not.toContain("onMove(");
    expect(board).toContain("columnReplyKinds(pending.to.key)");
  });

  it("holds what was just stated so the card moves before the re-read lands", () => {
    // The write's only visible effect is the jump, and the jump comes from a re-read —
    // without this the control reads as dead for a round trip.
    expect(page).toContain("setStatedReplyKinds((prev) => new Map(prev).set(email, kind))");
    // A refusal drops it: the board must never state something nobody recorded.
    expect(page).toContain("next.delete(email)");
  });

  it("draws Move as a control rather than a grey word nobody presses", () => {
    const move = sliceFrom(board, "aria-expanded={menuFor === card.id}", 420);
    expect(move).toContain("border border-gray-200");
    expect(move).toContain("focus-visible:ring");
    expect(move).toContain("aria-label={`Move ${card.name}");
  });

  it("offers a pointer-free way to move a card", () => {
    // Drag and drop is a mouse affordance; a phone has none.
    expect(board).toContain("movableColumnsFrom(card.column)");
    expect(board).toContain("startMove(card, target)");
  });

  it("only lets a writable column take a drop, and only where a write is possible", () => {
    expect(board).toContain(
      "canMove && column.writable && dragging != null && dragging.column !== column.key",
    );
    const over = sliceFrom(board, "onDragOver={", 160);
    expect(over).toContain("if (takesDrop) e.preventDefault();");
  });

  it("renders the producer's own refusal, never the thrown Error's message", () => {
    const move = sliceFrom(page, "onMove={(email, kind)", 1600);
    expect(move).toContain("leadStepErrorMessage(err)");
    expect(move).not.toContain("err.message");
  });
});

describe("the board explains the two splits a reader would not guess", () => {
  it("says a bounce and a no both stay in Contacted", () => {
    expect(board).toContain("both stay in Contacted");
    expect(board).toContain("<InfoTooltip");
  });

  it("badges the card with the kind somebody stated, since a column holds several", () => {
    expect(board).toContain("replyKindOption(card.replyKind)");
    expect(board).toContain("REPLY_TONE_PILL[stated.tone]");
  });

  it("tints the kind pills with colours the dark remap covers", () => {
    // An unremapped tint renders its light-mode near-white on the dark surface.
    const globals = readFileSync(join(__dirname, "..", "src", "app", "globals.css"), "utf8");
    for (const cls of [
      "bg-green-50",
      "bg-red-50",
      "text-green-700",
      "border-green-200",
      "border-red-200",
    ]) {
      expect(globals).toContain(`html.dark .${cls}`);
    }
  });
});
