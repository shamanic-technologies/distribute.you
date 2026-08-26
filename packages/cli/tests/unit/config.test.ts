import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cachePath, clearConfig, configPath, describeKey, readConfig, writeConfig } from "../../src/config.js";

const dirs: string[] = [];
const freshEnv = (): NodeJS.ProcessEnv => {
  const dir = mkdtempSync(join(tmpdir(), "distribute-cli-"));
  dirs.push(dir);
  return { DISTRIBUTE_CONFIG_DIR: dir } as NodeJS.ProcessEnv;
};

afterEach(() => {
  dirs.length = 0;
});

describe("config store", () => {
  it("reads an empty config when nothing was written", () => {
    expect(readConfig(freshEnv())).toEqual({});
  });

  it("round trips the key", () => {
    const env = freshEnv();
    writeConfig({ apiKey: "distrib.usr_abc" }, env);
    expect(readConfig(env).apiKey).toBe("distrib.usr_abc");
  });

  it("writes the key readable by its owner only", () => {
    const env = freshEnv();
    const path = writeConfig({ apiKey: "distrib.usr_abc" }, env);
    expect(statSync(path).mode & 0o777).toBe(0o600);
  });

  it("keeps the file private when it already existed", () => {
    const env = freshEnv();
    writeConfig({ apiKey: "one" }, env);
    const path = writeConfig({ apiKey: "two" }, env);
    expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(JSON.parse(readFileSync(path, "utf8")).apiKey).toBe("two");
  });

  it("removes the file on logout and says whether there was one", () => {
    const env = freshEnv();
    expect(clearConfig(env)).toBe(false);
    writeConfig({ apiKey: "distrib.usr_abc" }, env);
    expect(clearConfig(env)).toBe(true);
    expect(readConfig(env)).toEqual({});
  });

  it("fails loudly on an unreadable config rather than losing the key", () => {
    const env = freshEnv();
    const path = configPath(env);
    writeConfig({ apiKey: "x" }, env);
    writeFileSync(path, "{ not json");
    expect(() => readConfig(env)).toThrow();
  });

  it("keeps the spec cache beside the config", () => {
    const env = freshEnv();
    expect(cachePath(env)).toBe(join(env.DISTRIBUTE_CONFIG_DIR as string, "openapi-cache.json"));
  });

  it("describes a key without revealing it", () => {
    const described = describeKey("distrib.usr_supersecretvalue");
    expect(described.prefix).toBe("distrib.usr_");
    expect(JSON.stringify(described)).not.toContain("supersecret");
  });
});
