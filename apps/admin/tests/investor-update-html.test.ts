import { describe, it, expect } from "vitest";
import {
  investorUpdateBlocker,
  imageMarkdown,
  imageAltFromFilename,
  sanitizeUploadFilename,
  formatUploadSize,
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

  it("wraps a URL with a space, or the line renders as literal text", () => {
    // Measured against the producer's own `marked`: a bare destination ends at
    // the first space, so `![Screenshot](https://…/Screenshot 2026…png)` emits
    // no <img> at all and the update goes out showing its own markup.
    expect(imageMarkdown("https://r2.dev/u/Screenshot 2026-08-02 at 10.46.50.png", "Shot")).toBe(
      "![Shot](<https://r2.dev/u/Screenshot 2026-08-02 at 10.46.50.png>)"
    );
  });

  it("wraps a URL with a parenthesis, which closes the destination early", () => {
    expect(imageMarkdown("https://x.com/chart(1).png", "Chart")).toBe(
      "![Chart](<https://x.com/chart(1).png>)"
    );
  });

  it("leaves a clean URL bare, and cannot double-encode an encoded one", () => {
    // `encodeURI` on an already-encoded URL turns %20 into %2520.
    expect(imageMarkdown("https://x.com/a%20b.png", "A")).toBe("![A](https://x.com/a%20b.png)");
  });
});

describe("sanitizeUploadFilename", () => {
  it("takes the spaces out of a macOS screenshot, which is where this came from", () => {
    expect(sanitizeUploadFilename("Screenshot 2026-08-02 at 10.46.50.png")).toBe(
      "screenshot-2026-08-02-at-10-46-50.png"
    );
  });

  it("splits on the LAST dot only, so a dotted timestamp is not cut short", () => {
    expect(sanitizeUploadFilename("chart.v2.final.PNG")).toBe("chart-v2-final.png");
  });

  it("transliterates an accent rather than dropping the letter", () => {
    expect(sanitizeUploadFilename("Rétention nette.jpeg")).toBe("retention-nette.jpeg");
  });

  it("keeps a name that has no extension", () => {
    expect(sanitizeUploadFilename("screenshot")).toBe("screenshot");
  });

  it("never returns an empty key, which the storage service could not build a URL from", () => {
    expect(sanitizeUploadFilename("___.png")).toBe("image.png");
    expect(sanitizeUploadFilename(".png")).toBe("png");
    expect(sanitizeUploadFilename("")).toBe("image");
  });

  it("leaves an already-clean name alone", () => {
    expect(sanitizeUploadFilename("net-revenue-retention.png")).toBe("net-revenue-retention.png");
  });
});

describe("formatUploadSize", () => {
  it("reads as a weight a person can judge", () => {
    expect(formatUploadSize(512)).toBe("512 bytes");
    expect(formatUploadSize(115375)).toBe("113 KB");
    expect(formatUploadSize(3 * 1024 * 1024)).toBe("3.0 MB");
  });

  it("says nothing rather than something wrong when the size is not a number", () => {
    expect(formatUploadSize(Number.NaN)).toBe("");
    expect(formatUploadSize(-1)).toBe("");
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

  it("blocks while a picked image is not in the body, and names the file", () => {
    // This is exactly how the first real update went out with no picture: the
    // file sat chosen in the form and the send said nothing.
    const blocker = investorUpdateBlocker("Q3 update", "We shipped.", "chart.png");
    expect(blocker).toContain("chart.png");
    expect(blocker).toContain("not in the update");
  });

  it("does not block once the image made it in", () => {
    expect(investorUpdateBlocker("Q3 update", "We shipped.", null)).toBeNull();
    expect(investorUpdateBlocker("Q3 update", "We shipped.", "  ")).toBeNull();
  });

  it("still reports the emptier problem first — a missing subject is the nearer fix", () => {
    expect(investorUpdateBlocker("", "body", "chart.png")).toBe("Add a subject.");
    expect(investorUpdateBlocker("Q3", "", "chart.png")).toBe("Write the update.");
  });
});

describe("imageAltFromFilename", () => {
  it("reads as words, since this is what shows while a client blocks images", () => {
    expect(imageAltFromFilename("Q3-revenue-chart.png")).toBe("Q3 revenue chart");
    expect(imageAltFromFilename("net_revenue_retention.JPEG")).toBe("net revenue retention");
  });

  it("drops only the final extension", () => {
    expect(imageAltFromFilename("chart.v2.png")).toBe("chart.v2");
  });

  it("keeps a name with no extension", () => {
    expect(imageAltFromFilename("screenshot")).toBe("screenshot");
  });

  it("never returns an empty alt, which would render as nothing at all", () => {
    expect(imageAltFromFilename(".png")).toBe("Image");
    expect(imageAltFromFilename("")).toBe("Image");
    expect(imageAltFromFilename("--_-.png")).toBe("Image");
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
