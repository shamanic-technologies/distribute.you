import { docsMetadata } from "@/lib/docs-metadata";
import { docsHeading } from "@/lib/docs-routes";
import { CopyForLLM } from "@/components/copy-for-llm";
import {
  MCP_TOOL_COUNT,
  MCP_URL,
  mcpToolsByCategory,
} from "@/lib/developer-surfaces";

export const metadata = docsMetadata("/mcp/tools");

const TOOL_CATEGORIES = mcpToolsByCategory();

const LLM_INSTRUCTIONS = TOOL_CATEGORIES.map(
  (cat) => `## ${cat.name}\n${cat.tools.map((t) => `- ${t.name}: ${t.description}`).join("\n")}`,
).join("\n\n");

export default function McpToolsPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-semibold text-gray-900">{docsHeading("/mcp/tools")}</h1>
        <CopyForLLM
          content={`# distribute.you MCP Tools (${MCP_TOOL_COUNT} total)\n\nEndpoint: ${MCP_URL}\n\n${LLM_INSTRUCTIONS}`}
        />
      </div>
      <p className="text-base text-gray-500 mb-8">
        Every tool the hosted distribute.you MCP server exposes, {MCP_TOOL_COUNT} in all. This is
        the list a connected client reads back from <code>{MCP_URL}</code>. Anything a campaign
        needs beyond these is reachable over the REST API.
      </p>

      <div className="space-y-12">
        {TOOL_CATEGORIES.map((category) => (
          <section key={category.name}>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">{category.name}</h2>
            <div className="space-y-3">
              {category.tools.map((tool) => (
                <div
                  key={tool.name}
                  className="border border-gray-200 rounded-lg p-4 hover:border-brand-300 transition"
                >
                  <code className="text-brand-700 font-medium text-sm">{tool.name}</code>
                  <p className="text-gray-600 text-sm mt-1">{tool.description}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
