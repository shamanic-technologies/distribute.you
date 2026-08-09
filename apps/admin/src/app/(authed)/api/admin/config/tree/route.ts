import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin-allowlist";
import { AGENT_CONFIG_REPO, groupConfigTree } from "@/lib/config-files";
import { GithubConfigError, githubConfigToken, listConfigRepos, readAgentConfigPaths } from "@/lib/github-config";

/**
 * GET /api/admin/config/tree
 *
 * The left-hand list of the config console: every file in agent-config, grouped, plus
 * the product repositories whose CLAUDE.md can be opened.
 *
 * The product repositories are listed but NOT probed. Confirming which ones actually
 * carry a CLAUDE.md would cost one request each, and the honest answer for a repo
 * without one is a message when you open it rather than a silently shorter list.
 *
 * Staff-only, re-checked off the session `email` claim. The Cloudflare Access
 * application in front of the hostname is the first gate; this is the second, and it
 * is the one that holds if a request reaches the origin another way.
 */
export async function GET() {
  const { userId, sessionClaims } = await auth();
  if (!userId || !isAdminEmail(sessionClaims?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!githubConfigToken()) {
    return NextResponse.json(
      {
        error: "no_token",
        message: "GITHUB_CONFIG_TOKEN is not set on this deployment, so no configuration can be read.",
      },
      { status: 503 },
    );
  }

  try {
    const [paths, repos] = await Promise.all([readAgentConfigPaths(), listConfigRepos()]);
    return NextResponse.json({
      agentConfigRepo: AGENT_CONFIG_REPO,
      groups: groupConfigTree(paths),
      repos,
    });
  } catch (err) {
    if (err instanceof GithubConfigError) {
      console.error("[admin-config] tree read failed", err.status, err.message);
      return NextResponse.json({ error: "github", message: err.message }, { status: err.status });
    }
    throw err;
  }
}
