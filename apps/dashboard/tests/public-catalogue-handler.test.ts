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
  it("returns the channels and the returns", async () => {
    globalThis.fetch = vi.fn(async (input: any) =>
      String(input).includes("/channels")
        ? json({ channels: [{ slug: "sales-cold-email-outreach" }] })
        : json({ pairs: [{ channelSlug: "sales-cold-email-outreach", measured: true }] }),
    ) as any;

    const { GET } = await import("../src/app/api/public/catalogue/route");
    const res = await GET();

    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.channels.channels).toHaveLength(1);
    expect(body.returns.pairs).toHaveLength(1);
  });

  it("502s when the channels read fails, rather than serving an empty list", async () => {
    // A visitor shown "no channels" reads it as us selling nothing.
    globalThis.fetch = vi.fn(async () => json({ error: "nope" }, 503)) as any;
    const { GET } = await import("../src/app/api/public/catalogue/route");
    const res = await GET();
    expect(res.status).toBe(502);
  });

  it("keeps serving when only the RETURNS half fails", async () => {
    // The producer states a figure only for pairs enough brands have spent on,
    // so a missing returns half is a weaker screen, not a broken one.
    globalThis.fetch = vi.fn(async (input: any) =>
      String(input).includes("/channels") ? json({ channels: [] }) : json({}, 500),
    ) as any;
    const { GET } = await import("../src/app/api/public/catalogue/route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).returns).toBeNull();
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

describe("GET /api/public/channel-returns", () => {
  const call = async (url: string) => {
    const { GET } = await import("../src/app/api/public/channel-returns/route");
    return GET(new Request(url));
  };

  it("returns one row per requested channel", async () => {
    globalThis.fetch = vi.fn(async (input: any) =>
      json({ featureSlug: new URL(String(input)).searchParams.get("featureSlug"), measured: true }),
    ) as any;
    const res = await call("https://x/api/public/channel-returns?slugs=a-one,b-two");
    expect(res.status).toBe(200);
    expect((await res.json()).returns).toHaveLength(2);
  });

  it("returns an empty list with no slugs, without calling upstream", async () => {
    const spy = vi.fn();
    globalThis.fetch = spy as any;
    const res = await call("https://x/api/public/channel-returns");
    expect(await res.json()).toEqual({ returns: [] });
    expect(spy).not.toHaveBeenCalled();
  });

  it("drops a slug outside the shape our producers use", async () => {
    // The query is visitor-supplied on a public route.
    const spy = vi.fn(async () => json({ measured: false }));
    globalThis.fetch = spy as any;
    await call("https://x/api/public/channel-returns?slugs=../../etc,<script>,ok-slug");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0][0])).toContain("featureSlug=ok-slug");
  });

  it("caps the fan-out rather than turning one screen into forty requests", async () => {
    const spy = vi.fn(async () => json({ measured: false }));
    globalThis.fetch = spy as any;
    const many = Array.from({ length: 40 }, (_, i) => `chan-${i}`).join(",");
    await call(`https://x/api/public/channel-returns?slugs=${many}`);
    expect(spy).toHaveBeenCalledTimes(12);
  });

  it("OMITS a channel whose read failed rather than faking a figure", async () => {
    globalThis.fetch = vi.fn(async (input: any) =>
      String(input).includes("good") ? json({ featureSlug: "good", measured: true }) : json({}, 500),
    ) as any;
    const res = await call("https://x/api/public/channel-returns?slugs=good,bad");
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.returns).toHaveLength(1);
    expect(body.returns[0].featureSlug).toBe("good");
  });
});
