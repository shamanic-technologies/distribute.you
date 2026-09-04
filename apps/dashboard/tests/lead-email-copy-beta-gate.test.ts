import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * The lead timeline shows WHAT a campaign did to GA, and the message's own COPY only
 * to beta.
 *
 * `EngagedLeadsPage` is one component rendered at all four grains (brand, offer,
 * funnel, campaign), so this is the single place the gate has to hold — there is no
 * second leads surface to keep in lockstep, and the CSV export carries neither a
 * subject nor a body.
 *
 * Two halves, and both matter:
 *   - The SUBJECT is content. Leaving the `<summary>` GA and gating only the body
 *     would put the copy's headline on screen for everyone, which is the thing the
 *     gate exists to stop.
 *   - The timeline's SHAPE stays GA. The `Initial email` / `Follow-up (step N)`
 *     cards, their cadence, and the `Queued` / `Sent` / `Delivered` rows say what a
 *     campaign did; that is the page's whole job.
 *
 * ⚠️ The gate is on the DERIVED copy only, and that distinction is the whole rule.
 * A message that was actually EXCHANGED — one we sent, or the prospect's own words
 * written to this customer — is GA: it is their conversation, and the reason our
 * drafts are gated (the copy is our writing, not yet sent) does not apply to it,
 * least of all to what someone wrote back to them. So the condition is not "is this
 * reader beta" but "is this body one we have not sent yet".
 *
 * The generation is still FETCHED for everyone, deliberately: the follow-up rows are
 * derived from its sequence steps, so gating the read would delete the cadence rather
 * than hide the words. The body therefore reaches the browser and is readable in
 * devtools — the org's own copy to its own leads, so a display decision, not a
 * security boundary, exactly like every other beta gate in this app.
 *
 * Source-substring guards: the page pulls Clerk/api through the `@` alias vitest does
 * not resolve here, matching the repo's other page guards.
 */
