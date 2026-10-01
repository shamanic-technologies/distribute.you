import type { Metadata } from "next";
import { PRODUCT_NAME, docsRoute, docsUrl } from "./docs-routes";

/**
 * The link-preview card (WhatsApp, Slack, LinkedIn, X), built at export time by
 * `src/app/og-image.png/route.tsx`. It is declared on every page because a
 * page's `openGraph` replaces the layout's instead of merging with it: when only
 * the layout named an image, no page served one.
 */
export const DOCS_OG_IMAGE_PATH = "/og-image.png";
export const DOCS_OG_IMAGE = {
  url: DOCS_OG_IMAGE_PATH,
  width: 1200,
  height: 630,
  alt: `${PRODUCT_NAME} docs: REST API, MCP server and command line client`,
};

/**
 * Metadata for one docs page, built from the single route list.
 *
 * The canonical is the load-bearing part. The root layout used to declare
 * `alternates.canonical` as the site root, and metadata inherits, so all 28
 * pages told search engines that the real document was the home page. Every
 * sub-page was therefore a duplicate of the index by its own admission, which
 * is why a name search for the API reference surfaced nothing. A canonical
 * belongs to the page it names and to no other page.
 */
export function docsMetadata(path: string): Metadata {
  const route = docsRoute(path);
  const url = docsUrl(path);
  // The layout's title template appends the product name to a page title, but
  // an openGraph title bypasses that template, so it is spelled out in full.
  const namesProduct = route.title.includes(PRODUCT_NAME);
  const socialTitle = namesProduct
    ? route.title
    : `${route.title} | ${PRODUCT_NAME} Docs`;

  return {
    // A title that already says `distribute.you` opts out of the layout's
    // template, which would otherwise render the name twice in one tab.
    title: namesProduct ? { absolute: route.title } : route.title,
    description: route.description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title: socialTitle,
      description: route.description,
      images: [DOCS_OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description: route.description,
      images: [DOCS_OG_IMAGE],
    },
  };
}
