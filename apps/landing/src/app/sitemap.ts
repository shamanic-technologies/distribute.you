import { MetadataRoute } from "next";
import { PROD_URLS } from "@/lib/env-urls";
import { listArticles } from "@/lib/blog/db";
import { comparePaths } from "@/lib/competitors";
import { bestForPaths } from "@/lib/best-for";
import { fetchIndexList } from "@/lib/fleet-indexes";
import { sitePagePaths } from "@/lib/site-pages";
import { agencyClusterPaths } from "@/lib/agencies";
import { leadgenClusterPaths } from "@/lib/lead-generation-agencies";
import { ppcClusterPaths } from "@/lib/ppc-agencies";
import { coldEmailClusterPaths } from "@/lib/cold-email-agencies";
import { appointmentClusterPaths } from "@/lib/appointment-setting-agencies";
import { reactivationClusterPaths } from "@/lib/reactivation-agencies";
import { csClusterPaths } from "@/lib/customer-success-agencies";
import { nurturingClusterPaths } from "@/lib/nurturing-tools";
import { aiCsClusterPaths } from "@/lib/cs-tools";
import { signupClusterPaths } from "@/lib/signup-tools";
import { uaClusterPaths } from "@/lib/user-acquisition-agencies";
import { DOCS_ROUTES, docsUrl } from "@/lib/docs/docs-routes";

