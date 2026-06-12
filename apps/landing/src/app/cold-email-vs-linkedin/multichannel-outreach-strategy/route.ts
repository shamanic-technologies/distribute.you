import { staticResponse } from "@/lib/static-html";

export const revalidate = 300;

export function GET() {
  return staticResponse("cold-email-vs-linkedin/multichannel-outreach-strategy.html");
}
