import { NextResponse, type NextRequest } from "next/server";

import { ARCHIVE_ROUTE_PREFIX, archiveSlugForHost } from "@/lib/archive-catalogue";
import { basicAuthOk } from "@/lib/clone-auth";
import { previewArticleSlugFor } from "@/lib/blog/preview";
import { CLONE_ROUTE_PREFIX, cloneSlugForHost } from "@/lib/clone-catalogue";

/**
 * Host routing for the `lab-*` pages, and NOTHING else.
 *
 * Two catalogues answer on that host family and they serve the same kind of thing — a
 * page frozen as it was, read against rather than described. `lab-<slug>.distribute.you`
 * is a mirrored competitor landing from `apps/landing/clones/<slug>/`
 * (src/lib/clone-catalogue.ts) or one of OUR past landings from
 * `apps/landing/archives/<slug>/` (src/lib/archive-catalogue.ts). Serving each at the
 * ROOT of its own host is what makes the copy faithful without editing a byte: a captured
 * page is full of root-absolute references (`/_next/static/…`, `/css/site.css`,
 * `url(/img/hero.png)`), and they resolve on a subdomain exactly as they did on the
 * origin. Under a path prefix every one of them would have to be rewritten, which is a
 * change to bytes we deliberately have not read.
 *
 * ⚠️ The FIRST statements are the exit for every ordinary landing request. This file runs
 * on every request the app serves — there is no `config.matcher`, because a lab host
 * legitimately needs `/_next/*` and any matcher that excludes static paths would exclude
 * its own assets. So the cost on distribute.you must stay at the two host comparisons
 * below — both bail on the same `lab-` prefix check — and no work of any kind may be
 * added above them.
 */
export default function proxy(request: NextRequest) {
  const host = request.headers.get("host");

  const clone = cloneSlugForHost(host);
  if (clone !== null) return serveLab(request, `${CLONE_ROUTE_PREFIX}/${clone}`, "distribute clones");

  const archive = archiveSlugForHost(host);
  if (archive !== null) {
    return serveLab(request, `${ARCHIVE_ROUTE_PREFIX}/${archive}`, "distribute archives");
  }

  return offLabHost(request);
}

/**
 * The gate every lab host goes through, whichever catalogue resolved it.
 *
 * One implementation rather than one per catalogue: the password, the crawler refusal and
 * the rewrite are properties of being a lab host, so a second copy is a second place for
 * one of them to be forgotten — and the one that would be forgotten is the password.
 */
function serveLab(request: NextRequest, internalPrefix: string, realm: string) {
  // Before the password, because a crawler that reaches the host without credentials
  // must still be told to stay away — a 401 says nothing about indexing, and the whole
  // point is that neither a competitor's copy nor a claim we have retired ever enters an
  // index under our domain.
  if (request.nextUrl.pathname === "/robots.txt") {
    return new NextResponse("User-agent: *\nDisallow: /\n", {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "x-robots-tag": "noindex, nofollow",
        "cache-control": "no-store",
      },
    });
  }

  if (!basicAuthOk(request.headers.get("authorization"), process.env.CLONE_BASIC_AUTH)) {
    return new NextResponse("Authentication required.", {
      status: 401,
      headers: {
        "www-authenticate": `Basic realm="${realm}", charset="UTF-8"`,
        "x-robots-tag": "noindex, nofollow",
        "cache-control": "no-store",
      },
    });
  }

  const url = request.nextUrl.clone();
  // The trailing slash is dropped because the app router redirects `/a/b/` to `/a/b`, and
  // a 308 in the middle of a rewrite loses the page. Nothing is lost by it: the reader
  // maps `/pricing` and `/pricing/` onto the same file.
  url.pathname = `${internalPrefix}${request.nextUrl.pathname}`.replace(/\/+$/, "") || internalPrefix;
  return NextResponse.rewrite(url);
}

/**
 * Every request that is NOT for a lab host, which is all of distribute.you.
 *
 * The one thing it does is close the internal routes: a segment the rewrite targets has
 * to be routable, so it is also addressable, and reaching one directly would serve a
 * competitor's copy — or a retired claim of ours — with no password in front of it.
 */
function offLabHost(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith(CLONE_ROUTE_PREFIX) || pathname.startsWith(ARCHIVE_ROUTE_PREFIX)) {
    return new NextResponse("Not found.", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  // A blog article under review sits in the DB so the real page renders it, and behind
  // the lab password so nobody outside reads it before the owner does. Same secret as
  // the clones; an unset one locks the article rather than opening it. The response is
  // never cached (a gate in front of a cached body is no gate) and never indexed.
  if (previewArticleSlugFor(pathname) !== null) {
    if (!basicAuthOk(request.headers.get("authorization"), process.env.CLONE_BASIC_AUTH)) {
      return new NextResponse("Authentication required.", {
        status: 401,
        headers: {
          "www-authenticate": 'Basic realm="distribute preview", charset="UTF-8"',
          "x-robots-tag": "noindex, nofollow",
          "cache-control": "no-store",
        },
      });
    }
    return NextResponse.next({
      headers: { "x-robots-tag": "noindex, nofollow", "cache-control": "private, no-store" },
    });
  }
  return NextResponse.next();
}
