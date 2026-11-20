/**
 * Resolves once React has hydrated every server-rendered Suspense boundary of the page
 * (MON-PAGE-SPEED-FLOOR-1120).
 *
 * Why: the saved browser copy (IndexedDB) must reach the React Query cache only after
 * hydration. A component that hydrates while the cache already holds data renders that
 * data where the server rendered a skeleton: React throws #418 and client-renders the
 * section again. The query provider's own effect fires when the ROOT has hydrated, but
 * Suspense boundaries hydrate later, each on its own: every v2 brand page sits under
 * the brand `loading.tsx` boundary, and the Copilot chat is its own lazily loaded chunk.
 *
 * How: React's server HTML wraps each boundary in `<!--$-->` … `<!--/$-->` comments, and
 * React tags each DOM node it has hydrated with a `__reactFiber$<id>` property. A
 * boundary has hydrated once the last node inside it carries that tag (a boundary's
 * render completes after its last child, and a cache write landing between that render
 * and its commit is picked up by the normal post-commit subscription, not by hydration).
 * `<!--$?-->` (still streaming) counts as not hydrated; `<!--$!-->` (React gave up and
 * client-renders it) never hydrates and is skipped.
 *
 * Bounded: a boundary that never hydrates (its chunk failed to load) must not hold the
 * saved copy forever. After `timeoutMs` it resolves anyway and says so loudly.
 *
 * Alias-free on purpose: unit-tested over a real DOM (jsdom).
 */

const START = "$";
const PENDING = "$?";
const CLIENT_RENDERED = "$!";
const END = "/$";

function isBoundaryStart(n: Node): n is Comment {
  return n.nodeType === 8 && ((n as Comment).data === START || (n as Comment).data === PENDING);
}

function isOpening(n: Node): boolean {
  if (n.nodeType !== 8) return false;
  const d = (n as Comment).data;
  return d === START || d === PENDING || d === CLIENT_RENDERED;
}

function isClosing(n: Node): boolean {
  return n.nodeType === 8 && (n as Comment).data === END;
}

/** True when React has attached its fiber to this node (it hydrated or rendered it). */
export function isHydratedNode(n: Node): boolean {
  for (const k in n) if (k.startsWith("__reactFiber$")) return true;
  return false;
}

/**
 * Every server-rendered Suspense boundary that has not hydrated yet in `root`, as its
 * opening comment. Empty = the whole page has hydrated.
 */
export function unhydratedBoundaries(root: Node): Comment[] {
  const out: Comment[] = [];
  const stack: Node[] = [root];
  while (stack.length) {
    const parent = stack.pop()!;
    const kids = parent.childNodes;
    for (let i = 0; i < kids.length; i++) {
      const c = kids[i];
      if (c.nodeType === 1 || c.nodeType === 11) stack.push(c);
      if (!isBoundaryStart(c)) continue;
      if (c.data === PENDING) {
        out.push(c);
        continue;
      }
      // The matching end comment is a sibling; nested boundaries in between are skipped by depth.
      let depth = 0;
      let end: Node | null = null;
      for (let s = c.nextSibling; s; s = s.nextSibling) {
        if (isOpening(s)) depth++;
        else if (isClosing(s)) {
          if (depth === 0) {
            end = s;
            break;
          }
          depth--;
        }
      }
      if (!end) continue; // Malformed or still streaming: React owns it, nothing to wait on.
      // The last real node of the boundary (nested boundaries' markers are not nodes React tags).
      let last: Node | null = end.previousSibling;
      while (last && last !== c && last.nodeType === 8) last = last.previousSibling;
      if (!last || last === c) continue; // An empty boundary: nothing to hydrate.
      if (!isHydratedNode(last)) out.push(c);
    }
  }
  return out;
}

export function waitForHydrationSettled({
  root,
  timeoutMs,
  intervalMs = 16,
  now = () => Date.now(),
}: {
  root: Node;
  timeoutMs: number;
  intervalMs?: number;
  now?: () => number;
}): Promise<void> {
  const started = now();
  return new Promise((resolve) => {
    const check = () => {
      const left = unhydratedBoundaries(root);
      if (left.length === 0) return resolve();
      if (now() - started >= timeoutMs) {
        console.error("[dashboard] page sections still not hydrated, restoring the saved copy anyway", {
          waitedMs: now() - started,
          sections: left.length,
        });
        return resolve();
      }
      setTimeout(check, intervalMs);
    };
    check();
  });
}
