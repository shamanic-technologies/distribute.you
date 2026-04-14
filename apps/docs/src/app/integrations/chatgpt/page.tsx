import { Metadata } from "next";

export const metadata: Metadata = {
  title: "ChatGPT Integration",
  description: "Use distribute with ChatGPT. Connect via MCP connector or use the REST API.",
};

export default function ChatGPTIntegrationPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-semibold text-gray-900 mb-3">ChatGPT</h1>
      <p className="text-base text-gray-500 mb-8">
        Use distribute with ChatGPT Plus, Pro, Team, or Enterprise.
      </p>

      <div className="prose">
        <h2>Option 1: MCP Connector</h2>
        <p>
          If your ChatGPT plan supports MCP connectors:
        </p>
        <ol>
          <li>Go to <strong>Settings &rarr; Connectors</strong></li>
          <li>Click <strong>Add Custom Connector</strong></li>
          <li>Enter the name: <code>distribute</code></li>
          <li>Configure the MCP server command: <code>npx @distribute/mcp --api-key=YOUR_KEY</code></li>
          <li>Save and enable</li>
        </ol>

        <h2>Option 2: REST API via GPT Actions</h2>
        <p>
          You can also create a custom GPT that calls the distribute REST API:
        </p>
        <ol>
          <li>Create a new GPT in ChatGPT</li>
          <li>Add an Action pointing to <code>https://api.distribute.you/v1</code></li>
          <li>Configure authentication with your API key in the <code>X-API-Key</code> header</li>
          <li>Import the OpenAPI spec from <code>https://api.distribute.you/docs</code></li>
        </ol>

        <h2>Requirements</h2>
        <ul>
          <li>ChatGPT Plus, Pro, Team, or Enterprise subscription</li>
          <li>distribute API key (get one at <a href="https://dashboard.distribute.you/api-keys">dashboard.distribute.you</a>)</li>
        </ul>
      </div>
    </div>
  );
}
