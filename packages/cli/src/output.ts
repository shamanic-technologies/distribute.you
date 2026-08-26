import type { CliError } from "./errors.js";

export interface Io {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
}

export const consoleIo: Io = {
  stdout: (line) => process.stdout.write(`${line}\n`),
  stderr: (line) => process.stderr.write(`${line}\n`),
};

/**
 * Everything this CLI prints on success is JSON on stdout, and every failure is
 * JSON on stderr. The first reader is an agent, so one shape it can always
 * parse beats prose it has to guess at.
 */
export function printJson(io: Io, value: unknown, compact: boolean): void {
  io.stdout(compact ? JSON.stringify(value) : JSON.stringify(value, null, 2));
}

export function printError(io: Io, error: CliError, compact: boolean): void {
  const payload: Record<string, unknown> = {
    error: {
      code: error.code,
      message: error.message,
      exitCode: error.exitCode,
    },
  };
  if (error.details !== undefined) (payload.error as Record<string, unknown>).details = error.details;
  io.stderr(compact ? JSON.stringify(payload) : JSON.stringify(payload, null, 2));
}
