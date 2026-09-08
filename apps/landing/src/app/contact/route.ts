import { renderedResponse } from "@/lib/static-html";
import { renderContactPage } from "@/lib/pages/contact";

export const revalidate = 86400;

export async function GET(request: Request) {
  return renderedResponse(renderContactPage(), request);
}
