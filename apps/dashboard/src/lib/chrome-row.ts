/**
 * The height of the top chrome row, shared by the header and by the sidebar's
 * tenant switcher block.
 *
 * In the beta L-shaped shell the sidebar is a full-height column to the LEFT of
 * the header, so the switcher block and the header sit side by side and MUST be
 * exactly the same height or the seam between them is visible. Deriving both
 * from this one token makes the match structural instead of a hand-tuned pixel
 * value that silently rots the next time a control inside the header changes
 * size (the first attempt hardcoded `h-[49px]` from a miscounted header, which
 * actually renders ~57px because the account button is `p-1` around a 28px
 * avatar — the two rows never lined up).
 *
 * Both rows also carry `border-b border-gray-200` so the line reads as one
 * continuous edge across the navbar and the sidebar.
 */
export const CHROME_ROW_HEIGHT = "h-14";
