import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdminEmail } from "@/lib/admin-allowlist";
import { configReadProblem, configWriteProblem, defaultCommitMessage } from "@/lib/config-files";
import { GithubConfigError, githubConfigToken, readConfigFile, writeConfigFile } from "@/lib/github-config";

/**
 * GET  /api/admin/config/file?repo=&path=   read one config file
 * PUT  /api/admin/config/file               commit one config file
 *
 * Both verbs re-check staff off the session `email` claim, and both run the path
 * through the allowlist in `config-files.ts` BEFORE any network call. The allowlist
 * is the boundary, not the UI: a control the page does not render is still a request
 * anyone can send, so hiding the save button on a hook is presentation and the 403
 * here is the rule.
 */

function staffProblem(email: unknown): boolean {
  return typeof email !== "string" || !isAdminEmail(email);
}

function tokenMissingResponse() {
  return NextResponse.json(
    {
      error: "no_token",
      message: "GITHUB_CONFIG_TOKEN is not set on this deployment, so no configuration can be read.",
    },
    { status: 503 },
  );
}

/**
 * Surface GitHub's own sentence. A 409 here is the concurrent-edit case and the most
 * important one to state plainly: the file moved since it was opened, so the write
 * was refused rather than applied over whatever landed.
 */
function githubErrorResponse(err: unknown) {
  if (err instanceof GithubConfigError) {
    console.error("[admin-config] github call failed", err.status, err.message);
    return NextResponse.json({ error: "github", message: err.message }, { status: err.status });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const { userId, sessionClaims } = await auth();
  if (!userId || staffProblem(sessionClaims?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!githubConfigToken()) return tokenMissingResponse();

  const repo = req.nextUrl.searchParams.get("repo") ?? "";
  const path = req.nextUrl.searchParams.get("path") ?? "";

  const problem = configReadProblem(repo, path);
  if (problem) {
    return NextResponse.json({ error: "not_allowed", message: problem }, { status: 403 });
  }

  try {
    const file = await readConfigFile(repo, path);
    return NextResponse.json({
      repo,
      path,
      content: file.content,
      sha: file.sha,
      htmlUrl: file.htmlUrl,
      editable: configWriteProblem(repo, path) === null,
      readOnlyReason: configWriteProblem(repo, path),
    });
  } catch (err) {
    const res = githubErrorResponse(err);
    if (res) return res;
    throw err;
  }
}

const WriteBodySchema = z.object({
  repo: z.string(),
  path: z.string(),
  content: z.string(),
  sha: z.string().min(1),
});

export async function PUT(req: NextRequest) {
  const { userId, sessionClaims } = await auth();
  if (!userId || staffProblem(sessionClaims?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!githubConfigToken()) return tokenMissingResponse();

  const parsed = WriteBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request", message: "The save request was malformed." }, { status: 400 });
  }

  const { repo, path, content, sha } = parsed.data;

  const problem = configWriteProblem(repo, path);
  if (problem) {
    return NextResponse.json({ error: "not_allowed", message: problem }, { status: 403 });
  }

  // Attribute the commit to whoever pressed save. Clerk gives the email on the
  // session claim; the name is best effort, and the email alone already identifies
  // the author in the history.
  const email = typeof sessionClaims?.email === "string" ? sessionClaims.email : "staff@distribute.you";
  const first = typeof sessionClaims?.firstName === "string" ? sessionClaims.firstName : "";
  const last = typeof sessionClaims?.lastName === "string" ? sessionClaims.lastName : "";
  const authorName = `${first} ${last}`.trim() || email;

  try {
    const result = await writeConfigFile({
      repo,
      path,
      content,
      sha,
      message: defaultCommitMessage(path),
      authorName,
      authorEmail: email,
    });
    return NextResponse.json({ commitSha: result.commitSha, sha: result.sha });
  } catch (err) {
    const res = githubErrorResponse(err);
    if (res) return res;
    throw err;
  }
}
