import { agentSkillMarkdown } from "@/lib/agent-skill";

// Static export writes this out as a plain `skill.md` file, so any static host
// serves it with no server behind it.
export const dynamic = "force-static";

export function GET() {
  return new Response(agentSkillMarkdown(), {
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
}
