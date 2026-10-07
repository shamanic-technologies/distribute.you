import { z } from "zod";

/**
 * The brand's own LinkedIn company page as brand-service holds it (Brand settings). Read
 * never computes or spends; a person's page wins over every automatic source and clearing
 * it hands the brand back to automatic discovery. Alias-free so the unit tests read it.
 */

export const BrandLinkedinPageSchema = z.object({
  brandId: z.string(),
  status: z.string(),
  linkedinUrl: z.string().nullable(),
  noneFoundReason: z.string().nullable(),
  provenance: z.object({ source: z.string().nullable() }).passthrough().nullable(),
});
export type BrandLinkedinPage = z.infer<typeof BrandLinkedinPageSchema>;

/** Where the page came from, in a few plain words; null when there is no page. */
export function linkedinPageSourceLabel(p: BrandLinkedinPage): string | null {
  if (!p.linkedinUrl) return null;
  switch (p.provenance?.source) {
    case "user":
      return "Set by you";
    case "brand_website":
      return "Found on your website";
    case "apollo":
      return "Found by us";
    default:
      console.error("[dashboard] brand LinkedIn page: unknown source", p.provenance?.source);
      return null;
  }
}

/** What the row says when no page is held. */
export function linkedinPageEmptyLabel(p: BrandLinkedinPage): string {
  return p.status === "not_computed" ? "Not looked up yet" : "None found";
}

/** brand-service's refusal reasons, in our words (never its message verbatim). */
const REFUSAL: Record<string, string> = {
  empty: "Paste your LinkedIn company page.",
  not_a_url: "That is not a link.",
  not_linkedin: "That is not a LinkedIn link.",
  personal_profile: "That is a personal profile. Paste your company page.",
  not_company_page: "Paste a company page: linkedin.com/company/…",
};

export function linkedinPageRefusal(reason: unknown): string {
  return (typeof reason === "string" && REFUSAL[reason]) || "Not saved. Try again.";
}

/** The page as it reads in the row: no scheme, no www, no trailing slash. */
export function shortLinkedinUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}
