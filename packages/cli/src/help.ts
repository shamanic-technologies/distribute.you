import { ROUTES } from "./routes.js";
import { commandName } from "./commands/resource.js";

const pad = (text: string, width: number): string => text + " ".repeat(Math.max(1, width - text.length));

export function helpText(): string {
  const named = ROUTES.map((route) => {
    const positional = route.pathParams.map((p) => ` <${p}>`).join("");
    return `  ${pad(commandName(route) + positional, 32)}${route.summary}`;
  }).join("\n");

  return `distribute, the command line interface for the distribute API.

Usage
  distribute <command> [flags]

Getting started
  ${pad("auth login", 32)}Store an API key after checking it works
  ${pad("auth status", 32)}Show which key is in use and who it belongs to
  ${pad("auth logout", 32)}Remove the stored key

Every operation the API has
  ${pad("ops", 32)}List the API's operations, read from the API itself
  ${pad("describe <METHOD> <PATH>", 32)}Show one operation's parameters and body
  ${pad("call <METHOD> <PATH>", 32)}Send any request the API accepts

Named commands
${named}

Flags
  ${pad("--key <key>", 32)}Use this key instead of the stored one
  ${pad("--api-url <url>", 32)}Point at a different API
  ${pad("--query k=v", 32)}Add a query parameter, repeatable
  ${pad("--header k=v", 32)}Add a request header, repeatable
  ${pad("--body <json|@file|->", 32)}Request body, inline, from a file, or from stdin
  ${pad("--data k=v", 32)}Build a flat JSON body, repeatable
  ${pad("--include-status", 32)}Print the status and headers as well as the body
  ${pad("--compact", 32)}One line of JSON instead of indented
  ${pad("--yes", 32)}Confirm a destructive command up front
  ${pad("--refresh", 32)}Refetch the API description instead of using the cache
  ${pad("--timeout <ms>", 32)}Give up on a request after this long
  ${pad("--version", 32)}Print the version
  ${pad("--help", 32)}Print this

Credentials
  A key is read from --key, then DISTRIBUTE_API_KEY, then the file written by
  auth login. Create a key in the distribute dashboard or with
  distribute call POST /v1/api-keys --data name=my-cli-key

Output
  Results are JSON on stdout. Failures are JSON on stderr and exit non-zero:
  2 bad command, 3 auth, 4 not found, 5 API error, 6 network, 7 not confirmed.
`;
}