describe("Leads — the email copy is beta, the timeline is GA", () => {
  const pagePath = path.join(__dirname, "../src/components/audiences/engaged-leads-page.tsx");
  const src = fs.readFileSync(pagePath, "utf-8");

  const timeline = () => {
    const at = src.indexOf("function LeadTimeline(");
    expect(at, "marker not found: function LeadTimeline(").toBeGreaterThan(-1);
    const end = src.indexOf("function LeadsLoadingSkeleton(");
    expect(end).toBeGreaterThan(at);
    return src.slice(at, end);
  };

  it("resolves the gate inside the component that renders the copy", () => {
    // The CALL SITE, not only the import: a component that never asks is the feature
    // entirely absent with the hook perfectly correct.
    expect(timeline()).toContain("const canReadEmailCopy = useIsBetaUser()");
    expect(src).toContain('import { useIsBetaUser } from "@/lib/use-beta-user"');
  });

  it("gates the subject and the body together, on one condition", () => {
    const body = timeline();
    // One gate over the whole `<details>`, so the summary (which prints the subject)
    // can never render without it — and it turns on whether the body is one we have
    // not sent, never on the reader alone.
    expect(body).toContain("{e.body && (!e.gated || canReadEmailCopy) && (");
    // The subject and the body render only inside that block.
    const gateAt = body.indexOf("{e.body && (!e.gated || canReadEmailCopy) && (");
    const before = body.slice(0, gateAt);
    expect(before).not.toContain("e.subject ?");
    expect(before).not.toContain("{e.body}");
    expect(before).not.toContain("EmailSignature");
  });

  it("marks the derived copy as gated and the real messages as not", () => {
    const body = timeline();
    // A card built from a message that was actually exchanged carries no `gated`
    // flag; only the generation's own cards do. Getting this backwards would either
    // hide the customer's conversation or leak an unsent draft.
    const derivedAt = body.indexOf('label: "Initial email",');
    expect(derivedAt).toBeGreaterThan(-1);
    expect(body.slice(derivedAt, body.indexOf("}", body.indexOf("events: initialEvents", derivedAt)))).toContain("gated: true");
    // The unsent follow-ups are gated the same way, in one place.
    expect(body).toContain("gated: true,");
    // The real-message cards state no gate at all.
    const threadAt = body.indexOf("messages.forEach((m, i) => {");
    expect(threadAt).toBeGreaterThan(-1);
    expect(body.slice(threadAt, body.indexOf("});", threadAt))).not.toContain("gated");
  });

  it("carries the badge the gate rule requires", () => {
    // Gating without a badge is a bug: the viewer who CAN see it has no way to know
    // the surface is not GA.
    const body = timeline();
    const gateAt = body.indexOf("{e.body && (!e.gated || canReadEmailCopy) && (");
    const detailsEnd = body.indexOf("</details>", gateAt);
    expect(detailsEnd).toBeGreaterThan(gateAt);
    expect(body.slice(gateAt, detailsEnd)).toContain('<MaturityBadge level="beta" />');
    expect(src).toContain('import { MaturityBadge } from "@/components/maturity-badge"');
  });

  it("GAs the copy on a scope that produced a sales interest", () => {
    const body = timeline();
    // A positive reply or a website visit is what the campaign was bought for, so the
    // customer reads the words that did it — beta or not. The unlock is derived from
    // the delivery evidence the CALLER stated, so a campaign card unlocks on its own
    // and never on a sibling's.
    expect(body).toContain("const salesInterest = hasSalesInterest(delivery)");
    expect(body).toContain("const canReadEmailCopy = useIsBetaUser() || salesInterest;");
    expect(src).toContain('import { hasSalesInterest } from "@/lib/lead-sales-interest"');
  });

  it("drops the badge where the unlock made the copy GA", () => {
    // Gating without a badge is a bug; badging without a gate is the mirror of it —
    // it claims a restriction that is no longer holding anything.
    expect(timeline()).toContain('{e.gated && !salesInterest && <span');
  });

  it("leaves the timeline's shape ungated", () => {
    const body = timeline();
    // What the campaign DID is the page's job and stays GA. Each of these is outside
    // the copy gate; a `canReadEmailCopy` wrapped around any of them would blank the
    // timeline for every non-beta reader.
    const gateAt = body.indexOf("{e.body && (!e.gated || canReadEmailCopy) && (");
    expect(gateAt).toBeGreaterThan(-1);
    const shape = body.slice(0, gateAt);
    expect(shape).toContain('label: "Initial email"');
    expect(shape).toContain("label: QUEUED_LABEL");
    expect(shape).toContain('{ label: "Sent", at: sentAt, dot: "bg-blue-400" }');
    expect(shape).toContain('{ kind: "event", label: "Website visit"');
    // The gate is resolved once, for the copy, and nowhere else in the component.
    expect(body.split("canReadEmailCopy").length - 1).toBe(2);
  });

  it("keeps fetching the generation for everyone", () => {
    // The follow-up rows are derived from the generation's sequence steps, so a read
    // gated on the beta flag would delete the cadence from a GA timeline instead of
    // hiding the words. The query's own condition stays the selected lead.
    expect(src).toContain('["leadEmail", selectedLeadId, brandId, openCampaignId]');
    expect(src).toContain("{ enabled: !!selectedLeadId }");
    expect(src).not.toContain("enabled: !!selectedLeadId && canReadEmailCopy");
  });

  it("derives the follow-up rows without consulting the gate", () => {
    const at = src.indexOf("function deriveEmailRows(");
    expect(at).toBeGreaterThan(-1);
    // 2200 chars covers the function; measured, with headroom to its closing brace.
    expect(src.slice(at, at + 2200)).not.toContain("canReadEmailCopy");
  });

  it("never asks the export for the copy", () => {
    // The file is lead-service's now (v0.70.0) and carries no subject and no body —
    // verified against the deployed export, whose 44 columns are the person, their
    // company, the lifecycle and the delivery evidence. What this repo can still hold is
    // that it does not ASK for them: the export request is the page's own scope, tab and
    // search, and nothing else.
    const src = fs.readFileSync(
      path.resolve(__dirname, "../src/components/audiences/engaged-leads-page.tsx"),
      "utf-8",
    );
    const at = src.indexOf("<CsvDownloadButton");
    expect(at).toBeGreaterThan(-1);
    const button = src.slice(at, at + 500);
    expect(button).toContain("fetchLeadsCsv(");
    expect(button).not.toContain("subject");
    expect(button).not.toContain("body");
  });
});
