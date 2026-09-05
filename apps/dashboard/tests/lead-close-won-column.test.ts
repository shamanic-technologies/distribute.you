import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

const PAGE = read("src/components/audiences/engaged-leads-page.tsx");
const SECTION = read("src/components/leads/lead-funnel-stage-section.tsx");
const LIB = read("src/lib/lead-close-won.ts");
// The FORM the cell mounts. It moved out of the page when the board grew its own Close
// won column: two copies of "whose win was it, and what was it worth" is how one
// surface comes to ask a question the other does not, about the same deal.
const FORM = read("src/components/leads/close-won-form.tsx");
const BOARD = read("src/components/leads/lead-board.tsx");

const sliceTo = (src: string, from: string, to: string) => {
  const at = src.indexOf(from);
  expect(at).toBeGreaterThan(-1);
  const end = src.indexOf(to, at);
  expect(end).toBeGreaterThan(at);
  return src.slice(at, end);
};

describe("the Close won column", () => {
  it("renders at every grain, because one component serves all four", () => {
    // `EngagedLeadsPage` is the brand, offer, funnel and campaign leads page. The
    // column is passed once, so there is no grain it can be missing from.
    expect(PAGE).toContain("<th className=\"px-4 py-3 hidden lg:table-cell\">Close won</th>");
    expect(PAGE).toContain("<CloseWonCell");
  });

  it("is the LAST column and folds away below lg, one breakpoint later than its neighbours", () => {
    // It holds a two-input FORM rather than a value. Measured against the app's own
    // compiled Tailwind: at `md` the cell is ~120px and the form wraps onto four lines;
    // from `lg` it sits on one or two. Below that the lead panel states the same thing.
    const head = sliceTo(PAGE, "<thead>", "</thead>");
    expect(head.indexOf("Close won")).toBeGreaterThan(head.indexOf(">Date<"));
    const closeWonHeader = head.slice(head.indexOf("Close won") - 200, head.indexOf("Close won"));
    expect(closeWonHeader).toContain("hidden lg:table-cell");
  });

  it("leaves the width floor alone, so no width that fit before scrolls now", () => {
    // Raising it to fit the form made an 820px tablet scroll sideways (measured: the
    // card wanted 840 in 754). The column is `lg`-gated instead, so the floor buys
    // nothing and the widths below it are byte-identical to before.
    expect(PAGE).toContain('className="w-full table-fixed text-sm md:table-auto md:min-w-[720px]"');
    expect(PAGE).not.toContain("md:min-w-[840px]");
  });

  it("states nothing at all when the lead's funnel cannot be placed", () => {
    // Three states, and the middle one is not the absence of the other two. A blank
    // that reads as "not won" would assert something nobody knows, and a button that
    // lead-service would refuse is worse than no button.
    const cell = sliceTo(PAGE, "function CloseWonCell(", "function LeadsTable(");
    expect(cell).toContain('if (state === "unavailable") return <span className="text-gray-300">-</span>');
  });

  it("reads WON off lead-service rather than deriving one", () => {
    // The producer decides it; this app renders it. Nothing here infers a close from a
    // reply, a click, a standing word or an amount.
    const cell = sliceTo(PAGE, "function CloseWonCell(", "function LeadsTable(");
    expect(cell).toContain("leadCloseWonState(lead)");
    expect(cell).not.toContain("repliedPositive");
    expect(cell).not.toContain("valueCents >");
    expect(cell).not.toContain('=== "customer"');
  });

  it("states the two substatuses, and never folds UNASKED into either", () => {
    // Three readings, because a deal nobody was asked about is not a deal we did not
    // cause — and nearly every deal in the system is in that state today.
    const cell = sliceTo(PAGE, "function CloseWonCell(", "function LeadsTable(");
    expect(cell).toContain('"Won, ours"');
    expect(cell).toContain('"Won, not ours"');
    expect(cell).toContain('caused === "outreach"');
    expect(cell).toContain('caused === "other"');
    // The unasked reading is the fall-through of both, so it can never wear either
    // verdict's colour or either verdict's words.
    expect(cell).toContain("dealCause(lead)");
  });

  it("asks whose win it was, and refuses to send until somebody answers", () => {
    // Defaulting the answer would record words nobody said, which is the one thing the
    // column exists to stop. Two named buttons rather than a checkbox: an unticked box
    // reads as "not ours" without anybody choosing it.
    expect(FORM).toContain("Caused by us?");
    expect(FORM).toContain("useState<boolean | null>(null)");
    expect(FORM).toContain("disabled={cause === null}");
    expect(FORM).toContain("if (cause === null) return;");
  });

  it("asks it in ONE form, mounted by the table cell AND by the board", () => {
    // A guard on the form alone passes forever over a surface that never renders it.
    const cell = sliceTo(PAGE, "function CloseWonCell(", "function LeadsTable(");
    expect(cell).toContain("<CloseWonForm");
    expect(BOARD).toContain("<CloseWonForm");
    // And there is no second copy: the cell states the amounts through the form, never
    // its own StageStatementForm.
    expect(cell).not.toContain("StageStatementForm");
  });

  it("sends the answer as the producer's own optional field", () => {
    // Optional on the wire: OMITTING it records `null` = nobody was asked. This column
    // always asks, so it always sends one.
    const write = sliceTo(PAGE, "const stateCloseWon = useCallback(", "const leadCampaignTree = useMemo(");
    expect(write).toContain("causedByOutreach");
  });

  it("stops the row's own click, or the form opens the detail panel underneath itself", () => {
    const cell = sliceTo(PAGE, "function CloseWonCell(", "function LeadsTable(");
    expect(cell).toContain("stopPropagation");
    // The form does too, for the board: a card is draggable, so a press on an input
    // inside it would otherwise lift the card.
    expect(FORM).toContain("stopPropagation");
  });

  it("writes through the row-scoped hook, the same one the board uses", () => {
    // The target is decided at press time. Holding it in state first so a per-lead hook
    // could be built would race the submit.
    expect(PAGE).toContain("useSetAnyLeadStepStatement()");
    // Bounded by the declaration that FOLLOWS it. `function LeadsTable(` is declared
    // EARLIER in the file, so using it as the end bound slices backwards and finds
    // nothing — a slice only ever looks forward.
    const write = sliceTo(PAGE, "const stateCloseWon = useCallback(", "const leadCampaignTree = useMemo(");
    expect(write).toContain('step: "sale"');
    expect(write).toContain('kind: "outcome"');
    // lead-service writes its refusal for a person to read; the raw thrown error is the
    // whole downstream body verbatim and never reaches a customer.
    expect(write).toContain("leadStepErrorMessage(err)");
    expect(write).not.toContain("err.message");
  });
});

