import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

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

  it("should authenticate with X-API-Key and include identity headers for email template deployment", () => {
    expect(content).toContain('"X-API-Key"');
    const registerBody = content.slice(content.indexOf("export async function register()"));
    expect(registerBody).toContain('"x-org-id"');
    expect(registerBody).toContain('"x-user-id"');
    expect(registerBody).toContain('"x-run-id"');
    expect(registerBody).toContain("SYSTEM_ORG_ID");
    expect(registerBody).toContain("SYSTEM_USER_ID");
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
  ];

  for (const name of templateNames) {
    it(`should include the "${name}" template`, () => {
      expect(content).toContain(`name: "${name}"`);
    });
  }

  it("should deploy exactly 7 templates", () => {
    const matches = content.match(/name: "/g);
    expect(matches).toHaveLength(7);
  });

  it("should be best-effort (not crash on failure)", () => {
    expect(content).toContain("catch");
    expect(content).toContain("console.error");
  });

  it("should skip deployment when API key is missing", () => {
    expect(content).toContain("if (!apiKey)");
  });
});
