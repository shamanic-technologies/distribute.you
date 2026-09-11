import { describe, it, expect } from "vitest";
import {
  isNanpDialCode,
  phoneDigits,
  phoneSyntaxProblem,
  toE164,
} from "../src/lib/phone-syntax";

// Alias-free module, so these are real unit tests. Keep it that way.

const US = (national: string) => ({ dialCode: "1", national });
const FR = (national: string) => ({ dialCode: "33", national });

describe("phoneDigits", () => {
  it("drops the separators a person types", () => {
    expect(phoneDigits("(415) 555-2671")).toBe("4155552671");
    expect(phoneDigits("06 12 34 56 78")).toBe("0612345678");
    expect(phoneDigits("555.123.4567")).toBe("5551234567");
  });

  it("answers null when something survives that is not a digit", () => {
    expect(phoneDigits("call me")).toBeNull();
    expect(phoneDigits("+15551234567")).toBeNull();
  });

  it("answers the empty string for nothing, or for separators alone", () => {
    expect(phoneDigits("")).toBe("");
    expect(phoneDigits("   ")).toBe("");
    expect(phoneDigits("()-")).toBe("");
  });
});

describe("isNanpDialCode", () => {
  it("is the +1 plan, however the dial code is spelled", () => {
    expect(isNanpDialCode("1")).toBe(true);
    expect(isNanpDialCode("+1")).toBe(true);
    expect(isNanpDialCode("33")).toBe(false);
    expect(isNanpDialCode("")).toBe(false);
  });
});

describe("phoneSyntaxProblem", () => {
  it("accepts an empty number, because the step is optional", () => {
    expect(phoneSyntaxProblem(US(""))).toBeNull();
    expect(phoneSyntaxProblem(US("   "))).toBeNull();
    expect(phoneSyntaxProblem(FR(""))).toBeNull();
  });

  it("accepts a real US number in every way a person writes it", () => {
    for (const typed of [
      "4155552671",
      "415 555 2671",
      "(415) 555-2671",
      "415-555-2671",
      "415.555.2671",
    ]) {
      expect(phoneSyntaxProblem(US(typed))).toBeNull();
    }
  });

  it("names the country code when one was pasted into the national field", () => {
    expect(phoneSyntaxProblem(US("+1 415 555 2671"))).toMatch(/country code/i);
    expect(phoneSyntaxProblem(FR("+33 6 12 34 56 78"))).toMatch(/country code/i);
  });

  it("refuses letters", () => {
    expect(phoneSyntaxProblem(US("415 CALL ME"))).toMatch(/digits only/i);
  });

  it("refuses separators with no digits at all", () => {
    expect(phoneSyntaxProblem(US("()- "))).toMatch(/enter a phone number/i);
  });

  describe("the NANP shape, which is what catches a mistyped US number", () => {
    it("refuses anything other than 10 digits", () => {
      expect(phoneSyntaxProblem(US("415555267"))).toMatch(/10 digits/);
      expect(phoneSyntaxProblem(US("41555526711"))).toMatch(/10 digits/);
      // The single commonest mistake: the trunk 1 typed in front.
      expect(phoneSyntaxProblem(US("14155552671"))).toMatch(/10 digits/);
    });

    it("refuses an area code starting 0 or 1", () => {
      expect(phoneSyntaxProblem(US("0155552671"))).toMatch(/area code cannot start/i);
      expect(phoneSyntaxProblem(US("1155552671"))).toMatch(/area code cannot start/i);
    });

    it("refuses a service code as an area code", () => {
      expect(phoneSyntaxProblem(US("9115552671"))).toMatch(/service code/i);
      expect(phoneSyntaxProblem(US("4115552671"))).toMatch(/service code/i);
    });

    it("refuses a central office starting 0 or 1", () => {
      expect(phoneSyntaxProblem(US("4150552671"))).toMatch(/after the area code/i);
      expect(phoneSyntaxProblem(US("4151552671"))).toMatch(/after the area code/i);
    });

    it("refuses a service code in the central office", () => {
      expect(phoneSyntaxProblem(US("4159112671"))).toMatch(/service code/i);
    });

    it("applies to Canada too, which shares the plan", () => {
      expect(phoneSyntaxProblem({ dialCode: "1", national: "6045552671" })).toBeNull();
      expect(phoneSyntaxProblem({ dialCode: "1", national: "604555267" })).toMatch(/10 digits/);
    });
  });

  describe("everywhere else, the E.164 bound alone", () => {
    it("accepts a national number of any plausible length", () => {
      expect(phoneSyntaxProblem(FR("612345678"))).toBeNull();
      expect(phoneSyntaxProblem(FR("0612345678"))).toBeNull();
      expect(phoneSyntaxProblem({ dialCode: "44", national: "7911123456" })).toBeNull();
      // A leading zero is normal outside the NANP, so it must not be refused.
      expect(phoneSyntaxProblem({ dialCode: "49", national: "01701234567" })).toBeNull();
    });

    it("refuses what is too short to be a number", () => {
      expect(phoneSyntaxProblem(FR("12"))).toMatch(/too short/i);
    });

    it("refuses more than 15 digits, country code included", () => {
      // 13 national digits under a 3-digit country code is 16.
      expect(phoneSyntaxProblem({ dialCode: "351", national: "1234567890123" })).toMatch(
        /too long/i,
      );
      // 12 under the same code is exactly 15, so it stands.
      expect(phoneSyntaxProblem({ dialCode: "351", national: "123456789012" })).toBeNull();
    });
  });
});

describe("toE164", () => {
  it("joins the country code to the digits, dropping every separator", () => {
    expect(toE164(US("(415) 555-2671"))).toBe("+14155552671");
    expect(toE164(FR("06 12 34 56 78"))).toBe("+330612345678");
    expect(toE164({ dialCode: "+44", national: "7911 123456" })).toBe("+447911123456");
  });

  it("answers the empty string for an empty number, which is what a skip stores", () => {
    expect(toE164(US(""))).toBe("");
    expect(toE164(US("  "))).toBe("");
  });
});
