import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * CALLING the public handlers, not reading them.
 *
 * Both of these shipped to production returning `undefined` -- a scripted edit
 * deleted their bodies and every gate stayed silent, because an async function
 * with no return infers `Promise<void>` and typechecks, the suite only read the
 * source, and `next build` compiles it happily. Next answers 500 with "No
 * response is returned from route handler" and the visitor gets the error
 * screen. The only thing that catches it is invoking the thing.
 */

const ORIGINAL_FETCH = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  vi.resetModules();
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("GET /api/public/catalogue", () => {
  it("returns the channels and the proof", async () => {
    globalThis.fetch = vi.fn(async (input: any) =>
      String(input).includes("/channels")
        ? json({ channels: [{ slug: "sales-cold-email-outreach" }] })
        : String(input).includes("return-on-spend")
          ? json({ measured: true, medianReturnPerDollar: 5.2 })
          : json({}),
    ) as any;

    const { GET } = await import("../src/app/api/public/catalogue/route");
    const res = await GET();

    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.channels.channels).toHaveLength(1);
    expect(body.proof.medianReturnPerDollar).toBe(5.2);
  });

  it("502s when the channels read fails, rather than serving an empty list", async () => {
    // A visitor shown "no channels" reads it as us selling nothing.
    globalThis.fetch = vi.fn(async () => json({ error: "nope" }, 503)) as any;
    const { GET } = await import("../src/app/api/public/catalogue/route");
    const res = await GET();
    expect(res.status).toBe(502);
  });

  it("keeps serving when only the PROOF half fails", async () => {
    // Every proof figure may legitimately be missing: a weaker screen, not a broken one.
    globalThis.fetch = vi.fn(async (input: any) =>
      String(input).includes("/channels") ? json({ channels: [] }) : json({}, 500),
    ) as any;
    const { GET } = await import("../src/app/api/public/catalogue/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const proof = (await res.json()).proof;
    expect(proof.hotLeads).toBeNull();
    expect(proof.medianReturnPerDollar).toBeNull();
    expect(proof.showcase).toEqual([]);
  });

  it("502s rather than throwing when the gateway is unreachable", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as any;
    const { GET } = await import("../src/app/api/public/catalogue/route");
    const res = await GET();
    expect(res.status).toBe(502);
  });
});

/**
 * THE FOUNDER COUNT IS ON A DIFFERENT PREFIX, and reading it under the wrong one
 * is invisible: the handler's own comment says the read "may legitimately be
 * missing", so a 404 logs one line and `founders` stays null forever. The strip
 * then renders its shipped seed -- a real sentence, a real number, frozen --
 * while the landing, which reads the same endpoint at the RIGHT path, states the
 * live figure. Two surfaces, one fleet, two counts.
 *
 * The gateway names its own paths and does NOT uniformly keep the downstream
 * prefix (`/v1/public/channels` is proxied, `/public/stats/users` is not), so
 * the prefix is a fact to read off the deployed contract rather than a rule to
 * infer. Measured 2026-09-17: `/v1/public/stats/users` -> 404 `{"error":"Not
 * found"}`, `/public/stats/users` -> 200 `{"totalUsers":82,...}`.
 */
describe("GET /api/public/catalogue -- the founder count", () => {
  const urls = (spy: ReturnType<typeof vi.fn>) => spy.mock.calls.map((c) => String(c[0]));

  it("reads the user count off the gateway's UNVERSIONED public path", async () => {
    const spy = vi.fn(async (input: any) =>
      String(input).includes("stats/users")
        ? json({ totalUsers: 82 })
        : json({ channels: [] }),
    );
    globalThis.fetch = spy as any;

    const { GET } = await import("../src/app/api/public/catalogue/route");
    const res = await GET();

    const usersUrl = urls(spy).find((u) => u.includes("stats/users"));
    expect(usersUrl).toBeDefined();
    expect(usersUrl).toContain("/public/stats/users");
    expect(usersUrl).not.toContain("/v1/public/stats/users");
    expect((await res.json()).founders).toBe(82);
  });

  it("keeps the other reads on /v1 -- only the user count moved", async () => {
    const spy = vi.fn(async (_input: any) => json({ channels: [] }));
    globalThis.fetch = spy as any;
    const { GET } = await import("../src/app/api/public/catalogue/route");
    await GET();

    expect(urls(spy).some((u) => u.endsWith("/v1/public/channels"))).toBe(true);
    expect(urls(spy).some((u) => u.includes("/v1/public/features/return-on-spend"))).toBe(true);
  });

  it("serves founders null, not a fabricated count, when that read fails", async () => {
    globalThis.fetch = vi.fn(async (input: any) =>
      String(input).includes("stats/users") ? json({}, 500) : json({ channels: [] }),
    ) as any;
    const { GET } = await import("../src/app/api/public/catalogue/route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).founders).toBeNull();
  });
});
