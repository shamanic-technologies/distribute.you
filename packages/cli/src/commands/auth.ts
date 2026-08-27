import { createInterface } from "node:readline/promises";
import { type ParsedArgs, flagValue } from "../args.js";
import { request } from "../client.js";
import { DEFAULT_API_URL, clearConfig, configPath, describeKey, readConfig, writeConfig } from "../config.js";
import { type Context, readStdin } from "../context.js";
import { EXIT, type ExitCode, authError, usageError } from "../errors.js";
import { printJson } from "../output.js";

/**
 * Stores a key after proving it works. Writing an unverified key would move the
 * failure to whichever command runs next, where it reads as that command being
 * broken rather than as the key being wrong.
 */
export async function login(context: Context, args: ParsedArgs): Promise<ExitCode> {
  const key = flagValue(args, "key") ?? (await keyFromInput(context));
  if (!key) {
    throw usageError(
      "No key given. Pass --key, or pipe it in: `echo $KEY | distribute auth login`. Create a key in the distribute.you dashboard.",
    );
  }

  const response = await request({ method: "GET", path: "/v1/me", apiUrl: context.apiUrl, apiKey: key, timeoutMs: context.timeoutMs });

  const stored = readConfig(context.env);
  const path = writeConfig(
    { ...stored, apiKey: key, apiUrl: context.apiUrl === DEFAULT_API_URL ? undefined : context.apiUrl },
    context.env,
  );

  printJson(context.io, { ok: true, storedAt: path, apiUrl: context.apiUrl, key: describeKey(key), identity: response.body }, context.compact);
  return EXIT.ok;
}

export function logout(context: Context): ExitCode {
  const removed = clearConfig(context.env);
  printJson(context.io, { ok: true, removed, path: configPath(context.env) }, context.compact);
  return EXIT.ok;
}

/** Says where the key came from as well as whether it works. */
export async function status(context: Context): Promise<ExitCode> {
  if (!context.apiKey) {
    throw authError("No API key found. Run `distribute auth login`, set DISTRIBUTE_API_KEY, or pass --key.", {
      configPath: configPath(context.env),
    });
  }
  const response = await request({
    method: "GET",
    path: "/v1/me",
    apiUrl: context.apiUrl,
    apiKey: context.apiKey,
    timeoutMs: context.timeoutMs,
  });
  printJson(
    context.io,
    { ok: true, apiUrl: context.apiUrl, keySource: context.keySource, key: describeKey(context.apiKey), identity: response.body },
    context.compact,
  );
  return EXIT.ok;
}

/**
 * In a terminal, ask for the key. Otherwise read whatever was piped in, which
 * is how a script or an agent supplies it without putting the key in argv where
 * it lands in shell history and in the process list.
 */
async function keyFromInput(context: Context): Promise<string | undefined> {
  if (context.interactive) {
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    try {
      const answer = await rl.question("Paste your distribute.you API key (it will be visible as you type): ");
      return answer.trim() || undefined;
    } finally {
      rl.close();
    }
  }
  const piped = (await readStdin()).trim();
  return piped.length > 0 ? piped : undefined;
}
