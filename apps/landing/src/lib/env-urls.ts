import { URLS } from "@distribute/content";

/**
 * Transform a distribute.you subdomain URL for staging.
 * e.g. https://dashboard.distribute.you → https://dashboard-staging.distribute.you
 */
function stagingify(url: string): string {
  return url.replace(
    /^(https:\/\/)([^.]+)(\.distribute\.you)/,
    "$1$2-staging$3",
  );
}

/**
 * Build environment-aware URLs based on the current hostname.
 * If hostname contains "staging", all distribute.you subdomains get a -staging suffix.
 * External links (GitHub, Twitter) and relative paths are unchanged.
 */
export function resolveUrls(hostname: string) {
  const isStaging = hostname.includes("staging");
  const adapt = (url: string) => (isStaging ? stagingify(url) : url);

  return {
    landing: adapt(URLS.landing),
    signUp: adapt(URLS.signUp),
    signIn: adapt(URLS.signIn),
    apiKeys: adapt(URLS.apiKeys),
    docs: adapt(URLS.docs),
    apiDocs: adapt(URLS.apiDocs),
    performance: "/performance",
    github: URLS.github,
    twitter: URLS.twitter,
  } as const;
}

/** Prod URLs — used for SEO metadata, sitemap, structured data. */
export const PROD_URLS = resolveUrls("");
