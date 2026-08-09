/**
 * What the staff console is allowed to READ and WRITE in the agent-config repo and
 * in each product repo's own CLAUDE.md.
 *
 * The console runs in a container on the Hetzner box; the config Claude Code
 * actually loads lives on a laptop, under `~/.claude` and `~/.agents/skills`, as
 * SYMLINKS into a clone of `shamanic-technologies/agent-config`. So there is no
 * filesystem to reach and none is attempted: every read and write here goes through
 * the GitHub Contents API against the repo, and the laptop picks the change up on
 * its next pull. That indirection is the whole design, and it is why this file talks
 * about repos and paths rather than about `~/.claude`.
 *
 * Two decisions are encoded below and both are deliberate:
 *
 *  - READ is narrow. agent-config is config through and through, so its whole tree
 *    is readable. Every other repo exposes exactly its CLAUDE.md. Widening that
 *    would turn a config console into a source browser for the entire organisation,
 *    which is a different product with a different threat model.
 *
 *  - WRITE is narrower still, and markdown-only. A hook and a script are CODE that
 *    runs on a laptop, unattended, on every Bash call; editing one from a browser
 *    means arbitrary local execution one click away. The Cloudflare Access gate and
 *    the email allowlist bound who can reach the page, but the two are different
 *    classes of action and only one of them belongs behind a textarea. They render,
 *    they do not save.
 *
 * Alias-free on purpose (no `@/...` import), so the guards for it are real unit
 * tests rather than source-substring checks. Keep it that way.
 *
 * NB the file carries no em-dash anywhere, comments included: nearly every string in
 * it is copy a person reads on screen, and a guard that tried to tell prose from a
 * doc comment would be the thing that rots.
 */

/** The repo holding the global CLAUDE.md, RTK.md, the skills and the hooks. */
export const AGENT_CONFIG_REPO = "shamanic-technologies/agent-config";

/** Only this owner is reachable. A foreign owner is refused before any network call. */
export const CONFIG_REPO_OWNER = "shamanic-technologies";

/** The one file a product repo exposes. */
export const PRODUCT_CONFIG_PATH = "CLAUDE.md";

export type ConfigSection = "root" | "skills" | "hooks" | "scripts" | "settings" | "other";

/**
 * Which part of agent-config a path belongs to. Drives both the write rule and how
 * the tree is grouped on screen, so the two can never disagree about what a file is.
 */
export function sectionForPath(path: string): ConfigSection {
  if (path === "settings.template.json") return "settings";
  if (path.startsWith("hooks/")) return "hooks";
  if (path.startsWith("skills/")) return "skills";
  if (path.startsWith("scripts/")) return "scripts";
  if (!path.includes("/")) return "root";
  return "other";
}

/**
 * Is this a shape we are willing to send to GitHub at all? Answers the question the
 * repo and the path cannot answer separately: a traversal segment is meaningless to
 * the Contents API but says something about the caller, so it is refused rather than
 * normalised.
 */
function pathShapeProblem(path: string): string | null {
  if (!path) return "No file was named.";
  if (path.startsWith("/")) return "A path must be relative to the repository root.";
  if (path.includes("\\")) return "A path must use forward slashes.";
  if (path.includes("\0")) return "That path is not a valid file name.";
  if (path.split("/").some((segment) => segment === "." || segment === "..")) {
    return "A path cannot step outside the repository.";
  }
  return null;
}

function repoShapeProblem(repo: string): string | null {
  if (!repo) return "No repository was named.";
  if (!/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(repo)) {
    return "That is not a repository name.";
  }
  if (!repo.startsWith(`${CONFIG_REPO_OWNER}/`)) {
    return `Only ${CONFIG_REPO_OWNER} repositories are reachable from here.`;
  }
  return null;
}

/**
 * Why this file cannot be READ, or null when it can. A sentence, because it is
 * rendered to a person rather than matched on.
 */
export function configReadProblem(repo: string, path: string): string | null {
  const repoProblem = repoShapeProblem(repo);
  if (repoProblem) return repoProblem;

  const shape = pathShapeProblem(path);
  if (shape) return shape;

  if (repo === AGENT_CONFIG_REPO) return null;

  if (path !== PRODUCT_CONFIG_PATH) {
    return `A product repository exposes only its ${PRODUCT_CONFIG_PATH} here.`;
  }
  return null;
}

