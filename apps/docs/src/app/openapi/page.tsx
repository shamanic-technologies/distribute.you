import { docsMetadata } from "@/lib/docs-metadata";
import { CopyForLLM } from "@/components/copy-for-llm";
import {
  MCP_ENDPOINT_URL,
  OPENAPI_DOCUMENT_URL,
  OPENAPI_EXPLORER_URL,
  docsHeading,
} from "@/lib/docs-routes";

export const metadata = docsMetadata("/openapi");

/**
 * A fixed address for the machine-readable entry points.
 *
 * Both the OpenAPI document and the MCP endpoint were reachable before this
 * page existed, and both were mentioned only inside prose. An agent asked to
 * find "the distribute.you OpenAPI spec" had to read a page to find a link;
 * now it can guess the URL, which is the whole point of a predictable one.
 */
const LLM_INSTRUCTIONS = `# distribute.you machine-readable entry points

## OpenAPI document
${OPENAPI_DOCUMENT_URL}
Covers every REST route under https://api.distribute.you/v1.
Authenticate with the header: X-API-Key: dist_YOUR_KEY

## Interactive API explorer
${OPENAPI_EXPLORER_URL}

## MCP server (Streamable HTTP)
${MCP_ENDPOINT_URL}
35 tools for brands, campaigns, workflows, leads, outlets, journalists,
articles, press kits, billing and costs.

## Local MCP server (stdio)
npx @distribute/mcp --api-key=dist_YOUR_KEY

## Documentation index for agents
https://docs.distribute.you/llms.txt
`;

export default function OpenApiPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-semibold text-gray-900">{docsHeading("/openapi")}</h1>
        <CopyForLLM content={LLM_INSTRUCTIONS} />
      </div>
      <p className="text-base text-gray-500 mb-8">
        The three addresses a program needs: the OpenAPI document, the explorer
        that renders it, and the hosted MCP server.
      </p>

      <div className="prose">
        <h2>OpenAPI document</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{OPENAPI_DOCUMENT_URL}</code>
        </pre>
        <p>
          Describes every REST route under{" "}
          <code>https://api.distribute.you/v1</code>. Generate a client from it,
          or hand it to an agent as the contract for the whole API.
        </p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`curl ${OPENAPI_DOCUMENT_URL} -o distribute-openapi.json`}</code>
        </pre>

        <h2>Interactive explorer</h2>
        <p>
          <a href={OPENAPI_EXPLORER_URL} target="_blank" rel="noopener noreferrer">
            {OPENAPI_EXPLORER_URL}
          </a>{" "}
          renders the same document, with a request builder per route.
        </p>

        <h2>MCP server</h2>
        <p>
          The hosted server speaks Streamable HTTP and exposes 35 tools. Point
          any MCP-compatible client at it:
        </p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{MCP_ENDPOINT_URL}</code>
        </pre>
        <p>
          Or run it locally over stdio, which is what the{" "}
          <a href="/mcp/installation/">installation guide</a> configures:
        </p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>npx @distribute/mcp --api-key=dist_YOUR_KEY</code>
        </pre>

        <h2>Authentication</h2>
        <p>
          Every route takes the same key, issued in the dashboard and sent as a
          header. See <a href="/authentication/">Authentication</a>.
        </p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>X-API-Key: dist_YOUR_KEY</code>
        </pre>

        <h2>Reading the docs as an agent</h2>
        <p>
          <a href="/llms.txt">docs.distribute.you/llms.txt</a> lists every page
          on this site with a one-line summary, plus the three URLs above.
        </p>
      </div>
    </div>
  );
}
