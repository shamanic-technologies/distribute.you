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

/**
 * DISTRY-SKILL-MENTIONS-1122: skills are linked by `@skill:<slug>` / `@tool:<name>` written in their
 * text. chat-service serves every link (mentions in text order, who mentions it, never-mentioned,
 * reachable); this module only LAYS them out, it never parses a text for links.
 */
export interface SkillMention {
  kind: "skill" | "tool";
  ref: string;
  known: boolean;
}

export interface SkillLinks {
  mentions: SkillMention[];
  mentionedBy: { prompt: boolean; skills: string[] };
  neverMentioned: boolean;
  reachable: boolean;
}

export type LinkedSkill = SkillSummary & Partial<SkillLinks>;

/** One line of the mention tree. `repeat` = this skill already unfolds higher up (or on its own branch): drawn, not unfolded again. */
export interface MentionRow {
  key: string;
  slug: string | null; // null = the Prompt
  depth: number;
  childCount: number;
  repeat: boolean;
}

const skillChildren = (mentions: readonly SkillMention[] | undefined, live: ReadonlyMap<string, LinkedSkill>) =>
  (mentions ?? []).filter((m) => m.kind === "skill" && m.known && live.has(m.ref)).map((m) => m.ref);

/**
 * The tree as Distry reaches it: the Prompt on top, under each text the skills it mentions in text
 * order. A skill unfolds ONCE, at its first place in reading order; every other place draws it as a
 * line marked `repeat` (texts now mention each other densely: unfolding each place repeated whole
 * branches, owner screenshot 2026-11-22). `open` holds the keys of expanded lines (a key is the path).
 */
export function mentionTreeRows(skills: readonly LinkedSkill[], promptMentions: readonly SkillMention[], open: ReadonlySet<string>): MentionRow[] {
  const live = new Map(skills.map((s) => [s.slug, s]));
  const rows: MentionRow[] = [];
  const unfolded = firstPlaces(skills, promptMentions);
  const walk = (slug: string, key: string, depth: number) => {
    const repeat = unfolded.get(slug) !== key;
    const kids = repeat ? [] : skillChildren(live.get(slug)?.mentions, live);
    rows.push({ key, slug, depth, childCount: kids.length, repeat });
    if (repeat || !open.has(key)) return;
    for (const k of kids) walk(k, `${key}/${k}`, depth + 1);
  };
  const top = skillChildren(promptMentions, live);
  rows.push({ key: "prompt", slug: null, depth: 0, childCount: top.length, repeat: false });
  if (open.has("prompt")) for (const k of top) walk(k, `prompt/${k}`, 1);
  return rows;
}

/** Each skill's first place (its path key) walking the whole tree depth first in text order: where it unfolds. */
function firstPlaces(skills: readonly LinkedSkill[], promptMentions: readonly SkillMention[]): Map<string, string> {
  const live = new Map(skills.map((s) => [s.slug, s]));
  const first = new Map<string, string>();
  const walk = (slug: string, key: string) => {
    if (first.has(slug)) return;
    first.set(slug, key);
    for (const k of skillChildren(live.get(slug)?.mentions, live)) walk(k, `${key}/${k}`);
  };
  for (const k of skillChildren(promptMentions, live)) walk(k, `prompt/${k}`);
  return first;
}

/**
 * Skills Distry never reaches, drawn under the tree: first those nothing mentions (tagged
 * "Not mentioned"), then any other unreached one not already under them (a loop nothing enters).
 */
export function unreachedRows(skills: readonly LinkedSkill[], open: ReadonlySet<string>): MentionRow[] {
  const live = new Map(skills.map((s) => [s.slug, s]));
  const rows: MentionRow[] = [];
  const drawn = new Set<string>();
  const walk = (slug: string, key: string, depth: number) => {
    const repeat = drawn.has(slug);
    const kids = repeat ? [] : skillChildren(live.get(slug)?.mentions, live).filter((k) => live.get(k)?.reachable === false);
    drawn.add(slug);
    rows.push({ key, slug, depth, childCount: kids.length, repeat });
    if (repeat || !open.has(key)) return;
    for (const k of kids) walk(k, `${key}/${k}`, depth + 1);
  };
  const unreached = skills.filter((s) => s.reachable === false);
  for (const s of unreached.filter((x) => x.neverMentioned)) walk(s.slug, `unreached/${s.slug}`, 0);
  for (const s of unreached) if (!drawn.has(s.slug)) walk(s.slug, `unreached/${s.slug}`, 0);
  return rows;
}

/** Every line key of a tree, to open everything on first load. */
export function allTreeKeys(skills: readonly LinkedSkill[], promptMentions: readonly SkillMention[]): Set<string> {
  const keys = new Set<string>(["prompt"]);
  let size = -1;
  // Open level by level until no new line appears (bounded: a loop stops at its second visit).
  while (keys.size !== size) {
    size = keys.size;
    for (const r of [...mentionTreeRows(skills, promptMentions, keys), ...unreachedRows(skills, keys)]) if (r.childCount > 0) keys.add(r.key);
  }
  return keys;
}
