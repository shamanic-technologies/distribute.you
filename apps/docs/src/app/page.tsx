import { URLS, WORKFLOW_DEFINITIONS } from "@distribute/content";

export default function DocsHome() {
  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <h1 className="font-display text-4xl font-bold mb-4 text-gray-800">distribute Documentation</h1>
      <p className="text-xl text-gray-600 mb-8">
        The Stripe for Distribution. AI-powered distribution automation from your URL.
      </p>

      <div className="prose prose-lg">
        <h2 className="font-display">What is distribute?</h2>
        <p>
          distribute is an AI-powered distribution automation platform built on the Model Context Protocol (MCP).
          You provide a URL and budget, distribute handles lead finding, content generation, outreach,
          optimization, and reporting — all automated.
        </p>

        <h2>Getting Started</h2>
        <ol>
          <li>
            <a href={URLS.signUp}>Create an account</a> and get your API key
          </li>
          <li>Configure your own API keys (OpenAI, Apollo, Resend, etc.)</li>
          <li>Install the MCP you want to use</li>
          <li>Start automating from Claude, Cursor, or any MCP-compatible client</li>
        </ol>

        <h2>Available Workflows</h2>
        <ul>
          {WORKFLOW_DEFINITIONS.map((wf) => (
            <li key={wf.featureSlug}>
              <a href={`/${wf.featureSlug}`}>
                <strong>{wf.label}</strong>
              </a>
              {" - "}{wf.description}
            </li>
          ))}
        </ul>

        <h2>Key Concepts</h2>
        <h3>Automated Distribution</h3>
        <p>
          Unlike traditional tools that require manual setup at every step, distribute automates the full
          distribution pipeline. You provide your URL and budget — distribute handles lead finding,
          content generation, outreach, optimization, and reporting.
        </p>

        <h3>Your Own API Keys</h3>
        <p>
          distribute uses your own API keys for the underlying services (OpenAI, Apollo, Resend, etc.).
          You pay those providers directly at their rates — no hidden markups.
        </p>
      </div>
    </div>
  );
}
