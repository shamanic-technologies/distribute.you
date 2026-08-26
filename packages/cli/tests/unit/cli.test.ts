import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { run } from "../../src/cli.js";
import { EXIT } from "../../src/errors.js";
import type { Io } from "../../src/output.js";

const SPEC = {
  info: { title: "distribute API", version: "1.0.0" },
  paths: {
    "/v1/me": { get: { tags: ["User"], summary: "Get current user info" } },
    "/v1/brands": { get: { tags: ["Brand"], summary: "List brands" } },
    "/v1/campaigns/{id}": { get: { tags: ["Campaigns"], summary: "Get a campaign" } },
    "/v1/orgs/audiences/{id}": { delete: { tags: ["Audiences"], summary: "Delete an audience" } },
  },
};

let out: string[];
let err: string[];
let io: Io;
let env: NodeJS.ProcessEnv;
let calls: { url: string; init: RequestInit }[];

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const runCli = (argv: string[], overrides: Partial<Parameters<typeof run>[0]> = {}) =>
  run({ argv, io, env, interactive: false, ...overrides });

beforeEach(() => {
  out = [];
  err = [];
  io = { stdout: (line) => out.push(line), stderr: (line) => err.push(line) };
  env = { DISTRIBUTE_CONFIG_DIR: mkdtempSync(join(tmpdir(), "distribute-cli-run-")) } as NodeJS.ProcessEnv;
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      if (url.endsWith("/openapi.json")) return json(200, SPEC);
      if (url.includes("/v1/me")) return json(200, { userId: "user_1", orgId: "org_1" });
      if (url.includes("/v1/brands")) return json(200, [{ id: "brand_1" }]);
      if (url.includes("/v1/campaigns/")) return json(404, { error: "Campaign not found" });
      return json(200, { ok: true });
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

const lastJson = (lines: string[]) => JSON.parse(lines.join("\n"));

describe("run", () => {
  it("prints help and reports a usage error when told nothing to do", async () => {
    expect(await runCli([])).toBe(EXIT.usage);
    expect(out.join("\n")).toContain("Usage");
  });

  it("prints help with a zero exit when help was asked for", async () => {
    expect(await runCli(["help"])).toBe(EXIT.ok);
  });

  it("prints the version as JSON", async () => {
    expect(await runCli(["--version"])).toBe(EXIT.ok);
    expect(lastJson(out).version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("refuses an unknown command with the usage exit code", async () => {
    expect(await runCli(["teleport"])).toBe(EXIT.usage);
    expect(lastJson(err).error.code).toBe("unknown_command");
  });

  it("refuses an unknown action inside a known group", async () => {
    expect(await runCli(["brands", "explode"])).toBe(EXIT.usage);
    expect(lastJson(err).error.message).toContain("distribute brands list");
  });

  it("refuses to run without a key, and says how to get one", async () => {
    expect(await runCli(["brands", "list"])).toBe(EXIT.auth);
    const error = lastJson(err).error;
    expect(error.exitCode).toBe(EXIT.auth);
    expect(error.message).toContain("auth login");
  });

  it("sends the key from the environment", async () => {
    env.DISTRIBUTE_API_KEY = "distrib.usr_env";
    expect(await runCli(["brands", "list"])).toBe(EXIT.ok);
    expect(lastJson(out)).toEqual([{ id: "brand_1" }]);
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe("Bearer distrib.usr_env");
  });

  it("prefers --key over the environment", async () => {
    env.DISTRIBUTE_API_KEY = "distrib.usr_env";
    await runCli(["brands", "list", "--key", "distrib.usr_flag"]);
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe("Bearer distrib.usr_flag");
  });

  it("maps named flags onto query parameters", async () => {
    env.DISTRIBUTE_API_KEY = "k";
    await runCli(["leads", "list", "--brand", "brand_1", "--limit", "5"]);
    expect(calls[0].url).toContain("brandId=brand_1");
    expect(calls[0].url).toContain("limit=5");
  });

  it("returns the not-found exit code and the upstream message", async () => {
    env.DISTRIBUTE_API_KEY = "k";
    expect(await runCli(["campaigns", "get", "missing"])).toBe(EXIT.notFound);
    expect(lastJson(err).error.details).toEqual({ error: "Campaign not found" });
  });

  it("stores the key on login, after checking it", async () => {
    expect(await runCli(["auth", "login", "--key", "distrib.usr_stored"])).toBe(EXIT.ok);
    expect(calls[0].url).toContain("/v1/me");
    expect(await runCli(["auth", "status"])).toBe(EXIT.ok);
    expect(lastJson(out.slice(-1)).keySource).toBe("config");
  });

  it("never prints the key itself", async () => {
    await runCli(["auth", "login", "--key", "distrib.usr_supersecret"]);
    expect(out.join("\n")).not.toContain("supersecret");
  });

  it("forgets the key on logout", async () => {
    await runCli(["auth", "login", "--key", "distrib.usr_stored"]);
    expect(await runCli(["auth", "logout"])).toBe(EXIT.ok);
    expect(await runCli(["auth", "status"])).toBe(EXIT.auth);
  });

  it("refuses a destructive command it cannot ask about", async () => {
    env.DISTRIBUTE_API_KEY = "k";
    expect(await runCli(["audiences", "delete", "aud_1"])).toBe(EXIT.notConfirmed);
    expect(lastJson(err).error.message).toContain("--yes");
    expect(calls).toHaveLength(0);
  });

  it("runs a destructive command once it is authorised", async () => {
    env.DISTRIBUTE_API_KEY = "k";
    expect(await runCli(["audiences", "delete", "aud_1", "--yes"])).toBe(EXIT.ok);
    expect(calls[0].init.method).toBe("DELETE");
  });

  it("lists the API's operations from the API itself", async () => {
    expect(await runCli(["ops", "--tag", "Brand"])).toBe(EXIT.ok);
    const body = lastJson(out);
    expect(body.total).toBe(4);
    expect(body.operations).toEqual([
      expect.objectContaining({ method: "GET", path: "/v1/brands", summary: "List brands" }),
    ]);
  });

  it("describes one operation", async () => {
    expect(await runCli(["describe", "GET", "/v1/me"])).toBe(EXIT.ok);
    expect(lastJson(out).summary).toBe("Get current user info");
  });

  it("checks a raw call against the live document before sending it", async () => {
    env.DISTRIBUTE_API_KEY = "k";
    expect(await runCli(["call", "GET", "/v1/nope"])).toBe(EXIT.usage);
    expect(calls.every((c) => !c.url.includes("/v1/nope"))).toBe(true);
  });

  it("sends a raw call the document knows about", async () => {
    env.DISTRIBUTE_API_KEY = "k";
    expect(await runCli(["call", "GET", "/v1/me", "--include-status"])).toBe(EXIT.ok);
    expect(lastJson(out).status).toBe(200);
  });

  it("prints one line of JSON with --compact", async () => {
    env.DISTRIBUTE_API_KEY = "k";
    await runCli(["brands", "list", "--compact"]);
    expect(out).toHaveLength(1);
    expect(out[0]).toBe('[{"id":"brand_1"}]');
  });

  it("reports a bad --timeout as a usage error", async () => {
    expect(await runCli(["brands", "list", "--timeout", "soon"])).toBe(EXIT.usage);
  });
});
