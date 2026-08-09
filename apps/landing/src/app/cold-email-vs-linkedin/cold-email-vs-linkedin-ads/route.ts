import { staticResponse } from "@/lib/static-html";

export const revalidate = 86400;

export function GET() {
  return staticResponse("cold-email-vs-linkedin/cold-email-vs-linkedin-ads.html");
}