// Sitemap is generated at build time. When DATABASE_URL is not configured
// (e.g. CI build runners without a Neon binding) we skip article rows
// instead of crashing the entire build — crawlers will rediscover them
// after the next deploy that has DATABASE_URL set.
//
// Re-read hourly, like the blog pages (ISR): an article is published by a DB row written
// AFTER its deploy, so a build-time-only sitemap never listed it until the next unrelated
// deploy, and kept listing rows deleted since.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = PROD_URLS.landing;

  let articles: { slug: string; updatedAt: string }[] = [];
  if (process.env.DATABASE_URL) {
    // listArticles already catches the "table missing" case (Postgres 42P01)
    // and returns []; any other DB error propagates per fail-loud policy.
    const rows = await listArticles(500);
    articles = rows.map((a) => ({ slug: a.slug, updatedAt: a.updatedAt }));
  }

  // The outcome pages, read from the page catalogue (`/` is the Revenue AI Agent page):
  // a page flipped live there is listed here without a second edit.
  const staticEntries: MetadataRoute.Sitemap = sitePagePaths().map((path) => ({
    url: path === "/" ? baseUrl : `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: path === "/" ? 1 : 0.9,
  }));
  staticEntries.push(
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  );

  // Statically-served pages (src/app/<page>/route.ts → staticResponse) that were
  // missing from the sitemap — all live + indexable. Keep in lockstep with the
  // public/landing/**.html set when adding/removing a static page.
  // Every other indexable page. Keep in lockstep with the routes under src/app: a page
  // added there and not here is live and absent from the sitemap.
  const STATIC_SEO_PATHS: { path: string; priority: number }[] = [
    { path: "/brand", priority: 0.5 },
    { path: "/about", priority: 0.6 },
    { path: "/catalog", priority: 0.6 },
    { path: "/contact", priority: 0.5 },
    { path: "/privacy", priority: 0.3 },
  ];

  // The comparison cluster is rendered from the competitor catalogue, so its paths are
  // read from it rather than listed here: a competitor added there is in the sitemap
  // without a second edit. The hub and /alternatives rank above the per-competitor pages.
  for (const path of comparePaths()) {
    STATIC_SEO_PATHS.push({ path, priority: path.split("/").length > 2 ? 0.7 : 0.8 });
  }

  // The GTM Agency page's own vs/alternatives cluster, read from its catalogue.
  for (const path of agencyClusterPaths()) {
    STATIC_SEO_PATHS.push({ path, priority: path.split("/").length > 3 ? 0.7 : 0.8 });
  }

  // The Lead Generation Agency page's own vs/alternatives cluster, read from its catalogue.
  for (const path of leadgenClusterPaths()) {
    STATIC_SEO_PATHS.push({ path, priority: path.split("/").length > 3 ? 0.7 : 0.8 });
  }

  // The PPC Agency page's own vs/alternatives cluster, read from its catalogue.
  for (const path of ppcClusterPaths()) {
    STATIC_SEO_PATHS.push({ path, priority: path.split("/").length > 3 ? 0.7 : 0.8 });
  }

  // The Appointment Setting Agency page's own vs/alternatives cluster, read from its catalogue.
  for (const path of appointmentClusterPaths()) {
    STATIC_SEO_PATHS.push({ path, priority: path.split("/").length > 3 ? 0.7 : 0.8 });
  }

  // The Database Reactivation Agency page's own vs/alternatives cluster, read from its catalogue.
  for (const path of reactivationClusterPaths()) {
    STATIC_SEO_PATHS.push({ path, priority: path.split("/").length > 3 ? 0.7 : 0.8 });
  }

  // The AI Customer Success page's own vs/alternatives cluster, read from its catalogue.
  for (const path of aiCsClusterPaths()) {
    STATIC_SEO_PATHS.push({ path, priority: path.split("/").length > 3 ? 0.7 : 0.8 });
  }

  // The Customer Success Agency page's own vs/alternatives cluster, read from its catalogue.
  for (const path of csClusterPaths()) {
    STATIC_SEO_PATHS.push({ path, priority: path.split("/").length > 3 ? 0.7 : 0.8 });
  }

  // The Lead Nurturing Automation page's own vs/alternatives cluster, read from its catalogue.
  for (const path of nurturingClusterPaths()) {
    STATIC_SEO_PATHS.push({ path, priority: path.split("/").length > 3 ? 0.7 : 0.8 });
  }

  // The Signup Automation and User Acquisition Agency pages' own vs/alternatives clusters.
  for (const path of [...signupClusterPaths(), ...uaClusterPaths()]) {
    STATIC_SEO_PATHS.push({ path, priority: path.split("/").length > 3 ? 0.7 : 0.8 });
  }

  // The Cold Email Agency page's own vs/alternatives cluster, read from its catalogue.
  for (const path of coldEmailClusterPaths()) {
    STATIC_SEO_PATHS.push({ path, priority: path.split("/").length > 3 ? 0.7 : 0.8 });
  }

  // The "best X for Y" cluster, read from its own catalogue for the same reason.
  for (const path of bestForPaths()) {
    STATIC_SEO_PATHS.push({ path, priority: 0.8 });
  }

  staticEntries.push(
    ...STATIC_SEO_PATHS.map((e) => ({
      url: `${baseUrl}${e.path}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: e.priority,
    })),
  );

  // The fleet indexes, read from the served list (a new index is listed without an
  // edit here). They move every day; a failed read lists the hub alone.
  const indexes = await fetchIndexList();
  // lastModified = the day the index last recorded a value (a crawler trusts a true date).
  const indexEntries = [
    { path: "/indexes", day: null as string | null },
    ...(indexes?.indexes ?? []).map((i) => ({ path: `/indexes/${i.slug}`, day: i.day })),
  ];
  staticEntries.push(
    ...indexEntries.map(({ path, day }) => ({
      url: `${baseUrl}${path}`,
      lastModified: day ? new Date(`${day}T00:00:00Z`) : new Date(),
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  );

  // The developer docs (moved from docs.distribute.you), read from their one route list.
  staticEntries.push(
    ...DOCS_ROUTES.map((route) => ({
      url: docsUrl(route.path),
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: route.path === "/" ? 0.8 : 0.6,
    })),
  );

  const articleEntries: MetadataRoute.Sitemap = articles.map((a) => ({
    url: `${baseUrl}/blog/${a.slug}`,
    lastModified: new Date(a.updatedAt),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticEntries, ...articleEntries];
}
