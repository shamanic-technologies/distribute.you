import onboardingData from "./clone-onboarding.json";

/**
 * The competitor landings we mirror, one entry per clone.
 *
 * These exist to be COPIED, not to be published: each one is served byte-for-byte as
 * its origin served it, logo included, so that a design conversation can happen against
 * the real thing rather than a description of it. Nothing about a clone is ours until
 * someone deliberately makes it ours, which is what `brandised` records.
 *
 * Two properties are load-bearing and enforced by `tests/unit/clone-serving.test.ts`:
 * a clone is reachable ONLY through the host named here (so nothing is discoverable by
 * guessing a path on distribute.you), and every entry has files on disk (so a host that
 * resolves cannot 404 its way through the whole site).
 */
export type Clone = {
  /** Directory under `apps/landing/clones/`, and the `lab-<slug>` half of the host. */
  readonly slug: string;
  /** The page this was taken from, verbatim, so a re-capture cannot drift. */
  readonly source: string;
  /** When it was captured. A clone is a photograph; the origin moves on. */
  readonly capturedAt: string;
  /**
   * FALSE means the bytes are still exactly the origin's, which is what every clone
   * starts as. Flip it when a clone stops being a copy and starts being ours — it is
   * what a future change reads before injecting anything of our own (analytics, CTAs,
   * our own marks), so that "identical at t=0" stays true by construction.
   */
  readonly brandised: boolean;
  /**
   * Third-party hosts whose assets were RAPATRIATED into `__external/<host>/…` and whose
   * references were rewritten to point there (`scripts/localise-clone.mjs`).
   *
   * Empty means the clone is a pure copy: every byte is the origin's and any cross-origin
   * asset still loads from wherever it always did. Non-empty is the ONE sanctioned
   * exception to leaving the bytes alone, and it exists because some sites host nothing
   * themselves — a Framer page keeps every image, font and bundle on
   * `framerusercontent.com`, so a same-origin capture yields the HTML and nothing else and
   * the "clone" would render entirely out of somebody else's CDN.
   *
   * Only REFERENCES are rewritten, never content, and only for asset hosts: analytics, tag
   * managers and embedded players are left pointing at their origin. Stated here rather
   * than inferred, so a clone can never quietly claim to be more local than it is.
   */
  readonly localisedHosts: readonly string[];
};

/**
 * A competitor's ONBOARDING, as far as it goes without an account.
 *
 * The landing is the page a visitor reads; this is where its signup CTAs lead — sign-up
 * and sign-in pages, plan pickers, pricing — captured by `scripts/capture-onboarding.mjs`
 * from `clone-onboarding.json` (JSON so that plain-node script reads the same list the app
 * does). Nothing here is ever typed into or submitted: every step is a URL loaded as it
 * stands, and `wall` records where going further needs an account and what is visible
 * behind it, so the decision to take a logged-in capture is the owner's.
 */
export type OnboardingStep = {
  /** The URL loaded, verbatim. Its origin is the landing's or one of the clone's `sites`. */
  readonly url: string;
  /**
   * `bytes` (the default): the origin's bytes, served as-is, so the page runs.
   * `snapshot`: the DOM a browser rendered on the origin, scripts removed and injected
   * styles inlined — faithful to look at, inert to click. Used only where a third-party
   * widget refuses to render off its own domain (Clerk checks the Origin), and stated per
   * step so a snapshot never passes for a live copy.
   */
  readonly mode: "bytes" | "snapshot";
  /**
   * Button labels clicked, in order, after loading `url` — for a step that only exists
   * inside a session a click starts (explee's identity provider refuses its sign-in page
   * outside an OIDC request its landing begins). Clicking a button is as far as it goes:
   * nothing is typed, nothing is submitted.
   */
  readonly click?: readonly string[];
  /** Where the clicks land (the page stored), when it differs from `url`. */
  readonly lands?: string;
};

/**
 * Another ORIGIN the onboarding lives on (`app.gojiberry.ai`, `auth.explee.com`).
 *
 * Served at the root of its own host, `lab-<slug>-<label>.distribute.you`, from
 * `clones/<slug>/__sites/<label>/` — for the reason the landing is served at a root: its
 * root-absolute references (`/assets/main.js`) would collide with the landing's under a
 * shared host, and an app's router reads the path it is mounted at. References to the
 * origin anywhere in the clone are pointed at that host, which is the second sanctioned
 * rewrite of references (after `localisedHosts`) and recorded here for the same reason.
 * Each one is a hostname on the box's Caddy line and a proxied Cloudflare A record.
 */
export type CloneSite = { readonly label: string; readonly origin: string };

