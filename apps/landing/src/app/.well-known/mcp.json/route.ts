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
        "Revenue made easy. No human needed: request a key with an email (distribute_signup_start, distribute_signup_complete), prepay when you need to spend (distribute_prepay). Read the method skills first (distribute_list_skills, distribute_read_skill): the steps our own Copilot follows. Then read brands, campaigns, leads and their results, and call any API operation.",
      version: "1",
      servers: [
        {
          name: "distribute.you",
          url: MCP_ENDPOINT,
          transport: "streamable-http",
          authentication: { type: "bearer" },
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
