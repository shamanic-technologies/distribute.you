import { describe, expect, it } from "vitest";
import {
  MARKDOWN_CONTENT_TYPE,
  VARY_HEADER,
  negotiateContentType,
  notAcceptableBody,
  parseAcceptHeader,
} from "@/lib/content-negotiation";

describe("negotiateContentType", () => {
  it("serves HTML when the client states no preference", () => {
    expect(negotiateContentType(null)).toBe("html");
    expect(negotiateContentType("")).toBe("html");
    expect(negotiateContentType("   ")).toBe("html");
  });

  it("serves HTML to a browser", () => {
    // Chrome, verbatim.
    expect(
      negotiateContentType(
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      ),
    ).toBe("html");
    // Safari, verbatim.
    expect(
      negotiateContentType("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"),
    ).toBe("html");
  });

  it("serves markdown when the client asks for it", () => {
    expect(negotiateContentType("text/markdown")).toBe("markdown");
    expect(negotiateContentType("text/x-markdown")).toBe("markdown");
    expect(negotiateContentType("text/markdown, text/html;q=0.5")).toBe("markdown");
    expect(negotiateContentType("text/markdown;q=1.0, */*;q=0.8")).toBe("markdown");
  });

  it("honours q-values in both directions", () => {
    expect(negotiateContentType("text/html;q=0.9, text/markdown;q=1.0")).toBe("markdown");
    expect(negotiateContentType("text/html;q=1.0, text/markdown;q=0.9")).toBe("html");
    // A tie must not hand a human markdown.
    expect(negotiateContentType("text/html, text/markdown")).toBe("html");
  });

  it("treats q=0 as a refusal, with a precise range beating a wildcard", () => {
    expect(negotiateContentType("text/html;q=0, */*")).toBe("markdown");
    expect(negotiateContentType("text/markdown;q=0, */*")).toBe("html");
    expect(negotiateContentType("*/*;q=0")).toBe("unsupported");
  });

  it("reports an unsupported type rather than guessing", () => {
    expect(negotiateContentType("application/json")).toBe("unsupported");
    expect(negotiateContentType("image/png, image/webp")).toBe("unsupported");
  });

  it("accepts a text/* wildcard", () => {
    // text/* covers both variants at one q, so the HTML tiebreak applies.
    expect(negotiateContentType("text/*")).toBe("html");
    expect(negotiateContentType("text/*, text/markdown;q=1.0, text/html;q=0.1")).toBe("markdown");
  });

  it("is case- and whitespace-insensitive", () => {
    expect(negotiateContentType("  TEXT/Markdown ; Q=1 ")).toBe("markdown");
  });

  it("ignores a malformed range instead of throwing", () => {
    expect(negotiateContentType("garbage, text/markdown")).toBe("markdown");
    expect(parseAcceptHeader("garbage")).toEqual([]);
    expect(negotiateContentType("text/markdown;q=notanumber")).toBe("markdown");
  });
});

describe("headers", () => {
  it("varies on Accept as well as Accept-Encoding", () => {
    expect(VARY_HEADER).toContain("Accept");
    expect(VARY_HEADER).toContain("Accept-Encoding");
  });

  it("names both servable types in the 406 body", () => {
    expect(notAcceptableBody()).toContain("406");
    expect(notAcceptableBody()).toContain(MARKDOWN_CONTENT_TYPE);
  });
});
