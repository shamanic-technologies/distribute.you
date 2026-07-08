import { describe, it, expect } from "vitest";
import { extractDomain, subpageDestinationFromUrl } from "../src/lib/extract-domain";

describe("extractDomain", () => {
  it("returns null for empty string", () => {
    expect(extractDomain("")).toBeNull();
  });

  it("returns null for whitespace", () => {
    expect(extractDomain("   ")).toBeNull();
  });

  it("returns null for string with no dot", () => {
    expect(extractDomain("asdf")).toBeNull();
  });

  it("returns null for localhost (no dot)", () => {
    expect(extractDomain("localhost")).toBeNull();
  });

  it("returns null for input with spaces (URL constructor throws)", () => {
    expect(extractDomain("mon entreprise")).toBeNull();
  });

  it("extracts hostname from bare domain", () => {
    expect(extractDomain("example.com")).toBe("example.com");
  });

  it("extracts hostname from URL with https://", () => {
    expect(extractDomain("https://example.com")).toBe("example.com");
  });

  it("extracts hostname from URL with http://", () => {
    expect(extractDomain("http://example.com")).toBe("example.com");
  });

  it("extracts hostname from URL with path and query", () => {
    expect(extractDomain("https://example.com/path?q=1")).toBe("example.com");
  });

  it("preserves www subdomain", () => {
    expect(extractDomain("www.example.com")).toBe("www.example.com");
  });

  it("extracts multi-level subdomain", () => {
    expect(extractDomain("https://sub.example.co.uk")).toBe("sub.example.co.uk");
  });

  it("trims surrounding whitespace", () => {
    expect(extractDomain("  example.com  ")).toBe("example.com");
  });
});

describe("subpageDestinationFromUrl", () => {
  it("returns '' for empty / whitespace", () => {
    expect(subpageDestinationFromUrl("")).toBe("");
    expect(subpageDestinationFromUrl("   ")).toBe("");
  });

  it("returns '' for a bare domain (no sub-page)", () => {
    expect(subpageDestinationFromUrl("acme.com")).toBe("");
  });

  it("returns '' for a domain with only a root path", () => {
    expect(subpageDestinationFromUrl("acme.com/")).toBe("");
  });

  it("returns the full normalized URL for a sub-page (protocol-less)", () => {
    expect(subpageDestinationFromUrl("acme.com/pricing")).toBe("https://acme.com/pricing");
  });

  it("preserves an existing https:// protocol + path", () => {
    expect(subpageDestinationFromUrl("https://acme.com/pricing")).toBe("https://acme.com/pricing");
  });

  it("treats a query-only URL as a sub-page", () => {
    expect(subpageDestinationFromUrl("acme.com?ref=x")).toBe("https://acme.com/?ref=x");
  });

  it("returns '' for unparseable input", () => {
    expect(subpageDestinationFromUrl("mon entreprise")).toBe("");
  });
});
