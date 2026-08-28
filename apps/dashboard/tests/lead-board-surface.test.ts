import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (rel: string) => readFileSync(join(__dirname, "..", "src", rel), "utf8");

const board = read("components/leads/lead-board.tsx");
const page = read("components/audiences/engaged-leads-page.tsx");
const statements = read("lib/use-lead-step-statements.ts");
const section = read("components/leads/lead-funnel-stage-section.tsx");

/** From `marker` forward, far enough to cover the JSX element that starts there. */
const sliceFrom = (src: string, marker: string, len: number) => {
  const at = src.indexOf(marker);
  expect(at).toBeGreaterThan(-1);
  return src.slice(at, at + len);
};

describe("the leads board is wired, not merely written", () => {
  it("is mounted by the page with the columns and cards the page derives", () => {
    // A guard on the component alone passes forever over a page that never renders it.
    const mount = sliceFrom(page, "<LeadBoard", 1400);
    expect(mount).toContain("columns={boardColumns}");
    expect(mount).toContain("cards={boardCards}");
    expect(mount).toContain("onMove={");
    expect(mount).toContain("onOpen={");
  });

  it("draws a board only when exactly ONE funnel is in scope", () => {
    // A brand selling through several has no single order to lay columns out in.
    expect(page).toContain("activeFunnelKeys.length === 1 ? activeFunnelKeys[0] : null");
    expect(page).toContain("const boardAvailable = boardColumns.length > 0;");
    expect(page).toContain('const showBoard = boardAvailable && view === "board";');
  });

  it("places every card from the data the page already holds, with no per-lead read", () => {
    const cards = sliceFrom(page, "const boardCards: LeadBoardCard[]", 1100);
    expect(cards).toContain("outcomeByLeadId.get(lead.leadId)");
    expect(cards).toContain("trackedStages(");
    expect(cards).toContain("leadBoardColumnFor(");
    // One board of N cards must never be N requests.
    expect(cards).not.toContain("useAuthQuery");
    expect(cards).not.toContain("useLeadStepStatements");
  });

  it("spans the whole population rather than the active tab's slice", () => {
    // A partition scoped to one tab draws a board with most of its cards missing.
    const cards = sliceFrom(page, "const boardCards: LeadBoardCard[]", 1100);
    expect(cards).toContain("of searchedLeads");
    expect(cards).not.toContain("of filteredLeads");
    expect(cards).not.toContain("of pagedLeads");
  });

  it("keeps ONE search predicate for the table and the board", () => {
    expect(page).toContain("const matchesSearch = (l: Lead, q: string): boolean =>");
    // Both lists read it; neither re-spells the fields it looks at.
    expect(page).toContain("activeList.filter((l) => matchesSearch(l, q))");
    expect(page).toContain("coveredLeads.filter((l) => matchesSearch(l, q))");
  });
});

describe("a move is a statement, and it is priced before it is written", () => {
  it("opens the SHARED cost form rather than a second copy of it", () => {
    expect(board).toContain("<StageStatementForm");
    expect(board).toContain('from "@/components/leads/lead-funnel-stage-section"');
    expect(section).toContain("export function StageStatementForm(");
    // No second prompt: lead-service makes the cost mandatory and one control asks it.
    expect(board).not.toContain("stepCostCentsFrom");
    expect(board).not.toContain("saleValueCentsFrom");
  });

  it("never writes straight from a drop", () => {
    // A drop that wrote on its own would meet a 400 the person never had a chance to
    // answer — lead-service refuses a statement carrying no cost.
    const drop = sliceFrom(board, "onDrop={", 320);
    expect(drop).toContain("startMove(dragging, column)");
    expect(drop).not.toContain("onMove(");
  });

  it("asks what the deal was worth on the one step the producer prices", () => {
    expect(board).toContain("needsValue={stageRequiresValue(");
  });

  it("draws Move as a control rather than a grey word nobody presses", () => {
    // Verified by reproduction at 1280 and on a Pixel 7, not by reading the class: a
    // plain text control in a quiet colour reads as a label, which is how the verify
    // screen's resend link went unused.
    const move = sliceFrom(board, "aria-expanded={menuFor === card.id}", 420);
    expect(move).toContain("border border-gray-200");
    expect(move).toContain("focus-visible:ring");
    expect(move).toContain("aria-label={`Move ${card.name}");
  });

  it("offers a pointer-free way to move a card", () => {
    // Drag and drop is a mouse affordance; a phone has none.
    expect(board).toContain("movableColumnsFrom(columns, card.column)");
    expect(board).toContain("aria-expanded={menuFor === card.id}");
    expect(board).toContain("startMove(card, target)");
  });

  it("only lets a writable column take a drop", () => {
    expect(board).toContain("column.writable && dragging != null && dragging.column !== column.key");
    const over = sliceFrom(board, "onDragOver={", 160);
    expect(over).toContain("if (takesDrop) e.preventDefault();");
  });

  it("renders lead-service's own refusal, never the thrown Error's message", () => {
    const move = sliceFrom(page, "onMove={(leadRowId, step, input)", 1200);
    expect(move).toContain("leadStepErrorMessage(err)");
    expect(move).not.toContain("err.message");
  });

  it("writes against the row the card carries, decided at press time", () => {
    // The panel binds one hook to the lead it has open; the board has no open lead, so
    // the row id rides in the mutation variables instead.
    expect(statements).toContain("export function useSetAnyLeadStepStatement()");
    expect(statements).toContain("mutationFn: ({ leadRowId, ...body }) => setLeadStepStatement(leadRowId, body)");
    // The card moves because the revenue join moves, so that is what is invalidated.
    const hook = sliceFrom(statements, "export function useSetAnyLeadStepStatement()", 1400);
    expect(hook).toContain('queryKey: ["featureRevenue"]');
  });
});

describe("the board says where each step's evidence comes from", () => {
  it("labels the column, not the card", () => {
    // A property of the STEP: every lead's booked meeting is stated and every lead's
    // click is measured, so it is said once per column instead of once per card.
    expect(board).toContain("SOURCE_LABEL[column.source]");
    expect(board).toContain("SOURCE_TIP");
  });

  it("tints each source with a colour the dark remap covers", () => {
    // An unremapped `-50` tint renders its light-mode near-white on the dark surface.
    for (const tint of ["bg-blue-50", "bg-indigo-50", "bg-purple-50"]) {
      expect(board).toContain(tint);
    }
    const globals = readFileSync(join(__dirname, "..", "src", "app", "globals.css"), "utf8");
    // The fill AND the two weights beside it: a remapped `-50` under an unremapped
    // `text-*-700` is near-black text on the dark surface, which is the gap the
    // Learning tag and the stale-build notice each had to close in turn.
    for (const cls of [
      "bg-blue-50",
      "bg-indigo-50",
      "bg-purple-50",
      "text-blue-700",
      "text-indigo-700",
      "text-purple-700",
      "border-blue-200",
      "border-indigo-200",
      "border-purple-200",
    ]) {
      expect(globals).toContain(`html.dark .${cls}`);
    }
  });
});
