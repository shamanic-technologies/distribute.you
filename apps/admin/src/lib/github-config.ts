import { AGENT_CONFIG_REPO } from "./config-files";

/**
 * The GitHub half of the config console. SERVER ONLY: the token never reaches the
 * browser, so every read and every write goes through a route handler. The `server-only`
 * package is not installed in this app, so the boundary is held by a guard test
 * asserting no client component imports this module rather than by the bundler.
 *
 * Auth is a fine-grained PAT in `GITHUB_CONFIG_TOKEN`, read from the container's own
 * environment the same way the god-mode routes read `CLERK_SECRET_KEY`. It is not
 * registered as a platform key because key-service exists for secrets SEVERAL
 * services resolve, and this one has exactly one consumer.
 *
 * The token being ABSENT is a first-class state rather than a crash: the console
 * ships before the credential does, so the page says what is missing and how to
 * supply it instead of rendering a broken tree.
 */

const GITHUB_API = "https://api.github.com";

/**
 * GitHub rejects a request with no `User-Agent`, and several vendors sit behind a
 * Cloudflare rule that bans the default Node agent string outright, which reads as
 * a credential problem rather than a header one. Send a real name every time.
 */
const USER_AGENT = "distribute-admin-config-console";

export class GithubConfigError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "GithubConfigError";
    this.status = status;
  }
}

/** The token, or null when it has not been supplied to this container yet. */
export function githubConfigToken(): string | null {
  const raw = process.env.GITHUB_CONFIG_TOKEN?.trim();
  return raw ? raw : null;
}

async function gh<T>(path: string, init?: RequestInit): Promise<T> {
  const token = githubConfigToken();
  if (!token) {
    throw new GithubConfigError("GITHUB_CONFIG_TOKEN is not set on this deployment.", 503);
  }

  const res = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": USER_AGENT,
      authorization: `Bearer ${token}`,
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    // GitHub states the reason in `message` (a stale sha, a path the token cannot
    // reach, a rate limit). Forward it: the alternative is a status code the person
    // holding the browser cannot act on.
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new GithubConfigError(body?.message ?? `GitHub returned ${res.status}.`, res.status);
  }

  return (await res.json()) as T;
}

export interface ConfigFileContent {
  content: string;
  /**
   * The blob sha this content was read at. It rides back on the save and is what
   * makes a concurrent edit fail loudly: if the file moved in between, GitHub
   * refuses the write rather than overwriting whatever landed.
   */
  sha: string;
  htmlUrl: string;
}

/** Read one file. Throws `GithubConfigError` with GitHub's own reason on failure. */
export async function readConfigFile(repo: string, path: string): Promise<ConfigFileContent> {
  const res = await gh<{
    content?: string;
    encoding?: string;
    sha: string;
    html_url: string;
    type: string;
  }>(`/repos/${repo}/contents/${encodeURI(path)}`);

  if (res.type !== "file" || typeof res.content !== "string") {
    throw new GithubConfigError("That path is not a file.", 400);
  }
  if (res.encoding !== "base64") {
    throw new GithubConfigError(`Unexpected encoding ${res.encoding} from GitHub.`, 502);
  }

  return {
    content: Buffer.from(res.content, "base64").toString("utf8"),
    sha: res.sha,
    htmlUrl: res.html_url,
  };
}

export interface WriteConfigFileArgs {
  repo: string;
  path: string;
  content: string;
  sha: string;
  message: string;
  authorName: string;
  authorEmail: string;
}

/**
 * Commit one file to the repository's DEFAULT branch (no `branch` field, so GitHub
 * resolves it). The `sha` is mandatory: without it the Contents API happily creates
 * or clobbers, and the concurrent-edit guarantee disappears.
 *
 * The commit is attributed to the staff member who pressed save, so a change nobody
 * remembers has a name attached to it in the history.
 */
export async function writeConfigFile(args: WriteConfigFileArgs): Promise<{ commitSha: string; sha: string }> {
  const res = await gh<{ commit: { sha: string }; content: { sha: string } }>(
    `/repos/${args.repo}/contents/${encodeURI(args.path)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        message: args.message,
        content: Buffer.from(args.content, "utf8").toString("base64"),
        sha: args.sha,
        author: { name: args.authorName, email: args.authorEmail },
        committer: { name: args.authorName, email: args.authorEmail },
      }),
    },
  );

  return { commitSha: res.commit.sha, sha: res.content.sha };
}

/**
 * Every file in agent-config, in one call. `recursive=1` returns the whole tree, so
 * the console does not walk directories one request at a time.
 *
 * A truncated response is reported rather than silently served short: a tree missing
 * files reads exactly like a repo that does not have them.
 */
export async function readAgentConfigPaths(): Promise<string[]> {
  const res = await gh<{
    tree: { path: string; type: string }[];
    truncated: boolean;
  }>(`/repos/${AGENT_CONFIG_REPO}/git/trees/main?recursive=1`);

  if (res.truncated) {
    throw new GithubConfigError("The agent-config tree came back truncated from GitHub.", 502);
  }

  return res.tree.filter((entry) => entry.type === "blob").map((entry) => entry.path);
}

/**
 * The repositories this token can reach, minus agent-config itself (it has its own
 * section). With a fine-grained PAT the list IS the grant, so what shows up here is
 * exactly what the console is able to touch.
 */
export async function listConfigRepos(): Promise<string[]> {
  const res = await gh<{ full_name: string; archived: boolean }[]>(
    `/orgs/shamanic-technologies/repos?per_page=100&sort=full_name`,
  );

  return res
    .filter((repo) => !repo.archived && repo.full_name !== AGENT_CONFIG_REPO)
    .map((repo) => repo.full_name)
    .sort();
}
