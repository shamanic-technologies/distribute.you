import { renderedResponse } from "@/lib/static-html";
import { renderSignupAlternativesPage } from "@/lib/pages/signup-automation-compare";

export const revalidate = 86400;

export async function GET(request: Request) {
  return renderedResponse(renderSignupAlternativesPage(), request, { canonicalPath: "/signup-automation/alternatives" });
}
