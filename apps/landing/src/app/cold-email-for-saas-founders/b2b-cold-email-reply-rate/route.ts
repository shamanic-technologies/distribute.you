import { staticV2Response } from "@/lib/static-v2-html";

export const revalidate = 300;

export function GET() {
  return staticV2Response("cold-email-for-saas-founders/b2b-cold-email-reply-rate.html");
}
