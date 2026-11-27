/**
 * The Distry skin on the sign-up walk (`distry-brand` skill), behind a private switch:
 * `/get-started?skin=distry` turns it on and remembers it in a cookie, `?skin=off` turns
 * it off. Nobody else is served any of this. It adds the sky and the
 * painting around the walk (no fireflies, no Distry bubble: owner 2026-11-27) (at daybreak since 2026-11-25) and loads a stylesheet that re-points Keel's
 * tokens; the walk itself is not touched.
 */
export const DISTRY_SKIN_COOKIE = "dy_skin";
const VERSION = 10;

/** Whether this request wears the skin: the query wins, else the cookie. */
export function wearsDistrySkin(query: string | null, cookie: string | undefined): boolean {
  if (query !== null) return query === "distry";
  return cookie === "distry";
}

const BOOT = (on: boolean) =>
  `document.cookie="${DISTRY_SKIN_COOKIE}=${on ? "distry" : "off"}; path=/; max-age=2592000; SameSite=Lax";` +
  (on ? `document.documentElement.classList.add("distry");if(!matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.classList.add("js");` : "");

/** Remembers `?skin=off`, and renders nothing. */
export function DistrySkinOff() {
  return <script dangerouslySetInnerHTML={{ __html: BOOT(false) }} />;
}

export function DistrySkin() {
  return (
    <>
      <link rel="stylesheet" href={`/distry/get-started.css?v=${VERSION}`} />
      <script dangerouslySetInnerHTML={{ __html: BOOT(true) }} />
      <div className="d-sky" aria-hidden>
        <div className="d-sky-layer d-sky-day" />
        {/* distry.js draws on it; hidden by day */}
        <canvas className="d-stars" id="stars" />
        <div className="d-orb d-sun" />
      </div>
      <div className="d-backdrop" aria-hidden />
      <script src={`/distry/distry.js?v=${VERSION}`} defer />
    </>
  );
}
