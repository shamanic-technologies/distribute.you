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
    "signup_notification",
    "signin_notification",
    "user_active",
    "waitlist-confirmed",
    "invite-claimed-welcome",
    "invite-success-notification",
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

  it("should deploy exactly 14 templates", () => {
    const arrMatch = content.match(/EMAIL_TEMPLATES\s*=\s*\[([\s\S]*?)\n\];/);
    expect(arrMatch).toBeTruthy();
    const arr = arrMatch![1];
    const matches = arr.match(/name: "/g);
    expect(matches).toHaveLength(14);
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

  it("renders with digest metadata leaving zero {{...}} placeholders", () => {
    const tpl = EMAIL_TEMPLATES.find((t) => t.name === "daily-outcome-digest");
    expect(tpl, "template missing from EMAIL_TEMPLATES").toBeDefined();
    const rendered = [tpl!.subject, tpl!.htmlBody, tpl!.textBody]
      .map((s) => render(s, {
        brandName: "Acme",
        brandUrl: "https://acme.test",
        outcomeCount: 3,
        outcomeLabel: "positive replies",
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

describe("DIS-64 lifecycle templates: render with spec metadata", () => {
  const render = (s: string, vars: Record<string, unknown>): string =>
    s.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? String(vars[k]) : `{{${k}}}`));

  const cases: { name: string; vars: Record<string, unknown> }[] = [
    {
      name: "waitlist-confirmed",
      vars: { email: "person@example.com", position: 42, brandUrl: "https://stripe.com" },
    },
    {
      name: "invite-claimed-welcome",
      vars: { email: "invitee@example.com", inviterOrgName: "Acme Co", balanceCents: 2500 },
    },
    {
      name: "invite-success-notification",
      vars: {
        email: "inviter@example.com",
        inviteeOrgName: "Beta Inc",
        balanceCents: 5000,
        invitesUsed: 1,
        invitesTotal: 3,
      },
    },
  ];

  for (const { name, vars } of cases) {
    it(`${name}: has at least one {{var}} placeholder`, () => {
      const tpl = EMAIL_TEMPLATES.find((t) => t.name === name);
      expect(tpl, `template "${name}" missing from EMAIL_TEMPLATES`).toBeDefined();
      const source = `${tpl!.subject}\n${tpl!.htmlBody}\n${tpl!.textBody}`;
      expect(source).toMatch(/\{\{\w+\}\}/);
    });

    it(`${name}: renders with spec metadata leaving zero {{...}} placeholders`, () => {
      const tpl = EMAIL_TEMPLATES.find((t) => t.name === name);
      expect(tpl).toBeDefined();
      const rendered = [tpl!.subject, tpl!.htmlBody, tpl!.textBody]
        .map((s) => render(s, vars))
        .join("\n");
      expect(rendered).not.toMatch(/\{\{\w+\}\}/);
    });
  }

  it("waitlist-confirmed slug is distinct from legacy waitlist template", () => {
    const slugs = EMAIL_TEMPLATES.map((t) => t.name);
    expect(slugs).toContain("waitlist");
    expect(slugs).toContain("waitlist-confirmed");
  });
});
