import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { POST } from "../src/app/api/partnero/customer/route";

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/partnero/customer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/partnero/customer", () => {
  const realToken = process.env.PARTNERO_API_TOKEN;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.PARTNERO_API_TOKEN = "test-token";
  });

  afterEach(() => {
    if (realToken === undefined) delete process.env.PARTNERO_API_TOKEN;
    else process.env.PARTNERO_API_TOKEN = realToken;
  });

  it("returns 500 and does not call Partnero when token is unset", async () => {
    delete process.env.PARTNERO_API_TOKEN;
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await POST(makeReq({ via: "P", key: "u", email: "a@b.co" }));
    expect(res.status).toBe(500);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns 400 when via/key/email missing", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await POST(makeReq({ via: "P", email: "a@b.co" })); // no key
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts the correct Partnero body + Bearer token on happy path", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const res = await POST(
      makeReq({ via: "PARTNER_KEY", key: "user_123", email: "c@d.co", name: "John" }),
    );
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.partnero.com/v1/customers");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-token",
    );
    expect(JSON.parse(init.body as string)).toEqual({
      partner: { key: "PARTNER_KEY" },
      key: "user_123",
      email: "c@d.co",
      name: "John",
    });
  });

  it("returns 502 (fail-loud) when Partnero rejects", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("nope", { status: 422 }),
    );
    const res = await POST(makeReq({ via: "P", key: "u", email: "a@b.co" }));
    expect(res.status).toBe(502);
  });
});

describe("Partnero wiring surfaces", () => {
  const read = (p: string) => fs.readFileSync(path.resolve(__dirname, p), "utf-8");

  it("PostHogAuthTracker registers the customer from the partnero_via cookie on signup", () => {
    const c = read("../src/components/posthog-auth-tracker.tsx");
    expect(c).toContain("partnero_via");
    expect(c).toContain("/api/partnero/customer");
    // fired inside the signup branch only, and fire-and-forget
    const idx = c.indexOf("/api/partnero/customer");
    const signupIdx = c.indexOf('if (authType === "signup")');
    expect(signupIdx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeGreaterThan(signupIdx);
  });

  it("dashboard captures ?via into the partnero_via cookie and mounts the capturer", () => {
    const cap = read("../src/components/partnero-via-capture.tsx");
    expect(cap).toContain("partnero_via");
    expect(cap).toContain('.get("via")');
    const layout = read("../src/app/layout.tsx");
    expect(layout).toContain("PartneroViaCapture");
    expect(layout).toContain("@/components/partnero-via-capture");
  });
});

describe("landing carries PartneroJS + via-forward", () => {
  const read = (p: string) =>
    fs.readFileSync(path.resolve(__dirname, p), "utf-8");

  it("static-html analyticsHead injects program KHV3KEHI + forward", () => {
    const c = read("../../landing/src/lib/static-html.ts");
    expect(c).toContain("KHV3KEHI");
    expect(c).toContain("universal.js");
    expect(c).toContain('a[href*="dashboard.distribute.you"]');
    expect(c).toContain("partneroHead()");
  });

  it("React landing layout injects program KHV3KEHI + forward", () => {
    const c = read("../../landing/src/app/layout.tsx");
    expect(c).toContain("KHV3KEHI");
    expect(c).toContain('a[href*="dashboard.distribute.you"]');
  });
});
