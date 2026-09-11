import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The linkifier is pure and unit-tested next door. What this pins is the CALL SITE:
 * a component perfectly able to render a link is the feature entirely absent if the
 * timeline never asks it for segments.
 */
const TIMELINE = readFileSync(
  join(process.cwd(), "src/components/audiences/lead-history-timeline.tsx"),
  "utf8",
);

describe("lead history timeline renders destinations as links", () => {
  it("draws every body through the shared linkifier", () => {
    expect(TIMELINE).toContain("emailBodySegments(");
    expect(TIMELINE).toContain('from "@/lib/email-body-links"');
  });

  it("no longer prints the body as inert text", () => {
    // The bare interpolation the anchors replaced. Spelled in pieces so this guard
    // cannot trip on itself.
    const bare = "{e." + "bodyText}";
    expect(TIMELINE).not.toContain(bare);
  });

  it("opens a destination safely in a new tab", () => {
    expect(TIMELINE).toContain('target="_blank"');
    expect(TIMELINE).toContain('rel="noopener noreferrer"');
  });

  it("colours a link from the brand ramp, never a literal hex", () => {
    // `:root[data-brand-tint]` re-declares the ramp at the brand's hue, so an
    // arbitrary-value colour would be the one control that stays our blue.
    expect(TIMELINE).toContain("text-brand-600");
    expect(TIMELINE).not.toMatch(/text-\[#[0-9a-f]{3,8}\]/i);
  });

  it("never injects a body as markup", () => {
    expect(TIMELINE).not.toContain("dangerouslySetInnerHTML");
  });
});
