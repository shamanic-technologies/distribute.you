import { URLS } from "@distribute/content";
import { parseChannels, parseEconomics, parseSteps, parseTreg, type PathFinderData } from "./pages/gtm-path-finder";
import type { PlatformPrice } from "./pages/catalog";

/**
 * The path finder's reads, through the public gateway. The channels and the steps are
 * required (a failed read drops the section, logged loud); the expected costs are not
 * (a failed read drops only the figures).
 */
const TREG_PLATFORMS = "https://treg.to/catalog/platforms";

async function read(path: string, caller: string): Promise<unknown | null> {
  const base = (process.env.API_SERVICE_URL || URLS.api).replace(/\/$/, "");
  try {
    const res = await fetch(path.startsWith("https://") ? path : `${base}${path}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(8_000),
    } as RequestInit);
    if (!res.ok) throw new Error(`status ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`[landing] ${caller}: ${path} read failed`, err);
    return null;
  }
}

export async function fetchPathFinderData(caller: string, prices: PlatformPrice[] | null): Promise<PathFinderData | null> {
  const [channels, steps, economics, tregBody] = await Promise.all([
    read("/v1/public/channels", caller),
    read("/v1/public/catalogue/steps", caller),
    read("/v1/public/channel-outcome-economics", caller),
    read(TREG_PLATFORMS, caller),
  ]);
  if (channels === null || steps === null) return null;
  let costs: PathFinderData["economics"] = null;
  try {
    if (economics !== null) costs = parseEconomics(economics);
  } catch (err) {
    console.error(`[landing] ${caller}: expected costs unreadable, shown without figures`, err);
  }
  let treg: PathFinderData["treg"] = null;
  try {
    if (tregBody !== null) treg = parseTreg(tregBody);
  } catch (err) {
    console.error(`[landing] ${caller}: treg catalogue unreadable, pile shows our own vendors only`, err);
  }
  try {
    return { channels: parseChannels(channels), stepLabels: parseSteps(steps), economics: costs, prices, treg };
  } catch (err) {
    console.error(`[landing] ${caller}: path finder data unreadable`, err);
    return null;
  }
}
