import { type ParsedArgs, boolFlag, flagValue, keyValueFlag } from "../args.js";
import { request } from "../client.js";
import { resolveBody } from "../body.js";
import { type Context, confirm, requireKey } from "../context.js";
import { EXIT, type ExitCode, usageError } from "../errors.js";
import { printJson } from "../output.js";
import { type Route, fillPath, routesInGroup } from "../routes.js";

/** Runs one of the named commands from the route table. */
export async function runRoute(context: Context, route: Route, args: ParsedArgs): Promise<ExitCode> {
  // positionals are [group, action, ...values], except for single-word groups
  // like `whoami` where there is no action word to skip.
  const offset = route.action === "" ? 1 : 2;
  const values = args.positionals.slice(offset);
  if (values.length < route.pathParams.length) {
    throw usageError(
      `Usage: distribute ${commandName(route)} ${route.pathParams.map((p) => `<${p}>`).join(" ")}${route.query.length ? " [flags]" : ""}`,
    );
  }

  const query: Record<string, string> = { ...keyValueFlag(args, "query") };
  for (const binding of route.query) {
    const value = flagValue(args, binding.flag);
    if (value !== undefined) query[binding.param] = value;
  }

  if (route.destructive) {
    await confirm(context, `${route.summary}: ${route.method} ${fillPath(route, values)}.`);
  }

  const response = await request({
    method: route.method,
    path: fillPath(route, values),
    apiUrl: context.apiUrl,
    apiKey: requireKey(context),
    query,
    headers: keyValueFlag(args, "header"),
    body: route.acceptsBody ? await resolveBody(args) : undefined,
    timeoutMs: context.timeoutMs,
  });

  printJson(context.io, boolFlag(args, "include-status") ? response : response.body, context.compact);
  return EXIT.ok;
}

export function commandName(route: Route): string {
  return route.action === "" ? route.group : `${route.group} ${route.action}`;
}

export function groupUsage(group: string): string {
  const lines = routesInGroup(group).map((r) => {
    const positional = r.pathParams.map((p) => ` <${p}>`).join("");
    return `  distribute ${commandName(r)}${positional}${" ".repeat(Math.max(1, 34 - commandName(r).length - positional.length))}${r.summary}`;
  });
  return lines.join("\n");
}

export function unknownAction(group: string, action: string | undefined): never {
  throw usageError(
    `Unknown command: distribute ${group}${action ? ` ${action}` : ""}\n\nAvailable:\n${groupUsage(group)}`,
  );
}

export { EXIT };
