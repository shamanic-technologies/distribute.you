import { z } from "zod";

/**
 * A brand's MCP servers (BRAND-MCP-1109, public beta): the servers our conversation AI
 * may call when it writes to the brand's leads and clients. Producer = chat-service
 * (`/orgs/brands/:brandId/mcp-servers`, v0.63.157), reached through the api-service gateway.
 * The Authorization value is write-only: no read ever carries it (`hasAuthorization` only).
 * Alias-free on purpose (unit-tested without the `@` alias).
 */
export const BrandMcpServerSchema = z.object({
  id: z.string(),
  brandId: z.string(),
  name: z.string(),
  url: z.string(),
  hasAuthorization: z.boolean(),
  // The producer's own status vocabulary, forwarded (never re-declared as a closed enum).
  status: z.string(),
  error: z.string().nullish(),
  toolCount: z.coerce.number(),
  toolNames: z.array(z.string()),
  checkedAt: z.string().nullish(),
  createdAt: z.string(),
});

export type BrandMcpServer = z.infer<typeof BrandMcpServerSchema>;

export const BrandMcpServersResponseSchema = z.object({ servers: z.array(BrandMcpServerSchema) });
export const BrandMcpServerResponseSchema = z.object({ server: BrandMcpServerSchema });

/** True when the producer could list the server's tools at its last check. */
export function isConnected(s: BrandMcpServer): boolean {
  return s.status === "connected";
}

/** One line under a server's name: what our AI can do with it, or why it cannot. */
export function serverStateLine(s: BrandMcpServer): string {
  if (isConnected(s)) return s.toolCount === 1 ? "Connected · 1 tool" : `Connected · ${s.toolCount} tools`;
  return s.error ? `Not connected: ${s.error}` : "Not connected";
}
