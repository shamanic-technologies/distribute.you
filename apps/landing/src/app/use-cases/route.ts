import { staticResponse } from "@/lib/static-html";

export const revalidate = 300;

export function GET() {
  return staticResponse("use-cases.html");
}
