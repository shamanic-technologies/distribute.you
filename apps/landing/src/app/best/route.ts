import { renderedResponse } from "@/lib/static-html";
import { renderBestForHub } from "@/lib/best-for-page";

export const revalidate = 86400;

export function GET(request: Request) {
  return renderedResponse(renderBestForHub(), request, { canonicalPath: "/best" });
}
