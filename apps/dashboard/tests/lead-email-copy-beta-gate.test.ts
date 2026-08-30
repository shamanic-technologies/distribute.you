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
    // can never render without it.
    expect(body).toContain("{canReadEmailCopy && e.body && (");
    // The subject and the body render only inside that block.
    const gateAt = body.indexOf("{canReadEmailCopy && e.body && (");
    const before = body.slice(0, gateAt);
    expect(before).not.toContain("e.subject ?");
    expect(before).not.toContain("{e.body}");
    expect(before).not.toContain("EmailSignature");
  });

  it("carries the badge the gate rule requires", () => {
    // Gating without a badge is a bug: the viewer who CAN see it has no way to know
    // the surface is not GA.
    const body = timeline();
    const gateAt = body.indexOf("{canReadEmailCopy && e.body && (");
    const detailsEnd = body.indexOf("</details>", gateAt);
    expect(detailsEnd).toBeGreaterThan(gateAt);
    expect(body.slice(gateAt, detailsEnd)).toContain('<MaturityBadge level="beta" />');
    expect(src).toContain('import { MaturityBadge } from "@/components/maturity-badge"');
  });

  it("leaves the timeline's shape ungated", () => {
    const body = timeline();
    // What the campaign DID is the page's job and stays GA. Each of these is outside
    // the copy gate; a `canReadEmailCopy` wrapped around any of them would blank the
    // timeline for every non-beta reader.
    const gateAt = body.indexOf("{canReadEmailCopy && e.body && (");
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
    expect(src).toContain('["leadEmail", selectedLeadId, brandId]');
    expect(src).toContain("{ enabled: !!selectedLeadId }");
    expect(src).not.toContain("enabled: !!selectedLeadId && canReadEmailCopy");
  });

  it("derives the follow-up rows without consulting the gate", () => {
    const at = src.indexOf("function deriveEmailRows(");
    expect(at).toBeGreaterThan(-1);
    // 2200 chars covers the function; measured, with headroom to its closing brace.
    expect(src.slice(at, at + 2200)).not.toContain("canReadEmailCopy");
  });

  it("keeps the copy out of the CSV export", () => {
    const csv = fs.readFileSync(path.join(__dirname, "../src/lib/leads-csv.ts"), "utf-8");
    expect(csv).not.toContain("subject");
    expect(csv).not.toContain("bodyHtml");
    expect(csv).not.toContain("bodyText");
  });
});
