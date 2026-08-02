import { describe, it, expect } from "vitest";
import { parseEmailBlob, describeParsedBlob, isLikelyEmail } from "../src/lib/investor-emails";

describe("parseEmailBlob", () => {
  it("takes a newline-separated column pasted out of a spreadsheet", () => {
    const { accepted, rejected, duplicates } = parseEmailBlob("a@x.com\nb@y.co.uk\nc@z.io");
    expect(accepted.map((e) => e.email)).toEqual(["a@x.com", "b@y.co.uk", "c@z.io"]);
    expect(rejected).toEqual([]);
    expect(duplicates).toBe(0);
  });

  it("takes a comma list out of a mail client", () => {
    const { accepted } = parseEmailBlob("a@x.com, b@x.com,c@x.com");
    expect(accepted.map((e) => e.email)).toEqual(["a@x.com", "b@x.com", "c@x.com"]);
  });

  it("takes semicolons and tabs as separators too", () => {
    const { accepted } = parseEmailBlob("a@x.com;b@x.com\tc@x.com");
    expect(accepted).toHaveLength(3);
  });

  it("keeps the display name out of a Name <email> pair", () => {
    const { accepted } = parseEmailBlob("Alice Smith <alice@x.com>");
    expect(accepted).toEqual([{ email: "alice@x.com", name: "Alice Smith" }]);
  });

  it("reports no name when the blob carried none", () => {
    expect(parseEmailBlob("alice@x.com").accepted[0].name).toBeNull();
  });

  it("lowercases so the same person pasted twice in different case is one entry", () => {
    const { accepted, duplicates } = parseEmailBlob("Alice@X.com\nalice@x.com");
    expect(accepted.map((e) => e.email)).toEqual(["alice@x.com"]);
    expect(duplicates).toBe(1);
  });

  it("keeps first-seen order", () => {
    const { accepted } = parseEmailBlob("z@x.com\na@x.com\nm@x.com");
    expect(accepted.map((e) => e.email)).toEqual(["z@x.com", "a@x.com", "m@x.com"]);
  });

  it("strips mailto:, wrapping quotes and a trailing sentence dot", () => {
    const { accepted } = parseEmailBlob('mailto:a@x.com\n"b@x.com"\nc@x.com.');
    expect(accepted.map((e) => e.email)).toEqual(["a@x.com", "b@x.com", "c@x.com"]);
  });

  it("reports a malformed address rather than dropping it silently", () => {
    const { accepted, rejected } = parseEmailBlob("good@x.com\nbad@nodot\n");
    expect(accepted.map((e) => e.email)).toEqual(["good@x.com"]);
    expect(rejected).toEqual(["bad@nodot"]);
  });

  it("does not report the name half of a quoted pair we split on its comma", () => {
    // `"Smith, Alice" <a@x.com>` splits into `"Smith` and `Alice" <a@x.com>`.
    // The address still parses; the leftover name fragment is not a failed
    // address and must not be shown to the user as one.
    const { accepted, rejected } = parseEmailBlob('"Smith, Alice" <a@x.com>');
    expect(accepted.map((e) => e.email)).toEqual(["a@x.com"]);
    expect(rejected).toEqual([]);
  });

  it("is a no-op on an empty or whitespace blob", () => {
    for (const blob of ["", "   ", "\n\n\t"]) {
      expect(parseEmailBlob(blob)).toEqual({ accepted: [], rejected: [], duplicates: 0 });
    }
  });

  it("tolerates trailing separators and blank lines", () => {
    const { accepted, rejected } = parseEmailBlob("a@x.com,\n\nb@x.com;\n");
    expect(accepted).toHaveLength(2);
    expect(rejected).toEqual([]);
  });
});

describe("isLikelyEmail", () => {
  it("accepts ordinary addresses including plus-tags and subdomains", () => {
    for (const v of ["a@x.com", "a+tag@x.com", "a.b@mail.x.co.uk", "a_b@x.io"]) {
      expect(isLikelyEmail(v)).toBe(true);
    }
  });

  it("rejects anything without an at-sign or a dotted domain", () => {
    for (const v of ["", "plainword", "a@nodot", "a@x.", "@x.com", "a@ x.com"]) {
      expect(isLikelyEmail(v)).toBe(false);
    }
  });
});

describe("describeParsedBlob", () => {
  it("says nothing when nothing has been pasted — a zero reads as a failure", () => {
    expect(describeParsedBlob({ accepted: [], rejected: [], duplicates: 0 })).toBeNull();
  });

  it("counts the addresses", () => {
    expect(describeParsedBlob(parseEmailBlob("a@x.com\nb@x.com"))).toBe("2 addresses");
  });

  it("uses the singular for one", () => {
    expect(describeParsedBlob(parseEmailBlob("a@x.com"))).toBe("1 address");
  });

  it("names the repeats and the rejects so nothing disappears quietly", () => {
    const summary = describeParsedBlob(parseEmailBlob("a@x.com\na@x.com\nnope"));
    expect(summary).toContain("1 address");
    expect(summary).toContain("1 repeated in this paste");
    // `nope` has no at-sign, so it is not reported as a failed address.
    expect(summary).not.toContain("not an email");
  });

  it("reports a malformed address as a reject", () => {
    expect(describeParsedBlob(parseEmailBlob("a@x.com\nbad@nodot"))).toBe("1 address, 1 not an email");
  });
});
