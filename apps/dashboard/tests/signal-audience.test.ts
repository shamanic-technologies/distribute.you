import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { companyPageSlug, linkedInSignalOf } from "../src/lib/signal-audience";

const ROOT = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

describe("LinkedIn signal audience model", () => {
  it("names a page by its slug", () => {
    expect(companyPageSlug("https://www.linkedin.com/company/lemlist/")).toBe("lemlist");
  });

  it("reads the producer's criterion off the filters, and nothing off an Apollo audience", () => {
    // The shape of the real prod row (audience d9ae565a-...).
    expect(
      linkedInSignalOf({
        buying_signal: {
          type: "linkedin_engagement",
          window_days: 30,
          competitor_pages: ["https://www.linkedin.com/company/lemlist/", "https://www.linkedin.com/company/instantly-ai/"],
        },
      }),
    ).toEqual({
      windowDays: 30,
      competitorPages: ["https://www.linkedin.com/company/lemlist/", "https://www.linkedin.com/company/instantly-ai/"],
    });
    expect(linkedInSignalOf({ person_titles: ["CEO"] })).toBeNull();
    expect(linkedInSignalOf(null)).toBeNull();
    expect(linkedInSignalOf({ buying_signal: { type: "job_change" } })).toBeNull();
  });
});

describe("LinkedIn signal audience surface", () => {
  const table = read("src/components/v2/audiences-table.tsx");

  it("labels the row with its competitors", () => {
    expect(table).toContain("{signal && <SignalTag signal={signal} />}");
  });

  it("an unknown size stays a dash, never a zero", () => {
    expect(table).toContain('if (column.col === "size") return audience.sizeCount != null ? <>{formatCount(audience.sizeCount)}</> : dash;');
  });

  it("the drawer shows the criterion, never its filters as Apollo pills", () => {
    expect(table).toContain("audience.filters && !signal && !plain ? audienceFilterGroups(audience.filters) : []");
  });

  // Done for you (owner 2026-10-03): we find the competitors and their LinkedIn pages and
  // create this audience ourselves. The client is never asked to paste pages.
  it("offers the client no form to type competitor pages", () => {
    expect(existsSync(resolve(ROOT, "src/components/v2/signal-audience-modal.tsx"))).toBe(false);
    expect(read("src/lib/api.ts")).not.toContain("/orgs/audiences/signal");
    expect(read("../admin/src/lib/api.ts")).not.toContain("/orgs/audiences/signal");
  });
});