export type CloneOnboarding = {
  /** The landing's own origin; pinned equal to `new URL(source).origin` by the tests. */
  readonly origin: string;
  readonly sites: readonly CloneSite[];
  readonly steps: readonly OnboardingStep[];
  /** Where the capture stopped, and what lies behind it as far as it is visible. */
  readonly wall: string;
};

export const CLONE_ONBOARDING = onboardingData as unknown as Readonly<Record<string, CloneOnboarding>>;

/** Where a site's files live, relative to its clone's root. Mirrors `SITES_DIR` in scripts/capture-onboarding.mjs. */
export const SITES_DIR = "__sites";

/** Recorded redirect hops, one file per root. Mirrors `REDIRECTS_FILE` in scripts/capture-onboarding.mjs. */
export const REDIRECTS_FILE = "__redirects.json";

/** Recorded Next server-action answers, keyed by action id. Mirrors `ACTIONS_FILE` in scripts/capture-onboarding.mjs. */
export const ACTIONS_FILE = "__actions.json";

export const CLONES: readonly Clone[] = [
  { slug: "explee", source: "https://explee.com/", capturedAt: "2026-09-24", brandised: false, localisedHosts: [] },
  { slug: "revid", source: "https://www.revid.ai/", capturedAt: "2026-09-24", brandised: false, localisedHosts: [] },
  { slug: "outrank", source: "https://www.outrank.so/", capturedAt: "2026-09-24", brandised: false, localisedHosts: [] },
  { slug: "trustmrr", source: "https://trustmrr.com/", capturedAt: "2026-09-24", brandised: false, localisedHosts: [] },
  { slug: "origami", source: "https://origami.chat/", capturedAt: "2026-09-24", brandised: false, localisedHosts: [] },
  { slug: "oxygen", source: "https://oxygen-agent.com/", capturedAt: "2026-09-24", brandised: false, localisedHosts: [] },
  { slug: "graphed", source: "https://www.graphed.com/", capturedAt: "2026-09-24", brandised: false, localisedHosts: [] },
  {
    slug: "gojiberry",
    source: "https://gojiberry.ai/",
    capturedAt: "2026-09-24",
    brandised: false,
    // Framer: the origin serves the HTML and nothing else, so without this the clone is a
    // shell rendering out of framerusercontent.com. 509 assets rapatriated.
    localisedHosts: [
      "app.framerstatic.com",
      "assets.calendly.com",
      "files.tlt-cdn.com",
      "fonts.gstatic.com",
      "framer.com",
      "framerusercontent.com",
      "visitor.app.gojiberry.ai",
    ],
  },
];

/**
 * The internal path `src/proxy.ts` rewrites a clone request onto, and the app-router
 * segment that serves it.
 *
 * NOT `_clone`: a leading underscore marks a PRIVATE folder in the app router, so such a
 * segment is excluded from routing and every rewrite onto it falls through to the 404
 * page. Being routable means it is also addressable, which is why the proxy 404s this
 * prefix on any host that is not a clone — otherwise it would be a second door onto the
 * clones with no password on it.
 */
export const CLONE_ROUTE_PREFIX = "/internal-clone";

/** `lab-<slug>.distribute.you` — one level, so Universal SSL already covers it. */
export const CLONE_HOST_PREFIX = "lab-";
export const CLONE_HOST_SUFFIX = ".distribute.you";

/**
 * The clone a request's Host belongs to, or null for every ordinary landing request.
 *
 * Resolved against the CATALOGUE rather than against the filesystem: a host is an
 * allowlist entry, so a made-up `lab-anything` cannot reach a directory read.
 */
export function cloneSlugForHost(host: string | null | undefined): string | null {
  return cloneTargetForHost(host)?.slug ?? null;
}

/**
 * The clone AND the site a request's Host belongs to: `site` is null for the landing
 * (`lab-<slug>`) and the site's label for one of its onboarding hosts
 * (`lab-<slug>-<label>`). Both halves come from the catalogue, never from the string.
 */
export function cloneTargetForHost(
  host: string | null | undefined,
): { slug: string; site: string | null } | null {
  if (!host) return null;
  const hostname = host.split(":")[0].trim().toLowerCase();
  if (!hostname.startsWith(CLONE_HOST_PREFIX) || !hostname.endsWith(CLONE_HOST_SUFFIX)) return null;

  const name = hostname.slice(CLONE_HOST_PREFIX.length, hostname.length - CLONE_HOST_SUFFIX.length);
  if (CLONES.some((clone) => clone.slug === name)) return { slug: name, site: null };
  for (const clone of CLONES) {
    for (const site of CLONE_ONBOARDING[clone.slug]?.sites ?? []) {
      if (`${clone.slug}-${site.label}` === name) return { slug: clone.slug, site: site.label };
    }
  }
  return null;
}

export function cloneFor(slug: string): Clone | null {
  return CLONES.find((clone) => clone.slug === slug) ?? null;
}
