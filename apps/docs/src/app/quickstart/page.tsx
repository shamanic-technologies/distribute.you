import { Metadata } from "next";
import { CopyForLLM } from "@/components/copy-for-llm";
import { URLS } from "@distribute/content";

export const metadata: Metadata = {
  title: "Quick Start",
  description: "Get started with distribute in 5 minutes. Connect from ChatGPT, Claude, or Cursor and launch your first campaign.",
  openGraph: {
    title: "Quick Start | distribute Docs",
    description: "Get started with distribute in 5 minutes.",
  },
};

const LLM_INSTRUCTIONS = `# distribute Quick Start

## 1. Create Account
Sign up at: https://{URLS.signUp.replace("https://", "")}

## 2. Get API Key
Dashboard → API Keys

## 3. Configure Your API Keys (Optional)
Dashboard → API Keys:
- Apollo: For lead search
- Anthropic: For AI email generation

## 4. Connect Your AI Client

### Cursor (.cursor/mcp.json):
{
  "mcpServers": {
    "distribute": {
      "url": "https://mcp.distribute.you/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}

### ChatGPT/Claude:
Settings → Connectors → Add: https://mcp.distribute.you/mcp

## 5. Test Connection
Ask: "Check my distribute connection status"

## 6. Launch Campaign
Example prompt: "Launch a cold email campaign for mybrand.com, targeting CTOs at SaaS companies. $10/day budget, 5 days trial."`;

export default function QuickstartPage() {
  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-4xl font-bold">Quick Start</h1>
        <CopyForLLM content={LLM_INSTRUCTIONS} />
      </div>
      <p className="text-xl text-gray-600 mb-8">
        Get up and running with distribute in 5 minutes.
      </p>

      <div className="prose prose-lg">
        <h2>1. Create an Account</h2>
        <p>
          Go to{" "}
          <a href={URLS.signUp}>
            {URLS.signUp.replace("https://", "")}
          </a>{" "}
          and create your account.
        </p>

        <h2>2. Get Your API Key</h2>
        <p>
          In the dashboard, go to{" "}
          <strong>API Keys</strong> and copy your distribute API key.
        </p>

        <h2>3. Configure Your API Keys (Optional)</h2>
        <p>
          For advanced features, add your own API keys in{" "}
          <strong>API Keys</strong>:
        </p>
        <ul>
          <li><strong>Apollo</strong> - For lead search and enrichment</li>
          <li><strong>Anthropic</strong> - For AI-powered email generation</li>
        </ul>

        <h2>4. Connect Your AI Client</h2>

        <h3>ChatGPT</h3>
        <ol>
          <li>Go to Settings → Connectors</li>
          <li>Add custom connector with URL: <code>https://mcp.distribute.you/mcp</code></li>
          <li>Add your API key for authentication</li>
        </ol>

        <h3>Claude.ai</h3>
        <ol>
          <li>Go to Settings → Connectors</li>
          <li>Add the MCP URL: <code>https://mcp.distribute.you/mcp</code></li>
          <li>Configure your API key</li>
        </ol>

        <h3>Cursor</h3>
        <p>Add to <code>.cursor/mcp.json</code>:</p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`{
  "mcpServers": {
    "distribute": {
      "url": "https://mcp.distribute.you/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}`}</code>
        </pre>

        <h2>5. Test the Connection</h2>
        <p>In your AI client, ask:</p>
        <blockquote>&quot;Check my distribute connection status&quot;</blockquote>
        <p>
          The AI will call <code>distribute_status</code> and confirm your
          connection is working.
        </p>

        <h2>6. Launch Your First Campaign</h2>
        <p>Just describe what you want in natural language:</p>
        <blockquote>
          &quot;Launch a cold email campaign for mybrand.com, targeting CTOs at SaaS
          companies. $10/day budget, 5 days trial.&quot;
        </blockquote>

        <p>The MCP will:</p>
        <ol>
          <li>Scrape your website to understand your business</li>
          <li>Find relevant leads via Apollo</li>
          <li>Generate personalized emails with AI</li>
          <li>Send emails and track responses</li>
          <li>Qualify replies and notify you of interested prospects</li>
        </ol>

        <h2>What&apos;s Next?</h2>
        <ul>
          <li>
            <a href="/mcp">MCP Usage Guide</a> - Full MCP documentation
          </li>
          <li>
            <a href="/api">API Reference</a> - Direct REST API access
          </li>
          <li>
            <a href="/sales-outreach">Sales Outreach</a> - Campaign configuration
          </li>
        </ul>
      </div>
    </div>
  );
}
