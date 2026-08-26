import { staticResponse } from "@/lib/static-html";

export const revalidate = 86400;

export function GET(request: Request) {
  return staticResponse("cold-email-cost-guide/linkedin-inmail-cost-vs-cold-email.html", request);
}
