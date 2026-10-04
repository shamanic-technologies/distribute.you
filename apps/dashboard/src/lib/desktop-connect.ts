/**
 * Browser sign-in for distribute for Mac (`apps/desktop`), the loopback pattern of
 * `gh auth login` / RFC 8252: the app listens on 127.0.0.1:<port>, opens
 * `/desktop/connect?port=&state=`, the user signs in with the dashboard's own Google or
 * email screens, the page mints a user API key and navigates to
 * `http://127.0.0.1:<port>/callback?state=&key=`. The app accepts it only when `state`
 * is the one it generated.
 *
 * Signing in leaves `/desktop/connect` (sign-in, Google, the choose-organization task,
 * onboarding all end on their own pages), so the request is parked in sessionStorage,
 * which survives every same-tab hop, and `DesktopConnectResume` brings the tab back.
 *
 * Alias-free: unit-tested directly.
 */

export const DESKTOP_CONNECT_PATH = "/desktop/connect";
export const DESKTOP_CONNECT_STORAGE_KEY = "distribute_desktop_connect";
/** A parked request older than this is dropped: the app stopped listening long ago. */
export const DESKTOP_CONNECT_TTL_MS = 15 * 60 * 1000;
export const DESKTOP_KEY_NAME = "distribute for Mac";

export interface DesktopConnectRequest {
  port: number;
  state: string;
}

interface Parked extends DesktopConnectRequest {
  at: number;
}

/** Only an unprivileged port and an opaque random token: the host is never caller-supplied. */
export function parseDesktopConnect(port: string | null, state: string | null): DesktopConnectRequest | null {
  if (!port || !state) return null;
  if (!/^\d{4,5}$/.test(port)) return null;
  const n = Number(port);
  if (n < 1024 || n > 65535) return null;
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(state)) return null;
  return { port: n, state };
}

export function desktopCallbackUrl(req: DesktopConnectRequest, key: string): string {
  const q = new URLSearchParams({ state: req.state, key });
  return `http://127.0.0.1:${req.port}/callback?${q.toString()}`;
}

export function parkDesktopConnect(storage: Pick<Storage, "setItem">, req: DesktopConnectRequest, now: number): void {
  const parked: Parked = { ...req, at: now };
  storage.setItem(DESKTOP_CONNECT_STORAGE_KEY, JSON.stringify(parked));
}

export function readParkedDesktopConnect(
  storage: Pick<Storage, "getItem" | "removeItem">,
  now: number,
): DesktopConnectRequest | null {
  const raw = storage.getItem(DESKTOP_CONNECT_STORAGE_KEY);
  if (!raw) return null;
  let parked: Partial<Parked>;
  try {
    parked = JSON.parse(raw) as Partial<Parked>;
  } catch {
    console.error("[dashboard] desktop connect: unreadable parked request, dropping it", { raw });
    storage.removeItem(DESKTOP_CONNECT_STORAGE_KEY);
    return null;
  }
  const req = parseDesktopConnect(String(parked.port ?? ""), parked.state ?? null);
  if (!req || typeof parked.at !== "number" || now - parked.at > DESKTOP_CONNECT_TTL_MS) {
    storage.removeItem(DESKTOP_CONNECT_STORAGE_KEY);
    return null;
  }
  return req;
}

export function clearDesktopConnect(storage: Pick<Storage, "removeItem">): void {
  storage.removeItem(DESKTOP_CONNECT_STORAGE_KEY);
}
