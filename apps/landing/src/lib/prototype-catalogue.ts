/**
 * Landing PROTOTYPES of ours: a page under design, shown to the owner before it is live.
 *
 * The two lab catalogues next door hold photographs (a competitor's page, a past page of
 * ours) and neither may carry work in progress: a clone is somebody else's bytes, an
 * archive is rebuilt from a commit. A prototype is hand-written, changes freely, and
 * lives at `apps/landing/prototypes/<slug>/`, served at the ROOT of
 * `lab-<slug>.distribute.you` behind the same password and `noindex` as every lab host.
 *
 * Nothing links to a prototype and the live landing does not know it exists. Promoting
 * one means rebuilding it under `public/landing/` through `staticResponse()` (analytics,
 * canonical, live figures), never pointing a live route here.
 */
export type Prototype = {
  /** Directory under `apps/landing/prototypes/`, and the `lab-<slug>` half of the host. */
  readonly slug: string;
  /** One line on what is being tried. */
  readonly note: string;
};

export const PROTOTYPES: readonly Prototype[] = [
  {
    slug: "distry",
    note: "The homepage redrawn in the world of Distry, our AI teammate: night to morning, hand-painted scenes.",
  },
];

/** The internal path `src/proxy.ts` rewrites a prototype request onto. */
export const PROTOTYPE_ROUTE_PREFIX = "/internal-prototype";

export const PROTOTYPE_HOST_PREFIX = "lab-";
export const PROTOTYPE_HOST_SUFFIX = ".distribute.you";

/**
 * The prototype a request's Host belongs to, or null for every other request. Resolved
 * against the catalogue, so a made-up `lab-anything` never reaches a directory read.
 */
export function prototypeSlugForHost(host: string | null | undefined): string | null {
  if (!host) return null;
  const hostname = host.split(":")[0].trim().toLowerCase();
  // `lab-<slug>.localhost` resolves to this machine in a browser: the render check, never production.
  if (process.env.NODE_ENV !== "production" && hostname.endsWith(".localhost")) {
    const local = hostname.slice(PROTOTYPE_HOST_PREFIX.length, hostname.length - ".localhost".length);
    return PROTOTYPES.some((prototype) => prototype.slug === local) ? local : null;
  }
  if (!hostname.startsWith(PROTOTYPE_HOST_PREFIX) || !hostname.endsWith(PROTOTYPE_HOST_SUFFIX)) {
    return null;
  }
  const slug = hostname.slice(
    PROTOTYPE_HOST_PREFIX.length,
    hostname.length - PROTOTYPE_HOST_SUFFIX.length,
  );
  return PROTOTYPES.some((prototype) => prototype.slug === slug) ? slug : null;
}

export function prototypeFor(slug: string): Prototype | null {
  return PROTOTYPES.find((prototype) => prototype.slug === slug) ?? null;
}

/**
 * The byte range a `Range: bytes=a-b` header asks for, or null when the header is absent,
 * malformed or outside the file. Safari refuses to play a video whose server ignores
 * Range, so the prototype route answers 206 for it.
 */
export function byteRangeFor(header: string | null, size: number): { start: number; end: number } | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (match[1] === "" && match[2] === "")) return null;
  let start: number;
  let end: number;
  if (match[1] === "") {
    const suffix = Number(match[2]);
    if (suffix === 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
  }
  if (start > end || start >= size) return null;
  return { start, end };
}
