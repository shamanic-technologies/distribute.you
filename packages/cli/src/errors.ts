/**
 * Exit codes are part of the CLI's contract. An agent branches on them, so they
 * are stable and specific: a caller can tell "your key is wrong" from "the API
 * said no" from "the network is down" without parsing any text.
 */
export const EXIT = {
  ok: 0,
  /** Something we did not anticipate. The message says what. */
  unexpected: 1,
  /** The command line itself was wrong: unknown command, missing argument. */
  usage: 2,
  /** No credential, or the API rejected the one we sent (401 / 403). */
  auth: 3,
  /** The API answered 404. */
  notFound: 4,
  /** The API answered with some other error status. */
  api: 5,
  /** The request never reached the API. */
  network: 6,
  /** A destructive command was not confirmed. */
  notConfirmed: 7,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];

/**
 * Every failure the CLI knows how to describe. `details` is printed verbatim,
 * so an API error body reaches the caller unedited rather than being summarised
 * into something shorter and less true.
 */
export class CliError extends Error {
  readonly code: string;
  readonly exitCode: ExitCode;
  readonly details?: unknown;

  constructor(args: { code: string; message: string; exitCode: ExitCode; details?: unknown }) {
    super(args.message);
    this.name = "CliError";
    this.code = args.code;
    this.exitCode = args.exitCode;
    this.details = args.details;
  }
}

export function usageError(message: string): CliError {
  return new CliError({ code: "usage_error", message, exitCode: EXIT.usage });
}

export function authError(message: string, details?: unknown): CliError {
  return new CliError({ code: "auth_error", message, exitCode: EXIT.auth, details });
}
