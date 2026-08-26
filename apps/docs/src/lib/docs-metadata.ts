import type { Metadata } from "next";
import { PRODUCT_NAME, docsRoute, docsUrl } from "./docs-routes";

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
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description: route.description,
    },
  };
}
