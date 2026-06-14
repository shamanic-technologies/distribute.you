import { describe, it, expect } from "vitest";
import { extractDomain } from "../src/lib/extract-domain";

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
