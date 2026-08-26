import { type ParsedArgs, boolFlag, keyValueFlag } from "../args.js";
import { request } from "../client.js";
import { resolveBody } from "../body.js";
import { type Context, confirm, requireKey } from "../context.js";
import { EXIT, type ExitCode, usageError } from "../errors.js";
import { printJson } from "../output.js";
import { findOperation, isDestructive, listOperations, loadSpec, normalisePath } from "../spec.js";

/**
 * The escape hatch, and the reason the named commands can stay small: any of
 * the API's operations can be driven from a shell without writing an HTTP
 * client. The path is checked against the live document first, so a typo is
 * reported as a typo instead of as a 404 from the gateway.
 */
export async function call(context: Context, args: ParsedArgs): Promise<ExitCode> {
  const [, methodRaw, pathRaw] = args.positionals;
  if (!methodRaw || !pathRaw) {
    throw usageError("Usage: distribute call <METHOD> <PATH> [--query k=v] [--body '<json>'|@file|-] [--data k=v]");
  }

  const method = methodRaw.toUpperCase();
  const path = normalisePath(pathRaw);
  const skipCheck = boolFlag(args, "no-verify");

  if (!skipCheck) {
    const { document } = await loadSpecFor(context, args);
    const operations = listOperations(document);
    const match = findOperation(operations, method, path);
    if (!match) {
      throw usageError(
        `${method} ${path} is not an operation of ${context.apiUrl}. Run \`distribute ops --search ${path.split("/").filter(Boolean).pop() ?? ""}\` to find it, or pass --no-verify to send it anyway.`,
      );
    }
  }

  if (isDestructive(method)) {
    await confirm(context, `${method} ${path} against ${context.apiUrl}.`);
  }

  const response = await request({
    method,
    path,
    apiUrl: context.apiUrl,
    apiKey: requireKey(context),
    query: keyValueFlag(args, "query"),
    headers: keyValueFlag(args, "header"),
    body: await resolveBody(args),
    timeoutMs: context.timeoutMs,
  });

  printJson(context.io, boolFlag(args, "include-status") ? response : response.body, context.compact);
  return EXIT.ok;
}

function loadSpecFor(context: Context, args: ParsedArgs) {
  return loadSpec({
    apiUrl: context.apiUrl,
    refresh: boolFlag(args, "refresh"),
    timeoutMs: context.timeoutMs,
    env: context.env,
  });
}
