import { renderedResponse } from "@/lib/static-html";
import { renderAlternativesPage } from "@/lib/compare-page";

export const revalidate = 86400;

export function GET(request: Request) {
  return renderedResponse(renderAlternativesPage(), request, { canonicalPath: "/alternatives" });
}
