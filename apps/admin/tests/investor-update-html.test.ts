import { describe, it, expect } from "vitest";
import {
  investorUpdateBlocker,
  imageMarkdown,
  imageUrlProblem,
} from "../src/lib/investor-update-html";

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

  it("asks for something when the box is empty", () => {
    expect(imageUrlProblem("   ")).toBe("Paste an image URL.");
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
