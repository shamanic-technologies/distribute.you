import { renderedResponse } from "@/lib/static-html";
import { renderDevelopersPage } from "@/lib/pages/developers";

export const revalidate = 86400;

export async function GET(request: Request) {
  return renderedResponse(renderDevelopersPage(), request);
}
