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
    const body = sliceFrom("function leadStatusLabel(", 700);
    expect(body).toContain('case "contacted": return "Queued"');
    expect(body).not.toContain('"Contacted"');
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
    const body = sliceFrom("function LeadTimeline(", 9000);
    // The gutter carries the GAP only. It used to print the first row's own date,
    // one inch from that row's own "Jul 30, 2026".
    expect(body).toContain('const gutter = i === 0 ? "" : gapLabel(sorted[i - 1].at, e.at)');
    // A derived timestamp gets no date line at all, so no second relative figure
    // ("10d after the first email") sits beside the gutter's "+7d".
    expect(body).toContain("{!e.estimated && (");
    expect(body).not.toContain("after the first email");
    expect(body).not.toContain("~");
  });

  it("shows the queue row only while nothing has been sent", () => {
    const body = sliceFrom("function LeadTimeline(");
    // The queue row is gated on the absence of a real send, so Queued and Sent can
    // never both appear for one lead.
    expect(body).toContain("const queuedOnly = !sentAt");
    expect(body).toContain("if (queuedOnly");
    expect(body).toContain("label: QUEUED_LABEL");
    expect(body).toContain("note: SEND_WINDOW_NOTE");
    // No standalone "Contacted" event survives.
    expect(body).not.toContain('label: "Contacted"');
  });

  it("puts the initial message on exactly one row, and never on a row of its own", () => {
    const body = sliceFrom("function LeadTimeline(");
    // Unsent: the queue row carries it. Sent: the Sent row does. An "Initial email"
    // row anchored at `sentAt` printed the Sent row's own instant a second time under
    // a label that stated nothing.
    expect(body).toContain("...(queuedOnly || !initial ? {} : { subject: initial.subject, body: initial.body })");
    expect(body).not.toContain('label: "Initial email"');
    expect(body).not.toContain("if (!queuedOnly && initial)");
    // The queue row still carries it while nothing has left.
    expect(body).toContain("body: initial?.body");
  });

  it("shows the envelope on whichever row carries the message", () => {
    const body = sliceFrom("function LeadTimeline(", 9000);
    // Neither the queue row nor the Sent row is `kind: "email"`, so keying the icon
    // on `kind` hid it on both — including, before this, on the queue row that has
    // always carried the waiting message.
    expect(body).toContain("{!!e.body && (");
    expect(body).not.toContain('{e.kind === "email" && (');
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
    // `lead.contacted` IS the Outreach-tab predicate and `lead.clicked` the
    // Website-Visits one, so the columns carry the tab's word.
    expect(csv).toContain('{ label: "Outreach", value: (l) => yesNo(l.contacted) }');
    expect(csv).toContain('{ label: "Website visit", value: (l) => yesNo(l.clicked) }');
    expect(csv).toContain('{ label: "First outreach at", value: (l) => date(l.firstContactedAt) }');
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
