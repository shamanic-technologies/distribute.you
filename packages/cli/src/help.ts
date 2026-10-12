import { ROUTES } from "./routes.js";
import { commandName } from "./commands/resource.js";

const pad = (text: string, width: number): string => text + " ".repeat(Math.max(1, width - text.length));

export function helpText(): string {
  const named = ROUTES.map((route) => {
    const positional = route.pathParams.map((p) => ` <${p}>`).join("");
    return `  ${pad(commandName(route) + positional, 42)}${route.summary}`;
  }).join("\n");

  return `The distribute.you command line interface. The command is \`distribute\`.

Usage
  distribute <command> [flags]

Getting started (no human needed)
  ${pad("signup --email <e> --phone <p>", 42)}Open an account: a 6-digit code is emailed
  ${pad("signup verify --email <e> --code <c>", 42)}Get a new API key and store it
  ${pad("prepay --amount 10 --reload 15 --below 5", 42)}Prepay in dollars, auto top-up included: returns a payment url
  ${pad("prepay status", 42)}Balance, auto top-up, and whether the card can be recharged
  ${pad("auth login", 42)}Store an API key after checking it works
  ${pad("auth status", 42)}Show which key is in use and who it belongs to
  ${pad("auth logout", 42)}Remove the stored key

Every operation the API has
  ${pad("ops", 42)}List the API's operations, read from the API itself
  ${pad("describe <METHOD> <PATH>", 42)}Show one operation's parameters and body
  ${pad("call <METHOD> <PATH>", 42)}Send any request the API accepts

Named commands
${named}

Flags
  ${pad("--key <key>", 42)}Use this key instead of the stored one
  ${pad("--api-url <url>", 42)}Point at a different API
  ${pad("--query k=v", 42)}Add a query parameter, repeatable
  ${pad("--header k=v", 42)}Add a request header, repeatable
  ${pad("--body <json|@file|->", 42)}Request body, inline, from a file, or from stdin
  ${pad("--data k=v", 42)}Build a flat JSON body, repeatable
  ${pad("--include-status", 42)}Print the status and headers as well as the body
  ${pad("--compact", 42)}One line of JSON instead of indented
  ${pad("--yes", 42)}Confirm a destructive command up front
  ${pad("--refresh", 42)}Refetch the API description instead of using the cache
  ${pad("--timeout <ms>", 42)}Give up on a request after this long
  ${pad("--version", 42)}Print the version
  ${pad("--help", 42)}Print this

Credentials
  A key is read from --key, then DISTRIBUTE_API_KEY, then the file written by
  signup verify or auth login. No account yet? distribute signup gets one with
  an email you can read, no human needed. Free calls work right away; every
  paid call is prepaid (min $10), with auto top-up (min $15 when the balance
  falls under $5 or more). No free credit, no trial.

Output
  Results are JSON on stdout. Failures are JSON on stderr and exit non-zero:
  2 bad command, 3 auth, 4 not found, 5 API error, 6 network, 7 not confirmed,
  8 payment required (run prepay).
`;
}
