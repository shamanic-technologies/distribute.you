import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (rel: string) => readFileSync(join(__dirname, "..", "src", rel), "utf8");

const board = read("components/leads/lead-board.tsx");
const page = read("components/audiences/engaged-leads-page.tsx");
// The GESTURE is shared by every kanban here, so it is asserted where it lives rather
// than once per board — two copies of a pointer state machine drift the first time
// either is touched.
const hook = read("components/boards/use-board-drag.ts");
const dragLib = read("lib/board-drag.ts");

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
    expect(page).toContain('const showBoard = boardOnly || view === "board";');
    expect(page).not.toContain("const boardAvailable");
    expect(page).not.toContain("leadBoardColumns(");
  });

  it("places every card from the lead row plus ONE campaign-scoped read", () => {
    const cards = sliceFrom(page, "const boardCards: LeadBoardCard[]", 1600);
    expect(cards).toContain("leadBoardColumnFor(");
    expect(cards).toContain("lead.unsubscribed === true");
    expect(cards).toContain("lead.replyClassification ?? null");
    // The person's own face rides the row the page already holds — never a per-card
    // fetch, and never a fabricated avatar when the enrichment carried none.
    expect(cards).toContain("photoUrl: full?.photoUrl ?? null");
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
    const cards = sliceFrom(page, "const boardCards: LeadBoardCard[]", 1600);
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

describe("a campaign page is the board and nothing else", () => {
  it("has no view switch and no funnel tabs to offer", () => {
    expect(page).toContain("const boardOnly = Boolean(campaignId);");
    // The switch and the tabs are not merely hidden: a control the markup still
    // carries is still a control anybody can reach.
    expect(page).toContain("{!boardOnly && (");
    // Both of them: the switch's own wrapper and the tab strip's.
    expect(page.split("{!boardOnly && (").length - 1).toBeGreaterThanOrEqual(2);
  });

  it("keeps BOTH views at brand grain, where the board can write nothing", () => {
    // No campaignId means the reply-kind read is disabled and `canMove` is false, so
    // a board-only brand page would be read-only with no dates, sort or pagination.
    expect(page).toContain("<LeadsTable");
    expect(page).toContain("setView(option)");
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
    const drop = sliceFrom(board, "onDrop: (card, columnKey)", 260);
    expect(drop).toContain("startMove(card, to)");
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

  it("renders the producer's own refusal, never the thrown Error's message", () => {
    const move = sliceFrom(page, "onMove={(email, kind)", 1600);
    expect(move).toContain("leadStepErrorMessage(err)");
    expect(move).not.toContain("err.message");
  });
});

describe("one gesture, two actions, told apart by time", () => {
  it("does not use HTML5 drag, which no touch device fires", () => {
    // And whose drag image is a composited screenshot — the square white corners
    // behind a rounded card come from exactly that.
    expect(board).not.toContain("draggable=");
    expect(board).not.toContain("onDragStart");
    expect(board).not.toContain("onDragOver");
    expect(board).not.toContain("onDrop=");
  });

  it("runs the ONE shared gesture rather than a copy of it", () => {
    // Both kanbans call it, so a change to how a card is picked up reaches both.
    expect(board).toContain("useBoardDrag<LeadBoardCard>");
    expect(board).toContain("board.cardHandlers(card)");
    expect(read("components/funnels/funnel-leg-board.tsx")).toContain("useBoardDrag<LegBoardCard>");
  });

  it("picks a card up on a HOLD and opens it on a tap", () => {
    expect(dragLib).toContain("export const LONG_PRESS_MS = 350;");
    expect(hook).toContain("window.setTimeout(");
    const up = sliceFrom(hook, "const onPointerUp =", 700);
    expect(up).toContain("onTap(card)");
    // A press that wandered was a scroll, not a hold.
    expect(dragLib).toContain("export const SLOP_PX = 8;");
    expect(hook).toContain("clearPress()");
    // And the board's own tap opens the lead.
    expect(board).toContain("onTap: (card) => onOpen(card.id)");
  });

  it("only stops the page scrolling once the card is actually up", () => {
    // `touch-action: none` on every card would kill the board's own scrolling, so it
    // rides the OUTLINE the lifted card leaves behind — the only card that is up.
    expect(board).toContain('style={{ touchAction: "none" }}');
    expect(board).not.toContain("touchAction: \"none\" } : undefined");
  });

  it("leaves an outline where the card was and opens one where it is going", () => {
    // A column that collapses under the finger reflows the board mid-drag, and a target
    // that gives no sign until release makes a drop something you discover.
    expect(board).toContain('<BoardSlot variant="origin" />');
    expect(board).toContain('<BoardSlot variant="target" />');
    expect(board).toContain("board.showsSlot(column.key)");
    expect(board).not.toContain('lifted ? "opacity-40"');
  });

  it("drags a LIVE element, so the ghost keeps the card's own corners", () => {
    const ghost = sliceFrom(board, 'data-testid="lead-board-drag-ghost"', 420);
    expect(ghost).toContain("rounded-lg");
    expect(ghost).toContain("bg-white");
    expect(ghost).toContain("pointer-events-none");
    expect(ghost).toContain("<CardBody");
  });

  it("keeps the card reachable without a pointer at all", () => {
    expect(board).toContain('role="button"');
    expect(board).toContain("tabIndex={0}");
    expect(board).toContain('e.key === "Enter"');
    expect(board).toContain("movableColumnsFrom(card.column)");
    expect(board).toContain("startMove(card, target)");
  });

  it("resolves the drop on the WINDOW, not on whatever card is under the pointer", () => {
    // The card is replaced by its own outline the moment it lifts, so the element the
    // press started on is gone and pointer capture with it. A pointerup handler living
    // on a card then fires only if the pointer happens to land on ANOTHER card — a drop
    // onto a column header, or onto the gap under the last card, is swallowed and the
    // board stays stuck holding it. Found by reproduction, not by reading.
    expect(hook).toContain('window.addEventListener("pointerup", up)');
    expect(hook).toContain('window.addEventListener("pointermove", move');
    expect(hook).toContain('window.removeEventListener("pointerup", up)');
    // And the card's own handlers stand down once it is up.
    expect(hook).toContain("if (live.current) return; // the window's own handler resolves the drop");
  });

  it("scrolls the rail under a card held at its edge", () => {
    // Four 256px columns do not fit a phone, so most of the board is off-screen while
    // a card is up — and a target you cannot reach is a target the drag cannot use.
    // A frame loop, because a finger parked at the edge emits no further move events.
    expect(hook).toContain("requestAnimationFrame(step)");
    expect(hook).toContain("el.scrollLeft += railScrollStep(");
    expect(dragLib).toContain("export function railScrollStep(");
    expect(board).toContain("ref={board.railRef}");
  });

  it("accepts a drop in EVERY column and refuses it in the form", () => {
    // A target that silently rejects a drag reads as a broken board, not as a rule.
    expect(board).toContain("columnMoveRefusal(pending.to.key)");
    expect(board).toContain("data-board-column={column.key}");
    expect(board).not.toContain("column.writable && dragging");
  });
});

describe("the card says what it is in two lines and one tag", () => {
  it("leads with the ORG and puts the person under it behind Via", () => {
    // The same shape a campaign wears everywhere else: what this is on top, where it
    // came from underneath, quieter.
    const body = sliceFrom(board, "function CardBody(", 2600);
    expect(body).toContain("<CompanyLogo");
    expect(body).toContain("card.orgName ?? card.name");
    expect(body).toContain(">Via<");
    expect(body).toContain("<PersonMark");
  });

  it("falls back to an initial when the enrichment carried no photo", () => {
    const mark = sliceFrom(board, "function PersonMark(", 900);
    expect(mark).toContain("onError={() => setBroken(true)}");
    expect(mark).toContain("charAt(0).toUpperCase()");
  });

  it("always wears a tag, the stated kind or the column's own word", () => {
    // A tagless card reads as one we know nothing about, when we always know at least
    // that we contacted them.
    const body = sliceFrom(board, "function CardBody(", 2600);
    expect(body).toContain("replyKindOption(card.replyKind)");
    expect(body).toContain("column?.label ?? \"Contacted\"");
    expect(body).toContain("COLUMN_TONE[card.column]");
    expect(body).toContain("REPLY_TONE_PILL[tag.tone]");
  });

  it("spends no line of its own on the move control", () => {
    // The `Move` button sat under the tag and cost the card a whole row for a control
    // that is reachable from the card itself.
    expect(board).not.toContain(">\n                            Move\n");
    const body = sliceFrom(board, "function CardBody(", 2600);
    expect(body).toContain("flex items-center justify-between");
    expect(body).toContain("aria-label={`Move ${card.name}");
  });
});

describe("the board explains the two splits a reader would not guess", () => {
  it("says a bounce and a no both stay in Contacted, and how to move a card", () => {
    expect(board).toContain("both stay in Contacted");
    expect(board).toContain("Hold a card to move it, tap to open it.");
    expect(board).toContain("<InfoTooltip");
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
