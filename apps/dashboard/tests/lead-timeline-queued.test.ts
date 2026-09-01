import { describe, it, expect } from "vitest";
import * as fs from "fs";
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
    const body = sliceFrom("function leadStatusStyle(", 900);
    expect(body).toContain('case "contacted": return "bg-slate-100 text-slate-700 border-slate-200"');
    expect(body).not.toContain("teal");
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
    const body = sliceFrom("function LeadTimeline(", 9000);
    expect(body).toContain("<InfoTooltip tip={e.note}");
    expect(body).not.toContain("title={e.note}");
    expect(src).toContain('import { InfoTooltip } from "@/components/visibility/metric-info"');
  });

  it("states each piece of timing exactly once", () => {
    const body = sliceFrom("function LeadTimeline(", 11000);
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
    const body = sliceFrom("function LeadTimeline(", 3000);
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
    const body = sliceFrom("function LeadTimeline(", 3000);
    // "Sent" on its own never said sent WHAT, and a lead receives several messages.
    expect(body).toContain('label: "Initial email"');
    expect(body).toContain("events: initialEvents");
    // Delivered is dropped when absent rather than rendered empty.
    expect(body).toContain("...(lead.firstDeliveredAt ? [{ label: \"Delivered\"");
    // Engagement is NOT nested: the wire gives one first-occurrence per LEAD, and a
    // reply can land after follow-up 2, so filing it under the initial email would
    // state something we never observed.
    expect(body).toContain('{ kind: "event", label: "Website visit"');
    expect(body).toContain('label: lead.replyClassification ? `Replied');
  });

  it("spaces consecutive rows off the index, not a :last-child modifier", () => {
    const body = sliceFrom("function LeadTimeline(", 11000);
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
    const body = sliceFrom("function LeadTimeline(", 11000);
    // Repo rule: tint + a full 1px border, no border-left accent.
    expect(body).toContain('e.kind === "message" ? "rounded-lg border border-brand-200 bg-brand-50 px-3 py-2" : ""');
    expect(body).not.toContain("border-l-2");
    expect(body).not.toContain("border-l-4");
    // The `html.dark` accent remap is a closed set: it covers `bg-brand-50` and
    // `border-brand-200` exactly. An opacity modifier (`bg-brand-50/60`) compiles to
    // a DIFFERENT class the remap never sees, and `border-brand-100` is not in it —
    // either would paint a near-white block on the dark surface.
    expect(body).not.toContain("bg-brand-50/");
    expect(body).not.toContain("border-brand-100");
    // The envelope marks a message, and only a message is a card.
    expect(body).toContain('{e.kind === "message" && (');
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

  it("exports the leads CSV in the words the dashboard uses", () => {
    const csv = fs.readFileSync(path.join(__dirname, "../src/lib/leads-csv.ts"), "utf-8");
    // `lead.contacted` IS the base tab's predicate and `lead.clicked` the
    // Website-Visits one, so the columns carry the tab's word — which is now
    // "Contacted", because this page counts people rather than sequences sent.
    expect(csv).toContain('{ label: "Contacted", value: (l) => yesNo(l.contacted) }');
    expect(csv).toContain('{ label: "Website visit", value: (l) => yesNo(l.clicked) }');
    expect(csv).toContain('{ label: "First contacted at", value: (l) => date(l.firstContactedAt) }');
    expect(csv).toContain('{ label: "First website visit at", value: (l) => date(l.firstClickedAt) }');
    // `Replied` stays: the flag covers negative replies too, so the Positive-replies
    // tab is a subset of it and renaming the column would overstate what it means.
    expect(csv).toContain('{ label: "Replied", value: (l) => yesNo(l.replied) }');
  });

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
