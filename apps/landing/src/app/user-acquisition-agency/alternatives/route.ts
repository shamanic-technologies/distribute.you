import { renderedResponse } from "@/lib/static-html";
import { renderUaAlternativesPage } from "@/lib/pages/user-acquisition-agency-compare";

export const revalidate = 86400;

export async function GET(request: Request) {
  return renderedResponse(renderUaAlternativesPage(), request, { canonicalPath: "/user-acquisition-agency/alternatives" });
}
