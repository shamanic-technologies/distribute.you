import { staticV2Response } from "@/lib/static-v2-html";

export const revalidate = 300;

export function GET() {
  return staticV2Response("cold-email-vs-linkedin/b2b-outbound-channel-comparison.html");
}
