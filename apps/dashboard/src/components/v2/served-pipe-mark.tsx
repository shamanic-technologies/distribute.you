"use client";

import { CatalogueMark } from "@/components/v2/catalogue-mark";
import { PathAvatar } from "@/components/v2/offer-sales-paths";
import { useStaffCatalogueObject } from "@/components/v2/staff-catalogue-data";
import type { ServedPipe } from "@/lib/v2/served-pipe";

/**
 * A PIPE's mark as features-service serves it (staff catalogue `icon` + `color`, owner
 * 2026-10-18: « les pipes ont maintenant leur nom et leur logo »). STAFF surfaces only: the
 * read is the gateway's staff catalogue. A customer surface never mounts this (the public
 * catalogue serves a pipe's name, not its mark yet).
 *
 * Until the catalogue answers, a quiet tile of the same size holds the place; a pipe it
 * cannot read is logged and drawn as the catalogue mark's own unknown-icon circle.
 */
export function useServedPipe(pipeId: string | null) {
  return useStaffCatalogueObject("pipes", pipeId);
}

export function ServedPipeMark({ pipeId, size = 16 }: { pipeId: string | null; size?: number }) {
  const q = useServedPipe(pipeId);
  if (!pipeId) {
    console.error("[v2] a pipe mark asked with no pipe id");
    return <CatalogueMark name="" size={size} />;
  }
  if (q.data) return <CatalogueMark icon={q.data.icon} color={q.data.color} name={q.data.name} size={size} />;
  if (q.isError) {
    console.error("[v2] pipe unreadable in the catalogue", { pipeId, error: q.error?.message });
    return <CatalogueMark name={pipeId} size={size} />;
  }
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 bg-[var(--bg-inset)] ${size <= 18 ? "rounded-[5px]" : "rounded-[8px]"}`}
      style={{ width: size, height: size }}
    />
  );
}

/**
 * A pipe's face on a CUSTOMER surface: the face drawn for its served name (the campaign face
 * these surfaces already show), never a look of ours. A pipe the producer names none for wears
 * the catalogue mark's unknown-icon circle (the caller already logged the missing name).
 */
export function PipeFace({ name, size = 16 }: { name: string | null; size?: number }) {
  return name ? <PathAvatar name={name} size={size} /> : <CatalogueMark name="" size={size} />;
}

/** The same, for a campaign's served pipe. */
export function ServedPipeFace({ pipe, size = 16 }: { pipe: ServedPipe; size?: number }) {
  return <PipeFace name={pipe.named ? pipe.name : null} size={size} />;
}
