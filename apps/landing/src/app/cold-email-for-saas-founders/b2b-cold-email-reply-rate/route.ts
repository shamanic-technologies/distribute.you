import { staticResponse } from "@/lib/static-html";

export const revalidate = 300;

export function GET() {
  return staticResponse("cold-email-for-saas-founders/b2b-cold-email-reply-rate.html");
}
