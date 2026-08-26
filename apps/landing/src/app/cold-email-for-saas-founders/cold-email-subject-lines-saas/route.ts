import { staticResponse } from "@/lib/static-html";

export const revalidate = 86400;

export function GET(request: Request) {
  return staticResponse("cold-email-for-saas-founders/cold-email-subject-lines-saas.html", request);
}
