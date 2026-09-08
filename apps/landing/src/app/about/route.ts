import { renderedResponse } from "@/lib/static-html";
import { renderAboutPage } from "@/lib/pages/about";

export const revalidate = 86400;

export async function GET(request: Request) {
  return renderedResponse(renderAboutPage(), request);
}