/**
 * Why this file cannot be WRITTEN, or null when it can. Strictly stricter than the
 * read rule: everything unwritable is still perfectly readable, which is the point.
 */
export function configWriteProblem(repo: string, path: string): string | null {
  const readProblem = configReadProblem(repo, path);
  if (readProblem) return readProblem;

  if (repo !== AGENT_CONFIG_REPO) return null;

  switch (sectionForPath(path)) {
    case "hooks":
      return "A hook is code that runs on your machine on every tool call, so it is read only here.";
    case "scripts":
      return "A script is code that runs on your machine, so it is read only here.";
    case "settings":
      return "install.sh copies this template into ~/.claude, so an edit here would not reach the live settings. Read only.";
    default:
      break;
  }

  if (!path.toLowerCase().endsWith(".md")) {
    return "Only markdown files can be edited here.";
  }
  return null;
}

/** Convenience for the UI. The reason is what gets rendered, so prefer the problem helpers. */
export function isEditableConfigPath(repo: string, path: string): boolean {
  return configWriteProblem(repo, path) === null;
}

/**
 * The commit message a save writes. Names the file, so the repo history reads as a
 * list of what changed rather than a wall of one identical line, and says where the
 * edit came from, so a commit nobody remembers making has an explanation attached.
 */
export function defaultCommitMessage(path: string): string {
  return `docs(config): update ${path} from the staff console`;
}

export interface ConfigTreeEntry {
  path: string;
  editable: boolean;
  section: ConfigSection;
}

export interface ConfigTreeGroup {
  section: ConfigSection;
  label: string;
  entries: ConfigTreeEntry[];
}

const SECTION_LABEL: Record<ConfigSection, string> = {
  root: "Global",
  skills: "Skills",
  hooks: "Hooks",
  scripts: "Scripts",
  settings: "Settings",
  other: "Other",
};

/** Fixed order, so the list does not reshuffle as files come and go. */
const SECTION_ORDER: ConfigSection[] = ["root", "skills", "hooks", "scripts", "settings", "other"];

/**
 * Turn a flat list of repository paths into the grouped tree the page renders. Pure,
 * so the grouping is unit-tested rather than eyeballed. An empty group is dropped:
 * a heading over nothing states a category the repo is not in.
 */
export function groupConfigTree(paths: readonly string[]): ConfigTreeGroup[] {
  const bySection = new Map<ConfigSection, ConfigTreeEntry[]>();

  for (const path of [...paths].sort()) {
    if (configReadProblem(AGENT_CONFIG_REPO, path)) continue;
    const section = sectionForPath(path);
    const entry: ConfigTreeEntry = {
      path,
      section,
      editable: isEditableConfigPath(AGENT_CONFIG_REPO, path),
    };
    const bucket = bySection.get(section);
    if (bucket) bucket.push(entry);
    else bySection.set(section, [entry]);
  }

  return SECTION_ORDER.flatMap((section) => {
    const entries = bySection.get(section);
    if (!entries || entries.length === 0) return [];
    return [{ section, label: SECTION_LABEL[section], entries }];
  });
}

/**
 * The label a path gets in the list. A skill is named by its directory, because
 * every one of them holds a file called SKILL.md and a column of identical names
 * identifies nothing.
 */
export function configEntryLabel(path: string): string {
  const parts = path.split("/");
  if (parts.length >= 3 && parts[0] === "skills") {
    const file = parts[parts.length - 1];
    return file.toLowerCase() === "skill.md" ? parts[1] : `${parts[1]} / ${parts.slice(2).join("/")}`;
  }
  return path;
}

/**
 * The pull that carries a change from GitHub to the laptop. Stated verbatim on the
 * page, because a save that lands on the remote and never reaches the machine that
 * reads it is the one way this feature can quietly do nothing.
 */
export const AGENT_CONFIG_PULL_COMMAND = "git -C ~/conductor/repos/agent-config pull";
