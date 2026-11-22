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

/** chat-service's slug rule: lowercase letters, digits and single hyphens. */
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * The slug a NEW skill is created under, from the title typed (SKILL-TREE-EDIT-1122). The slug is
 * the skill's id in chat-service's URL, chosen by whoever creates it; a taken one gets `-2`, `-3`…
 * `null` when the title holds no letter or digit (nothing to name it by).
 */
export function slugForNewSkill(title: string, taken: ReadonlySet<string>): string | null {
  const base = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  if (!SLUG_RE.test(base)) return null;
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

/** A new child goes LAST under its parent: one past the highest sibling position. */
export function nextChildPosition(skills: readonly SkillSummary[], parentSlug: string): number {
  let max = -1;
  for (const s of skills) if (s.parentSlug === parentSlug && s.position > max) max = s.position;
  return max + 1;
}

/** Where a dragged line lands on another: above it, inside it (last child), or below it. */
export type DropZone = "before" | "inside" | "after";

/** The zone under the pointer: the top and bottom quarter of a line insert beside it, the middle drops inside. */
export function dropZoneAt(offsetY: number, height: number): DropZone {
  if (offsetY < height / 4) return "before";
  if (offsetY > (height * 3) / 4) return "after";
  return "inside";
}

/** True when `slug` is `ancestor` itself or sits anywhere under it. */
export function isSelfOrDescendant(skills: readonly SkillSummary[], slug: string, ancestor: string): boolean {
  const parent = new Map(skills.map((s) => [s.slug, s.parentSlug]));
  for (let cur: string | null | undefined = slug, guard = 0; cur && guard < 100; cur = parent.get(cur), guard++) {
    if (cur === ancestor) return true;
  }
  return false;
}

/**
 * What a drop asks chat-service's move (SKILL-TREE-EDIT-1122): the new parent and the 0-based place
 * among that parent's OTHER sub-skills (the dragged one left out, as the move reads it). `null` = the
 * drop is refused here: onto itself or under its own branch (a cycle), beside the root (the root has
 * no parent), or a drop that changes nothing.
 */
export function planSkillDrop(
  skills: readonly SkillSummary[],
  dragged: string,
  target: string,
  zone: DropZone,
): { parentSlug: string; position: number } | null {
  const bySlug = new Map(skills.map((s) => [s.slug, s]));
  const moving = bySlug.get(dragged);
  const onto = bySlug.get(target);
  if (!moving || !onto || moving.parentSlug === null) return null;
  if (isSelfOrDescendant(skills, target, dragged)) return null;
  const parentSlug = zone === "inside" ? onto.slug : onto.parentSlug;
  if (parentSlug === null) return null;
  const siblings = skills
    .filter((s) => s.parentSlug === parentSlug && s.slug !== dragged)
    .sort((a, b) => a.position - b.position || a.slug.localeCompare(b.slug));
  const at = siblings.findIndex((s) => s.slug === onto.slug);
  const position = zone === "inside" ? siblings.length : zone === "before" ? at : at + 1;
  // The place it already holds: nothing to move.
  const current = skills
    .filter((s) => s.parentSlug === moving.parentSlug)
    .sort((a, b) => a.position - b.position || a.slug.localeCompare(b.slug))
    .findIndex((s) => s.slug === dragged);
  if (parentSlug === moving.parentSlug && position === current) return null;
  return { parentSlug, position };
}

/** The list as the move leaves it, before chat-service answers: the skill under its new parent, places renumbered. */
export function applySkillMove<T extends SkillSummary>(skills: readonly T[], dragged: string, parentSlug: string, position: number): T[] {
  const moving = skills.find((s) => s.slug === dragged);
  if (!moving) return [...skills];
  const order = (parent: string | null) =>
    skills
      .filter((s) => s.parentSlug === parent && s.slug !== dragged)
      .sort((a, b) => a.position - b.position || a.slug.localeCompare(b.slug))
      .map((s) => s.slug);
  const target = order(parentSlug);
  target.splice(Math.min(position, target.length), 0, dragged);
  const places = new Map(target.map((slug, i) => [slug, i]));
  if (moving.parentSlug !== parentSlug) order(moving.parentSlug).forEach((slug, i) => places.set(slug, i));
  return skills.map((s) => {
    const p = places.get(s.slug);
    if (p === undefined) return s;
    return { ...s, position: p, parentSlug: s.slug === dragged ? parentSlug : s.parentSlug };
  });
}
