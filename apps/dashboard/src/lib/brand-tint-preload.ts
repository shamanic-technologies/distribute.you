/**
 * The brand accent, painted in the FIRST FRAME.
 *
 * WHY A SCRIPT AND NOT A SERVER RENDER. The tint lives on `<html>`, and `<html>`
 * belongs to the ROOT layout — which must not call `cookies()` or `headers()`:
 * that would force dynamic rendering on the public `/report/*` tree and silently
 * kill the ISR the whole `(authed)` split exists to protect. A layout cannot see
 * the URL's brandId either. So the one place that can know BOTH the open brand
 * and its last-known tint before paint is a blocking script in `<head>`, where
 * `location.pathname` and `document.cookie` are both synchronous reads.
 *
 * That is the same doctrine the tenant-identity cookie already states — remembered
 * state goes somewhere readable before the first paint, never in a client store —
 * just delivered through the pre-paint script rather than the server render,
 * because of where `<html>` sits.
 *
 * WHAT IT DOES NOT DO. It resolves nothing: `resolveBrandTint`'s OKLCH maths stays
 * in the React tree, and the cookie carries its OUTPUT. A second implementation of
 * that maths here is how the first frame and the hydrated frame would come to
 * disagree about the same brand's hue.
 *
 * A brand this browser has never opened has no entry, so it paints the charter
 * blue and tints a moment later, exactly as every brand did before this existed.
 * We do not know its colour yet, and inventing one is worse than a late repaint.
 *
 * Alias-free on purpose (see CLAUDE.md): the `@` alias is not resolved under
 * vitest, so keeping this module on relative imports is what lets the script be
 * exercised by REAL unit tests rather than a source-substring guard.
 */
import { TENANT_IDENTITY_COOKIE, TENANT_IDENTITY_VERSION } from "./tenant-identity-cookie";
import { TINT_ATTR, HUE_VAR, CHROMA_VAR, DELTA_VAR } from "./brand-tint";

/**
 * The open brand, from the path. ONE rule, read by the pre-paint script and by
 * `useTenantSwitcher` — two parsers would eventually disagree about which brand
 * is open, and a wrong-colour first frame is worse than a late one.
 *
 * `/orgs/:orgId/brands/:brandId/...` and nothing else: an org root, billing and
 * the API-key page carry no brand, so they carry no tint.
 */
export function brandIdFromPathname(pathname: string): string | null {
  const all = pathname.split("/").filter(Boolean);
  // The v2 dashboard mounts the same tree under `/v2` — same brand, same tint.
  const parts = all[0] === "v2" ? all.slice(1) : all;
  if (parts[0] !== "orgs" || !parts[1]) return null;
  if (parts[2] !== "brands" || !parts[3]) return null;
  return parts[3];
}

/**
 * The IIFE rendered into `<head>`.
 *
 * Every value it reads is validated before use, because the cookie is NOT
 * httpOnly and is therefore a user-writable input — the same posture
 * `parseTenantIdentityCookie` takes. The `try` wraps ONLY the two calls that can
 * throw on a hand-edited blob (`decodeURIComponent`, `JSON.parse`); it is not a
 * swallow around the logic, which fails by doing nothing rather than by throwing.
 */
export const BRAND_TINT_PRELOAD_SCRIPT = `(function(){
var parts=location.pathname.split("/").filter(Boolean);
if(parts[0]==="v2")parts=parts.slice(1);
if(parts[0]!=="orgs"||!parts[1]||parts[2]!=="brands"||!parts[3])return;
var prefix=${JSON.stringify(`${TENANT_IDENTITY_COOKIE}=`)};
var row=document.cookie.split("; ").filter(function(p){return p.indexOf(prefix)===0})[0];
if(!row)return;
var snap;
try{snap=JSON.parse(decodeURIComponent(row.slice(prefix.length)))}catch(e){return}
if(!snap||snap.v!==${TENANT_IDENTITY_VERSION}||!snap.brands)return;
var brand=snap.brands[parts[3]];
var t=brand&&brand.t;
if(!t||typeof t.h!=="number"||typeof t.c!=="number"||typeof t.r!=="number")return;
var root=document.documentElement;
root.style.setProperty(${JSON.stringify(HUE_VAR)},String(t.h));
root.style.setProperty(${JSON.stringify(CHROMA_VAR)},String(t.c));
root.style.setProperty(${JSON.stringify(DELTA_VAR)},String(t.r));
root.setAttribute(${JSON.stringify(TINT_ATTR)},"");
})()`;
