/**
 * The Copilot skill tree (chat-service `/internal/skills`, owner 2026-10-09): staff browse it as
 * folders and sub-folders on Monitoring > Chat > Skills. chat-service serves a FLAT list with
 * `parentSlug`; this module only arranges it. Alias-free so it carries real unit tests.
 */

export interface SkillSummary {
  slug: string;
  parentSlug: string | null;
  title: string;
  description: string;
  position: number;
  version: number;
  updatedBy: string;
  updatedAt: string;
}

export interface SkillNode {
  skill: SkillSummary;
  children: SkillNode[];
}

/** One visible line of the tree: the skill, its depth, and whether it is a folder. */
export interface SkillRow {
  skill: SkillSummary;
  depth: number;
  hasChildren: boolean;
  childCount: number;
}

const bySiblingOrder = (a: SkillNode, b: SkillNode) => a.skill.position - b.skill.position || a.skill.slug.localeCompare(b.skill.slug);

/**
 * Nest the flat list under its parents. A skill whose parent is not in the list is a ROOT
 * (and logged): it stays visible rather than vanishing from the page.
 */
export function buildSkillTree(skills: SkillSummary[]): SkillNode[] {
  const nodes = new Map<string, SkillNode>(skills.map((s) => [s.slug, { skill: s, children: [] }]));
  const roots: SkillNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.skill.parentSlug == null ? null : nodes.get(node.skill.parentSlug);
    if (node.skill.parentSlug != null && !parent) {
      console.error("[dashboard] skills tree: parent not served", { slug: node.skill.slug, parentSlug: node.skill.parentSlug });
    }
    (parent ? parent.children : roots).push(node);
  }
  const sort = (list: SkillNode[]) => {
    list.sort(bySiblingOrder);
    for (const n of list) sort(n.children);
  };
  sort(roots);
  return roots;
}

/** The lines shown: every root, and the children of each OPEN folder, depth first. */
export function visibleSkillRows(tree: SkillNode[], open: ReadonlySet<string>): SkillRow[] {
  const rows: SkillRow[] = [];
  const walk = (list: SkillNode[], depth: number) => {
    for (const n of list) {
      rows.push({ skill: n.skill, depth, hasChildren: n.children.length > 0, childCount: n.children.length });
      if (n.children.length > 0 && open.has(n.skill.slug)) walk(n.children, depth + 1);
    }
  };
  walk(tree, 0);
  return rows;
}

/** Folders open on first load: the roots, so the first level of topics shows at once. */
export function initiallyOpen(tree: SkillNode[]): Set<string> {
  return new Set(tree.filter((n) => n.children.length > 0).map((n) => n.skill.slug));
}

/** "seed" = written by the deploy, never edited by a person (chat-service's own word). */
export function editedByLabel(updatedBy: string): string {
  return updatedBy === "seed" ? "Seeded" : updatedBy;
}
