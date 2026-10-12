import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { run } from "../../src/cli.js";
import { configPath } from "../../src/config.js";
import { EXIT } from "../../src/errors.js";
import type { Io } from "../../src/output.js";

let out: string[];
let err: string[];
let io: Io;
let env: NodeJS.ProcessEnv;
let calls: { url: string; init: RequestInit }[];

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const runCli = (argv: string[]) => run({ argv, io, env, interactive: false });
const lastJson = (lines: string[]) => JSON.parse(lines.join("\n"));
const sentBody = (i: number) => JSON.parse(String(calls[i].init.body));
const sentAuth = (i: number) => (calls[i].init.headers as Record<string, string>).authorization;

beforeEach(() => {
  out = [];
  err = [];
  io = { stdout: (line) => out.push(line), stderr: (line) => err.push(line) };
  env = { DISTRIBUTE_CONFIG_DIR: mkdtempSync(join(tmpdir(), "distribute-cli-signup-")) } as NodeJS.ProcessEnv;
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      if (url.endsWith("/v1/agent-signups/start")) return json(200, { email: "a@x.com", codeTtlMinutes: 15 });
      if (url.endsWith("/v1/agent-signups/complete")) return json(200, { apiKey: "distrib.usr_new", orgId: "o1", created: true });
      if (url.endsWith("/v1/billing/accounts/prepaid_checkout")) return json(200, { url: "https://pay.example/s1" });
      if (url.endsWith("/v1/billing/accounts/prepaid_status")) return json(200, { state: "awaiting_payment" });
      if (url.endsWith("/v1/campaigns")) return json(402, { error: "payment_required", prepay: { path: "/v1/billing/accounts/prepaid_checkout" } });
      return json(200, { ok: true });
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("signup, no key needed", () => {
  it("asks for a code with email and phone, sending no key", async () => {
    expect(await runCli(["signup", "--email", "a@x.com", "--phone", "+33612345678"])).toBe(EXIT.ok);
    expect(calls[0].url).toBe("https://api.distribute.you/v1/agent-signups/start");
    expect(sentBody(0)).toEqual({ email: "a@x.com", phone: "+33612345678" });
    expect(sentAuth(0)).toBeUndefined();
    expect(lastJson(out).next).toContain("signup verify");
  });

  it("refuses a signup without a phone", async () => {
    expect(await runCli(["signup", "--email", "a@x.com"])).toBe(EXIT.usage);
    expect(calls).toHaveLength(0);
  });

  it("trades the code for a key, stores it, and prints it", async () => {
    expect(await runCli(["signup", "verify", "--email", "a@x.com", "--code", "123456"])).toBe(EXIT.ok);
    expect(sentBody(0)).toEqual({ email: "a@x.com", code: "123456" });
    expect(lastJson(out).apiKey).toBe("distrib.usr_new");
    expect(JSON.parse(readFileSync(configPath(env), "utf8")).apiKey).toBe("distrib.usr_new");
  });
});

describe("prepay", () => {
  it("turns dollars into cents and sends the stored key", async () => {
    env.DISTRIBUTE_API_KEY = "distrib.usr_k";
    expect(await runCli(["prepay", "--amount", "10", "--reload", "15", "--below", "5"])).toBe(EXIT.ok);
    expect(sentBody(0)).toEqual({ topup_amount_cents: 1000, auto_topup_amount_cents: 1500, auto_topup_threshold_cents: 500 });
    expect(sentAuth(0)).toBe("Bearer distrib.usr_k");
    expect(lastJson(out).url).toBe("https://pay.example/s1");
  });

  it("needs all three amounts", async () => {
    env.DISTRIBUTE_API_KEY = "distrib.usr_k";
    expect(await runCli(["prepay", "--amount", "10"])).toBe(EXIT.usage);
    expect(calls).toHaveLength(0);
  });

  it("reads the prepaid status", async () => {
    env.DISTRIBUTE_API_KEY = "distrib.usr_k";
    expect(await runCli(["prepay", "status"])).toBe(EXIT.ok);
    expect(lastJson(out).state).toBe("awaiting_payment");
  });
});

describe("payment required", () => {
  it("exits 8 with the API's prepay instructions", async () => {
    env.DISTRIBUTE_API_KEY = "distrib.usr_k";
    expect(await runCli(["call", "POST", "/v1/campaigns", "--data", "x=1", "--no-verify", "--yes"])).toBe(EXIT.paymentRequired);
    const error = lastJson(err).error;
    expect(error.code).toBe("payment_required");
    expect(error.message).toContain("distribute prepay");
    expect(error.details.prepay.path).toBe("/v1/billing/accounts/prepaid_checkout");
  });
});
