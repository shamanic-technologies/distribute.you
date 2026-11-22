import { describe, it, expect, vi } from "vitest";
import { buildSkillTree, visibleSkillRows, initiallyOpen, editedByLabel, type SkillSummary } from "../src/lib/monitoring/skills-tree";

const s = (slug: string, parentSlug: string | null, position = 0): SkillSummary => ({
  slug,
  parentSlug,
  title: slug,
  description: "",
  position,
  version: 1,
  updatedBy: "seed",
  updatedAt: "2026-10-09T00:00:00Z",
});

describe("skills tree", () => {
  const flat = [s("legs", "index", 2), s("index", null), s("campaigns", "index", 1), s("triggers", "legs", 0)];

  it("nests children under parents, siblings by position", () => {
    const tree = buildSkillTree(flat);
    expect(tree.map((n) => n.skill.slug)).toEqual(["index"]);
    expect(tree[0].children.map((n) => n.skill.slug)).toEqual(["campaigns", "legs"]);
    expect(tree[0].children[1].children.map((n) => n.skill.slug)).toEqual(["triggers"]);
  });

  it("shows only the children of open folders", () => {
    const tree = buildSkillTree(flat);
    expect(visibleSkillRows(tree, new Set()).map((r) => r.skill.slug)).toEqual(["index"]);
    const rows = visibleSkillRows(tree, initiallyOpen(tree));
    expect(rows.map((r) => [r.skill.slug, r.depth, r.hasChildren])).toEqual([
      ["index", 0, true],
      ["campaigns", 1, false],
      ["legs", 1, true],
    ]);
    expect(visibleSkillRows(tree, new Set(["index", "legs"])).map((r) => r.skill.slug)).toEqual(["index", "campaigns", "legs", "triggers"]);
  });

  it("keeps a skill whose parent is not served visible, as a root, and says so", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const tree = buildSkillTree([s("index", null), s("orphan", "gone")]);
    expect(tree.map((n) => n.skill.slug)).toEqual(["index", "orphan"]);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("names a seeded skill, and the person otherwise", () => {
    expect(editedByLabel("seed")).toBe("Seeded");
    expect(editedByLabel("kevin@distribute.you")).toBe("kevin@distribute.you");
  });
});

describe("skill tree editing (SKILL-TREE-EDIT-1122)", () => {
  it("names a new skill from its title, unique among the served slugs", async () => {
    const { slugForNewSkill } = await import("../src/lib/monitoring/skills-tree");
    expect(slugForNewSkill("Cold email: follow-ups", new Set())).toBe("cold-email-follow-ups");
    expect(slugForNewSkill("Réponses", new Set(["reponses"]))).toBe("reponses-2");
    expect(slugForNewSkill("Réponses", new Set(["reponses", "reponses-2"]))).toBe("reponses-3");
    expect(slugForNewSkill("!!!", new Set())).toBeNull();
  });

  it("puts a new child last under its parent", async () => {
    const { nextChildPosition } = await import("../src/lib/monitoring/skills-tree");
    const flat = [s("index", null), s("a", "index", 3), s("b", "index", 7), s("c", "a", 1)];
    expect(nextChildPosition(flat, "index")).toBe(8);
    expect(nextChildPosition(flat, "c")).toBe(0);
  });
});

describe("the skill tree lives on the Distry page", () => {
  it("draws the tree on Distry with no tick box, the old Skills URL lands there", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const read = (p: string) => readFileSync(join(__dirname, "..", "src", p), "utf8");
    // Owner 2026-11-22: the skills live on the Distry page only, every skill read (no pick-list, no tick box).
    const distry = read("components/v2/monitoring-distry.tsx");
    expect(distry).toContain("<SkillsBlock");
    expect(distry).not.toContain("skillSlugs");
    expect(distry).not.toContain("Every skill");
    expect(read("lib/monitoring/monitoring.ts")).toContain('"chat/skills": "chat/distry"');
    expect(read("components/v2/monitoring-page.tsx")).not.toContain("SkillsView");
    const tree = read("components/v2/monitoring-skill-tree.tsx");
    expect(tree).toContain("writeStaffSkill(slug, { content: current.content, ...change })");
    // "Add a skill" only (owner: never a sub-skill), and the Not mentioned tag in the three views.
    expect(tree).toContain("+ Add a skill");
    expect(tree).not.toContain("sub-skill\"");
    expect(tree.match(/<NotMentioned \/>/g)?.length).toBe(2);
    expect(tree).toContain('fill="var(--data-amber)">\n                  Not mentioned');
  });
});


describe("the tree is who mentions whom (DISTRY-SKILL-MENTIONS-1122)", () => {
  const m = (ref: string, kind: "skill" | "tool" = "skill", known = true) => ({ kind, ref, known });
  const k = (slug: string, mentions: ReturnType<typeof m>[], over: Record<string, unknown> = {}) => ({
    ...s(slug, null),
    mentions,
    mentionedBy: { prompt: false, skills: [] },
    neverMentioned: false,
    reachable: true,
    ...over,
  });
  // Prompt -> money, campaigns ; campaigns -> budgets, money ; budgets -> campaigns (a loop) ; orphan ; lost <-> lost2
  const skills = [
    k("money", [m("run_operation", "tool")]),
    k("campaigns", [m("budgets"), m("money"), m("gone", "skill", false)]),
    k("budgets", [m("campaigns")]),
    k("orphan", [m("lost")], { neverMentioned: true, reachable: false }),
    k("lost", [m("lost2")], { reachable: false }),
    k("lost2", [m("lost")], { reachable: false }),
  ];
  const prompt = [m("money"), m("campaigns")];

  it("draws the Prompt on top; a skill unfolds once, at its first place, and only shows elsewhere", async () => {
    const { mentionTreeRows, allTreeKeys } = await import("../src/lib/monitoring/skills-tree");
    const rows = mentionTreeRows(skills, prompt, allTreeKeys(skills, prompt));
    expect(rows.map((r) => [r.slug, r.depth, r.repeat])).toEqual([
      [null, 0, false],
      ["money", 1, false],
      ["campaigns", 1, false],
      ["budgets", 2, false],
      ["campaigns", 3, true],
      ["money", 2, true],
    ]);
  });

  it("only shows the children of open lines", async () => {
    const { mentionTreeRows } = await import("../src/lib/monitoring/skills-tree");
    expect(mentionTreeRows(skills, prompt, new Set()).map((r) => r.slug)).toEqual([null]);
    expect(mentionTreeRows(skills, prompt, new Set(["prompt"])).map((r) => r.slug)).toEqual([null, "money", "campaigns"]);
  });

  it("lists what Distry never reaches: never-mentioned first, then an unreached loop nothing enters", async () => {
    const { unreachedRows, allTreeKeys } = await import("../src/lib/monitoring/skills-tree");
    const rows = unreachedRows(skills, allTreeKeys(skills, prompt));
    expect(rows.map((r) => [r.slug, r.depth, r.repeat])).toEqual([
      ["orphan", 0, false],
      ["lost", 1, false],
      ["lost2", 2, false],
      ["lost", 3, true],
    ]);
  });
});
