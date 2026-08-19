import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Two right-panel affordances on the Leads page.
 *
 * 1. The "Audience" card states WHICH audience the lead came from and links to the
 *    Audiences page for everything else. It used to also print Size / Remaining,
 *    which duplicated numbers the Audiences page owns while still not showing the
 *    targeting filters — the thing a reader of that card actually wants. The link
 *    carries `?audienceId=`, the deep-link seed CustomerAudiencesPage reads on first
 *    paint, so the audience's detail panel (colored targeting tags) opens directly.
 *
 * 2. The email value is copy-to-clipboard, NOT a link. It shipped styled as one
 *    (`text-brand-600` + `hover:underline`), which promises a `mailto:` and then does
 *    something else on click. The copy intent is carried by a persistent copy glyph
 *    that darkens on hover plus a Copy/Copied tooltip, the way Stripe, PatternFly and
 *    Shoelace carry it; the address itself stays plain text.
 *
 * Source-substring guards: the component pulls Clerk/api through the `@` alias vitest
 * does not resolve here, matching the repo's other page guards. Both are scoped to
 * their own function body — `text-brand-600` and `hover:underline` are legitimate
 * elsewhere in this file (the audience link itself, the tab bar).
 */
describe("Leads right panel — audience card and email copy", () => {
  const filePath = path.join(__dirname, "../src/components/audiences/engaged-leads-page.tsx");
  const src = fs.readFileSync(filePath, "utf-8");

  // Measured: 1805 chars from `function AudienceSection(` to the link at the end
  // of it. A `toContain` guard fails when the slice is too SHORT, so this is
  // measured against the file, never guessed — re-measure when the block grows.
  const sliceFrom = (marker: string, length = 2200) => {
    const at = src.indexOf(marker);
    expect(at, `marker not found: ${marker}`).toBeGreaterThan(-1);
    return src.slice(at, at + length);
  };

  it("audience card drops Size / Remaining and links to the audience detail panel", () => {
    const body = sliceFrom("function AudienceSection(");
    expect(body).not.toContain("Size:");
    expect(body).not.toContain("Remaining:");
    expect(body).toContain("/audiences?audienceId=${inline.id}");
    expect(body).toContain("View audience details");
  });

  it("email copy control is not styled as a link and names the copy action", () => {
    const body = sliceFrom("function CopyableEmail(");
    expect(body).not.toContain("text-brand-600");
    expect(body).not.toContain("hover:underline");
    expect(body).toContain('title={copied ? "Copied" : "Copy"}');
    expect(body).toContain("aria-label={`Copy email address ${email}`}");
    expect(body).toContain("group-hover:text-gray-500");
  });
});
