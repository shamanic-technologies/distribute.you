# distribute CLI

Drive the [distribute](https://distribute.you) API from a shell. Authenticate once, then read and
change the things the product is made of: brands, campaigns, leads, audiences, workflows, runs and
billing. Anything the API can do, the CLI can send, so scripting the product does not mean writing
an HTTP client first.

Results are JSON on stdout, failures are JSON on stderr, and the exit code says which kind of
failure it was. The first reader of this tool is an agent, so that shape comes before pretty output.

## Install

```bash
npx @distribute.you/cli --help          # no install
npm install -g @distribute.you/cli      # or keep it around as `distribute`
```

Then point it at your account once:

```bash
distribute auth login
```

The key is the one you create in the dashboard. It carries your organisation and user identity, so
nothing else needs configuring.

## Authenticating

Create an API key in the distribute dashboard, then hand it over once:

```bash
echo "$MY_KEY" | distribute auth login
distribute auth status
```

The key is written to `~/.config/distribute/config.json`, readable by its owner only. A key is read
from `--key` first, then `DISTRIBUTE_API_KEY`, then that file, so CI can pass one through the
environment and never write it to disk. `auth status` says which of the three answered, so a run
that used the wrong key is diagnosable.

`auth login` calls the API before it stores anything. A key that does not work is refused here
rather than three commands later.

## Named commands

```bash
distribute whoami
distribute brands list
distribute campaigns list --brand "$BRAND_ID" --status active
distribute campaigns stats "$CAMPAIGN_ID"
distribute leads stats --brand "$BRAND_ID" --group-by campaignId
distribute leads list --brand "$BRAND_ID" --limit 50
distribute audiences list --brand "$BRAND_ID" --status active
distribute workflows list --feature sales-cold-email-outreach
distribute runs list --brand "$BRAND_ID" --status failed --limit 20
distribute billing balance
```

`distribute help` lists all of them.

## Every other operation

The named commands cover the common ground. The rest of the API is one command away, and the list
comes from the API itself rather than from anything committed here:

```bash
distribute ops --tag Campaigns
distribute ops --search audience
distribute describe POST /v1/orgs/audiences
distribute call POST /v1/orgs/audiences --body '{"brandId":"...","name":"Founders in Berlin"}'
distribute call GET /v1/leads --query brandId=... --query limit=10
```

`call` checks the method and path against the live description before sending anything, so a typo
comes back as a typo instead of as a 404 from the gateway. `--no-verify` sends it regardless.

Bodies come from `--body` (inline JSON, `@file`, or `-` for stdin) or from repeated `--data key=value`
pairs, which build a flat object. `--data` values are sent as the strings you typed: nothing here
decides that `true` was meant as a boolean.

## Destructive commands

Anything that deletes or stops asks first. With no terminal to ask in, which is how an agent runs
it, the command refuses and names the flag that authorises it:

```bash
$ distribute audiences delete "$ID"
{"error":{"code":"confirmation_required","message":"... Re-run with --yes to authorise it.","exitCode":7}}
$ distribute audiences delete "$ID" --yes
```

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | It worked |
| 1 | Something unexpected, with the message and the top of the stack |
| 2 | The command line was wrong |
| 3 | No key, or the API rejected the one sent |
| 4 | The API answered 404 |
| 5 | The API answered with another error status |
| 6 | The request never reached the API |
| 7 | A destructive command was not confirmed |

An API error carries the upstream body verbatim under `error.details`. The API writes its messages
for people to read, and shortening them here would throw away the only explanation you get.

## Flags

| Flag | What it does |
|------|--------------|
| `--key <key>` | Use this key instead of the stored one |
| `--api-url <url>` | Point at a different API |
| `--query k=v` | Add a query parameter, repeatable |
| `--header k=v` | Add a request header, repeatable |
| `--body <json\|@file\|->` | Request body |
| `--data k=v` | Build a flat JSON body, repeatable |
| `--include-status` | Print the status and headers as well as the body |
| `--compact` | One line of JSON instead of indented |
| `--yes` | Confirm a destructive command up front |
| `--refresh` | Refetch the API description instead of using the cached copy |
| `--timeout <ms>` | Give up on a request after this long |

## How it stays current

The command surface is read from `GET /openapi.json` on the API you are pointed at, cached for a day
under `~/.config/distribute/`, and refetched with `--refresh`. No copy of that document lives in this
package. The API gains operations and renames them, and a snapshot baked in at build time would
start lying the day after it shipped.

The named commands are the one hand written part, and `tests/spec-conformance.test.ts` reads the live
document and fails if any of them names an operation that is not there.

## MCP

Agents that speak MCP can use the server at `https://mcp.distribute.you/mcp` instead. It is the same
product through a different door: MCP for an agent that discovers tools, this for a shell script
or a CI job.

## Developing

```bash
pnpm --filter @distribute.you/cli build      # bundle to dist/
pnpm --filter @distribute.you/cli test       # unit tests plus the live conformance check
pnpm --filter @distribute.you/cli typecheck
```

The CLI has no runtime dependencies. Installing it pulls one package and nothing else.
