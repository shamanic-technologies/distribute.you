import { describe, expect, it } from "vitest";
import {
  BrandLinkedinPageSchema,
  linkedinPageEmptyLabel,
  linkedinPageRefusal,
  linkedinPageSourceLabel,
  shortLinkedinUrl,
} from "../src/lib/v2/brand-linkedin-page";

const page = (source: string | null, url: string | null, status = "found") =>
  BrandLinkedinPageSchema.parse({ brandId: "b", status, linkedinUrl: url, noneFoundReason: null, provenance: source ? { source } : null });

describe("Brand settings: LinkedIn page", () => {
  it("says where the page came from", () => {
    expect(linkedinPageSourceLabel(page("user", "https://www.linkedin.com/company/x/"))).toBe("Set by you");
    expect(linkedinPageSourceLabel(page("apollo", "https://www.linkedin.com/company/x/"))).toBe("Found by us");
    expect(linkedinPageSourceLabel(page("brand_website", "https://www.linkedin.com/company/x/"))).toBe("Found on your website");
    expect(linkedinPageSourceLabel(page(null, null, "not_found"))).toBeNull();
  });

  it("tells none found from never looked up", () => {
    expect(linkedinPageEmptyLabel(page(null, null, "not_found"))).toBe("None found");
    expect(linkedinPageEmptyLabel(page(null, null, "not_computed"))).toBe("Not looked up yet");
  });

  it("answers a refusal in our words", () => {
    expect(linkedinPageRefusal("personal_profile")).toMatch(/personal profile/);
    expect(linkedinPageRefusal("something_new")).toBe("Not saved. Try again.");
  });

  it("reads the page short", () => {
    expect(shortLinkedinUrl("https://www.linkedin.com/company/pressbeat/")).toBe("linkedin.com/company/pressbeat");
  });
});
