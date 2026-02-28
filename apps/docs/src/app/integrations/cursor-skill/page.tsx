import { Metadata } from "next";
import { CopyForLLM } from "@/components/copy-for-llm";

export const metadata: Metadata = {
  title: "Cursor Skill",
  description: "Use distribute as a Cursor skill for AI-assisted distribution automation. Installation and example prompts.",
  openGraph: {
    title: "Cursor Skill | distribute Docs",
    description: "Install distribute as a Cursor skill.",
  },
};

const LLM_INSTRUCTIONS = `# distribute Cursor Skill

## What is a Cursor Skill?
Cursor Skills extend AI assistant capabilities. The distribute skill enables launching and managing automated campaigns from Cursor IDE.

## Installation

### Global Skill
Create: ~/.cursor/skills/mcpfactory/SKILL.md

### MCP Configuration
Add to .cursor/mcp.json:
{
  "mcpServers": {
    "mcpfactory": {
      "url": "https://mcp.mcpfactory.org/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}

## Example Prompts
- "Launch a cold email campaign for acme.com targeting CTOs at SaaS companies"
- "Find fitness influencers with 10k-100k followers and pitch them"
- "What's the status of my sales campaign?"
- "Pause my sales outreach campaign"

## Best Practices
1. Be specific about target audience
2. Always set budget limits
3. Start with 3-5 day trial
4. Check stats regularly`;

export default function CursorSkillPage() {
  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-4xl font-bold">Cursor Skill</h1>
        <CopyForLLM content={LLM_INSTRUCTIONS} />
      </div>
      <p className="text-xl text-gray-600 mb-8">
        Use distribute as a Cursor skill for AI-assisted distribution automation.
      </p>

      <div className="prose prose-lg">
        <h2>What is a Cursor Skill?</h2>
        <p>
          Cursor Skills are specialized instructions that extend your AI
          assistant&apos;s capabilities. The distribute skill enables your Cursor
          agent to launch and manage automated campaigns directly from your IDE.
        </p>

        <h2>Installation</h2>

        <h3>Option 1: Global Skill</h3>
        <p>
          Create a file at <code>~/.cursor/skills/mcpfactory/SKILL.md</code>:
        </p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`# distribute Skill

Use this skill to launch automated distribution campaigns.

## Available MCPs
- @mcpfactory/sales-outreach - Cold email campaigns
- @mcpfactory/influencer-pitch - Influencer outreach
- @mcpfactory/journalist-pitch - Press outreach

## Usage
When the user asks to launch a campaign, outreach, or 
generate leads, use the appropriate distribute tool.

## Configuration
Ensure MCPFACTORY_API_KEY is set in your MCP config.

## Example Prompts
- "Launch a cold email campaign for acme.com"
- "Find influencers in the fitness niche and pitch them"
- "Get me press coverage for our product launch"`}</code>
        </pre>

        <h3>Option 2: Project Skill</h3>
        <p>
          Create a <code>.cursor/skills/mcpfactory/SKILL.md</code> in your
          project root for project-specific configuration.
        </p>

        <h2>MCP Configuration</h2>
        <p>
          Add to your <code>.cursor/mcp.json</code>:
        </p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`{
  "mcpServers": {
    "mcpfactory": {
      "url": "https://mcp.mcpfactory.org/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}`}</code>
        </pre>

        <h2>Example Prompts</h2>

        <h3>Sales Outreach</h3>
        <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto">
          <code className="text-gray-800">{`"Launch a cold email campaign for our startup acme.com.
Target: CTOs at SaaS companies with 50-200 employees.
Budget: $15/day max, run for 7 days.
Send me daily reports at founders@acme.com."`}</code>
        </pre>

        <h3>Influencer Pitch</h3>
        <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto">
          <code className="text-gray-800">{`"Find fitness influencers with 10k-100k followers on Instagram.
Pitch them our new protein powder with a collaboration offer.
Budget: $20/day, weekly reports."`}</code>
        </pre>

        <h3>Check Campaign Status</h3>
        <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto">
          <code className="text-gray-800">{`"What's the status of my sales campaign?
How many emails sent, opened, replied?"`}</code>
        </pre>

        <h3>Pause/Resume</h3>
        <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto">
          <code className="text-gray-800">{`"Pause my sales outreach campaign, we're at capacity."

"Resume the campaign, we can handle more leads now."`}</code>
        </pre>

        <h2>Best Practices</h2>
        <ol>
          <li>
            <strong>Be specific about your target audience</strong> - The more
            details you provide, the better the results
          </li>
          <li>
            <strong>Always set budget limits</strong> - Prevent unexpected API
            costs
          </li>
          <li>
            <strong>Start with a trial</strong> - Run 3-5 days first to validate
            results
          </li>
          <li>
            <strong>Check stats regularly</strong> - Ask for campaign performance
            updates
          </li>
        </ol>

        <h2>Troubleshooting</h2>

        <h3>MCP not found</h3>
        <p>
          Ensure the MCP is installed and your <code>mcp.json</code> is correctly
          configured. Restart Cursor after changes.
        </p>

        <h3>API key errors</h3>
        <p>
          Verify your <code>MCPFACTORY_API_KEY</code> is valid at{" "}
          <a href="https://dashboard.mcpfactory.org/api-keys">dashboard.mcpfactory.org/api-keys</a>.
        </p>

        <h3>API key missing</h3>
        <p>
          Configure required API keys in your dashboard before launching
          campaigns.
        </p>
      </div>
    </div>
  );
}
