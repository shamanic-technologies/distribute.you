import { type ParsedArgs, flagValue } from "../args.js";
import { request } from "../client.js";
import { DEFAULT_API_URL, readConfig, writeConfig } from "../config.js";
import type { Context } from "../context.js";
import { CliError, EXIT, type ExitCode, usageError } from "../errors.js";
import { printJson } from "../output.js";

/**
 * Opens an account with no human in the loop: an agent gives an email it can
 * read and a phone number, then proves the email with the code it receives.
 * Neither step needs a key, which is the point: this is how a key is obtained.
 */
export async function signupStart(context: Context, args: ParsedArgs): Promise<ExitCode> {
  const email = flagValue(args, "email");
  const phone = flagValue(args, "phone");
  if (!email || !phone) {
    throw usageError(
      "Usage: distribute signup --email <address you can read> --phone <+E.164 number>. A 6-digit code is emailed; then run `distribute signup verify --email <address> --code <code>`.",
    );
  }

  const response = await request({
    method: "POST",
    path: "/v1/agent-signups/start",
    apiUrl: context.apiUrl,
    body: { email, phone },
    timeoutMs: context.timeoutMs,
  });

  printJson(
    context.io,
    {
      ok: true,
      ...(response.body as Record<string, unknown>),
      next: `Read the 6-digit code sent to ${email}, then run: distribute signup verify --email ${email} --code <code>`,
    },
    context.compact,
  );
  return EXIT.ok;
}

/**
 * Trades the emailed code for a new API key and stores it, so every command
 * after this one is authenticated. The key is printed too: an agent installing
 * the MCP server needs the key itself, not just a CLI that holds it.
 */
export async function signupVerify(context: Context, args: ParsedArgs): Promise<ExitCode> {
  const email = flagValue(args, "email");
  const code = flagValue(args, "code");
  if (!email || !code) {
    throw usageError("Usage: distribute signup verify --email <address> --code <6-digit code>");
  }
  const keyName = flagValue(args, "key-name");

  const response = await request({
    method: "POST",
    path: "/v1/agent-signups/complete",
    apiUrl: context.apiUrl,
    body: keyName ? { email, code, keyName } : { email, code },
    timeoutMs: context.timeoutMs,
  });

  const body = response.body as Record<string, unknown>;
  const apiKey = body.apiKey;
  if (typeof apiKey !== "string" || apiKey.length === 0) {
    throw new CliError({ code: "api_error", message: "The API answered without an apiKey.", exitCode: EXIT.api, details: body });
  }

  const stored = readConfig(context.env);
  const path = writeConfig(
    { ...stored, apiKey, apiUrl: context.apiUrl === DEFAULT_API_URL ? undefined : context.apiUrl },
    context.env,
  );

  printJson(context.io, { ok: true, storedAt: path, ...body }, context.compact);
  return EXIT.ok;
}
