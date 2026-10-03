import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { companyPageSlug, isLinkedInCompanyPage, linkedInSignalOf } from "../src/lib/signal-audience";

const ROOT = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

describe("LinkedIn signal audience model", () => {
  it("recognises a company page and refuses anything else", () => {
    expect(isLinkedInCompanyPage("https://www.linkedin.com/company/lemlist/")).toBe(true);
    expect(isLinkedInCompanyPage("https://linkedin.com/company/hubspot")).toBe(true);
    expect(isLinkedInCompanyPage(" https://fr.linkedin.com/company/acme/?trk=x ")).toBe(true);
    expect(isLinkedInCompanyPage("https://www.linkedin.com/in/someone/")).toBe(false);
    expect(isLinkedInCompanyPage("https://www.linkedin.com/company/")).toBe(false);
    expect(isLinkedInCompanyPage("lemlist")).toBe(false);
  });

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
  const modal = read("src/components/v2/signal-audience-modal.tsx");
  const dashApi = read("src/lib/api.ts");
  const adminApi = read("../admin/src/lib/api.ts");

  it("the table offers it on the offer page only, and labels the row with its competitors", () => {
    expect(table).toContain("{!t.campaignScoped && (");
    expect(table).toContain("<V2SignalAudienceModal");
    expect(table).toContain("{signal && <SignalTag signal={signal} />}");
  });

  it("an unknown size stays a dash, never a zero", () => {
    expect(table).toContain('if (column.col === "size") return audience.sizeCount != null ? <>{formatCount(audience.sizeCount)}</> : dash;');
  });

  it("the drawer shows the criterion, never its filters as Apollo pills", () => {
    expect(table).toContain("audience.filters && !signal ? audienceFilterGroups(audience.filters) : []");
  });

  it("the modal shows the producer's named refusal, and its own copy for any other status", () => {
    expect(modal).toContain("{signalAudienceErrorMessage(error)}");
    expect(modal).toContain("(status === 400 || status === 422)");
    expect(modal).toContain('"v2-portal"');
  });

  it("the reader is byte-equal in both apps and puts brandId in the query", () => {
    const slice = (src: string) => {
      const at = src.indexOf("export async function createSignalAudience(");
      return src.slice(at, src.indexOf("const parsed", at));
    };
    expect(slice(dashApi)).toBe(slice(adminApi));
    expect(slice(dashApi)).toContain("`/orgs/audiences/signal?${query.toString()}`");
  });
});
