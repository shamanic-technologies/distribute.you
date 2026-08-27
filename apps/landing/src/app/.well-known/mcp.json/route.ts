import { URLS } from "@distribute/content";

/**
 * MCP server descriptor at a predictable, machine-readable address.
 *
 * No MCP specification defines a well-known discovery URI today (checked against
 * the current spec), so this is a de-facto convention rather than a standard: an
 * agent that lands on the apex domain can find the server without reading prose.
 * The same server is named in /llms.txt, so the information exists in two places
 * and neither is the only copy.
 */
export const revalidate = 86400;

const MCP_ENDPOINT = "https://mcp.distribute.you/mcp";

export function GET() {
  return Response.json(
    {
      name: "distribute.you",
      description:
        "Autonomous sales meetings acquisition. Launch and inspect outbound campaigns, list brands and workflows, read live campaign stats, and suggest an ideal customer profile from a website.",
      version: "1",
      servers: [
        {
          name: "distribute.you",
          url: MCP_ENDPOINT,
          transport: "streamable-http",
          authentication: { type: "oauth2" },
        },
      ],
      documentation: `${URLS.docs}/mcp`,
      openapi: "https://api.distribute.you/openapi.json",
      contact: "support@distribute.you",
    },
    {
      headers: {
        "cache-control": "s-maxage=86400, stale-while-revalidate=31536000",
      },
    },
  );
}
