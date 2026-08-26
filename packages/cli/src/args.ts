import { usageError } from "./errors.js";

export interface ParsedArgs {
  /** Everything that is not a flag, in the order it was written. */
  positionals: string[];
  /** A flag given more than once keeps every value, in order. */
  flags: Map<string, string[]>;
}

/**
 * Parses `--flag value`, `--flag=value` and `--boolean`. A bare `--` ends flag
 * parsing, so a value that looks like a flag can still be passed through.
 *
 * Deliberately hand written: the CLI ships with no runtime dependencies, so an
 * agent installing it pulls one package and nothing else.
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags = new Map<string, string[]>();
  let flagsClosed = false;

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (flagsClosed || !token.startsWith("--")) {
      positionals.push(token);
      continue;
    }

    if (token === "--") {
      flagsClosed = true;
      continue;
    }

    const body = token.slice(2);
    if (body.length === 0) throw usageError(`Not a valid flag: ${token}`);

    const eq = body.indexOf("=");
    if (eq !== -1) {
      push(flags, body.slice(0, eq), body.slice(eq + 1));
      continue;
    }

    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      push(flags, body, "true");
      continue;
    }

    push(flags, body, next);
    i += 1;
  }

  return { positionals, flags };
}

function push(flags: Map<string, string[]>, name: string, value: string): void {
  const existing = flags.get(name);
  if (existing) existing.push(value);
  else flags.set(name, [value]);
}

export function flagValue(args: ParsedArgs, name: string): string | undefined {
  const values = args.flags.get(name);
  if (!values) return undefined;
  return values[values.length - 1];
}

export function flagValues(args: ParsedArgs, name: string): string[] {
  return args.flags.get(name) ?? [];
}

export function boolFlag(args: ParsedArgs, name: string): boolean {
  const value = flagValue(args, name);
  if (value === undefined) return false;
  return value !== "false";
}

/** `--query brandId=abc` and friends. */
export function keyValueFlag(args: ParsedArgs, name: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entry of flagValues(args, name)) {
    const eq = entry.indexOf("=");
    if (eq <= 0) throw usageError(`--${name} expects key=value, received: ${entry}`);
    out[entry.slice(0, eq)] = entry.slice(eq + 1);
  }
  return out;
}
