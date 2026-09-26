import { constants } from "node:fs";
import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import {
  CLONE_ROUTE_PREFIX,
  ACTIONS_FILE,
  REDIRECTS_FILE,
  SITES_DIR,
  cloneFor,
  cloneTargetForHost,
} from "@/lib/clone-catalogue";
import {
  clonePathFor,
  contentTypeFor,
  originPathFor,
  isRscCacheBusterOnly,
  pickRscVariant,
  pickStoredVariant,
  withinRoot,
} from "@/lib/clone-files";

/**
 * Serves one file of a mirrored competitor landing, verbatim.
 *
 * Reached only through the host rewrite in `src/proxy.ts`, which has already resolved the
 * slug against the catalogue and checked the password. The segment is `internal-clone`
 * rather than `_clone` because a leading underscore is a PRIVATE folder in the app router
 * — it is excluded from routing entirely, so the rewrite fell through to the 404 page —
 * and the proxy 404s this prefix on every host that is not a clone, which is what keeps
 * an addressable path from being a second, password-free door.
 *
 * The response body is the origin's bytes and nothing else. No token substitution, no
 * analytics injection, no JSON-LD rewrite: every rewrite the negotiated-page helper does
 * for OUR pages is exactly what must NOT happen here while a clone is still a copy.
 */

export const dynamic = "force-dynamic";

/**
 * Where the clones live at runtime. The standalone server runs from the repo root inside
 * the image (`node apps/landing/server.js`), while `next dev` runs from this package —
 * so the directory is one path in production and another in development. Resolved once,
 * and it THROWS when neither exists: a clone host that silently 404s everything reads as
 * a broken capture rather than as a missing COPY line in the Dockerfile.
 */
let clonesRootPromise: Promise<string> | null = null;

async function clonesRoot(): Promise<string> {
  clonesRootPromise ??= (async () => {
    const candidates = [
      path.join(process.cwd(), "clones"),
      path.join(process.cwd(), "apps", "landing", "clones"),
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
      `[landing] clones directory not found. Looked in: ${candidates.join(", ")}. ` +
        "In the container it is copied by apps/landing/Dockerfile.",
    );
  })();
  return clonesRootPromise;
}

const NOT_FOUND_HEADERS = {
  "content-type": "text/plain; charset=utf-8",
  "x-robots-tag": "noindex, nofollow",
  "cache-control": "no-store",
} as const;

/**
 * The directory a request reads from: the clone's root for the landing host, its
 * `__sites/<label>/` for one of its onboarding hosts. Resolved from the Host header
 * against the catalogue — the proxy already checked it, and a host whose slug disagrees
 * with the rewritten segment is refused rather than served from the wrong root.
 */
async function rootFor(slug: string, host: string | null): Promise<string | null> {
  if (cloneFor(slug) === null) return null;
  const base = path.join(await clonesRoot(), slug);
  const target = cloneTargetForHost(host);
  // A request with no clone host is the internal path asked for directly, which the proxy
  // only lets through on a clone host; serve the landing root as before.
  if (target === null) return base;
  if (target.slug !== slug) return null;
  return target.site === null ? base : path.join(base, SITES_DIR, target.site);
}

/**
 * A redirect the origin answered for this path, replayed. Consulted only when no file
 * matched, so a captured page always wins over a recorded hop.
 */
async function recordedRedirect(root: string, pathname: string): Promise<{ status: number; location: string } | null> {
  let records: Record<string, { status: number; location: string }>;
  try {
    records = JSON.parse(await readFile(path.join(root, REDIRECTS_FILE), "utf8"));
  } catch {
    return null;
  }
  const key = pathname.replace(/\/+$/, "") || "/";
  const record = records[key];
  if (!record || record.status < 300 || record.status >= 400 || typeof record.location !== "string") return null;
  return record;
}

