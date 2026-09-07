import { renderedResponse } from "@/lib/static-html";
import { renderCompareHub } from "@/lib/compare-page";

export const revalidate = 86400;

export function GET(request: Request) {
  return renderedResponse(renderCompareHub(), request, { canonicalPath: "/compare" });
}
