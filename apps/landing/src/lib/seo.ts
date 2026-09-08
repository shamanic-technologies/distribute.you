import { PROD_URLS } from "@/lib/env-urls";

export const SITE_NAME = "distribute.you";
export const SITE_URL = PROD_URLS.landing;
export const SITE_TITLE = "distribute.you: the AI-native acquisition agency";
export const SITE_DESCRIPTION =
  "Paste your website and set a daily budget. We find the buyers, run the outreach from domains we own, answer interested leads until the meeting is booked, and show you what each one cost. First $30 free.";
export const TWITTER_HANDLE = "@distribute_you";

export const BRAND_LOGO_PATH = "/landing/logo/logo-distribute-blue.svg";
export const BRAND_LOGO_URL = `${SITE_URL}${BRAND_LOGO_PATH}`;

export const DEFAULT_OG_IMAGE_PATH = "/opengraph-image";
export const DEFAULT_OG_IMAGE_URL = `${SITE_URL}${DEFAULT_OG_IMAGE_PATH}`;
export const INVESTORS_OG_IMAGE_PATH = "/investors/opengraph-image";

export function absoluteUrl(path: string) {
  return `${SITE_URL}${path}`;
}

export function organizationJsonLd(description = SITE_DESCRIPTION) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    // The registered entity, not a trading name. "Shamanic Technologies" was
    // never a legal name — it is the GitHub organisation handle, which is why it
    // read as one for so long. BLOOMING GENERATION is a SASU registered at the
    // address below; both are public record on the French company register, and
    // a commercial site here is required to publish them.
    legalName: "BLOOMING GENERATION",
    // SIREN. `identifier` is what schema.org offers for a national company
    // number, and it is the thing that makes the rest of this block verifiable
    // rather than merely stated.
    identifier: "882102775",
    url: SITE_URL,
    logo: BRAND_LOGO_URL,
    image: BRAND_LOGO_URL,
    description,
    sameAs: [PROD_URLS.github, PROD_URLS.twitter],
    contactPoint: {
      "@type": "ContactPoint",
      email: "support@distribute.you",
      contactType: "customer service",
    },
    // Registered address of the operating company, taken from the company bank
    // record. Structured-data consumers read a PostalAddress, not a string.
    address: {
      "@type": "PostalAddress",
      streetAddress: "285 rue de l'\u00c9glise",
      postalCode: "46140",
      addressLocality: "Douelle",
      addressCountry: "FR",
    },
  };
}
