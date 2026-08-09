import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AGENT_CONFIG_REPO,
  PRODUCT_CONFIG_PATH,
  configEntryLabel,
  configReadProblem,
  configWriteProblem,
  defaultCommitMessage,
  groupConfigTree,
  isEditableConfigPath,
  sectionForPath,
} from "../src/lib/config-files";

const PRODUCT_REPO = "shamanic-technologies/distribute.you";

describe("configReadProblem", () => {
  it("opens the whole agent-config tree", () => {
    for (const path of [
      "CLAUDE.md",
      "RTK.md",
      "README.md",
      "install.sh",
      "settings.template.json",
      "skills/casual/SKILL.md",
      "hooks/guard-branch.sh",
      "scripts/release.sh",
    ]) {
      expect(configReadProblem(AGENT_CONFIG_REPO, path)).toBeNull();
    }
  });

  it("refuses a path that steps outside the repository", () => {
    for (const path of ["../secrets.env", "skills/../../etc/passwd", "..", "a/./b", "/etc/passwd", "a\\b", ""]) {
      expect(configReadProblem(AGENT_CONFIG_REPO, path)).not.toBeNull();
    }
  });

  it("refuses a repository outside the organisation", () => {
    expect(configReadProblem("someone-else/agent-config", "CLAUDE.md")).not.toBeNull();
    expect(configReadProblem("not-a-repo", "CLAUDE.md")).not.toBeNull();
    expect(configReadProblem("", "CLAUDE.md")).not.toBeNull();
  });

  it("exposes only CLAUDE.md on a product repository", () => {
    expect(configReadProblem(PRODUCT_REPO, PRODUCT_CONFIG_PATH)).toBeNull();
    expect(configReadProblem(PRODUCT_REPO, "src/index.ts")).not.toBeNull();
    expect(configReadProblem(PRODUCT_REPO, ".env")).not.toBeNull();
    expect(configReadProblem(PRODUCT_REPO, "apps/admin/CLAUDE.md")).not.toBeNull();
  });
});

describe("configWriteProblem", () => {
  it("allows markdown in agent-config", () => {
    for (const path of ["CLAUDE.md", "RTK.md", "skills/casual/SKILL.md", "skills/release/references/notes.md"]) {
      expect(configWriteProblem(AGENT_CONFIG_REPO, path)).toBeNull();
      expect(isEditableConfigPath(AGENT_CONFIG_REPO, path)).toBe(true);
    }
  });

  it("keeps hooks and scripts read only, because they are code that runs on the machine", () => {
    for (const path of [
      "hooks/guard-branch.sh",
      "hooks/caveman-activate.js",
      "hooks/package.json",
      "scripts/release.sh",
    ]) {
      expect(configWriteProblem(AGENT_CONFIG_REPO, path)).not.toBeNull();
      expect(isEditableConfigPath(AGENT_CONFIG_REPO, path)).toBe(false);
      // Still readable: read-only means shown, not hidden.
      expect(configReadProblem(AGENT_CONFIG_REPO, path)).toBeNull();
    }
  });

  it("keeps the settings template read only, since install.sh is what reaches the live file", () => {
    expect(configWriteProblem(AGENT_CONFIG_REPO, "settings.template.json")).not.toBeNull();
  });

  it("refuses anything that is not markdown", () => {
    for (const path of ["install.sh", "AGENTS.md.bak", ".gitignore", "skills/casual/config.json"]) {
      expect(configWriteProblem(AGENT_CONFIG_REPO, path)).not.toBeNull();
    }
  });

  it("allows a product repository CLAUDE.md and nothing else", () => {
    expect(configWriteProblem(PRODUCT_REPO, PRODUCT_CONFIG_PATH)).toBeNull();
    expect(configWriteProblem(PRODUCT_REPO, "src/index.ts")).not.toBeNull();
  });

  it("never allows a write the read rule already refused", () => {
    for (const [repo, path] of [
      ["someone-else/x", "CLAUDE.md"],
      [AGENT_CONFIG_REPO, "../CLAUDE.md"],
      [PRODUCT_REPO, "docs/CLAUDE.md"],
    ] as const) {
      expect(configReadProblem(repo, path)).not.toBeNull();
      expect(configWriteProblem(repo, path)).not.toBeNull();
    }
  });
});

describe("sectionForPath", () => {
  it("buckets each part of the repository", () => {
    expect(sectionForPath("CLAUDE.md")).toBe("root");
    expect(sectionForPath("RTK.md")).toBe("root");
    expect(sectionForPath("skills/casual/SKILL.md")).toBe("skills");
    expect(sectionForPath("hooks/guard-branch.sh")).toBe("hooks");
    expect(sectionForPath("scripts/release.sh")).toBe("scripts");
    expect(sectionForPath("settings.template.json")).toBe("settings");
    expect(sectionForPath(".conductor/settings.toml")).toBe("other");
  });
});

describe("groupConfigTree", () => {
  it("groups, sorts and marks editability", () => {
    const groups = groupConfigTree([
      "skills/casual/SKILL.md",
      "CLAUDE.md",
      "hooks/guard-branch.sh",
      "settings.template.json",
      "RTK.md",
    ]);

    expect(groups.map((g) => g.section)).toEqual(["root", "skills", "hooks", "settings"]);
    expect(groups[0].entries.map((e) => e.path)).toEqual(["CLAUDE.md", "RTK.md"]);
    expect(groups[0].entries.every((e) => e.editable)).toBe(true);
    expect(groups[2].entries[0].editable).toBe(false);
  });

  it("drops a section with no files rather than heading an empty list", () => {
    const groups = groupConfigTree(["CLAUDE.md"]);
    expect(groups).toHaveLength(1);
    expect(groups[0].section).toBe("root");
  });

  it("drops a path the read rule refuses", () => {
    expect(groupConfigTree(["../escape.md", "CLAUDE.md"]).flatMap((g) => g.entries)).toHaveLength(1);
  });
});

describe("configEntryLabel", () => {
  it("names a skill by its directory, since every one holds a SKILL.md", () => {
    expect(configEntryLabel("skills/casual/SKILL.md")).toBe("casual");
    expect(configEntryLabel("skills/release/references/flow.md")).toBe("release / references/flow.md");
    expect(configEntryLabel("CLAUDE.md")).toBe("CLAUDE.md");
    expect(configEntryLabel("hooks/guard-branch.sh")).toBe("hooks/guard-branch.sh");
  });
});

describe("defaultCommitMessage", () => {
  it("names the file that changed", () => {
    expect(defaultCommitMessage("skills/casual/SKILL.md")).toContain("skills/casual/SKILL.md");
  });
});

describe("copy", () => {
  it("carries no em-dash anywhere, comments included", () => {
    const src = readFileSync(join(__dirname, "../src/lib/config-files.ts"), "utf8");
    expect(src).not.toContain("—");
  });

  it("stays alias free, so these are real unit tests", () => {
    const src = readFileSync(join(__dirname, "../src/lib/config-files.ts"), "utf8");
    expect(src).not.toMatch(/from "@\//);
  });
});
