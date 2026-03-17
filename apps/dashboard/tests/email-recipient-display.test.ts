import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const emailsPagePath = path.resolve(
  __dirname,
  "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[sectionKey]/campaigns/[id]/emails/page.tsx"
);

describe("Email recipient display", () => {
  const content = fs.readFileSync(emailsPagePath, "utf-8");

  it("should use formatRecipient helper instead of raw field concatenation", () => {
    // Must not directly concatenate lead fields — use the helper that handles nulls
    expect(content).toContain("function formatRecipient(email: Email): string");
    expect(content).toContain("formatRecipient(email)");
    expect(content).toContain("formatRecipient(selectedEmail)");
  });

  it("should show 'Unknown recipient' when all lead fields are empty", () => {
    expect(content).toContain('"Unknown recipient"');
  });

  it("should not render raw concatenation of leadFirstName + leadLastName + leadCompany", () => {
    // Regression: previously rendered "To:   — " when fields were null
    expect(content).not.toMatch(
      /\{email\.leadFirstName\}\s*\{email\.leadLastName\}\s*—\s*\{email\.leadCompany\}/
    );
    expect(content).not.toMatch(
      /\{selectedEmail\.leadFirstName\}\s*\{selectedEmail\.leadLastName\}/
    );
  });
});
