import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { EMAIL_TEMPLATES } from "../src/instrumentation";

const instrumentationPath = path.resolve(__dirname, "../src/instrumentation.ts");

describe("Email template deployment at startup", () => {
  const content = fs.readFileSync(instrumentationPath, "utf-8");

  it("should exist as instrumentation.ts", () => {
    expect(fs.existsSync(instrumentationPath)).toBe(true);
  });

  it("should export a register function", () => {
    expect(content).toContain("export async function register()");
  });

  it("should call PUT /internal/emails/templates", () => {
    expect(content).toContain("/internal/emails/templates");
    expect(content).toContain('method: "PUT"');
  });

  it("should authenticate with X-API-Key only (no org/user headers in fetch calls)", () => {
    expect(content).toContain('"X-API-Key"');
    const registerBody = content.slice(content.indexOf("export async function register()"));
    expect(registerBody).not.toContain("x-org-id");
    expect(registerBody).not.toContain("x-user-id");
    expect(registerBody).not.toContain("x-external-org-id");
    expect(registerBody).not.toContain("x-external-user-id");
  });

  it("should use ADMIN_DISTRIBUTE_API_KEY env var", () => {
    expect(content).toContain("ADMIN_DISTRIBUTE_API_KEY");
  });

  it("should contain emailLayout helper", () => {
    expect(content).toContain("function emailLayout");
  });

  const templateNames = [
    "campaign_created",
    "campaign_stopped",
    "waitlist",
    "welcome",
    "goal_launched",
    "signup_notification",
    "signin_notification",
    "user_active",
    "credit-depleted",
    "credit-depleted-followup-3d",
    "credit-depleted-followup-10d",
    "daily-outcome-digest",
  ];

  for (const name of templateNames) {
    it(`should include the "${name}" template`, () => {
      expect(content).toContain(`name: "${name}"`);
    });
  }

  it("should deploy exactly 13 templates", () => {
    const arrMatch = content.match(/EMAIL_TEMPLATES\s*=\s*\[([\s\S]*?)\n\];/);
    expect(arrMatch).toBeTruthy();
    const arr = arrMatch![1];
    // The two brand pause/resume mails went with the Pause control that was their
    // only sender: money (and pausing) is per sales funnel on Brand Settings now, so
    // nothing flips a brand-level pause flag from the dashboard. A registration whose
    // sender is gone is dead config — and it fails SILENTLY, since the stored row
    // survives whether or not anyone still writes it.
    //
    // 12 are declared inline here. The 13th, the staff digest, is imported from
    // the module that SENDS it — that module re-registers it before every send,
    // because a boot-time registration on a serverless cold start is not a
    // guarantee that the write ever reached the template store.
    const inline = arr.match(/name: "/g);
    expect(inline).toHaveLength(12);
    expect(arr).toContain("STAFF_DIGEST_TEMPLATE_DEF");
    expect(content).toContain('from "@/lib/staff-digest"');
  });

  it("should be best-effort (not crash on failure)", () => {
    expect(content).toContain("catch");
    expect(content).toContain("console.error");
  });

  it("should skip deployment when API key is missing", () => {
    expect(content).toContain("if (!apiKey)");
  });
});

describe("Daily outcome digest template", () => {
  const render = (s: string, vars: Record<string, unknown>): string =>
    s.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? String(vars[k]) : `{{${k}}}`));

  // The variable set is the metadata `digestMetadataForBrand` actually emits. It moved
  // from a goal's outcome count to the brand's RETURN plus what moved it, because a
  // brand runs several funnels and the digest now fires only when the return went up.
  it("renders with digest metadata leaving zero {{...}} placeholders", () => {
    const tpl = EMAIL_TEMPLATES.find((t) => t.name === "daily-outcome-digest");
    expect(tpl, "template missing from EMAIL_TEMPLATES").toBeDefined();
    const rendered = [tpl!.subject, tpl!.htmlBody, tpl!.textBody]
      .map((s) => render(s, {
        brandName: "Acme",
        brandUrl: "https://acme.test",
        roiToday: "11.7×",
        roiPrevious: "9.1×",
        newOutcomes: "3 positive replies and 1 signup",
        totalLeads: 5,
        totalOutcomeOrganizations: 4,
        totalExpectedRevenueUsd: "$20,000",
        digestHtml: "<section>Digest</section>",
        digestText: "Digest",
      }))
      .join("\n");
    expect(rendered).not.toMatch(/\{\{\w+\}\}/);
  });
});

describe("email chrome carries the charter accent, not the retired green", () => {
  // The whole brand went back to blue in #2939 and these templates were the straggler:
  // the green-charter reskin (#2671, 15 Jul) landed six days before the revert and nothing
  // swept it, so every button and link mailed to customers stayed green for three weeks.
  // Guarded by hex rather than by eye because no test renders these to a screen.
  const src = fs.readFileSync(
    path.resolve(__dirname, "../src/instrumentation.ts"),
    "utf-8",
  );

  it("declares no green-charter hex anywhere", () => {
    expect(src).not.toMatch(/#00[0-9a-fA-F]{4}/);
  });

  it("pins the three accent roles to the blue ramp", () => {
    expect(src).toContain('const EMAIL_ACCENT = "#2563EB"');
    expect(src).toContain('const EMAIL_ACCENT_TEXT = "#1A4FC3"');
    expect(src).toContain('const EMAIL_DOT = "#3D80FF"');
  });

  it("reads those constants at every call site rather than repeating a hex", () => {
    // A literal accent in a template body is what let the revert miss these in the
    // first place, so each accent hex may appear exactly once: its declaration.
    // Neutral literals (text, surface) are left alone — they never change with the charter.
    for (const hex of ["#2563EB", "#1A4FC3", "#3D80FF"]) {
      expect(src.split(hex).length - 1, `${hex} is repeated outside its constant`).toBe(1);
    }
  });
});
