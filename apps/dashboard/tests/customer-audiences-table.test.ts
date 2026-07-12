import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

// The Audiences page reads human-service audiences via the gateway and offers a
// lifecycle status toggle ONLY — no manual create, no filter editor, no avatar
// (audiences carry no avatar field), no AI chat (the audience-editor chat config
// is a backend follow-up). Pins that shape so a regression that re-introduces the
// brand-service persona editor is caught.
describe("Audiences page", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "../src/components/audiences/customer-audiences-page.tsx"),
    "utf-8",
  );

  it("reads audiences from the gateway, not brand-service personas", () => {
    expect(src).toContain('listAudiences(brandId, { status: "active" })');
    expect(src).toContain('listAudiences(brandId, { status: "paused" })');
    expect(src).toContain('listAudiences(brandId, { status: "archived" })');
    expect(src).toContain('["audiences", brandId, "active"]');
    expect(src).not.toContain("listPersonas");
    expect(src).not.toContain("createPersona");
    expect(src).not.toContain("/brands/");
  });

  it("renders an audiences table with real outreach / clicks columns", () => {
    expect(src).toContain("<table");
    for (const header of ["Outreach", "Clicks", "Cost per click"]) {
      expect(src).toContain(header);
    }
    expect(src).not.toContain(">Opens<");
    expect(src).toContain('audience.status === "paused"');
    expect(src).toContain("Paused");
  });

  it("leads with the outcome columns (cost then count) for the signups + form_submissions goals", () => {
    // signups goal → "Cost per signup" + "Signups" render FIRST (after Audience,
    // before the website-visit funnel), default sort CPS asc. Backend fields are
    // optional on the wire (renders "-" until features-service ships them).
    expect(src).toContain("const showSignupCols");
    expect(src).toContain("Cost per signup");
    expect(src).toContain('col="cps"');
    expect(src).toContain('col="signups"');
    expect(src).toContain("stats.metrics.cpsCents");
    expect(src).toContain("stats.evidence.signups");
    // form_submissions goal → "Cost per form submission" + "Form submissions" lead too.
    expect(src).toContain("const showFormSubmissionCols");
    expect(src).toContain("Cost per form submission");
    expect(src).toContain('col="cpfs"');
    expect(src).toContain('col="formSubmissions"');
    // Default sort is the cheapest-outcome column per goal (CPS / CPFS / CPPR / CPC).
    expect(src).toContain("const defaultSortCol");
  });

  it("hides the signup + form-submission outcome columns until the conversion tracker is set up", () => {
    // No tracker → no signups/form-submissions to attribute, so the columns would only
    // ever show 0 / "-". Gate them on lead-service's tracker liveness (live_waiting|live).
    expect(src).toContain("getBrandConversionToken");
    expect(src).toContain('conversionTokenData?.status === "live"');
    expect(src).toContain('conversionTokenData?.status === "live_waiting"');
    expect(src).toContain("const trackerSetUp");
    expect(src).toContain('optimizationGoal === "signups" && trackerSetUp');
    expect(src).toContain('optimizationGoal === "form_submissions" && trackerSetUp');
  });

  it("hides the CPC + Website Visits columns for the positive_replies goal", () => {
    // Single-step reply→paid goal: clicks aren't in the funnel, so both the header and
    // body cells for CPC + Website Visits are gated off (CPPR columns stay).
    expect(src).toContain('"positive_replies"');
    expect(src).toContain("const isPositiveReplies");
    expect(src).toContain("{!isPositiveReplies && (");
  });

  it("joins per-audience evidence from features-service audience-stats by audienceId", () => {
    expect(src).toContain("fetchFeatureAudienceStats");
    expect(src).toContain("statsByAudienceId");
    expect(src).toContain("stats.evidence.contacted");
    expect(src).toContain("stats.evidence.websiteClicks");
    expect(src).toContain("stats.metrics.cpcCents");
  });

  it("toggles lifecycle status via the gateway (pause / resume / archive / restore)", () => {
    expect(src).toContain("setAudienceStatus(i.id, i.status)");
    expect(src).toContain('onSetStatus("paused")');
    expect(src).toContain('onSetStatus("active")');
    expect(src).toContain('onSetStatus("archived")');
    expect(src).toContain("function AudienceDetailPanel");
    expect(src).toContain('role="dialog"');
  });

  it("has NO manual create, filter editor or avatar (CRUD via AI chat only)", () => {
    expect(src).not.toContain("New audience");
    expect(src).not.toContain("PersonaCard");
    expect(src).not.toContain("regeneratePersonaAvatar");
  });

  it("edits audiences through the audience-editor AI chat (not the brand-service persona editor)", () => {
    expect(src).toContain("EditWithAIChat");
    expect(src).toContain('configKey="audience-editor"');
    expect(src).not.toContain('configKey="persona-editor"');
    // "Expand and split with similar audience" shortcut is GA (no beta gate/badge).
    expect(src).toContain("Expand and split with similar audience");
    expect(src).not.toContain('MaturityBadge level="beta"');
  });

  it("renders readable detail-panel status and targeting tags", () => {
    expect(src).toContain("statusPillTone");
    expect(src).toContain("bg-emerald-50 text-emerald-700 border-emerald-200");
    expect(src).toContain("grid grid-cols-[7.5rem_minmax(0,1fr)]");
    expect(src).not.toContain("Contact email status");
  });

  it("only lists user-visible lifecycle statuses", () => {
    expect(src).toContain('const VISIBLE_AUDIENCE_STATUSES = ["active", "paused", "archived"] as const');
    expect(src).not.toContain('a.status !== "suggested"');
  });
});
