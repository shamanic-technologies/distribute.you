import { describe, it, expect } from "vitest";
import {
  investorUpdateBlocker,
  imageMarkdown,
  imageFileProblem,
  imageUrlProblem,
  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_IMAGE_ACCEPT_ATTR,
  MAX_IMAGE_UPLOAD_BYTES,
} from "../src/lib/investor-update-html";

const file = (name: string, type: string, size: number) => ({ name, type, size });

describe("imageMarkdown", () => {
  it("assembles the markdown so no caller hand-writes the syntax", () => {
    expect(imageMarkdown(" https://x.com/a.png ", " A chart ")).toBe("![A chart](https://x.com/a.png)");
  });
});

describe("investorUpdateBlocker", () => {
  it("blocks an empty subject", () => {
    expect(investorUpdateBlocker("   ", "body")).toBe("Add a subject.");
  });

  it("blocks an empty body", () => {
    expect(investorUpdateBlocker("Subject", "  \n ")).toBe("Write the update.");
  });

  it("clears once both are written", () => {
    expect(investorUpdateBlocker("Q3 update", "We shipped a lot.")).toBeNull();
  });
});

describe("imageUrlProblem", () => {
  it("refuses SVG — it renders in the composer preview and shows alt text in Gmail", () => {
    // The failure that prompted this: a verification send used an SVG logo and
    // landed as a broken-image placeholder.
    const problem = imageUrlProblem("https://distribute.you/logo-distribute.svg");
    expect(problem).toContain("SVG");
    expect(problem).toContain("PNG");
  });

  it("refuses a relative path — nothing resolves it once the HTML is in a mail client", () => {
    expect(imageUrlProblem("/brand/icon.png")).toContain("https://");
  });

  it("refuses plain http, which clients block", () => {
    expect(imageUrlProblem("http://x.com/a.png")).toContain("https://");
  });

  it("refuses a data URI, which Gmail strips", () => {
    expect(imageUrlProblem("data:image/png;base64,AAAA")).toContain("Gmail");
  });

  it("says so when the upload came back with no URL at all", () => {
    expect(imageUrlProblem("   ")).toContain("without a URL");
  });

  it("accepts an https PNG or JPG, query string and all", () => {
    for (const u of [
      "https://distribute.you/brand/icon.png",
      "https://x.com/a.JPG",
      "https://x.com/a.jpeg?w=800&v=2",
      "https://cdn.x.com/img/chart.gif",
    ]) {
      expect(imageUrlProblem(u)).toBeNull();
    }
  });

  it("judges the path, not the query, so a ?v=.svg cache-buster is not mistaken for an SVG", () => {
    expect(imageUrlProblem("https://x.com/a.png?ref=.svg")).toBeNull();
  });
});

describe("imageFileProblem", () => {
  it("refuses SVG by type AND by name — a dragged file can arrive with an empty type", () => {
    expect(imageFileProblem(file("logo.svg", "image/svg+xml", 1024))).toContain("SVG");
    expect(imageFileProblem(file("logo.SVG", "", 1024))).toContain("SVG");
  });

  it("refuses a format mail clients do not draw", () => {
    // WebP is the live one: Gmail draws it, Outlook on Windows renders through
    // Word and does not.
    expect(imageFileProblem(file("chart.webp", "image/webp", 1024))).toContain("PNG");
    expect(imageFileProblem(file("deck.pdf", "application/pdf", 1024))).toContain("PNG");
  });

  it("refuses an empty file, which uploads fine and draws nothing", () => {
    expect(imageFileProblem(file("chart.png", "image/png", 0))).toContain("empty");
  });

  it("refuses one over the cap and says how big it is", () => {
    const problem = imageFileProblem(file("chart.png", "image/png", MAX_IMAGE_UPLOAD_BYTES + 1));
    expect(problem).toContain("5 MB");
    expect(problem).toContain("5.0 MB");
  });

  it("asks for a file when none is picked", () => {
    expect(imageFileProblem(null)).toBe("Choose an image.");
  });

  it("accepts each format the picker offers, right up to the cap", () => {
    for (const type of ACCEPTED_IMAGE_TYPES) {
      expect(imageFileProblem(file("chart.bin", type, MAX_IMAGE_UPLOAD_BYTES))).toBeNull();
    }
  });

  it("builds the picker's accept attribute from the same list it gates on", () => {
    for (const type of ACCEPTED_IMAGE_TYPES) {
      expect(ACCEPTED_IMAGE_ACCEPT_ATTR).toContain(type);
    }
    expect(ACCEPTED_IMAGE_ACCEPT_ATTR).not.toContain("svg");
  });
});