async function readClone(
  root: string,
  pathname: string,
  search: string,
  accept: string | null,
): Promise<{ body: Buffer; file: string } | null> {
  // The landing root holds its sites and the redirect records; neither is a page of it.
  const first = pathname.split("/").filter(Boolean)[0] ?? "";
  if (first === SITES_DIR || first === REDIRECTS_FILE || first === ACTIONS_FILE) return null;

  // A query-bearing URL is stored beside its plain form, because the origin generates a
  // different response per query (`/_next/image?w=96` and `?w=48` are two pictures). The
  // plain form is tried second so a query the origin ignored — a utm tail on a shared
  // link — still serves the page rather than 404ing.
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

  // A query-bearing url whose path carries no extension — `/_next/image?w=256` is the
  // one that matters — is stored with an extension taken from what the origin ANSWERED,
  // which the request cannot name. So the last resort lists the directory and picks the
  // variant this caller's `Accept` asks for, exactly as the origin negotiated it.
  const stemRelative = candidates[0];
  if (search && stemRelative !== null) {
    const directory = path.join(root, path.dirname(stemRelative));
    if (withinRoot(root, directory)) {
      try {
        const names = await readdir(directory);
        const picked = pickStoredVariant(names, path.basename(stemRelative), accept);
        if (picked !== null) {
          const file = path.join(directory, picked);
          if (withinRoot(root, file)) return { body: await readFile(file), file };
        }
      } catch {
        // the directory does not exist — an ordinary miss
      }
    }
  }

  // A Next router payload asked for under a cache-buster the capture never saw: the bytes
  // are the same for every `_rsc` value, so any stored variant answers it.
  const plainRelative = candidates[1];
  if (isRscCacheBusterOnly(search) && plainRelative !== null) {
    const directory = path.join(root, path.dirname(plainRelative));
    if (withinRoot(root, directory)) {
      try {
        const picked = pickRscVariant(await readdir(directory), path.basename(plainRelative));
        if (picked !== null) {
          const file = path.join(directory, picked);
          if (withinRoot(root, file)) return { body: await readFile(file), file };
        }
      } catch {
        // the directory does not exist — an ordinary miss
      }
    }
  }

  return null;
}

export async function GET(request: Request, context: { params: Promise<{ slug: string; path?: string[] }> }) {
  const { slug } = await context.params;
  const url = new URL(request.url);

  const pathname = originPathFor(url.pathname, CLONE_ROUTE_PREFIX, slug);

  const root = await rootFor(slug, request.headers.get("host"));
  if (root === null) {
    return new Response("Not found in this clone.", { status: 404, headers: NOT_FOUND_HEADERS });
  }

  const found = await readClone(root, pathname, url.search, request.headers.get("accept"));
  if (found === null) {
    const redirect = await recordedRedirect(root, pathname);
    if (redirect !== null) {
      return new Response(null, {
        status: redirect.status,
        headers: { location: redirect.location, "x-robots-tag": "noindex, nofollow", "cache-control": "no-store" },
      });
    }
    return new Response("Not found in this clone.", { status: 404, headers: NOT_FOUND_HEADERS });
  }

  return new Response(new Uint8Array(found.body), {
    headers: {
      "content-type": contentTypeFor(found.file),
      // A clone carries a competitor's copy and their logo under our domain. It is never
      // indexable, and it is never shared-cacheable: the password is per request.
      "x-robots-tag": "noindex, nofollow",
      "cache-control": "no-store",
    },
  });
}

/**
 * A Next server action the origin answered, replayed.
 *
 * Some landings start their sign-in with a server action rather than a link (explee's
 * "Sign in" POSTs to `/` and is answered with an `x-action-redirect` to its identity
 * provider). A static copy cannot run it, so the capture RECORDS the answer, keyed by the
 * action id the browser sends in `next-action`, and this replays it with the redirect
 * already pointed at our copy of the provider. Only a recorded id answers; anything else
 * is the same 404 a GET miss gets, and nothing is ever executed.
 */
export async function POST(request: Request, context: { params: Promise<{ slug: string; path?: string[] }> }) {
  const { slug } = await context.params;
  const root = await rootFor(slug, request.headers.get("host"));
  const actionId = request.headers.get("next-action");
  if (root !== null && actionId) {
    try {
      const actions = JSON.parse(await readFile(path.join(root, ACTIONS_FILE), "utf8")) as Record<
        string,
        { status: number; headers: Record<string, string>; body: string }
      >;
      const recorded = actions[actionId];
      if (recorded) {
        return new Response(recorded.body, {
          status: recorded.status,
          headers: { ...recorded.headers, "x-robots-tag": "noindex, nofollow", "cache-control": "no-store" },
        });
      }
    } catch {
      // no recorded actions for this root — an ordinary miss
    }
  }
  return new Response("Not found in this clone.", { status: 404, headers: NOT_FOUND_HEADERS });
}

export async function HEAD(request: Request, context: { params: Promise<{ slug: string; path?: string[] }> }) {
  const response = await GET(request, context);
  return new Response(null, { status: response.status, headers: response.headers });
}
