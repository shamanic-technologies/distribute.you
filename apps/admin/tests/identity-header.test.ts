import { describe, it, expect } from "vitest";
import { setIdentityHeader } from "../src/lib/identity-header";

describe("setIdentityHeader", () => {
  it("sets the value verbatim, Latin-1 accents and padding included", () => {
    const h: Record<string, string> = {};
    setIdentityHeader(h, "x-first-name", "  Zoë Müller-Ñ ");
    expect(h["x-first-name"]).toBe("  Zoë Müller-Ñ ");
  });

  it("leaves the header absent for empty, null or undefined", () => {
    const h: Record<string, string> = {};
    setIdentityHeader(h, "x-org-name", "");
    setIdentityHeader(h, "x-email", null);
    setIdentityHeader(h, "x-last-name", undefined);
    expect(h).toEqual({});
  });

  it("leaves the header absent when fetch would reject the value", async () => {
    for (const v of ["李雷", "Иван", "Acme 🚀"]) {
      const h: Record<string, string> = {};
      setIdentityHeader(h, "x-first-name", v);
      expect(h).toEqual({});
      // Proof the guard is needed: Node's Headers refuses the raw value.
      expect(() => new Headers({ "x-first-name": v })).toThrow();
    }
    expect(() => new Headers({ "x-first-name": "Zoë" })).not.toThrow();
  });
});
