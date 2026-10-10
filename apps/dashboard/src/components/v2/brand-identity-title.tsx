"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { PencilSimpleIcon } from "@phosphor-icons/react/dist/csr/PencilSimple";
import { UploadSimpleIcon } from "@phosphor-icons/react/dist/csr/UploadSimple";
import { BrandLogo } from "@/components/brand-logo";
import { CharCounter } from "@/components/char-counter";
import { getBrand, updateBrandIdentity, uploadOrgImage, type BrandDetail } from "@/lib/api";
import {
  BRAND_LOGO_FOLDER,
  LOGO_FILE_ACCEPT,
  brandLogoFilename,
  logoFileProblem,
  logoUrlProblem,
} from "@/lib/brand-logo-file";
import { BRAND_NAME_MAX_CHARS, nameCounter, normalizeBrandName } from "@/lib/name-limits";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";

/**
 * WHAT A BRAND IS CALLED, AND ITS LOGO, edited where they are read: the Brand page's
 * own title (owner 2026-10-10). It replaced an "Identity" settings card that restated
 * both in a form below the title.
 *
 * The NAME follows the v2 inline rule (as `offer-identity-title.tsx`): it reads as
 * text, a click opens the field in the same box, blur/Enter saves, Esc drops it, and a
 * refusal reopens the field with the text kept. brand-service caps it at 255.
 *
 * The LOGO uploads on click and saves at once. It is uploaded to OUR storage, never a
 * pasted URL (a file we do not hold can move or start refusing hotlinks). Once a
 * brand has its own logo, the click opens a two-item menu so it can also go back to
 * the logo found from its website (`logoUrl: null`, which is NOT an omitted field).
 *
 * Every save sends only what MOVED, so renaming cannot overwrite a logo, and writes
 * the answer into the shared `["brand", id]` cache: the sidebar mark, the tab favicon
 * and every scope card read that key and move with the save.
 */

