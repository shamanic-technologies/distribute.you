import { staticResponse } from "@/lib/static-html";

export const revalidate = 300;

export function GET() {
  return staticResponse("cold-email-cost-guide/cold-email-cost-per-contact.html");
}
