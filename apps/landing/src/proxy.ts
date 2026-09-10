import { NextResponse, type NextRequest } from "next/server";

import { basicAuthOk } from "@/lib/clone-auth";
import { previewArticleSlugFor } from "@/lib/blog/preview";
import { CLONE_ROUTE_PREFIX, cloneSlugForHost } from "@/lib/clone-catalogue";

/**
 * Host routing for the competitor clones, and NOTHING else.
 *
 * `lab-<slug>.distribute.you` serves a mirrored competitor landing from
 * `apps/landing/clones/<slug>/` (see src/lib/clone-catalogue.ts). Serving each clone at
 * the ROOT of its own host is what makes the mirror faithful without editing a byte: a
 * captured page is full of root-absolute references (`/_next/static/…`, `/css/site.css`,
 * `url(/img/hero.png)`), and they resolve on a subdomain exactly as they did on the
 * origin. Under a path prefix every one of them would have to be rewritten, which is a
 * change to bytes we deliberately have not read.
 *
 * ⚠️ The FIRST statement is the exit for every ordinary landing request. This file runs
 * on every request the app serves — there is no `config.matcher`, because a clone host
 * legitimately needs `/_next/*` and any matcher that excludes static paths would exclude
 * the clone's own assets. So the cost on distribute.you must stay at one host comparison,
 * and no work of any kind may be added above that check.
 */
export default function proxy(request: NextRequest) {
  const slug = cloneSlugForHost(request.headers.get("host"));
  if (slug === null) return offCloneHost(request);

  // Before the password, because a crawler that reaches the host without credentials
  // must still be told to stay away — a 401 says nothing about indexing, and the whole
  // point is that a competitor's copy under our domain never enters an index.
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
        "www-authenticate": 'Basic realm="distribute clones", charset="UTF-8"',
        "x-robots-tag": "noindex, nofollow",
        "cache-control": "no-store",
      },
    });
  }

  const url = request.nextUrl.clone();
  // The trailing slash is dropped because the app router redirects `/a/b/` to `/a/b`, and
  // a 308 in the middle of a rewrite loses the clone. Nothing is lost by it: the reader
  // maps `/pricing` and `/pricing/` onto the same file.
  url.pathname =
    `${CLONE_ROUTE_PREFIX}/${slug}${request.nextUrl.pathname}`.replace(/\/+$/, "") ||
    `${CLONE_ROUTE_PREFIX}/${slug}`;
  return NextResponse.rewrite(url);
}

/**
 * Every request that is NOT for a clone host, which is all of distribute.you.
 *
 * The one thing it does is close the internal route: the segment the rewrite targets has
 * to be routable, so it is also addressable, and reaching it directly would serve a
 * competitor's copy with no password in front of it.
 */
function offCloneHost(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith(CLONE_ROUTE_PREFIX)) {
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
