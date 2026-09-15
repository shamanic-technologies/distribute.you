import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { ARCHIVE_ROUTE_PREFIX, archiveFor } from "@/lib/archive-catalogue";
import { clonePathFor, contentTypeFor, originPathFor, withinRoot } from "@/lib/clone-files";

/**
 * Serves one file of an archived landing of OURS, verbatim.
 *
 * Reached only through the host rewrite in `src/proxy.ts`, which has already resolved the
 * slug against the catalogue and checked the password. The segment is `internal-archive`
 * rather than `_archive` because a leading underscore is a PRIVATE folder in the app
 * router — it is excluded from routing entirely, so the rewrite would fall through to the
 * 404 page — and the proxy 404s this prefix on every host that is not an archive, which
 * is what keeps an addressable path from being a password-free door.
 *
 * The response body is the archived bytes and nothing else. No token substitution, no
 * analytics injection, no JSON-LD rewrite: every rewrite the negotiated-page helper does
 * for the LIVE pages is exactly what must not happen to a page from a date that is over.
 * What the handler did that day was replayed ONCE, at capture time, by
 * `scripts/capture-archive.mjs` — see the `departures` on the catalogue entry.
 *
 * The path helpers are the clones' (`src/lib/clone-files.ts`): they answer a question
 * about paths, not about competitors, and a second copy is a second place for the reader
 * and the writer to disagree about where a file lives.
 */

export const dynamic = "force-dynamic";

/**
 * Where the archives live at runtime. The standalone server runs from the repo root
 * inside the image (`node apps/landing/server.js`), while `next dev` runs from this
 * package — so the directory is one path in production and another in development.
 * Resolved once, and it THROWS when neither exists: an archive host that silently 404s
 * everything reads as a broken capture rather than as a missing COPY line in the
 * Dockerfile.
 */
let archivesRootPromise: Promise<string> | null = null;

async function archivesRoot(): Promise<string> {
  archivesRootPromise ??= (async () => {
    const candidates = [
      path.join(process.cwd(), "archives"),
      path.join(process.cwd(), "apps", "landing", "archives"),
    ];
    for (const candidate of candidates) {
      try {
        await access(candidate, constants.R_OK);
        return candidate;
      } catch {
        // try the next one
      }
    }
    throw new Error(
      `[landing] archives directory not found. Looked in: ${candidates.join(", ")}. ` +
        "In the container it is copied by apps/landing/Dockerfile.",
    );
  })();
  return archivesRootPromise;
}

const NOT_FOUND_HEADERS = {
  "content-type": "text/plain; charset=utf-8",
  "x-robots-tag": "noindex, nofollow",
  "cache-control": "no-store",
} as const;

async function readArchive(
  slug: string,
  pathname: string,
  search: string,
): Promise<{ body: Buffer; file: string } | null> {
  if (archiveFor(slug) === null) return null;

  const root = path.join(await archivesRoot(), slug);

  // The plain form is tried after the query-bearing one so a utm tail on a shared link
  // still serves the page rather than 404ing. Unlike a competitor capture, nothing here
  // is stored per query — our own pages never answered differently for one — so in
  // practice the second candidate is the one that resolves.
  const candidates = [clonePathFor(pathname, search), search ? clonePathFor(pathname) : null];

  for (const relative of candidates) {
    if (relative === null) continue;
    const file = path.join(root, relative);
    if (!withinRoot(root, file)) continue;
    try {
      return { body: await readFile(file), file };
    } catch {
      // try the next candidate
    }
  }

  return null;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string; path?: string[] }> },
) {
  const { slug } = await context.params;
  const url = new URL(request.url);

  const pathname = originPathFor(url.pathname, ARCHIVE_ROUTE_PREFIX, slug);

  const found = await readArchive(slug, pathname, url.search);
  if (found === null) {
    return new Response("Not found in this archive.", { status: 404, headers: NOT_FOUND_HEADERS });
  }

  return new Response(new Uint8Array(found.body), {
    headers: {
      "content-type": contentTypeFor(found.file),
      // An archive states claims we have since retired, under our own domain. It is never
      // indexable, and it is never shared-cacheable: the password is per request.
      "x-robots-tag": "noindex, nofollow",
      "cache-control": "no-store",
    },
  });
}

export async function HEAD(
  request: Request,
  context: { params: Promise<{ slug: string; path?: string[] }> },
) {
  const response = await GET(request, context);
  return new Response(null, { status: response.status, headers: response.headers });
}
