"use client";

import { useEffect, useState } from "react";
import type { StartCatalogue } from "@/lib/start-catalogue";
import type { FleetProof, ShowcaseBrand } from "@/lib/start-proof";

/**
 * The public catalogue the `/get-started` wall reads its proof from (served fleet
 * figures, never invented), and the product's one spelling of a return.
 */

export interface StartCatalogueState {
  /** The producer's catalogue: its channels (with the legs they perform) and its steps. */
  wire: StartCatalogue;
  founders: number | null;
  /** The fleet's proof, each half nullable on its own. */
  proof: FleetProof & {
    showcase: ShowcaseBrand[];
  };
}

/** One decimal under 10x, a whole number above it — the product's one spelling of a
 *  return. */
export const formatReturn = (x: number): string => (x < 10 ? `${x.toFixed(1)}x` : `${Math.round(x)}x`);

/**
 * The catalogue the screens draw from, read once by the surface that shows it.
 */
export function useStartCatalogue(): { catalogue: StartCatalogueState | null; catalogueError: boolean } {
  const [catalogue, setCatalogue] = useState<StartCatalogueState | null>(null);
  const [catalogueError, setCatalogueError] = useState(false);

  // The catalogue is the whole screen's content, so a failed read is STATED rather
  // than rendered as an empty list.
  useEffect(() => {
    let live = true;
    fetch("/api/public/catalogue")
      .then(async (res) => {
        if (!res.ok) throw new Error(`catalogue ${res.status}`);
        return res.json();
      })
      .then((body) => {
        if (!live) return;
        const cat = body?.channels;
        const wire: StartCatalogue = {
          channels: cat?.channels ?? cat ?? [],
          steps: cat?.steps ?? [],
        };
        const founders = typeof body?.founders === "number" ? body.founders : null;
        const p = body?.proof ?? {};
        setCatalogue({
          wire,
          founders,
          proof: {
            hotLeads: p.hotLeads ?? null,
            medianReturnPerDollar: p.medianReturnPerDollar ?? null,
            showcase: Array.isArray(p.showcase) ? p.showcase : [],
          },
        });
      })
      .catch((err) => {
        console.error("[start] catalogue read failed:", err);
        if (live) setCatalogueError(true);
      });
    return () => {
      live = false;
    };
  }, []);
  return { catalogue, catalogueError };
}
