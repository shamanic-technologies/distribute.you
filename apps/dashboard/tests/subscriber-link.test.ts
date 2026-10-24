import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SUBSCRIBER_LINK_CAPTURE_SCRIPT,
  SUBSCRIBER_LINK_COOKIE,
  SUBSCRIBER_LINK_ROUTE,
  identifySubscriberClick,
  resolveSubscriberLink,
  subscriberPersonPayload,
  type SubscriberLinkDeps,
} from "../src/lib/subscriber-link";

const LINK = "AbCdEfGhIjKlMnOpQrStUvWxYz"; // 26 base64url chars, like the producer's
const DID = "01a16d3d-456a-7bf4-8303-6190709c4d74";
const PH_COOKIE = `ph_phc_test_posthog=${encodeURIComponent(JSON.stringify({ distinct_id: DID, $device_id: DID }))}`;

/**
 * Runs the exact string both apps render, against stubbed globals (`new Function`
 * binds the free variables it reads), so this is the shipped script.
 */
function run(opts: { url: string; cookie?: string; sent?: string | null; timeouts?: number }) {
  const u = new URL(opts.url);
  let jar = opts.cookie ?? "";
  const written: string[] = [];
  const document = {
    get cookie() {
      return jar;
    },
    set cookie(v: string) {
      written.push(v);
      const pair = v.split(";")[0];
      jar = jar ? `${jar}; ${pair}` : pair;
    },
  };
  const location = { href: u.href, hostname: u.hostname, protocol: u.protocol };
  const replaced: string[] = [];
  const history = { replaceState: (_s: unknown, _t: string, url: string) => replaced.push(url) };
  const store = new Map<string, string>();
  if (opts.sent) store.set("distribute_dy_sub_sent", opts.sent);
  const sessionStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  };
  const posts: { url: string; body: unknown; credentials: unknown }[] = [];
  const fetchStub = (url: string, init: { body: string; credentials: unknown }) => {
    posts.push({ url, body: JSON.parse(init.body), credentials: init.credentials });
    return { then: (fn: (r: { ok: boolean }) => void) => (fn({ ok: true }), { catch: () => undefined }) };
  };
  let timeouts = 0;
  const setTimeoutStub = (fn: () => void) => {
    timeouts++;
    if (timeouts <= (opts.timeouts ?? 100)) fn();
  };
  new Function("document", "location", "history", "sessionStorage", "fetch", "setTimeout", "URL", SUBSCRIBER_LINK_CAPTURE_SCRIPT)(
    document,
    location,
    history,
    sessionStorage,
    fetchStub,
    setTimeoutStub,
    URL,
  );
  return { written, replaced, posts, store, timeouts };
}

describe("subscriber-link capture script", () => {
  it("parks dy_sub on .distribute.you, strips it from the address bar, posts id + distinct id", () => {
    const r = run({ url: `https://distribute.you/blog/gtm?utm_source=newsletter&dy_sub=${LINK}#top`, cookie: PH_COOKIE });
    expect(r.replaced).toEqual(["/blog/gtm?utm_source=newsletter#top"]);
    expect(r.written).toHaveLength(1);
    expect(r.written[0]).toBe(`${SUBSCRIBER_LINK_COOKIE}=${LINK};Path=/;SameSite=Lax;Domain=.distribute.you;Secure`);
    expect(r.posts).toEqual([{ url: SUBSCRIBER_LINK_ROUTE, body: { linkId: LINK, distinctId: DID }, credentials: "omit" }]);
    expect(r.store.get("distribute_dy_sub_sent")).toBe(LINK);
  });

  it("/get-started reached from the landing reads the parked id (no URL param)", () => {
    const r = run({
      url: "https://dashboard.distribute.you/get-started?url=inogates.com",
      cookie: `${PH_COOKIE}; ${SUBSCRIBER_LINK_COOKIE}=${LINK}`,
    });
    expect(r.replaced).toEqual([]);
    expect(r.written).toEqual([]);
    expect(r.posts).toHaveLength(1);
    expect(r.posts[0].body).toEqual({ linkId: LINK, distinctId: DID });
  });

  it("a junk dy_sub is stripped but neither parked nor posted", () => {
    const r = run({ url: "https://distribute.you/?dy_sub=%3Cscript%3E", cookie: PH_COOKIE });
    expect(r.replaced).toEqual(["/"]);
    expect(r.written).toEqual([]);
    expect(r.posts).toEqual([]);
  });

  it("posts once per tab session", () => {
    const r = run({ url: `https://distribute.you/?dy_sub=${LINK}`, cookie: PH_COOKIE, sent: LINK });
    expect(r.posts).toEqual([]);
  });

  it("waits for PostHog's distinct id cookie, then gives up quietly", () => {
    const r = run({ url: `https://distribute.you/?dy_sub=${LINK}` });
    expect(r.posts).toEqual([]);
    expect(r.timeouts).toBe(39);
  });

  it("does nothing without a dy_sub", () => {
    const r = run({ url: "https://distribute.you/pricing", cookie: PH_COOKIE });
    expect(r.replaced).toEqual([]);
    expect(r.written).toEqual([]);
    expect(r.posts).toEqual([]);
  });

  it("a throwing environment never breaks the page", () => {
    expect(() =>
      new Function("document", "location", SUBSCRIBER_LINK_CAPTURE_SCRIPT)(null, null),
    ).not.toThrow();
  });

  it("is safe to inline in <script>", () => {
    expect(SUBSCRIBER_LINK_CAPTURE_SCRIPT).not.toContain("</script");
    expect(() => new Function(SUBSCRIBER_LINK_CAPTURE_SCRIPT)).not.toThrow();
  });
});

