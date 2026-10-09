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
