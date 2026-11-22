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
    expect(distry).toContain("<SkillTree");
    expect(distry).not.toContain("skillSlugs");
    expect(distry).not.toContain("Every skill");
    expect(read("lib/monitoring/monitoring.ts")).toContain('"chat/skills": "chat/distry"');
    expect(read("components/v2/monitoring-page.tsx")).not.toContain("SkillsView");
    const tree = read("components/v2/monitoring-skill-tree.tsx");
    expect(tree).toContain("writeStaffSkill(slug, { content: current.content, ...change })");
    expect(tree).toContain("Add a skill under");
  });
});

describe("drag and drop (SKILL-TREE-EDIT-1122)", () => {
  // index > [campaigns > [budgets, briefs], comms, billing]
  const flat = [
    s("index", null, 0),
    s("campaigns", "index", 0),
    s("comms", "index", 1),
    s("billing", "index", 2),
    s("budgets", "campaigns", 0),
    s("briefs", "campaigns", 1),
  ];

  it("reads the pointer: top quarter above, bottom quarter below, middle inside", async () => {
    const { dropZoneAt } = await import("../src/lib/monitoring/skills-tree");
    expect(dropZoneAt(5, 60)).toBe("before");
    expect(dropZoneAt(30, 60)).toBe("inside");
    expect(dropZoneAt(55, 60)).toBe("after");
  });

  it("asks the place among the parent's OTHER sub-skills", async () => {
    const { planSkillDrop } = await import("../src/lib/monitoring/skills-tree");
    expect(planSkillDrop(flat, "billing", "campaigns", "before")).toEqual({ parentSlug: "index", position: 0 });
    expect(planSkillDrop(flat, "campaigns", "billing", "after")).toEqual({ parentSlug: "index", position: 2 });
    expect(planSkillDrop(flat, "billing", "campaigns", "inside")).toEqual({ parentSlug: "campaigns", position: 2 });
    expect(planSkillDrop(flat, "billing", "budgets", "after")).toEqual({ parentSlug: "campaigns", position: 1 });
  });

  it("refuses a cycle, the root, a drop beside the root and a drop that changes nothing", async () => {
    const { planSkillDrop } = await import("../src/lib/monitoring/skills-tree");
    expect(planSkillDrop(flat, "campaigns", "budgets", "inside")).toBeNull();
    expect(planSkillDrop(flat, "campaigns", "campaigns", "inside")).toBeNull();
    expect(planSkillDrop(flat, "index", "billing", "inside")).toBeNull();
    expect(planSkillDrop(flat, "billing", "index", "before")).toBeNull();
    expect(planSkillDrop(flat, "comms", "campaigns", "after")).toBeNull();
    expect(planSkillDrop(flat, "comms", "billing", "before")).toBeNull();
  });

  it("moves the tree at once, places renumbered under both parents", async () => {
    const { applySkillMove, buildSkillTree } = await import("../src/lib/monitoring/skills-tree");
    const moved = applySkillMove(flat, "campaigns", "billing", 0);
    const tree = buildSkillTree(moved);
    expect(tree[0].children.map((n) => [n.skill.slug, n.skill.position])).toEqual([["comms", 0], ["billing", 1]]);
    expect(tree[0].children[1].children.map((n) => n.skill.slug)).toEqual(["campaigns"]);
  });
});
