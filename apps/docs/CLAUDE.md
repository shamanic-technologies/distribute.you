# apps/docs rules

**Static export, deployed by GitHub Actions to Cloudflare Pages.** `output: "export"`, shipped by `.github/workflows/deploy-static-sites.yml` (not the box cron). No server: no route handler, middleware, or request-time API, so "serve markdown" means a published file, never a handler.

**The root layout declares NO canonical.** A layout `alternates.canonical` is inherited by every page and marks them all duplicates of the home page (28 pages pointed at `/` for months; name search surfaced nothing).
- `src/lib/docs-routes.ts` is the ONE list (path, title, description). `<title>`, meta description, canonical and `sitemap.ts` all read it. `docsMetadata(path)` (`src/lib/docs-metadata.ts`) throws on an unknown path.
- Canonicals carry the trailing slash (`trailingSlash: true`).
- Name is `distribute.you`, never bare `distribute`. A title already containing it opts out of the `%s | distribute.you Docs` template.
- `/openapi` is the fixed address for `api.distribute.you/openapi.json`, `api.distribute.you/docs`, `mcp.distribute.you/mcp`.
- `public/llms.txt` indexes every route + those three URLs; `robots.txt` announces it; a guard fails on a route without an llms.txt line.
- `src/app/not-found.tsx` gives `404.html` a body.
- Per-page `.md` mirrors are deliberately NOT published (markdown is heterogeneous per page). To change that, first move all markdown into one module and generate from it.

**Usable before discoverable: verify every pasted value RUNS before writing copy.** Past pages printed a nonexistent npm package, a 401 auth header (api-service ADMIN path), a 404 TS client, 35 MCP tools vs 6 real, and REST routes absent from the 185 served. Checks: `npm view <pkg>`; deployed `openapi.json` `components.securitySchemes`; a connected MCP client's tool list; regex every printed route and diff against deployed `openapi.json`.

**Another system's catalogue is read from that system, never hand-maintained.** `src/lib/developer-surfaces.ts` is the one home for every pasted value (header, key prefix, MCP endpoint, client configs, CLI package, tool catalogue). Command-printing pages import from it; the guard fails if a retired literal reappears in `src`/`public` or a page carries its own copy. Word comments to DESCRIBE a retired literal, not spell it.

**Sweep traps (find-and-replace across the app):**
- It rewrites your own explanatory comments (inverted the `X-API-Key` rationale). Re-read every touched comment.
- An unasserted import-insert `str.replace` no-ops silently; assert every scripted replace.
- A word with several senses flattens into nonsense ("a funnel is a funnel"); classify senses first, narrow phrases before the generic rule, scope to prose not identifiers, then `grep -inE "funnel[^.]{0,45}funnel"` the result and read the diff.
- An extension-scoped sweep breaks pairings across files (CSS class, `data-` attr, keyframe, DOM id); sweep HTML/CSS/JS together and diff token counts.

**A page for a surface the API no longer serves is DELETED**, with its route entry, sidebar entry and llms.txt line in the same commit (outlets/journalists/articles/press kits, #3632).

**Guards:** `tests/unit/agent-discoverability.test.ts`. The docs suite is NOT a CI gate: run `pnpm --filter @distribute/docs test` locally before pushing.
