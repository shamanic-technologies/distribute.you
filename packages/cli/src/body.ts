import { readFileSync } from "node:fs";
import { type ParsedArgs, flagValue, keyValueFlag } from "./args.js";
import { usageError } from "./errors.js";
import { readStdin } from "./context.js";

/**
 * Resolves the request body from `--body` (inline JSON, `@file`, or `-` for
 * stdin) or from repeated `--data key=value` pairs. Returns undefined when the
 * caller gave neither, so a GET stays a GET.
 *
 * `--data` values are sent as the strings they were typed as. Guessing that
 * "true" meant a boolean or "07" meant seven is how a CLI sends a body the
 * caller never wrote.
 */
export async function resolveBody(args: ParsedArgs): Promise<unknown | undefined> {
  const raw = flagValue(args, "body");
  const data = keyValueFlag(args, "data");
  const hasData = Object.keys(data).length > 0;

  if (raw !== undefined && hasData) {
    throw usageError("Pass either --body or --data, not both.");
  }
  if (raw === undefined) return hasData ? data : undefined;

  const text = raw === "-" ? await readStdin() : raw.startsWith("@") ? readFile(raw.slice(1)) : raw;
  if (text.trim().length === 0) throw usageError("--body was empty.");

  try {
    return JSON.parse(text);
  } catch (error) {
    throw usageError(`--body is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function readFile(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    throw usageError(`Could not read ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
