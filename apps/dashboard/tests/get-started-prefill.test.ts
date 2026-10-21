import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseE164, readGetStartedPrefill } from "../src/lib/get-started-prefill";

const q = (s: string) => new URLSearchParams(s);

describe("prepared onboarding link (owner 2026-10-21)", () => {
  it("reads first name, last name and an E.164 phone", () => {
    expect(readGetStartedPrefill(q("url=nyle.ai&firstName=Karim&lastName=Saydashev&phone=%2B33680478402"), null)).toEqual({
      firstName: "Karim",
      lastName: "Saydashev",
      phone: { countryCode: "FR", dialCode: "33", national: "680478402" },
    });
  });

  it("absent params leave every field empty", () => {
    expect(readGetStartedPrefill(q("url=nyle.ai"), "US")).toEqual({ firstName: "", lastName: "", phone: null });
  });

  it("a shared dial code takes the visitor's IP country, else the first listed", () => {
    expect(parseE164("+14165550123", "CA")?.countryCode).toBe("CA");
    expect(parseE164("+14165550123", "FR")?.dialCode).toBe("1");
  });

  it("the longest dial code wins and junk is ignored", () => {
    expect(parseE164("+44 7700 900123", null)).toEqual({ countryCode: "GB", dialCode: "44", national: "7700900123" });
    expect(parseE164("0680478402", null)).toBeNull();
    expect(parseE164("+12", null)).toBeNull();
  });

  it("the walk seeds its fields from the link", () => {
    const src = readFileSync(join(__dirname, "../src/components/v2/get-started/get-started.tsx"), "utf8");
    expect(src).toContain("readGetStartedPrefill(params, ipCountry)");
    expect(src).toContain("useState(prefill.firstName)");
    expect(src).toContain("useState(prefill.lastName)");
    expect(src).toContain("if (prefill.phone) return prefill.phone;");
  });
});
