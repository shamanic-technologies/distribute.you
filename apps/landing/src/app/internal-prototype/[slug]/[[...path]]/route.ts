import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { clonePathFor, contentTypeFor, originPathFor, withinRoot } from "@/lib/clone-files";
import { PROTOTYPE_ROUTE_PREFIX, byteRangeFor, prototypeFor } from "@/lib/prototype-catalogue";

/**
 * Serves one file of a landing PROTOTYPE of ours (`apps/landing/prototypes/<slug>/`).
 *
 * Reached only through the host rewrite in `src/proxy.ts`, which has already resolved the
 * slug against the catalogue and checked the lab password; the proxy 404s this prefix on
 * every other host. The body is the file on disk and nothing else: a prototype is not a
 * live page, so it gets no analytics, no canonical and no live figures.
 *
 * The path helpers are the clones' (`src/lib/clone-files.ts`): they answer a question
 * about paths, and a second copy is a second place to get traversal wrong.
 */

export const dynamic = "force-dynamic";

let prototypesRootPromise: Promise<string> | null = null;

/** One path under `next dev`, another in the standalone image; throws when neither exists. */
async function prototypesRoot(): Promise<string> {
  prototypesRootPromise ??= (async () => {
    const candidates = [
      path.join(process.cwd(), "prototypes"),
      path.join(process.cwd(), "apps", "landing", "prototypes"),
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
      `[landing] prototypes directory not found. Looked in: ${candidates.join(", ")}. ` +
        "In the container it is copied by apps/landing/Dockerfile.",
    );
  })();
  return prototypesRootPromise;
}

const BASE_HEADERS = {
  "x-robots-tag": "noindex, nofollow",
  // The password is per request, so a prototype is never shared-cacheable.
  "cache-control": "no-store",
} as const;

async function readPrototype(slug: string, pathname: string): Promise<{ body: Buffer; file: string } | null> {
  if (prototypeFor(slug) === null) return null;
  const root = path.join(await prototypesRoot(), slug);
  const relative = clonePathFor(pathname);
  if (relative === null) return null;
  const file = path.join(root, relative);
  if (!withinRoot(root, file)) return null;
  try {
    return { body: await readFile(file), file };
  } catch {
    return null;
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string; path?: string[] }> },
) {
  const { slug } = await context.params;
  const url = new URL(request.url);
  const pathname = originPathFor(url.pathname, PROTOTYPE_ROUTE_PREFIX, slug);

  const found = await readPrototype(slug, pathname);
  if (found === null) {
    return new Response("Not found in this prototype.", {
      status: 404,
      headers: { ...BASE_HEADERS, "content-type": "text/plain; charset=utf-8" },
    });
  }

  const headers = { ...BASE_HEADERS, "content-type": contentTypeFor(found.file), "accept-ranges": "bytes" };
  const size = found.body.length;
  const range = byteRangeFor(request.headers.get("range"), size);
  if (range !== null) {
    return new Response(new Uint8Array(found.body.subarray(range.start, range.end + 1)), {
      status: 206,
      headers: { ...headers, "content-range": `bytes ${range.start}-${range.end}/${size}` },
    });
  }
  return new Response(new Uint8Array(found.body), { headers });
}

export async function HEAD(
  request: Request,
  context: { params: Promise<{ slug: string; path?: string[] }> },
) {
  const response = await GET(request, context);
  return new Response(null, { status: response.status, headers: response.headers });
}
