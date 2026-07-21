import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "..", "..");

// The dashboard WhatsApp FAB (mounted on both the dashboard shell and the
// onboarding shell) fires a dedicated `support_whatsapp_clicked` PostHog event
// so support demand is countable by location + page, with user/org context.
describe("Dashboard WhatsApp support button tracking", () => {
  const src = readFileSync(
    resolve(ROOT, "src/components/support/support-button.tsx"),
    "utf8",
  );

  it("captures support_whatsapp_clicked on click", () => {
    expect(src).toContain('posthog.capture("support_whatsapp_clicked"');
    expect(src).toContain("onClick={handleClick}");
  });

  it("splits location into onboarding vs dashboard", () => {
    expect(src).toContain('pathname?.startsWith("/onboarding")');
    expect(src).toContain('location,');
  });

  it("attaches user + org context when known", () => {
    expect(src).toContain("userId: user?.id ?? null");
    expect(src).toContain("userEmail: email || null");
    expect(src).toContain("orgId: organization?.id ?? null");
    expect(src).toContain("orgName: org || null");
  });
});
