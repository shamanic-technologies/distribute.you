import { describe, expect, it } from "vitest";
import { VENDOR_CONSOLES, vendorConsole } from "../src/lib/estate-signals";

describe("vendor consoles", () => {
  it("knows the four vendors instantly-service actually names", () => {
    // Measured over the live estate on 2026-09-22: gandi 40, primeforge 24,
    // instantly-dfy 5, mailforge 5.
    expect(Object.keys(VENDOR_CONSOLES).sort()).toEqual([
      "gandi",
      "instantly-dfy",
      "mailforge",
      "primeforge",
    ]);
  });

  it("pins the exact URLs that were verified to resolve", () => {
    // Every one of these answered on 2026-09-22 (Gandi 302s to its own login
    // with the path preserved; the other three answer 200). They are dashboard
    // ROOTS on purpose: Gandi's console is a catch-all SPA, so a per-domain URL
    // cannot be told apart from a route that does not exist, and a CTA that
    // 404s after a login round-trip is worse than one that lands on the list.
    expect(VENDOR_CONSOLES.gandi.href).toBe("https://admin.gandi.net/domain");
    expect(VENDOR_CONSOLES.primeforge.href).toBe("https://app.primeforge.ai");
    expect(VENDOR_CONSOLES.mailforge.href).toBe("https://app.mailforge.ai");
    expect(VENDOR_CONSOLES["instantly-dfy"].href).toBe("https://app.instantly.ai/app/accounts");
  });

  it("links only https consoles, so no CTA can send an operator to a guess", () => {
    for (const v of Object.values(VENDOR_CONSOLES)) {
      expect(v.href.startsWith("https://")).toBe(true);
      expect(v.logoDomain).toMatch(/^[a-z0-9.-]+\.[a-z]{2,}$/);
    }
  });

  it("states nothing for a vendor it does not carry, rather than guessing one", () => {
    expect(vendorConsole(null)).toBeNull();
    expect(vendorConsole("a-vendor-nobody-has-read-yet")).toBeNull();
    expect(vendorConsole("gandi")?.label).toBe("Gandi");
  });
});
