import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The WhatsApp support FAB has no dedicated tracking by default (it's a plain
// <a href="wa.me/...">); these guards pin the `support_whatsapp_clicked`
// PostHog event that lets us count support demand per surface + page.
describe("WhatsApp support button fires support_whatsapp_clicked", () => {
  it("React landing button captures with location 'landing'", () => {
    const src = readFileSync(
      fileURLToPath(
        new URL("../../src/components/support-whatsapp-button.tsx", import.meta.url),
      ),
      "utf8",
    );
    expect(src).toContain('posthog.capture("support_whatsapp_clicked"');
    expect(src).toContain('location: "landing"');
  });
});
