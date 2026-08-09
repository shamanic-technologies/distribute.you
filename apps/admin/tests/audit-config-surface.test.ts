import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EPHEMERAL_QUERY_ROOTS, SENSITIVE_QUERY_ROOTS } from "../src/lib/persist-cache";

const read = (rel: string) => readFileSync(join(__dirname, "..", rel), "utf8");

const PAGE = "src/app/(authed)/(dashboard)/audit/config/page.tsx";
const FILE_ROUTE = "src/app/(authed)/api/admin/config/file/route.ts";
const TREE_ROUTE = "src/app/(authed)/api/admin/config/tree/route.ts";
const GITHUB_LIB = "src/lib/github-config.ts";
const SIDEBAR = "src/components/context-sidebar.tsx";

describe("the write boundary is the route, not the UI", () => {
  it("checks the allowlist before writing", () => {
    const src = read(FILE_ROUTE);
    const guard = src.indexOf("configWriteProblem(repo, path)");
    const write = src.indexOf("writeConfigFile(");
    expect(guard).toBeGreaterThan(-1);
    expect(write).toBeGreaterThan(guard);
  });

  it("re-checks staff on every verb", () => {
    const src = read(FILE_ROUTE);
    expect(src.match(/isAdminEmail|staffProblem\(/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(read(TREE_ROUTE)).toContain("isAdminEmail");
  });

  it("exposes no verb beyond GET and PUT", () => {
    const src = read(FILE_ROUTE);
    expect(src).not.toContain("export async function DELETE");
    expect(src).not.toContain("export async function POST");
    expect(read(TREE_ROUTE)).not.toContain("export async function PUT");
  });

  it("sends the sha it read, so a concurrent edit is refused rather than overwritten", () => {
    expect(read(FILE_ROUTE)).toContain("sha: z.string().min(1)");
    expect(read(GITHUB_LIB)).toContain("sha: args.sha");
  });
});

describe("the token never reaches the browser", () => {
  it("keeps the GitHub client out of the page", () => {
    expect(read(PAGE)).not.toContain("github-config");
  });

  it("reads the token from the server environment only", () => {
    expect(read(GITHUB_LIB)).toContain("process.env.GITHUB_CONFIG_TOKEN");
    // The page NAMES the variable, in the copy telling an operator how to supply it.
    // What it must never do is read one, so that is what this asserts.
    expect(read(PAGE)).not.toContain("process.env");
  });

  it("sends a user agent, which GitHub requires", () => {
    expect(read(GITHUB_LIB)).toContain("user-agent");
  });
});

describe("the page", () => {
  it("renders the route's own message, never a thrown body", () => {
    const src = read(PAGE);
    // Two halves. The message shown is the one the ROUTE wrote (`readProblem` lifts
    // it off the response), and every error surface reads it through ONE helper, so
    // `.message` is dereferenced in exactly one place instead of at each render site.
    expect(src).toContain("readProblem");
    expect(src).toContain("function problemMessage(");

    // Everything OUTSIDE the helper must not touch a rejection's `.message`. Scoped
    // by cutting the helper out rather than counting hits file-wide, because
    // `readProblem` legitimately reads `.message` off the route's JSON body, and a
    // file-wide count would break the next time either helper gains a line.
    const start = src.indexOf("function problemMessage(");
    const end = src.indexOf("\n}", start) + 2;
    expect(start).toBeGreaterThan(-1);
    const outsideHelper = src.slice(0, start) + src.slice(end);
    expect(outsideHelper).not.toMatch(/\berr(or)?\.message\b/);
    // `apiCall` sets an Error's message to the whole downstream body verbatim, which
    // is the thing that must never reach a person. This page does not use it.
    expect(src).not.toContain("apiCall");
    expect(src).not.toContain('from "@/lib/api"');
  });

  it("prints the pull command, since a commit alone never reaches the machine", () => {
    expect(read(PAGE)).toContain("AGENT_CONFIG_PULL_COMMAND");
  });

  it("states what lives only on the machine instead of omitting it", () => {
    const src = read(PAGE);
    expect(src).toContain("MachineLocalCard");
    expect(src).toContain("~/.claude.json");
    expect(src).toContain(".credentials.json");
  });

  it("warns that saving a service CLAUDE.md redeploys it", () => {
    expect(read(PAGE)).toContain("rebuilds and redeploys");
  });

  it("hides the commit button until the draft differs from what was read", () => {
    const src = read(PAGE);
    expect(src).toContain("const dirty = file.data !== undefined && draft !== null && draft !== file.data.content;");
    expect(src).toContain("{(dirty || saved) && (");
  });

  it("carries no em-dash in its copy", () => {
    expect(read(PAGE)).not.toContain("—");
  });
});

describe("cache policy", () => {
  it("never persists a file, whose sha goes stale the moment anyone commits", () => {
    expect(EPHEMERAL_QUERY_ROOTS.has("configFile")).toBe(true);
    expect(SENSITIVE_QUERY_ROOTS.has("configFile")).toBe(false);
  });
});

describe("navigation", () => {
  it("reaches the page from the Audit group", () => {
    const src = read(SIDEBAR);
    expect(src).toContain('href: "/audit/config"');
    expect(src).toContain('id: "audit-config"');
  });
});
