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

  it("places every card from the PRODUCER's answer plus ONE campaign-scoped read", () => {
    const cards = sliceFrom(page, "const boardCards: LeadBoardCard[]", 2400);
    // Where a card sits is lead-service's `standing`, rendered — not derived here from
    // the reply signals on the row beside it. Those signals stay on the wire and stay
    // read; "is this person still in play" has one owner now.
    expect(cards).toContain("leadBoardColumnFor(lead.standing)");
    expect(cards).not.toContain("lead.unsubscribed === true");
    expect(cards).not.toContain("lead.replyClassification ?? null");
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
    const cards = sliceFrom(page, "const boardCards: LeadBoardCard[]", 2400);
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

describe("the list keeps the whole page width and the panel overlays it", () => {
  it("never squeezes the list to half-width when a lead is open", () => {
    // It used to be a two-up split, so opening one card reflowed five board columns
    // into a 50% rail — the set the reader was working moved under them as the cost
    // of looking at one row of it.
    expect(page).toContain('<div className="flex flex-col h-full relative">');
    expect(page).toContain('<div className="w-full p-4 md:p-8 pb-24 overflow-y-auto transition-all">');
    expect(page).not.toContain("md:flex-row h-full relative");
    expect(page).not.toContain("hidden md:block md:w-1/2");
  });

  it("floats the panel over the right edge at every size, not only on a phone", () => {
    const panel = sliceFrom(page, "{selectedLead && (", 900);
    // Full-screen on a phone, a right-hand sheet on desktop. `md:relative md:w-1/2`
    // is what took the width; `md:left-auto` is what gives it back.
    expect(panel).toContain("absolute inset-0 md:left-auto");
    expect(panel).not.toContain("md:relative");
    expect(panel).not.toContain("md:w-1/2");
    // Above the board's rail, below the support FAB (z-30) — hence its own bottom
    // clearance, or the FAB covers the end of the panel.
    expect(panel).toContain("z-20");
    expect(panel).toContain("pb-24");
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
    // The column the drop landed in is threaded back to the page, which cannot derive
    // it from the kind — that mapping is the producer's, not this app's.
    expect(board).toContain("onMove(pending.card.email as string, kind, pending.to.key)");
  });

  it("holds what was just stated so the card moves before the re-read lands", () => {
    // The write's only visible effect is the jump, and the jump comes from a re-read —
    // without this the control reads as dead for a round trip. The COLUMN rides along
    // because placement is the producer's now: without it the card would snap back the
    // instant it was dropped.
    expect(page).toContain(
      "new Map(prev).set(email, { kind, at: new Date().toISOString(), column })",
    );
    expect(page).toContain("const column = held?.column ?? leadBoardColumnFor(lead.standing);");
    // A refusal drops it: the board must never state something nobody recorded.
    expect(page).toContain("next.delete(email)");
  });

  it("drops the held column once the re-read lands, so a move can visibly NOT take", () => {
    // A permanent client override would hide lead-service legitimately placing the card
    // somewhere else — which it does: stating "Interested" on a campaign whose funnel is
    // entered by a website visit is a positive reply, and a positive reply is not the
    // step that campaign sells. That is the correct answer and the reader must see it.
    const move = sliceFrom(page, "onMove={(email, kind, column)", 3400);
    expect(move).toContain("void settled.then(() => {");
    expect(move).toContain("next.delete(email)");
    // Detached rather than awaited: a promise returned from `onSuccess` keeps the
    // mutation pending, and that is what the board disables its picker on — so
    // awaiting the leads refetch would lock it for the length of a read that runs to
    // tens of megabytes on a live campaign.
    expect(move).not.toContain("onSuccess: async () => {");
  });

  it("renders the producer's own refusal, never the thrown Error's message", () => {
    // Measured: `leadStepErrorMessage(err)` sits 3,504 chars from the handler's own
    // open tag. A `toContain` cannot be hurt by a slice that runs long, so this has
    // real headroom; the `not.toContain` below is bounded by the same slice and its
    // neighbour writes no `err.message`.
    const move = sliceFrom(page, "onMove={(email, kind, column)", 4200);
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

  it("opens a card without a pointer at all", () => {
    // OPENING is keyboard-reachable; MOVING is the drag and nothing else. The per-card
    // `...` menu that listed the targets is gone — its row now states how long the card
    // has been in its column, which is what a triage board is scanned for. Accepted
    // consequence: a move needs a pointer.
    expect(board).toContain('role="button"');
    expect(board).toContain("tabIndex={0}");
    expect(board).toContain('e.key === "Enter"');
    expect(board).toContain("movableColumnsFrom(card.column)");
    expect(board).not.toContain("startMove(card, target)");
    expect(board).not.toContain("setMenuFor");
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
    const body = sliceFrom(board, "function CardBody(", 3600);
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

  it("states what we last OBSERVED, never the column's own word repeated", () => {
    // A card reading "Sales interest" under a heading reading "Sales interest" spends
    // its one tag saying nothing a reader did not already have. So Sales interest
    // reads "Website visit" and Leads reads "Delivered" / "Sent" / "Bounced".
    const body = sliceFrom(board, "function CardBody(", 3600);
    expect(body).toContain("replyKindOption(card.replyKind)");
    expect(body).toContain("label: card.statusLabel, pill: card.statusPill");
    expect(body).toContain("${tag.pill}");
    // The column's own word is not a tag any more, and its map has no reader left.
    expect(board).not.toContain("COLUMN_TONE");
    expect(body).not.toContain('column?.label');
  });

  it("reads the SAME status word the leads table's own badge reads", () => {
    // One map, three surfaces (table badge, CSV, card): a second spelling is how one
    // lead comes to read "Delivered" in the table and "Sent" on a card one click away.
    expect(page).toContain('import { leadStatusLabel, leadStatusPill } from "@/lib/lead-status";');
    expect(page).toContain("statusLabel: leadStatusLabel(getLeadConsolidatedStatus(lead))");
    expect(page).toContain("statusPill: leadStatusPill(getLeadConsolidatedStatus(lead))");
    // And the date under it proves THAT status — one statement, one event.
    expect(page).toContain(
      "statusAt: statement?.at ?? leadDateForStatus(lead, getLeadConsolidatedStatus(lead))",
    );
  });

  it("says HOW LONG it has been that, beside the tag and never as its own line", () => {
    // A tag with no age is the one thing a triage board cannot be read for. It sits
    // beside the tag rather than pinned right, because it qualifies the tag — and it
    // took the place of the `...` menu rather than costing the card another row.
    const body = sliceFrom(board, "function CardBody(", 3600);
    expect(body).toContain("timeAgo(card.statusAt)");
    expect(body).toContain("text-gray-400");
    expect(body).not.toContain("aria-label={`Move ${card.name}");
    expect(board).not.toContain("&#8943;");
  });

  it("dates a STATED kind by the statement, everything else by the delivery status", () => {
    // A stated kind happened when somebody said it; the delivery event underneath is a
    // different moment. And the un-stated case reads the ONE map the table's own Date
    // column reads, so the two surfaces cannot date one lead two ways.
    expect(page).toContain("out.set(q.email, { kind: q.replyKind, at: q.qualifiedAt })");
    expect(page).toContain(
      "statusAt: statement?.at ?? leadDateForStatus(lead, getLeadConsolidatedStatus(lead))",
    );
  });

  it("says nothing rather than dating a status it holds no instant for", () => {
    const body = sliceFrom(board, "function CardBody(", 3600);
    expect(body).toContain("{card.statusAt && (");
  });
});

describe("the board explains the two splits a reader would not guess", () => {
  it("says it in the COLUMN, not in a footnote under the whole board", () => {
    // The footnote restated what the Contacted column's own blurb already says, one
    // scroll below the thing it was about. The column carries it now, and the gesture
    // explains itself the first time somebody holds a card.
    expect(board).not.toContain("Hold a card to move it");
    expect(board).not.toContain("both stay in Contacted");
    expect(board).not.toContain("<InfoTooltip");
    const lib = readFileSync(join(__dirname, "..", "src", "lib", "lead-board.ts"), "utf8");
    // Each column states what lands in it, in its own blurb.
    for (const blurb of [
      "Still in play. Nothing has happened yet, or nothing this campaign sells.",
      "They reached the step this campaign sells, or bought.",
      "Out of play: they said no, they opted out, or they cannot buy.",
    ]) {
      expect(lib).toContain(blurb);
    }
  });

  it("names the first column LEADS, because Contacted is a card's word now", () => {
    // "Contacted" is one of the delivery statuses a CARD wears (beside Sent,
    // Delivered, Bounced, Queued), so spending the column's name on it made the
    // heading and the cards under it argue about what the word meant.
    const lib = readFileSync(join(__dirname, "..", "src", "lib", "lead-board.ts"), "utf8");
    const first = lib.slice(lib.indexOf("export const LEAD_BOARD_COLUMNS"), lib.indexOf('key: "sales_interest"'));
    expect(first).toContain('key: "contacted"');
    expect(first).toContain('label: "Leads"');
    expect(first).not.toContain('label: "Contacted"');
  });

  it("draws the producer-failure column only when it has something to report", () => {
    // "Not placed" on a healthy campaign advertises a problem that is not there.
    expect(board).toContain("if (column.hideWhenEmpty && inColumn.length === 0) return null;");
  });

  it("draws a page of a column and states what is LEFT, never scroll-loading", () => {
    // A column that draws every card is unusable on Contacted, which holds the whole
    // campaign; a column that hides the size of its tail cannot be judged at all.
    expect(board).toContain("LEAD_BOARD_PAGE_SIZE");
    expect(board).toContain("columnPage(");
    expect(board).toContain("left)");
    // The header count stays the WHOLE column — it answers "how many are here", which
    // is what the board is read for, not "how many fit".
    expect(board).toContain("{inColumn.length}");
    // The reveal falls back when the page re-queries the set, and NOT on a poll.
    expect(board).toContain("}, [filterKey]);");
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
