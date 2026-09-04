import { describe, it, expect } from "vitest";
import * as fs from "fs";
const { readFileSync } = fs;
import * as path from "path";

/**
 * "Contacted" claimed we had emailed a lead we had only handed to Instantly.
 *
 * Instantly dispatches on weekdays between 08:00 and 17:00 in the recipient's
 * timezone, so a lead pushed on a Friday evening sits in that queue for three days.
 * The dashboard printed "Contacted" for the whole window, which is why a customer
 * who had just been told we respect business hours read the page as contradicting us.
 *
 * The push is now "Queued", the send window is stated on the row that needs it, and
 * the queue row disappears the moment a real send exists — a lead never shows the
 * waiting state and the sent state at once.
 *
 * Source-substring guards: the page pulls Clerk/api through the `@` alias vitest does
 * not resolve here, matching the repo's other page guards. Each guard is scoped to the
 * function body it covers, because "Contacted"/"Clicked" remain legitimate words
 * elsewhere in the tree (the wire field names, the admin console).
 */
describe("Leads — a queued lead is not a contacted lead", () => {
  const pagePath = path.join(__dirname, "../src/components/audiences/engaged-leads-page.tsx");
  const src = fs.readFileSync(pagePath, "utf-8");

  const sliceFrom = (marker: string, length = 2600) => {
    const at = src.indexOf(marker);
    expect(at, `marker not found: ${marker}`).toBeGreaterThan(-1);
    return src.slice(at, at + length);
  };

  /** Bounded to the next top-level `function`, for `toContain`-only guards. */
  const sliceToNextFunction = (marker: string) => {
    const at = src.indexOf(marker);
    expect(at, `marker not found: ${marker}`).toBeGreaterThan(-1);
    const end = src.indexOf("\nfunction ", at + marker.length);
    return src.slice(at, end > at ? end : undefined);
  };

  it("names the queue state Queued and drops the Contacted claim", () => {
    // The label moved to `lib/lead-status.ts` so the leads TABLE's badge, the CSV and
    // the BOARD card's tag all read one map — a lead must not say "Delivered" in the
    // table and "Sent" on a card one click away.
    const lib = fs.readFileSync(
      path.join(__dirname, "../src/lib/lead-status.ts"),
      "utf-8",
    );
    const body = lib.slice(lib.indexOf("export function leadStatusLabel("));
    expect(body).toContain('case "contacted": return "Queued"');
    expect(body).not.toContain('"Contacted"');
    // And nothing re-spells it back in the page.
    expect(src).not.toContain("function leadStatusLabel(");
  });

  it("styles the queue state as a wait, not as an acquired step", () => {
    // The palette moved to `lib/lead-status.ts` with the label, so the table badge, the
    // lead panel and the board card draw one status one way. Slate is the "ours to
    // send, not sent" step of that sweep — the lead has cleared nothing yet.
    const lib = readFileSync(
      path.join(__dirname, "../src/lib/lead-status.ts"),
      "utf-8",
    );
    const body = lib.slice(lib.indexOf("export function leadStatusPill("));
    expect(body).toContain('case "contacted": return "bg-slate-100 text-slate-700 border-slate-200"');
    // Teal is the far end of the sweep, where the lead has answered.
    expect(body).toContain('case "replied": return "bg-teal-100');
    expect(src).not.toContain("function leadStatusStyle(");
  });

  it("states the send window on the queue row so the wait is explained", () => {
    expect(src).toContain('const QUEUED_LABEL = "Queued for sending"');
    expect(src).toContain(
      "We only send on weekdays, 8am to 5pm during the recipient's local business hours.",
    );
    // Em-dash is banned in user-facing copy; the note is user-facing.
    expect(src.slice(src.indexOf("const SEND_WINDOW_NOTE"), src.indexOf("const SEND_WINDOW_NOTE") + 300))
      .not.toContain("—");
  });

  it("carries the note on the shared InfoTooltip, never a native title", () => {
    // A native `title` waits ~1s, cannot be styled, and shows NOTHING on touch —
    // which is exactly how this shipped broken the first time.
    const body = sliceToNextFunction("function LeadTimeline(");
    expect(body).toContain("<InfoTooltip tip={e.note}");
    expect(body).not.toContain("title={e.note}");
    expect(src).toContain('import { InfoTooltip } from "@/components/visibility/metric-info"');
  });

  it("states each piece of timing exactly once", () => {
    const body = sliceToNextFunction("function LeadTimeline(");
    // The gutter carries the GAP only. It used to print the first row's own date,
    // one inch from that row's own "Jul 30, 2026".
    expect(body).toContain('const gutter = i === 0 ? "" : gapLabel(sorted[i - 1].at, e.at)');
    // A card with delivery rows states no date of its own — its instant IS its
    // `Sent` row's — and a derived timestamp states none either, so no second
    // relative figure ("10d after the first email") sits beside the gutter's "+7d".
    expect(body).toContain("{!e.estimated && !e.events?.length && (");
    expect(body).not.toContain("after the first email");
    expect(body).not.toContain("~");
  });

  it("shows the queue row only while nothing has been sent", () => {
    // 4200 is a MEASURED bound and stays one: the `not.toContain` below would read the
    // next function's body if the slice ran past this one. `label: QUEUED_LABEL` sits
    // at 3140, `note: SEND_WINDOW_NOTE` at 3414 and the `Sent` row at 3463, so it has
    // real headroom.
    const body = sliceFrom("function LeadTimeline(", 4200);
    // The queue row is gated on the absence of a real send, so Queued and Sent can
    // never both appear for one lead — they are the two branches of one ternary.
    expect(body).toContain("const queuedOnly = !sentAt");
    expect(body).toContain("const initialEvents: MessageEvent[] = queuedOnly");
    expect(body).toContain("label: QUEUED_LABEL");
    expect(body).toContain("note: SEND_WINDOW_NOTE");
    expect(body).toContain('{ label: "Sent", at: sentAt, dot: "bg-blue-400" }');
    // No standalone "Contacted" event survives.
    expect(body).not.toContain('label: "Contacted"');
  });

  it("groups each message's delivery rows inside that message", () => {
    // Bounded to the NEXT declaration, not a number: every assertion below is a
    // `toContain`, which a long slice cannot hurt, and a measured length expires on
    // the next comment added to the function — it did, when the timeline took a
    // structural `delivery` prop and grew a doc comment above its signature.
    const body = sliceToNextFunction("function LeadTimeline(");
    // "Sent" on its own never said sent WHAT, and a lead receives several messages.
    expect(body).toContain('label: "Initial email"');
    expect(body).toContain("events: initialEvents");
    // Delivered is dropped when absent rather than rendered empty.
    expect(body).toContain("...(delivery.firstDeliveredAt ? [{ label: \"Delivered\"");
    // Engagement is NOT nested: the wire gives one first-occurrence per LEAD, and a
    // reply can land after follow-up 2, so filing it under the initial email would
    // state something we never observed.
    expect(body).toContain('{ kind: "event", label: "Website visit"');
    expect(body).toContain('label: delivery.replyClassification ? `Replied');
  });

  it("spaces consecutive rows off the index, not a :last-child modifier", () => {
    const body = sliceToNextFunction("function LeadTimeline(");
    // `last:` resolves to `:last-child` of the PARENT, and this div is the final
    // child of its <li> on EVERY row — so `pb-4 last:pb-0` zeroed the padding
    // everywhere and consecutive message cards sat edge to edge. Verified headlessly:
    // the old markup computed padding-bottom 0px on the first of two rows.
    expect(body).toContain('${i < sorted.length - 1 ? "pb-4" : ""}');
    expect(body).not.toContain("last:pb-0");
    // Same condition as the connector line right below it, so the line and the gap
    // can never disagree about which row is last.
    expect(body).toContain("{i < sorted.length - 1 && <span");
  });

  it("draws a message as a demarcated block, never a thick side accent", () => {
    const body = sliceToNextFunction("function LeadTimeline(");
    // Repo rule: tint + a full 1px border, no border-left accent.
    expect(body).toContain('e.kind === "message" ? "rounded-lg border border-brand-200 bg-brand-50 px-3 py-2"');
    // A message the PROSPECT sent is a card too, in its own tint, so a glance down
    // the column shows who was speaking. Same shape rule: full 1px border, no accent.
    expect(body).toContain('e.kind === "inbound" ? "rounded-lg border border-violet-200 bg-violet-50 px-3 py-2"');
    expect(body).not.toContain("border-l-2");
    expect(body).not.toContain("border-l-4");
    // The `html.dark` accent remap is a closed set: it covers `bg-brand-50` and
    // `border-brand-200` exactly. An opacity modifier (`bg-brand-50/60`) compiles to
    // a DIFFERENT class the remap never sees, and `border-brand-100` is not in it —
    // either would paint a near-white block on the dark surface.
    expect(body).not.toContain("bg-brand-50/");
    expect(body).not.toContain("border-brand-100");
    // The envelope marks a message — either side's. Only a lead-level event is a
    // plain row.
    expect(body).toContain('{e.kind !== "event" && (');
  });

  it("drops the Served footer from the lead panel", () => {
    // An internal pipeline instant, in a different date format than every timeline
    // row above it. `servedAt` still dates the row while it reads "Processing".
    expect(src).not.toContain("Served: {new Date(");
  });

  it("marks an unsent follow-up as estimated rather than dating it", () => {
    const derive = sliceFrom("function deriveEmailRows(", 2200);
    expect(derive).toContain("estimated ? { estimated: true } : {}");
    // A boolean, not a string: there is no second wording of the timing to drift.
    expect(derive).not.toContain("after the first email");
  });

  it("lets every Outreach row show its own status", () => {
    // forceContacted painted "Contacted" on every row of the Outreach tab, so a lead
    // that really was sent contradicted its own detail panel.
    expect(src).not.toContain("forceContacted");
  });

  // The conversions chips that carried the same word are retired with their tabs (see
  // conversions-cluster-retired.test.ts), so `leadStatusLabel` is now the only place
  // the queue state is named for a customer.

  // The leads CSV is lead-service's file now (v0.70.0), headings included: it used to be
  // built here only because the producer headed its columns with the API's field names.
  // The words are guarded where the file is produced; a copy of them here would be a
  // guard over something this repo does not own. `leadStatusLabel` below is still the
  // dashboard's own naming of the queue state, and that IS ours.

  it("leaves the staff console on the raw technical state", () => {
    const admin = fs.readFileSync(
      path.join(
        __dirname,
        "../../admin/src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/leads/page.tsx",
      ),
      "utf-8",
    );
    expect(admin).toContain('case "contacted": return "Contacted"');
  });
});
