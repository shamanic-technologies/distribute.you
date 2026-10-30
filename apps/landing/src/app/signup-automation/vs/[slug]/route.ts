import { renderedResponse } from "@/lib/static-html";
import { renderNotFoundPage } from "@/lib/pages/not-found";
import { renderSignupVsPage } from "@/lib/pages/signup-automation-compare";
import { SIGNUP_TOOLS, signupToolBySlug, signupVsPath } from "@/lib/signup-tools";

export const revalidate = 86400;
export const dynamicParams = true;

export function generateStaticParams() {
  return SIGNUP_TOOLS.map((t) => ({ slug: t.slug }));
}

/** One page per tool in the signup automation cluster; any other slug is the ordinary 404. */
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const tool = signupToolBySlug(slug);
  if (!tool) {
    return renderedResponse(renderNotFoundPage(), request, { status: 404, canonicalPath: "/404" });
  }
  return renderedResponse(renderSignupVsPage(tool), request, { canonicalPath: signupVsPath(tool) });
}
