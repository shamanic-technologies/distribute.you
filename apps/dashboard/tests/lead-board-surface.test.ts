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
    // Anchored on the JSX tag with its newline: a bare `<LeadBoard` also matches
    // `Record<LeadBoardColumnKey, ...>` further up the file, and the slice then asserts
    // against a type declaration rather than the mount.
    const mount = sliceFrom(page, "<LeadBoard\n", 1800);
    expect(mount).toContain("columns={boardColumns}");
    expect(mount).toContain("onShowMore={");
    expect(mount).toContain("canMove={Boolean(campaignId)}");
    expect(mount).toContain("onMove={");
    expect(mount).toContain("onOpen={");
    // The bound the board used to apologise for is gone: each column has its own page.
    expect(page).not.toContain("LEAD_BOARD_CARD_CAP");
    expect(mount).not.toContain("most recently");
  });

  it("draws the board at EVERY scope, since triage needs no funnel to order it", () => {
    expect(page).toContain('const showBoard = boardOnly || view === "board";');
    expect(page).not.toContain("const boardAvailable");
    expect(page).not.toContain("leadBoardColumns(");
  });

  it("places every card by the column it was READ from, never a second opinion", () => {
    const cards = sliceFrom(page, "const boardColumns = useMemo(", 2600);
    // lead-service filtered that page BY STANDING, so re-deriving a column from the row
    // would be a second opinion over the answer that selected it. The only thing that
    // overrides it is a statement somebody just made, for the round trip it takes.
    expect(cards).not.toContain("leadBoardColumnFor(lead.standing)");
    expect(cards).toContain("held?.column && held.column !== column.key");
    // The person's own face rides the row the page already holds — never a per-card
    // fetch, and never a fabricated avatar when the enrichment carried none.
    expect(page).toContain("photoUrl: full?.photoUrl ?? null");
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

  it("reads ONE page and ONE size PER COLUMN, so no column is a slice of another", () => {
    // It used to be a single bounded read of the widest bucket, sorted into columns
    // here — so a column's head counted the rows that read returned rather than the
    // people in it, and no column could be grown past what the others had consumed.
    expect(page).toContain("useBoardColumnPage(columnArgs(");
    expect(page).toContain("leadsColumnPageQuery({");
    expect(page).not.toContain('leadsPageQuery({ tab: "outreach", search: wireSearch, page: 0 })');
    // The sizes are the producer's counts, added over the standings a column holds.
    expect(page).toContain("getLeadStandingCounts(scope, standingCountsQuery(wireSearch))");
    expect(page).toContain("boardColumnTotals(standingCounts)");
    // An empty column costs no read once its size is known; before that every column is
    // read in parallel rather than waiting a round trip to find out.
    expect(page).toContain("columnTotals == null || columnTotals[column] > 0");
  });

  it("grows a column by asking for a WIDER page, not a bigger slice of one it holds", () => {
    // How far each column is drawn lives on the page because it drives a fetch now.
    expect(page).toContain("const [columnShown, setColumnShown] = useState<Record<string, number>>({});");
    expect(page).toContain("(prev[column] ?? LEAD_BOARD_PAGE_SIZE) + LEAD_BOARD_PAGE_SIZE");
    // A search re-queries every column, so how far one was grown describes a set that
    // no longer exists.
    expect(page).toContain("setColumnShown({});");
  });

  it("keeps ONE search, and it is the producer's", () => {
    // The table and the board pass the SAME `wireSearch` to lead-service, which searches
    // the whole matching population — so a match on page 40 is findable, which a local
    // predicate over the loaded rows never made it. A second local predicate is how a
    // search comes to mean one thing in a row and another on a card.
    expect(page).not.toContain("const matchesSearch");
    expect(page).toContain("const wireSearch = leadsSearchParam(debouncedSearch) ?? \"\";");
    expect(page).toContain("leadBucketCountsQuery(wireSearch)");
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
    expect(board).toContain('type: "reply",');
    expect(board).toContain("replyKind: kind,");
    expect(board).toContain("column: pending.to.key,");
  });

  it("holds what was just stated so the card moves before the re-read lands", () => {
    // The write's only visible effect is the jump, and the jump comes from a re-read —
    // without this the control reads as dead for a round trip. The COLUMN rides along
    // because placement is the producer's now: without it the card would snap back the
    // instant it was dropped.
    expect(page).toContain("new Map(prev).set(email, held.kind");
    expect(page).toContain("at: new Date().toISOString(), column: held.column }");
    expect(page).toContain("if (!held?.column || held.column !== column.key) continue;");
    // A refusal drops it: the board must never state something nobody recorded.
    expect(page).toContain("next.delete(email)");
  });

  it("drops the held column once the re-read lands, so a move can visibly NOT take", () => {
    // A permanent client override would hide lead-service legitimately placing the card
    // somewhere else — which it does: stating "Interested" on a campaign whose funnel is
    // entered by a website visit is a positive reply, and a positive reply is not the
    // step that campaign sells. That is the correct answer and the reader must see it.
    const move = sliceFrom(page, "onMove={(move) => {", 4400);
    expect(move).toContain("void settled.then(drop);");
    expect(move).toContain("next.delete(email)");
    // A WITHDRAWAL holds nothing at all: where a released person lands is
    // lead-service's answer, and guessing at it here would be this app deciding a
    // standing again — the whole thing this board stopped doing.
    expect(move).toContain('if (move.type !== "withdrawal") {');
    // Detached rather than awaited: a promise returned from `onSuccess` keeps the
    // mutation pending, and that is what the board disables its picker on — so
    // awaiting the leads refetch would lock it for the length of a read that runs to
    // tens of megabytes on a live campaign.
    expect(move).not.toContain("onSuccess: async () => {");
  });

  it("renders the producer's own refusal, never the thrown Error's message", () => {
    // A `toContain` cannot be hurt by a slice that runs long, so this has real
    // headroom; the `not.toContain` below is bounded by the same slice and its
    // neighbour writes no `err.message`.
    const move = sliceFrom(page, "onMove={(move) => {", 4900);
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
    expect(page).toContain("statusLabel: leadStatusLabel(status)");
    expect(page).toContain("statusPill: leadStatusPill(status)");
    // And the date under it proves THAT status — one statement, one event.
    expect(page).toContain("statusAt: statedAt ?? leadDateForStatus(lead, status)");
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
    expect(page).toContain("statusAt: statedAt ?? leadDateForStatus(lead, status)");
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
      "Individuals we have identified as potential clients.",
      "Leads who have shown or expressed sales interest.",
      // The scope is filled in at render — see the blurb suite below.
      "Individuals disqualified as leads for this {scope}.",
    ]) {
      expect(lib).toContain(blurb);
    }
  });

  it("never tells a reader that a no, or an opt-out, belongs in Disqualified", () => {
    // Disqualified is "not our target" and nothing else. A no about the moment stays in
    // Leads and an opt-out has its own column, so a blurb naming either of them here
    // describes a board that does not exist.
    const lib = readFileSync(join(__dirname, "..", "src", "lib", "lead-board.ts"), "utf8");
    const disqualified = lib.slice(
      lib.indexOf('key: "disqualified"'),
      lib.indexOf('key: "opt_out"'),
    );
    expect(disqualified).not.toContain("said no");
    expect(disqualified).not.toContain("opted out");
    expect(disqualified).not.toContain("cannot buy");
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
    // On its SERVED size, not on how many rows arrived: a column drawn from a page is
    // empty for as long as that page is in flight, which would make "Not placed" appear
    // a moment after the board rather than not at all.
    expect(board).toContain("if (column.hideWhenEmpty && total === 0) return null;");
  });

  it("draws a page of a column and states what is LEFT, never scroll-loading", () => {
    // A column that draws every card is unusable on Leads, which holds the whole
    // campaign; a column that hides the size of its tail cannot be judged at all.
    expect(board).toContain("Math.max(0, total - drawn.length)");
    expect(board).toContain("left)");
    expect(board).toContain("onShowMore(column.key)");
    // The header count is the COLUMN's SERVED size, never the cards drawn — which is a
    // fact about the viewport and would make a column of 1,966 read as a column of 20.
    expect(board).toContain('{total == null ? "" : total.toLocaleString("en-US")}');
    expect(board).not.toContain("{inColumn.length}");
    // An unknown remainder offers no button rather than a guessed one.
    expect(board).toContain("remaining != null && remaining > 0");
    // How far a column is drawn is the PAGE's now: it drives a fetch, so the board
    // holding its own copy would let the two disagree about what has been asked for.
    expect(board).not.toContain("const [shown, setShown]");
    expect(board).not.toContain("columnPage(");
  });

  it("shares the page width between the columns rather than pinning each one", () => {
    // How many columns there are is a property of what is being triaged, so a fixed
    // width leaves half the page empty on a four-column board and is what was reported.
    // `basis-0` makes the split even whatever the content; the floor keeps a card
    // legible and hands the overflow to the rail, which is the phone case.
    expect(board).toContain("min-w-[13rem] flex-1 basis-0 rounded-xl border p-2");
    expect(board).not.toContain("w-64 shrink-0 rounded-xl");
    // The rail still scrolls once the floors no longer fit.
    expect(board).toContain('className="flex gap-3 overflow-x-auto pb-2"');
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

/**
 * The blurbs say who is in a column in the customer's own words, and the one whose
 * sentence depends on the grain names it.
 */
describe("the column blurbs name who is in them", () => {
  const lib = readFileSync(join(__dirname, "..", "src", "lib", "lead-board.ts"), "utf8");
  const page = readFileSync(
    join(__dirname, "..", "src", "components", "audiences", "engaged-leads-page.tsx"),
    "utf8",
  );

  it("reads the blurb through the helper, so the scope is filled in", () => {
    expect(board).toContain("columnBlurb(column, scopeNoun)");
    expect(board).not.toContain("{column.blurb}");
  });

  it("threads the grain from the page at the CALL SITE", () => {
    // The prop, not only the component: a board handed no scope would silently read
    // "campaign" on a brand page.
    expect(page).toContain("scopeNoun={boardScopeNoun}");
    for (const noun of ['"campaign"', '"sales funnel"', '"offer"', '"brand"']) {
      expect(page).toContain(noun);
    }
  });

  it("keeps the four sentences the owner wrote", () => {
    for (const blurb of [
      "Individuals we have identified as potential clients.",
      "Leads who have shown or expressed sales interest.",
      "Individuals disqualified as leads for this {scope}.",
      "Leads who requested to be unsubscribed.",
    ]) {
      expect(lib).toContain(blurb);
    }
  });
});
