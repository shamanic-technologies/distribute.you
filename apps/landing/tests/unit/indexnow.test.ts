import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { pingIndexNow, INDEXNOW_KEY } from "@/lib/indexnow";

describe("pingIndexNow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("no-ops (no fetch) on an empty url list", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await pingIndexNow([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("POSTs the IndexNow bulk payload with host, key, keyLocation, urlList", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));

    await pingIndexNow([
      "https://distribute.you/blog/a",
      "https://distribute.you/blog/b",
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.indexnow.org/indexnow");
    expect(init?.method).toBe("POST");
    const body = JSON.parse(init?.body as string);
    expect(body).toEqual({
      host: "distribute.you",
      key: INDEXNOW_KEY,
      keyLocation: `https://distribute.you/${INDEXNOW_KEY}.txt`,
      urlList: [
        "https://distribute.you/blog/a",
        "https://distribute.you/blog/b",
      ],
    });
  });

  it("logs loud but does not throw when the ping fails (best-effort)", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 500 }),
    );
    await expect(
      pingIndexNow(["https://distribute.you/blog/a"]),
    ).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalled();
  });

  it("swallows a network throw (best-effort, still logs loud)", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    await expect(
      pingIndexNow(["https://distribute.you/blog/a"]),
    ).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalled();
  });
});