function deps(over: Partial<SubscriberLinkDeps> = {}) {
  const captured: unknown[] = [];
  const logs: string[] = [];
  const d: SubscriberLinkDeps = {
    resolve: async () => ({ status: "valid", email: "Staff@Distribute.you", name: null, listSlug: "jev-gtm" }),
    capture: async (p) => {
      captured.push(p);
      return { ok: true, status: 200 };
    },
    posthogApiKey: "phc_test",
    log: (m) => logs.push(m),
    ...over,
  };
  return { d, captured, logs };
}

describe("identifySubscriberClick", () => {
  it("sets the subscriber's email (set_once, lower-cased) on the visitor's PostHog person", async () => {
    const { d, captured } = deps();
    expect(await identifySubscriberClick({ linkId: LINK, distinctId: DID }, d)).toBe("identified");
    expect(captured).toEqual([
      {
        api_key: "phc_test",
        event: "newsletter_link_identified",
        distinct_id: DID,
        properties: { $set_once: { email: "staff@distribute.you" }, newsletter_list: "jev-gtm", source: "server" },
      },
    ]);
  });

  it("names the person only when the producer serves a name", () => {
    expect(subscriberPersonPayload("k", DID, { email: "a@b.co", name: "Ada", listSlug: null }).properties).toEqual({
      $set_once: { email: "a@b.co", name: "Ada" },
      source: "server",
    });
  });

  it.each(["revoked", "unknown", "tampered"] as const)("a %s link sets nothing and logs it", async (status) => {
    const { d, captured, logs } = deps({ resolve: async () => ({ status }) });
    expect(await identifySubscriberClick({ linkId: LINK, distinctId: DID }, d)).toBe(status);
    expect(captured).toEqual([]);
    expect(logs[0]).toContain(status);
  });

  it("rejects a junk body before any call", async () => {
    const resolve = vi.fn();
    const { d } = deps({ resolve });
    expect(await identifySubscriberClick({ linkId: "../x", distinctId: DID }, d)).toBe("bad-request");
    expect(await identifySubscriberClick({ linkId: LINK, distinctId: "x" }, d)).toBe("bad-request");
    expect(await identifySubscriberClick(null, d)).toBe("bad-request");
    expect(resolve).not.toHaveBeenCalled();
  });

  it("never throws, and never logs an email", async () => {
    const boom = deps({ resolve: async () => Promise.reject(new Error("down")) });
    expect(await identifySubscriberClick({ linkId: LINK, distinctId: DID }, boom.d)).toBe("resolve-failed");
    const ph = deps({ capture: async () => ({ ok: false, status: 503 }) });
    expect(await identifySubscriberClick({ linkId: LINK, distinctId: DID }, ph.d)).toBe("capture-failed");
    expect([...boom.logs, ...ph.logs].join(" ")).not.toMatch(/@/);
  });
});

describe("resolveSubscriberLink (api-service GET /v1/subscriber-links/{linkId})", () => {
  function fakeFetch(status: number, body?: unknown) {
    const calls: { url: string; headers: Record<string, string> }[] = [];
    const f = (async (url: string, init: { headers: Record<string, string> }) => {
      calls.push({ url, headers: init.headers });
      return new Response(body === undefined ? null : JSON.stringify(body), { status });
    }) as unknown as typeof fetch;
    return { f, calls };
  }

  it("sends the platform key and NO identity header (the gateway refuses one)", async () => {
    const { f, calls } = fakeFetch(200, {
      status: "valid",
      linkId: LINK,
      subscriber: { id: "s1", email: "staff@distribute.you", name: null },
      list: { slug: "jev-gtm" },
    });
    const r = await resolveSubscriberLink(LINK, { apiUrl: "https://api.distribute.you/", apiKey: "k", fetchImpl: f });
    expect(r).toEqual({ status: "valid", email: "staff@distribute.you", name: null, listSlug: "jev-gtm" });
    expect(calls[0].url).toBe(`https://api.distribute.you/v1/subscriber-links/${LINK}`);
    expect(Object.keys(calls[0].headers).sort()).toEqual(["Accept", "X-API-Key"]);
  });

  it.each([
    [400, "tampered"],
    [404, "unknown"],
    [410, "revoked"],
  ] as const)("maps %i to %s", async (code, status) => {
    const { f } = fakeFetch(code, { error: "x" });
    expect(await resolveSubscriberLink(LINK, { apiUrl: "https://a", apiKey: "k", fetchImpl: f })).toEqual({ status });
  });

  it("any other answer is an error, never a guess", async () => {
    const { f } = fakeFetch(502, { error: "x" });
    expect((await resolveSubscriberLink(LINK, { apiUrl: "https://a", apiKey: "k", fetchImpl: f })).status).toBe("error");
    const odd = fakeFetch(200, { status: "valid", subscriber: { email: null } });
    expect((await resolveSubscriberLink(LINK, { apiUrl: "https://a", apiKey: "k", fetchImpl: odd.f })).status).toBe("error");
    expect((await resolveSubscriberLink(LINK, { apiUrl: "https://a", apiKey: undefined })).status).toBe("error");
  });
});

describe("wiring", () => {
  const read = (p: string) => readFileSync(join(__dirname, "../src", p), "utf8");

  it("the root layout renders the capture script", () => {
    expect(read("app/layout.tsx")).toContain("__html: SUBSCRIBER_LINK_CAPTURE_SCRIPT");
  });

  it("the route is public and answers 204 with no body, whatever happened", () => {
    const route = read("app/api/public/subscriber-link/route.ts");
    expect(route).toContain("status: 204");
    expect(route).not.toContain("NextResponse.json");
    expect(read("proxy.ts")).toContain('"/api/public(.*)"');
  });
});
