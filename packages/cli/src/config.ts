import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_API_URL = "https://api.distribute.you";

export interface StoredConfig {
  apiKey?: string;
  apiUrl?: string;
}

export function configDir(env: NodeJS.ProcessEnv = process.env): string {
  if (env.DISTRIBUTE_CONFIG_DIR) return env.DISTRIBUTE_CONFIG_DIR;
  const base = env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  return join(base, "distribute");
}

export function configPath(env: NodeJS.ProcessEnv = process.env): string {
  return join(configDir(env), "config.json");
}

export function cachePath(env: NodeJS.ProcessEnv = process.env): string {
  return join(configDir(env), "openapi-cache.json");
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): StoredConfig {
  let raw: string;
  try {
    raw = readFileSync(configPath(env), "utf8");
  } catch {
    return {};
  }
  // A config file we cannot read is a real problem and says so, rather than
  // being silently replaced by an empty one that loses the stored key.
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Config file is not an object: ${configPath(env)}`);
  }
  return parsed as StoredConfig;
}

export function writeConfig(next: StoredConfig, env: NodeJS.ProcessEnv = process.env): string {
  const dir = configDir(env);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const path = configPath(env);
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  // writeFileSync only applies the mode when it creates the file, so an
  // existing file keeps whatever permissions it had. The key is a credential.
  chmodSync(path, 0o600);
  return path;
}

export function clearConfig(env: NodeJS.ProcessEnv = process.env): boolean {
  try {
    rmSync(configPath(env));
    return true;
  } catch {
    return false;
  }
}

/** Everything about the key except the key: safe to print. */
export function describeKey(apiKey: string): { prefix: string; length: number } {
  return { prefix: apiKey.slice(0, 12), length: apiKey.length };
}
