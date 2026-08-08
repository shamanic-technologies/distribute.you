import { NextResponse } from "next/server";

// The standalone /how-it-works page was retired — the homepage "How it works"
// section (/#how) is the live source. 308-redirect so inbound links + the SEO
// history land on the section instead of an outdated page.
//
// The Location is RELATIVE on purpose. `NextResponse.redirect` demands an absolute
// URL, and the only origin a route handler can build one from is `request.url` —
// which on a self-hosted standalone server is the address the process BINDS to, not
// the address the visitor typed. Behind Caddy that made this route answer
// `Location: http://0.0.0.0:3000/#how`, a link to nowhere, while the same code on
// Vercel produced the public host and looked fine. A relative Location needs no
// origin at all: the browser resolves it against whatever host it asked.
export function GET() {
  return new NextResponse(null, { status: 308, headers: { Location: "/#how" } });
}
