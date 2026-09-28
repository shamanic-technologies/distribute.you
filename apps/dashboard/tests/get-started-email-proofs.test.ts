import { describe, expect, it } from "vitest";
import {
  emailCheckNote,
  emailPieces,
  highlightKindLabel,
  providerLabel,
  shouldCheckNext,
  verdictLabel,
  type EmailHighlight,
} from "../src/lib/v2/get-started";

const h = (text: string, start: number, kind = "prospect"): EmailHighlight => ({
  text,
  start,
  end: start + text.length,
  kind,
  sourceLabel: "Their title",
  sourceValue: "Head of Growth",
  reason: "Names their role.",
});

describe("step 5: the email checks", () => {
  it("stops on done, on an unavailable preview, and after one call per person plus one", () => {
    const people = [{}, {}, {}];
    expect(shouldCheckNext({ status: "ready", done: false, people }, 0)).toBe(true);
    expect(shouldCheckNext({ status: "ready", done: false, people }, 3)).toBe(true);
    expect(shouldCheckNext({ status: "ready", done: false, people }, 4)).toBe(false);
    expect(shouldCheckNext({ status: "ready", done: true, people }, 0)).toBe(false);
    expect(shouldCheckNext({ status: "unavailable", done: false, people: [] }, 0)).toBe(false);
  });

  it("names providers and verdicts in words, and keeps an unknown one as given", () => {
    expect(providerLabel("apollo")).toBe("Apollo");
    expect(providerLabel("bounceverify")).toBe("BounceVerify");
    expect(providerLabel("hunter")).toBe("Hunter");
    expect(providerLabel(null)).toBeNull();
    expect(verdictLabel("valid")).toBe("valid");
    expect(verdictLabel("catch_all")).toBe("catch-all domain");
    expect(verdictLabel("brand_new")).toBe("brand new");
    expect(verdictLabel(null)).toBeNull();
  });

  it("says why nothing could be checked", () => {
    expect(emailCheckNote("not_built_yet")).toContain("still being prepared");
    expect(emailCheckNote("no_reveal_handle")).toContain("cannot be looked up");
    expect(emailCheckNote("empty_sample")).toBe("No email could be checked for this sample.");
  });
});

describe("step 6: the sentences and their reasons", () => {
  const body = "Hi Ana, as Head of Growth you know this. We help teams grow. Worth a call?";

  it("gives the body back exactly, with the explained sentences marked", () => {
    const pieces = emailPieces(body, [h("as Head of Growth you know this.", 8), h("Worth a call?", 61, "instruction")]);
    expect(pieces.map((p) => p.text).join("")).toBe(body);
    expect(pieces.filter((p) => p.highlight).map((p) => p.text)).toEqual(["as Head of Growth you know this.", "Worth a call?"]);
  });

  it("drops a highlight whose offsets no longer point at its text, or that overlaps one placed", () => {
    const pieces = emailPieces(body, [h("as Head of Growth", 8), h("Head of Growth you", 11), h("not in the body", 0), h("We help", 999)]);
    expect(pieces.map((p) => p.text).join("")).toBe(body);
    expect(pieces.filter((p) => p.highlight)).toHaveLength(1);
  });

  it("reads an email stored before highlights existed as plain text", () => {
    expect(emailPieces(body, null)).toEqual([{ text: body, highlight: null }]);
  });

  it("tags where each reason comes from", () => {
    expect(highlightKindLabel("brand")).toBe("From your site");
    expect(highlightKindLabel("instruction")).toBe("Writing rule");
    expect(highlightKindLabel("new_kind")).toBe("new_kind");
  });
});