describe("the deal-value field opens with the brand's own stated lifetime revenue", () => {
  it("resolves it per lead, off the lead's OWN funnel", () => {
    const resolver = sliceTo(PAGE, "const prefillUsdFor = useCallback(", "const stateCloseWon");
    expect(resolver).toContain("saleValuePrefillUsd(salesFunnelsData?.funnels, closeWonFunnelKey(lead))");
  });

  it("reads the OFFER's funnels, on the key the Sales Funnels card already polls", () => {
    // A lifetime revenue is a property of (offer, funnel), so a brand-wide read would
    // open the field with what a DIFFERENT proposition is worth. The shared key means
    // no extra request.
    expect(PAGE).toContain('["offerSalesFunnels", brandId, offerId ?? "none"]');
    expect(PAGE).toContain("enabled: !!offerId");
    expect(PAGE).not.toContain("getBrandSalesFunnels");
  });

  it("passes it to the PANEL too, so one deal is worth one thing on both surfaces", () => {
    // The guard pins the CALL SITE, not only the component: a page that resolves the
    // value and does not pass it is the feature entirely absent with the component
    // perfectly correct.
    const call = sliceTo(PAGE, "<LeadFunnelStageSection", ">Organization<");
    expect(call).toContain("saleValuePrefillUsd={selectedLead ? prefillUsdFor(selectedLead) : null}");
  });

  it("seeds the field ONCE, so it cannot rewrite an amount somebody is typing", () => {
    const form = sliceTo(SECTION, "export function StageStatementForm(", "export function LeadFunnelStageSection(");
    expect(form).toContain("useState(() =>");
    expect(form).toContain("defaultValueUsd != null && defaultValueUsd > 0");
  });

  it("is a PREFILL, not a default — what is sent is whatever the field holds", () => {
    // The producer refuses a sale with no value on purpose, and nothing here sends a
    // number on the author's behalf: an empty field still leaves the button disabled.
    const form = sliceTo(SECTION, "export function StageStatementForm(", "export function LeadFunnelStageSection(");
    expect(form).toContain("const valueCents = saleValueCentsFrom(rawValue);");
    expect(form).toContain("if (needsValue && valueCents == null) return;");
  });
});

describe("lib/lead-close-won.ts stays alias-free", () => {
  it("imports nothing through the @ alias, so it can carry real unit tests", () => {
    expect(LIB).not.toContain('from "@/');
  });
});
