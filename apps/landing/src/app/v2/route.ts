import { staticResponse } from "@/lib/static-html";

export const revalidate = 300;

export function GET() {
  return staticResponse("v2.html");
}
