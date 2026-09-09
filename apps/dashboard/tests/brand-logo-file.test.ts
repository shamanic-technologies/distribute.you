import { describe, it, expect } from "vitest";
import {
  ACCEPTED_LOGO_TYPES,
  BRAND_LOGO_FOLDER,
  LOGO_FILE_ACCEPT,
  MAX_LOGO_BYTES,
  brandLogoFilename,
  logoFileProblem,
  logoUrlProblem,
} from "../src/lib/brand-logo-file";

/**
 * A LOGO IS UPLOADED, NEVER LINKED — every rule here follows from that, and the
 * refusals all happen BEFORE the upload so a person is told while the file is
 * still in front of them.
 */
describe("logoFileProblem", () => {
  const ok = { type: "image/png", size: 1024, name: "logo.png" };

  it("accepts the raster formats a browser draws at favicon size", () => {
    for (const type of ACCEPTED_LOGO_TYPES) {
      expect(logoFileProblem({ ...ok, type })).toBeNull();
    }
  });

  it("refuses SVG: it is a document that can carry script, rendered on our own origin", () => {
    const problem = logoFileProblem({ ...ok, type: "image/svg+xml", name: "logo.svg" });
    expect(problem).not.toBeNull();
    // Names what to pick instead, rather than only what was wrong.
    expect(problem).toContain("PNG");
  });

  it("refuses a file over the cap, and says how big it actually was", () => {
    const problem = logoFileProblem({ ...ok, size: MAX_LOGO_BYTES + 1 });
    expect(problem).toContain("2MB");
    // The person's own number, so they can tell how far over they are.
    expect(problem).toContain("2.1MB");
  });

  it("accepts a file exactly at the cap — the bound is inclusive", () => {
    expect(logoFileProblem({ ...ok, size: MAX_LOGO_BYTES })).toBeNull();
  });

  it("refuses an empty file rather than uploading zero bytes", () => {
    expect(logoFileProblem({ ...ok, size: 0 })).toBe("That file is empty.");
  });

  it("names the type it was given, even when the browser reported none", () => {
    expect(logoFileProblem({ type: "", size: 10, name: "x" })).toContain("that file type");
  });

  it("offers exactly the accepted types in the picker — one catalogue, no second list", () => {
    expect(LOGO_FILE_ACCEPT).toBe(ACCEPTED_LOGO_TYPES.join(","));
    expect(LOGO_FILE_ACCEPT).not.toContain("svg");
    expect(LOGO_FILE_ACCEPT).not.toContain("webp");
  });
});

describe("logoUrlProblem", () => {
  it("accepts an https URL storage handed back", () => {
    expect(logoUrlProblem("https://assets.distribute.you/brand-logos/a.png")).toBeNull();
  });

  it("refuses http: an https dashboard will not draw a mixed-content image", () => {
    expect(logoUrlProblem("http://assets.example.com/a.png")).not.toBeNull();
  });

  it("refuses something that is not a URL at all", () => {
    expect(logoUrlProblem("brand-logos/a.png")).not.toBeNull();
  });
});

describe("brandLogoFilename", () => {
  it("keeps the brand id in the key, so a bucket object says what it is", () => {
    expect(brandLogoFilename("b-1", "image/png")).toContain("b-1");
  });

  it("takes the extension from the MIME type, the byte-level truth", () => {
    expect(brandLogoFilename("b", "image/png").endsWith(".png")).toBe(true);
    expect(brandLogoFilename("b", "image/gif").endsWith(".gif")).toBe(true);
    expect(brandLogoFilename("b", "image/jpeg").endsWith(".jpg")).toBe(true);
  });

  it("busts the cache in the NAME, not a query string", () => {
    // The URL is later handed to a browser as a FAVICON, and a favicon URL that
    // differs only by query string is one browsers happily serve from cache.
    const generated = brandLogoFilename("b", "image/png");
    expect(generated).not.toContain("?");
    expect(generated).toMatch(/^b-\d+\.png$/);
  });

  it("drops the customer's own filename — it becomes a public URL", () => {
    // macOS names every screenshot with spaces and colons, and the name carries
    // nothing a reader of the bucket needs; the brand id does.
    expect(brandLogoFilename("b", "image/png")).not.toContain(" ");
  });

  it("files every logo under one greppable prefix", () => {
    expect(BRAND_LOGO_FOLDER).toBe("brand-logos");
  });
});
