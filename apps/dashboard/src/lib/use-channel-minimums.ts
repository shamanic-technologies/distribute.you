"use client";

import { useMemo } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getPublicCatalogue } from "@/lib/api";
import { pollOptions } from "@/lib/query-options";
import {
  NO_CHANNEL_MINIMUMS,
  channelMinimumsFromWire,
  type ChannelMinimums,
} from "@/lib/channel-minimums";

/**
 * What each acquisition channel costs to run for a day — the floor a funded
 * ceiling must clear.
 *
 * Read from `GET /public/channels`, where features-service publishes every
 * channel's commercial terms, on the SAME query key the leg catalogue already polls,
 * so knowing a floor costs no request. It is a PLATFORM catalogue — no org, no
 * brand, no auth — so it is the same answer for every tenant and changes only
 * when a channel is published or re-priced.
 *
 * NO floors is the honest reading while the read is settling or has failed, and
 * it is safe by construction: every gate in `channel-minimums.ts` reads an
 * unknown floor as "state none and let billing decide", so a failed catalogue
 * read costs the client-side hint, never the floor itself — billing holds the
 * same rule against the same figure and its 400 is what decides.
 */
export function useChannelMinimums(): ChannelMinimums {
  const { data } = useAuthQuery(["publicCatalogue"], () => getPublicCatalogue(), pollOptions);
  return useMemo(() => (data ? channelMinimumsFromWire(data.channels) : NO_CHANNEL_MINIMUMS), [data]);
}
