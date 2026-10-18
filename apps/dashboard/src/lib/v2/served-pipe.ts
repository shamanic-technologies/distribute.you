/**
 * A PIPE (one leg x one channel) as dashboard v2 names it: by its SERVED name.
 *
 * features-service names every pipe (bird names: "Dotterel", "Killdeer") and serves that name
 * twice: as `campaignName` per leg on the public channel catalogue (what a customer session
 * reads), and as `name` on the staff catalogue pipe, which also serves the pipe's `icon` and
 * `color`. The id both reads key on is `<channel slug>|<leg key>` (`featureLegId`).
 *
 * The look (icon, colour) is never ours: every surface draws it with `ServedPipeMark`, off the
 * public catalogue's `pipe` per leg (owner 2026-10-18: « les pipes ont maintenant leur nom et leur logo »).
 *
 * Alias-free so it carries real unit tests.
 */
import { featureLegId } from "../outbound-leg-key";

export interface ServedPipe {
  /** `<channel slug>|<leg key>` (canonical leg spelling), the catalogue's pipe id; null when the campaign states no leg. */
  id: string | null;
  /** The served pipe name; the channel's name only while the catalogue has not answered or names none (the caller logs that). */
  name: string;
  /** The channel performing it, by its own words. */
  channelName: string;
  /** True when `name` is the producer's own (not the channel's words standing in). */
  named: boolean;
}

export function servedPipe(
  channelSlug: string,
  legKey: string | null | undefined,
  servedName: string | null,
  channelName: string,
): ServedPipe {
  const id = legKey ? featureLegId(channelSlug, legKey) : null;
  return { id, name: servedName ?? channelName, channelName, named: !!servedName };
}
