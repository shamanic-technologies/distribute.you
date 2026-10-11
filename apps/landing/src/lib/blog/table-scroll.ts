/**
 * Article bodies come from the database as HTML, and many carry comparison tables of 4-6
 * columns. On a phone those tables are wider than the screen, and the page clips sideways
 * overflow, so the right-hand columns were cut off with no way to read them. Each table is
 * wrapped in a box that scrolls sideways on its own (`.dy-table-scroll` in globals.css).
 *
 * Alias-free and dependency-free so it carries real unit tests.
 */
export function wrapTables(html: string): string {
  return html
    .replace(/<table\b/gi, (open) => `<div class="dy-table-scroll">${open}`)
    .replace(/<\/table>/gi, (close) => `${close}</div>`);
}
