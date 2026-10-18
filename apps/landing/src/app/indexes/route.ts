import { renderedResponse } from "@/lib/static-html";
import { INDEX_REVALIDATE_SECONDS, fetchIndexDetail, fetchIndexList, type IndexPoint } from "@/lib/fleet-indexes";
import { renderIndexListPage } from "@/lib/pages/indexes";

// Literal (Next reads it statically); equals INDEX_REVALIDATE_SECONDS.
export const revalidate = 1800;

/**
 * Every fleet index with today's value and its days so far, read through the gateway.
 * A failed list read renders the page with a "could not be read" block; a failed
 * series read only drops that row's sparkline.
 */
export async function GET(request: Request) {
  const list = await fetchIndexList();
  const series = new Map<string, IndexPoint[]>();
  if (list) {
    const details = await Promise.all(list.indexes.map((i) => fetchIndexDetail(i.slug)));
    details.forEach((d, n) => {
      if (d && d !== "not_found") series.set(list.indexes[n].slug, d.points);
    });
  }
  return renderedResponse(renderIndexListPage(list, series), request, {
    canonicalPath: "/indexes",
    sMaxAge: list ? INDEX_REVALIDATE_SECONDS : 60,
  });
}
