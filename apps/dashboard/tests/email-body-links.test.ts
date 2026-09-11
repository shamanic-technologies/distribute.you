import { describe, expect, it } from "vitest";

import {
  emailBodySegments,
  linkDisplayText,
  trimUrlEnd,
  type EmailBodySegment,
} from "../src/lib/email-body-links";

const links = (segments: EmailBodySegment[]) =>
  segments.filter((s): s is Extract<EmailBodySegment, { kind: "link" }> => s.kind === "link");

const prose = (segments: EmailBodySegment[]) =>
  segments
    .filter((s) => s.kind === "text")
    .map((s) => s.text)
    .join("");

describe("emailBodySegments", () => {
  it("leaves a body with no destination exactly as it was", () => {
    const body = "Hi Tom,\n\nMost defense contractors find out too late.\n--\nKevin";
    expect(emailBodySegments(body)).toEqual([{ kind: "text", text: body }]);
  });

  it("states nothing for an empty body rather than one empty line", () => {
    expect(emailBodySegments("")).toEqual([]);
  });

  it("shows the destination without its query and links the whole URL", () => {
    const href =
      "https://opsfolio.com/lp/cmmc/level-1-free-assessment/?utm_source=landing_page&utm_medium=email&utm_id=distribute";
    const [link] = links(emailBodySegments(`See how it works here: ${href}`));
    expect(link.text).toBe("https://opsfolio.com/lp/cmmc/level-1-free-assessment/");
    expect(link.href).toBe(href);
  });

  it("reads a URL with no query as its own label", () => {
    const href = "https://opsfolio.com/lp/cmmc/level-1-free-assessment/";
    const [link] = links(emailBodySegments(`Here: ${href}`));
    expect(link.text).toBe(href);
    expect(link.href).toBe(href);
  });

  it("keeps a fragment, which is part of the address a person reads out", () => {
    const href = "https://distribute.you/#pricing";
    const [link] = links(emailBodySegments(href));
    expect(link.text).toBe(href);
  });

  it("hands a sentence's final stop back to the prose", () => {
    const segments = emailBodySegments("Check https://site.com/page. Then reply.");
    expect(links(segments)[0].href).toBe("https://site.com/page");
    expect(prose(segments)).toContain(". Then reply.");
  });

  it("drops a closing bracket the URL never opened", () => {
    const segments = emailBodySegments("(see https://site.com/a) for more");
    expect(links(segments)[0].href).toBe("https://site.com/a");
    expect(prose(segments)).toContain(") for more");
  });

  it("keeps a bracket pair the URL opened itself", () => {
    const href = "https://en.wikipedia.org/wiki/Foo_(bar)";
    expect(links(emailBodySegments(`Read ${href}`))[0].href).toBe(href);
  });

  it("links every destination and preserves the prose between them", () => {
    const segments = emailBodySegments(
      "First https://a.com/one?x=1 then https://b.com/two and done.",
    );
    expect(links(segments).map((l) => l.href)).toEqual([
      "https://a.com/one?x=1",
      "https://b.com/two",
    ]);
    expect(links(segments).map((l) => l.text)).toEqual(["https://a.com/one", "https://b.com/two"]);
    expect(prose(segments)).toBe("First  then  and done.");
  });

  it("links a destination that opens the body", () => {
    const segments = emailBodySegments("https://a.com/x is the page");
    expect(segments[0]).toEqual({ kind: "link", text: "https://a.com/x", href: "https://a.com/x" });
  });

  it("never admits a scheme other than http or https", () => {
    for (const body of [
      "javascript:alert(1)",
      "ftp://files.example.com/x",
      "mailto:tom@lammico.com",
      "data:text/html;base64,AAAA",
    ]) {
      expect(links(emailBodySegments(body))).toEqual([]);
      expect(prose(emailBodySegments(body))).toBe(body);
    }
  });

  it("does not invent a link out of a bare domain", () => {
    const body = "Kevin Lourd | Founder\nDistribute.you | Marketing Agency\nopsfolio.com";
    expect(links(emailBodySegments(body))).toEqual([]);
  });

  it("renders the original body verbatim when the segments are concatenated", () => {
    const body =
      "Hi Tom,\nSee https://opsfolio.com/lp/x/?utm_id=distribute — or reply.\n--\nKevin";
    const rebuilt = emailBodySegments(body)
      .map((s) => (s.kind === "link" ? s.href : s.text))
      .join("");
    expect(rebuilt).toBe(body);
  });

  it("keeps two bodies independent of each other", () => {
    const first = emailBodySegments("a https://a.com/1 b");
    const second = emailBodySegments("c https://c.com/2 d");
    expect(links(first)[0].href).toBe("https://a.com/1");
    expect(links(second)[0].href).toBe("https://c.com/2");
  });
});

describe("trimUrlEnd", () => {
  it("strips several sentence enders at once", () => {
    expect(trimUrlEnd("https://site.com/a).")).toBe("https://site.com/a");
  });

  it("leaves a URL that ends on a path segment alone", () => {
    expect(trimUrlEnd("https://site.com/a/")).toBe("https://site.com/a/");
  });
});

describe("linkDisplayText", () => {
  it("shows a URL that is nothing but a query in full rather than a bare scheme", () => {
    expect(linkDisplayText("https://?x=1")).toBe("https://?x=1");
  });
});

describe("a destination the producer resolved", () => {
  const clean = "https://opsfolio.com/lp/cmmc/level-1-free-assessment/";
  const real = `${clean}?utm_source=landing_page&utm_id=distribute`;

  it("follows where the link truly leads while showing what the prospect saw", () => {
    const [link] = links(
      emailBodySegments(`See how it works here: ${clean}`, [{ text: clean, href: real }]),
    );
    expect(link.text).toBe(clean);
    expect(link.href).toBe(real);
  });

  it("states the URL as written when the producer could not resolve it", () => {
    const [link] = links(emailBodySegments(`Here: ${clean}`, [{ text: clean, href: null }]));
    expect(link.href).toBe(clean);
  });

  it("resolves every occurrence of a link the producer states once", () => {
    const body = `First ${clean} and again ${clean}`;
    const resolved = links(emailBodySegments(body, [{ text: clean, href: real }]));
    expect(resolved.map((l) => l.href)).toEqual([real, real]);
  });

  it("leaves a link the producer never mentions exactly as written", () => {
    const other = "https://distribute.you/pricing";
    const resolved = links(
      emailBodySegments(`${clean} and ${other}`, [{ text: clean, href: real }]),
    );
    expect(resolved.map((l) => l.href)).toEqual([real, other]);
  });

  it("reads a body with no resolution exactly as it did before the field existed", () => {
    const body = `Here: ${real}`;
    expect(emailBodySegments(body)).toEqual(emailBodySegments(body, undefined));
    expect(emailBodySegments(body, [])).toEqual(emailBodySegments(body, null));
  });

  it("never shows the tracking parameters in the label, only in the destination", () => {
    const [link] = links(emailBodySegments(clean, [{ text: clean, href: real }]));
    expect(link.text).not.toContain("utm_");
    expect(link.href).toContain("utm_");
  });
});
