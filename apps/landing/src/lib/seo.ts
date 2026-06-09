import { PROD_URLS } from "@/lib/env-urls";

export const SITE_NAME = "distribute";
export const SITE_URL = PROD_URLS.landing;
export const SITE_TITLE = "distribute - AI cold email, done for you";
export const SITE_DESCRIPTION =
  "Drop your website URL. We email your ideal customers. AI reads every reply. Only real buyers land in your Gmail. You read 5 emails, not 200. No SDR. No setup. No subscription.";
export const TWITTER_HANDLE = "@distribute_you";

export const BRAND_LOGO_PATH = "/landing-v2/logo/logo-distribute.svg";
export const BRAND_LOGO_URL = `${SITE_URL}${BRAND_LOGO_PATH}`;

export const DEFAULT_OG_IMAGE_PATH = "/opengraph-image";
export const DEFAULT_OG_IMAGE_URL = `${SITE_URL}${DEFAULT_OG_IMAGE_PATH}`;
export const PRICING_OG_IMAGE_PATH = "/pricing/opengraph-image";
export const BENCHMARKS_OG_IMAGE_PATH = "/benchmarks/opengraph-image";
export const INVESTORS_OG_IMAGE_PATH = "/investors/opengraph-image";

export function absoluteUrl(path: string) {
  return `${SITE_URL}${path}`;
}

export function organizationJsonLd(description = SITE_DESCRIPTION) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    legalName: "Shamanic Technologies",
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
  };
}
