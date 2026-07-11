import { NextResponse } from "next/server";

// The standalone /how-it-works page was retired — the homepage "How it works"
// section (/#how) is the live source. 308-redirect so inbound links + the SEO
// history land on the section instead of an outdated page.
export function GET(request: Request) {
  return NextResponse.redirect(new URL("/#how", request.url), 308);
}
