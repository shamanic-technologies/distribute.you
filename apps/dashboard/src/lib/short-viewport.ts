/**
 * SHORT-VIEWPORT COMPACTION for the onboarding shell.
 *
 * Onboarding is a fixed `100svh` app shell: the card is bounded by the space
 * left between the top chrome, the pill bar and the trust strip, and its body
 * scrolls inside when the content does not fit. That is the right shape — the
 * CTA must stay on screen at every width — and it has one failure mode: on a
 * SHORT window there is simply not enough room, so the body scrolls and, with
 * macOS overlay scrollbars hidden until you scroll, it reads as truncated.
 *
 * Measured on the welcome step (compiled Tailwind off this app's own
 * globals.css, Playwright): the card wants 482px and the chrome around it eats
 * 224px, so it needs a 706px window. A 1333x587 browser window — an ordinary
 * un-maximised one — overflowed by 71px.
 *
 * So below a threshold the shell gives the card its padding back: the outer
 * gutter, the gaps, the card's own padding, the headline size and the row
 * rhythm all step down one notch. Nothing changes above it.
 *
 * ONE THRESHOLD, SPELLED ONCE. Two spellings is how the gutter starts
 * compacting at a different height from the card inside it, which reads as a
 * layout that breaks halfway. Every variant below carries `SHORT` verbatim.
 *
 * ⚠️ These are full literal class strings on purpose. Tailwind scans source for
 * literals, so a variant assembled at runtime (`` `${SHORT}:p-6` ``) compiles to
 * nothing and fails silently — the class is in the DOM and the rule does not
 * exist. Keep every entry a complete, greppable literal.
 *
 * Alias-free (no `@/` import), so it carries real unit tests.
 */

/** The height under which the shell compacts. Named once; never re-typed. */
export const SHORT_VIEWPORT_MAX_HEIGHT_PX = 760;

/**
 * Every compaction, keyed by the surface it applies to. Each value is appended
 * to that element's existing classes, so removing an entry restores the
 * uncompacted look for that surface alone.
 */
export const SHORT_VIEWPORT = {
  /**
   * THE CAP ITSELF, in three parts, and this is the load-bearing one.
   *
   * Above the threshold nothing changes: the pill bar, the card and the trust
   * strip float together in the middle of the column and the card caps itself
   * at a viewport calc. Below it that calc is the bug — it is a hand-counted
   * guess at the chrome (the top bar is 20px signed-out and ~66px signed-in, so
   * no constant is right for both), and under-reserving does not scroll, it
   * CLIPS: the card grows past the column, `items-center` splits the overflow,
   * and the `overflow-hidden` above eats both ends with no scrollbar to say so.
   *
   * So below the threshold the row STRETCHES its child instead. That gives the
   * column a definite height, which is the one thing a percentage cap needs:
   * `max-h-full` on the card then follows the top bar, the gutter, the gaps and
   * the trust strip exactly, with no constant to keep in step. `my-auto` keeps a
   * short card centered in what is left.
   *
   * Consequence, accepted and only below the threshold: the pill bar sits at the
   * top of the column and the trust strip at the bottom rather than floating
   * with the card. On a short window that space does not exist anyway.
   */
  stretchRow: "[@media(max-height:760px)]:sm:items-stretch",
  stretchShell: "[@media(max-height:760px)]:sm:flex-1",
  stretchCard: "[@media(max-height:760px)]:sm:my-auto [@media(max-height:760px)]:sm:max-h-full",

  /** The onboarding layout's outer gutter around the whole shell. */
  outerPadding: "[@media(max-height:760px)]:sm:py-3",
  /** Between the pill bar, the card and the trust strip. */
  shellGap: "[@media(max-height:760px)]:sm:gap-2",
  /** The pill bar's own height. */
  pillPadding: "[@media(max-height:760px)]:sm:py-1.5",
  /** The card's padding, at both the `sm` and the `md` step. */
  cardPadding: "[@media(max-height:760px)]:sm:p-6 [@media(max-height:760px)]:md:p-6",
  /** The "Setting this up for <host>" line above the headline. */
  eyebrowGap: "[@media(max-height:760px)]:mb-2",
  /** The screen's headline. One size down, so a two-line title saves 12px. */
  title: "[@media(max-height:760px)]:sm:text-3xl",
  /** Between the headline and the subtitle. */
  subtitleGap: "[@media(max-height:760px)]:mt-2",
  /** Between the card's header block and its scrolling body. */
  bodyGap: "[@media(max-height:760px)]:mt-3",
  /** The CTA row's own rhythm. */
  footerGap: "[@media(max-height:760px)]:mt-4 [@media(max-height:760px)]:pt-4",
  /** The trust strip under the card. */
  trustPadding: "[@media(max-height:760px)]:py-0",
  /** A card inside a step's body (the welcome pillars). */
  innerCardPadding: "[@media(max-height:760px)]:p-4",
} as const;
