import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The investor-update preview.
 *
 * These are source-substring guards, not unit calls: both files import through
 * the `@` alias, which vitest does not resolve in this repo. What they protect
 * is a class of bug that already shipped once — the console rendering its own
 * version of an email the producer renders — so the guards are about WHERE the
 * HTML comes from and WHERE it is rendered, not about markup details.
 */

const root = join(__dirname, "..");
const modal = readFileSync(join(root, "src/components/investors/email-preview-modal.tsx"), "utf8");
const composer = readFileSync(
  join(root, "src/components/investors/investor-update-composer.tsx"),
  "utf8"
);
const lib = readFileSync(join(root, "src/lib/investor-update-html.ts"), "utf8");
const api = readFileSync(join(root, "src/lib/api.ts"), "utf8");

function sliceFrom(source: string, marker: string, length: number): string {
  const at = source.indexOf(marker);
  expect(at, `marker not found: ${marker}`).toBeGreaterThan(-1);
  return source.slice(at, at + length);
}

describe("the preview comes from the producer, never from here", () => {
  it("has no local markdown renderer left in the lib", () => {
    expect(lib).not.toContain("renderInvestorUpdatePreviewHtml");
    expect(lib).not.toContain('from "marked"');
  });

  it("does not render markdown anywhere in the composer either", () => {
    expect(composer).not.toContain("marked");
    expect(composer).not.toContain("renderInvestorUpdatePreviewHtml");
  });

  it("asks the producer for it", () => {
    expect(composer).toContain("previewMailingListUpdate");
    expect(api).toContain("/mailing-lists/updates/preview");
  });

  it("fetches it only while the modal is open, so it is one call per preview", () => {
    // Measured to the end of the useAuthQuery call (about 250 chars from the
    // key); widen it only after re-measuring, or the enabled line drops out.
    const body = sliceFrom(composer, 'useAuthQuery(\n    ["mailingListUpdatePreview"', 300);
    expect(body).toContain("enabled: previewOpen");
  });

  it("says it could not render rather than falling back to markup of its own", () => {
    expect(composer).toContain("Could not render this");
    expect(composer).not.toContain("?? previewHtml");
  });
});

describe("the email renders isolated from the console", () => {
  it("renders it in a sandboxed iframe, never inlined into the page", () => {
    expect(modal).toContain("<iframe");
    expect(modal).toContain('sandbox=""');
    expect(modal).toContain("srcDoc");
    expect(modal).not.toContain("dangerouslySetInnerHTML");
  });

  it("sanitizes what it renders", () => {
    expect(modal).toContain("sanitizeEmailHtml");
  });

  it("leaves no inline preview behind in the composer", () => {
    expect(composer).not.toContain("dangerouslySetInnerHTML");
    expect(composer).not.toContain("showPreview");
  });
});

describe("what the modal states beside the message", () => {
  it("keeps the unsubscribe note, which the author cannot see in the body", () => {
    expect(composer).toContain("UNSUBSCRIBE_PREVIEW_NOTE");
    expect(lib).toContain("UNSUBSCRIBE_PREVIEW_NOTE");
  });

  it("names an image no mail client renders — a browser shows it happily", () => {
    expect(composer).toContain("unrenderableImages");
    expect(composer).toContain("No mail client renders");
  });
});

describe("the past-updates history uses the same modal", () => {
  it("opens the message rather than inlining what was sent", () => {
    expect(composer).toContain("<EmailPreviewModal");
    expect(composer).toContain("html={update.htmlBody}");
  });
});
