import { URLS, WORKFLOW_DEFINITIONS } from "@mcpfactory/content";

export default function DocsHome() {
  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <h1 className="font-display text-4xl font-bold mb-4 text-gray-800">MCP Factory Documentation</h1>
      <p className="text-xl text-gray-600 mb-8">
        The DFY, BYOK MCP Platform. From URL to Revenue.
      </p>

      <div className="prose prose-lg">
        <h2 className="font-display">What is MCP Factory?</h2>
        <p>
          MCP Factory provides Done-For-You (DFY) automation tools via the Model Context Protocol (MCP).
          You provide a URL + budget, we handle everything else.
        </p>

        <h2>Getting Started</h2>
        <ol>
          <li>
            <a href={URLS.signUp}>Create an account</a> and get your API key
          </li>
          <li>Configure your BYOK keys (OpenAI, Apollo, Resend, etc.)</li>
          <li>Install the MCP you want to use</li>
          <li>Start automating from Claude, Cursor, or any MCP-compatible client</li>
        </ol>

        <h2>Available Workflows</h2>
        <ul>
          {WORKFLOW_DEFINITIONS.map((wf) => (
            <li key={wf.sectionKey}>
              <a href={`/${wf.sectionKey}`}>
                <strong>{wf.label}</strong>
              </a>
              {" - "}{wf.description}
            </li>
          ))}
        </ul>

        <h2>Key Concepts</h2>
        <h3>DFY (Done For You)</h3>
        <p>
          Unlike traditional tools that require you to set up everything, MCP Factory does the work for you.
          You just provide your URL and budget - we handle lead finding, content generation, outreach,
          optimization, and reporting.
        </p>

        <h3>BYOK (Bring Your Own Keys)</h3>
        <p>
          You use your own API keys for the underlying services (OpenAI, Apollo, Resend, etc.).
          This means you pay only for actual usage with no hidden markups.
        </p>
      </div>
    </div>
  );
}
