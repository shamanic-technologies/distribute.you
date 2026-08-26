import { type ParsedArgs, boolFlag, flagValue } from "../args.js";
import { type Context } from "../context.js";
import { EXIT, type ExitCode, usageError } from "../errors.js";
import { printJson } from "../output.js";
import { filterOperations, findOperation, listOperations, loadSpec, normalisePath } from "../spec.js";

/** Lists what this API can actually do, read from the API itself. */
export async function ops(context: Context, args: ParsedArgs): Promise<ExitCode> {
  const { document, source, fetchedAt } = await load(context, args);
  const all = listOperations(document);
  const matching = filterOperations(all, {
    tag: flagValue(args, "tag"),
    method: flagValue(args, "method"),
    search: flagValue(args, "search"),
  });

  printJson(
    context.io,
    {
      apiUrl: context.apiUrl,
      spec: { source, fetchedAt: new Date(fetchedAt).toISOString(), title: document.info?.title, version: document.info?.version },
      total: all.length,
      returned: matching.length,
      tags: [...new Set(all.flatMap((op) => op.tags))].sort(),
      operations: matching.map((op) => ({
        method: op.method,
        path: op.path,
        operationId: op.operationId,
        summary: op.summary,
        tags: op.tags,
        destructive: op.destructive,
      })),
    },
    context.compact,
  );
  return EXIT.ok;
}

/** The parameters and body one operation takes, so a caller can build a call. */
export async function describe(context: Context, args: ParsedArgs): Promise<ExitCode> {
  const [, methodRaw, pathRaw] = args.positionals;
  if (!methodRaw || !pathRaw) throw usageError("Usage: distribute describe <METHOD> <PATH>");

  const { document } = await load(context, args);
  const operation = findOperation(listOperations(document), methodRaw, normalisePath(pathRaw));
  if (!operation) {
    throw usageError(`${methodRaw.toUpperCase()} ${normalisePath(pathRaw)} is not an operation of ${context.apiUrl}.`);
  }

  printJson(context.io, operation, context.compact);
  return EXIT.ok;
}

function load(context: Context, args: ParsedArgs) {
  return loadSpec({
    apiUrl: context.apiUrl,
    refresh: boolFlag(args, "refresh"),
    timeoutMs: context.timeoutMs,
    env: context.env,
  });
}
