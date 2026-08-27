import { createInterface } from "node:readline/promises";
import { type ParsedArgs, boolFlag, flagValue } from "./args.js";
import { DEFAULT_API_URL, readConfig } from "./config.js";
import { CliError, EXIT, authError } from "./errors.js";
import type { Io } from "./output.js";

export interface Context {
  apiUrl: string;
  /** Undefined when nothing supplied one. Commands that need it say so. */
  apiKey?: string;
  keySource: "flag" | "env" | "config" | "none";
  timeoutMs: number;
  compact: boolean;
  assumeYes: boolean;
  interactive: boolean;
  env: NodeJS.ProcessEnv;
  io: Io;
}

const DEFAULT_TIMEOUT_MS = 60_000;

export function buildContext(args: ParsedArgs, io: Io, env: NodeJS.ProcessEnv, interactive: boolean): Context {
  const stored = readConfig(env);
  const flagKey = flagValue(args, "key");
  const envKey = env.DISTRIBUTE_API_KEY;

  const { apiKey, keySource } = flagKey
    ? { apiKey: flagKey, keySource: "flag" as const }
    : envKey
      ? { apiKey: envKey, keySource: "env" as const }
      : stored.apiKey
        ? { apiKey: stored.apiKey, keySource: "config" as const }
        : { apiKey: undefined, keySource: "none" as const };

  return {
    apiUrl: flagValue(args, "api-url") ?? env.DISTRIBUTE_API_URL ?? stored.apiUrl ?? DEFAULT_API_URL,
    apiKey,
    keySource,
    timeoutMs: readTimeout(args),
    compact: boolFlag(args, "compact"),
    assumeYes: boolFlag(args, "yes"),
    interactive,
    env,
    io,
  };
}

function readTimeout(args: ParsedArgs): number {
  const raw = flagValue(args, "timeout");
  if (raw === undefined) return DEFAULT_TIMEOUT_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new CliError({
      code: "usage_error",
      message: `--timeout expects a positive number of milliseconds, received: ${raw}`,
      exitCode: EXIT.usage,
    });
  }
  return parsed;
}

/** Names where the key came from, so "wrong key" is diagnosable. */
export function requireKey(context: Context): string {
  if (context.apiKey) return context.apiKey;
  throw authError(
    "No API key. Run `distribute auth login`, set DISTRIBUTE_API_KEY, or pass --key. Create a key in the distribute.you dashboard or with POST /v1/api-keys.",
  );
}

/**
 * A destructive command asks first. With no terminal to ask in, which is how an
 * agent runs it, the command refuses and names the flag that authorises it:
 * silently proceeding is how an unattended run deletes something nobody meant.
 */
export async function confirm(context: Context, question: string): Promise<void> {
  if (context.assumeYes) return;
  if (!context.interactive) {
    throw new CliError({
      code: "confirmation_required",
      message: `${question} This is destructive and there is no terminal to confirm in. Re-run with --yes to authorise it.`,
      exitCode: EXIT.notConfirmed,
    });
  }
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = await rl.question(`${question} Type yes to continue: `);
    if (answer.trim().toLowerCase() !== "yes") {
      throw new CliError({ code: "confirmation_declined", message: "Cancelled.", exitCode: EXIT.notConfirmed });
    }
  } finally {
    rl.close();
  }
}

export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}
