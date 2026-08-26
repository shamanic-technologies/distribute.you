import { describe, expect, it, vi } from "vitest";
import { buildUrl, request } from "../../src/client.js";
import { EXIT } from "../../src/errors.js";

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("buildUrl", () => {
  it("joins the base and the path without doubling the slash", () => {
    expect(buildUrl("https://api.distribute.you/", "/v1/me")).toBe("https://api.distribute.you/v1/me");
    expect(buildUrl("https://api.distribute.you", "v1/me")).toBe("https://api.distribute.you/v1/me");
  });

  it("appends query parameters", () => {
    expect(buildUrl("https://api.distribute.you", "/v1/leads", { brandId: "b 1" })).toBe(
      "https://api.distribute.you/v1/leads?brandId=b+1",
    );
  });
});

describe("request", () => {
  const base = { apiUrl: "https://api.distribute.you", timeoutMs: 1000 };

  it("sends the key as a Bearer token", async () => {
    const fetcher = vi.fn(async () => jsonResponse(200, { ok: true }));
    await request({ ...base, method: "GET", path: "/v1/me", apiKey: "distrib.usr_x" }, fetcher as never);
    const [, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer distrib.usr_x");
  });

  it("returns the parsed body on success", async () => {
    const fetcher = vi.fn(async () => jsonResponse(200, { brands: [] }));
    const response = await request({ ...base, method: "GET", path: "/v1/brands" }, fetcher as never);
    expect(response.body).toEqual({ brands: [] });
    expect(response.status).toBe(200);
  });

  it("maps 401 to the auth exit code and keeps the upstream body", async () => {
    const fetcher = vi.fn(async () => jsonResponse(401, { error: "Invalid API key" }));
    await expect(request({ ...base, method: "GET", path: "/v1/me" }, fetcher as never)).rejects.toMatchObject({
      exitCode: EXIT.auth,
      details: { error: "Invalid API key" },
    });
  });

  it("maps 404 apart from other API errors", async () => {
    const notFound = vi.fn(async () => jsonResponse(404, { error: "no" }));
    await expect(request({ ...base, method: "GET", path: "/v1/brands/x" }, notFound as never)).rejects.toMatchObject({
      exitCode: EXIT.notFound,
    });
    const failed = vi.fn(async () => jsonResponse(500, { error: "boom" }));
    await expect(request({ ...base, method: "GET", path: "/v1/brands" }, failed as never)).rejects.toMatchObject({
      exitCode: EXIT.api,
      details: { error: "boom" },
    });
  });

  it("maps a transport failure to the network exit code", async () => {
    const fetcher = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(request({ ...base, method: "GET", path: "/v1/me" }, fetcher as never)).rejects.toMatchObject({
      exitCode: EXIT.network,
      code: "network_error",
    });
  });

  it("hands back a non-JSON body as text rather than losing it", async () => {
    const fetcher = vi.fn(async () => new Response("error code: 1010", { status: 200, headers: { "content-type": "text/plain" } }));
    const response = await request({ ...base, method: "GET", path: "/health" }, fetcher as never);
    expect(response.body).toBe("error code: 1010");
  });
});