/** Read a picked file as the base64 payload the upload route takes. */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    // Rejects rather than resolving empty: an unreadable file is a failure to state.
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export function BrandIdentityTitle({ brandId }: { brandId: string }) {
  const queryClient = useQueryClient();
  // The key every other brand surface already polls: deduped, no extra request.
  const { data } = useAuthQuery(["brand", brandId], () => getBrand(brandId));
  const brand: BrandDetail | null = data?.brand ?? null;

  const [text, setText] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const logoBox = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!logoBox.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const identityMut = useMutation({
    mutationFn: (patch: { name?: string; logoUrl?: string | null }) => updateBrandIdentity(brandId, patch),
    onSuccess: (res) => {
      setPending(null);
      setProblem(null);
      queryClient.setQueryData(["brand", brandId], (prev: { brand: BrandDetail } | null | undefined) =>
        prev?.brand ? { brand: { ...prev.brand, name: res.name, logoUrl: res.logoUrl } } : prev,
      );
      // The switcher's dropdown reads a DIFFERENT key carrying the same two fields;
      // without this the brand renames everywhere except in the list you renamed it from.
      queryClient.invalidateQueries({ queryKey: ["brands"] });
    },
    onError: (err, patch) => {
      // Fail loud in the console with the whole body; on screen, our own sentence.
      console.error("[dashboard] updateBrandIdentity failed", err);
      setPending(null);
      if (patch.name !== undefined) setText(patch.name);
      setProblem("We could not save that. Try again in a moment.");
    },
  });

  const counter = nameCounter(text ?? "", BRAND_NAME_MAX_CHARS, normalizeBrandName);
  const savedName = brand?.name ?? "";

  const commit = () => {
    if (text === null || !brand) return;
    const trimmed = text.trim();
    if (trimmed.length === 0 || trimmed === savedName.trim()) {
      setText(null);
      setProblem(null);
      return;
    }
    if (counter.over) return;
    setText(null);
    setProblem(null);
    setPending(trimmed);
    identityMut.mutate({ name: trimmed });
  };

  async function handleFile(file: File) {
    // Refused BEFORE the upload, while the person still has the file in front of them.
    const fileProblem = logoFileProblem(file);
    if (fileProblem) {
      setProblem(fileProblem);
      return;
    }
    setProblem(null);
    setUploading(true);
    try {
      const dataUrl = await readAsDataUrl(file);
      const { url } = await uploadOrgImage({
        contentBase64: dataUrl,
        folder: BRAND_LOGO_FOLDER,
        filename: brandLogoFilename(brandId, file.type),
        contentType: file.type,
      });
      // Checked on the URL that came BACK, so a misconfigured host surfaces here
      // rather than as a broken picture a week later.
      const urlProblem = logoUrlProblem(url);
      if (urlProblem) {
        console.error("[dashboard] brand logo upload returned an unusable URL", url);
        setProblem(urlProblem);
        return;
      }
      identityMut.mutate({ logoUrl: url });
    } catch (err) {
      console.error("[dashboard] brand logo upload failed", err);
      setProblem("We could not upload that file. Try again in a moment.");
    } finally {
      setUploading(false);
      // Clear the input or picking the SAME file again fires no change event.
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const busyLogo = uploading || (identityMut.isPending && identityMut.variables?.logoUrl !== undefined);
  const shown = pending ?? brand?.name ?? " ";

  return (
    <span className="flex min-w-0 flex-col gap-1">
      <span className="flex min-w-0 items-center gap-3">
        <span ref={logoBox} className="relative shrink-0">
          <input
            ref={fileRef}
            type="file"
            accept={LOGO_FILE_ACCEPT}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <button
            type="button"
            disabled={!brand || busyLogo}
            onClick={() => (brand?.logoUrl ? setMenuOpen((o) => !o) : fileRef.current?.click())}
            aria-label={brand?.logoUrl ? "Change the logo" : "Upload a logo"}
            aria-haspopup={brand?.logoUrl ? "menu" : undefined}
            aria-expanded={brand?.logoUrl ? menuOpen : undefined}
            title={brand?.logoUrl ? "Change logo" : "Upload a logo"}
            className="group relative block h-10 w-10 overflow-hidden rounded-[10px] disabled:cursor-wait"
          >
            <BrandLogo
              domain={brand?.domain ?? null}
              logoUrl={brand?.logoUrl ?? null}
              size={40}
              className="h-10 w-10 object-contain"
              fallbackClassName="k-fg4 h-10 w-10 p-2"
            />
            <span
              className={`absolute inset-0 flex items-center justify-center bg-black/50 text-white transition-opacity duration-150 ${
                busyLogo ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
              }`}
            >
              {busyLogo ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <UploadSimpleIcon weight="bold" className="h-4 w-4" />
              )}
            </span>
          </button>
          {menuOpen && (
            <span
              role="menu"
              className="k-popover absolute left-0 top-12 z-20 flex w-max flex-col p-1 text-[13px] font-normal leading-5 tracking-normal"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  fileRef.current?.click();
                }}
                className="k-hover flex h-8 items-center rounded-[6px] px-2.5 text-left"
              >
                Upload a logo
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setProblem(null);
                  // null is the instruction that CLEARS it: the brand goes back on the
                  // logo we find from its website.
                  identityMut.mutate({ logoUrl: null });
                }}
                className="k-hover flex h-8 items-center rounded-[6px] px-2.5 text-left"
              >
                Use the one from my website
              </button>
            </span>
          )}
        </span>
        {/* ONE box for both states, so the field opens exactly where the text sat. */}
        {text !== null ? (
          <>
            <span className={`${NAME_BOX} ${counter.over ? "border-[var(--data-rose)]" : "border-[var(--accent)]"}`}>
              <span className="inline-grid min-w-0">
                <span aria-hidden className="invisible col-start-1 row-start-1 whitespace-pre">
                  {text || " "}{" "}
                </span>
                <input
                  autoFocus
                  size={1}
                  aria-label="Brand name"
                  value={text}
                  placeholder="Brand name"
                  onChange={(e) => {
                    setText(e.target.value);
                    setProblem(null);
                  }}
                  onBlur={commit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") {
                      setText(null);
                      setProblem(null);
                    }
                  }}
                  /* No maxLength: the counter shows the overrun as a negative number. */
                  className="col-start-1 row-start-1 w-full min-w-0 bg-transparent p-0 outline-none [font:inherit] [letter-spacing:inherit]"
                />
              </span>
              <PencilSimpleIcon aria-hidden className="invisible h-4 w-4 shrink-0" />
            </span>
            <CharCounter value={text} max={BRAND_NAME_MAX_CHARS} normalize={normalizeBrandName} className="shrink-0" />
          </>
        ) : (
          <button
            type="button"
            disabled={!brand || pending !== null}
            onClick={() => brand && setText(savedName)}
            className={`${NAME_BOX} k-hover group border-transparent text-left hover:border-[var(--line)]`}
          >
            <span className="truncate">{shown}</span>
            <PencilSimpleIcon className="k-fg3 h-4 w-4 shrink-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100" />
          </button>
        )}
      </span>
      {problem && <span className="text-[13px] font-normal leading-[20px] tracking-normal text-[var(--data-rose)]">{problem}</span>}
    </span>
  );
}

/** The name's box, identical reading and editing, so nothing moves on click. */
const NAME_BOX = "-mx-2 flex min-w-0 items-center gap-2 rounded-[8px] border px-2";
