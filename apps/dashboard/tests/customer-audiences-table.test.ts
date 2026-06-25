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
    expect(src).toContain("listAudiences(brandId)");
    expect(src).toContain('["audiences", brandId]');
    expect(src).not.toContain("listPersonas");
    expect(src).not.toContain("createPersona");
    expect(src).not.toContain("/brands/");
  });

  it("renders an audiences table with real outreach / opens / clicks columns", () => {
    expect(src).toContain("<table");
    for (const header of ["Outreach", "Opens", "Clicks", "Cost per click"]) {
      expect(src).toContain(header);
    }
    // Signups / cost-per-signup have no audience-stats source — dropped.
    expect(src).not.toContain("Cost per signup");
    expect(src).toContain('audience.status === "paused"');
    expect(src).toContain("Paused");
  });

  it("joins per-audience evidence from features-service audience-stats by audienceId", () => {
    expect(src).toContain("fetchFeatureAudienceStats");
    expect(src).toContain("statsByAudienceId");
    expect(src).toContain("stats.evidence.contacted");
    expect(src).toContain("stats.evidence.opened");
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
    expect(src).toContain("MaturityBadge");
    expect(src).toContain('MaturityBadge level="beta"');
  });

  it("renders readable detail-panel status and targeting tags", () => {
    expect(src).toContain("statusPillTone");
    expect(src).toContain("bg-emerald-50 text-emerald-700 border-emerald-200");
    expect(src).toContain("grid grid-cols-[7.5rem_minmax(0,1fr)]");
    expect(src).not.toContain("Contact email status");
  });

  it("hides pre-activation suggested candidates from the list", () => {
    expect(src).toContain('a.status !== "suggested"');
  });
});
