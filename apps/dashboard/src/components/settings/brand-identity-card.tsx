"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { BrandLogo } from "@/components/brand-logo";
import { SettingsSaveRow } from "@/components/settings/settings-save-row";
import {
  getBrand,
  updateBrandIdentity,
  uploadOrgImage,
  type BrandDetail,
} from "@/lib/api";
import {
  BRAND_LOGO_FOLDER,
  LOGO_FILE_ACCEPT,
  brandLogoFilename,
  logoFileProblem,
  logoUrlProblem,
} from "@/lib/brand-logo-file";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";

/**
 * What a brand IS: the name it is shown under, and the logo beside it.
 *
 * Both were DERIVED and unfixable by the person they describe — the name from a
 * one-off extraction at signup, the logo from whatever logo.dev had indexed for
 * the domain. When that crawl is stale the brand wears the wrong mark on every
 * surface a customer looks at, and it was: logo.dev served OUR brand under an
 * identity we retired in July, for two months, with no way to correct it.
 *
 * The domain is deliberately NOT here. It is the brand's key — a website belongs
 * to one brand at a time and moving it resolves a conflict against whoever holds
 * it — so it keeps its own one-time card. A name and a logo are what a brand is
 * CALLED; they change without consequence to anything else.
 */

/** Read a picked file as the base64 payload the upload route takes. */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    // Rejects rather than resolving empty: an unreadable file is a failure to
    // state, never a logo to store.
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export function BrandIdentityCard({ brandId }: { brandId: string }) {
  const queryClient = useQueryClient();
  // The key every other brand surface already polls → deduped, disk-backed, so
  // this card paints from the local-first cache rather than a cold read.
  const { data, isPending, isError } = useAuthQuery(["brand", brandId], () => getBrand(brandId));
  const brand = data?.brand ?? null;

  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Re-seed when the payload the form was BUILT FROM changes — identity, not deep
  // equality, so an unchanged poll (React Query returns the same reference) costs
  // nothing and cannot loop. A once-per-mount latch would seed from the DISK
  // snapshot and then ignore the fresher server answer that lands a beat later,
  // which is how a saved value comes back looking blank.
  const seededFrom = useRef<BrandDetail | null>(null);
  const touched = useRef(false);
  useEffect(() => {
    if (!brand || seededFrom.current === brand) return;
    // A field the user has edited outranks the server: a form that rewrites itself
    // mid-edit is worse than a stale one.
    if (touched.current) return;
    seededFrom.current = brand;
    setName(brand.name ?? "");
    setLogoUrl(brand.logoUrl ?? null);
  }, [brand]);

  const savedName = brand?.name ?? "";
  const savedLogo = brand?.logoUrl ?? null;
  // A LIVE compare, never a sticky boolean: typing a change and undoing it must
  // disarm Save again.
  const dirty = name.trim() !== savedName.trim() || logoUrl !== savedLogo;

  const { mutate, isPending: saving } = useMutation({
    mutationFn: () =>
      updateBrandIdentity(brandId, {
        ...(name.trim() !== savedName.trim() ? { name: name.trim() } : {}),
        // `logoUrl` goes on the body only when it MOVED, and `null` is a real
        // instruction (clear it) rather than an absence — so the key is set
        // explicitly instead of being spread away by a falsy check.
        ...(logoUrl !== savedLogo ? { logoUrl } : {}),
      }),
    onSuccess: (res) => {
      // Write the answer into the shared cache rather than invalidating: this is
      // the key the sidebar mark, the tab favicon and every scope card read, so
      // they move with the save instead of after a second round trip that could
      // fail and leave them on the old identity.
      queryClient.setQueryData(
        ["brand", brandId],
        (prev: { brand: BrandDetail } | null | undefined) =>
          prev?.brand ? { brand: { ...prev.brand, name: res.name, logoUrl: res.logoUrl } } : prev,
      );
      // The list the switcher's dropdown reads is a different key and carries the
      // same two fields; without this the brand renames everywhere except in the
      // list you renamed it from.
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      touched.current = false;
      seededFrom.current = null;
      setSaved(true);
      setProblem(null);
    },
    onError: (err) => {
      // Fail loud in the console with the whole body; on screen, our own sentence.
      console.error("[dashboard] updateBrandIdentity failed", err);
      setProblem("We could not save that. Try again in a moment.");
    },
  });

  async function handleFile(file: File) {
    setSaved(false);
    // Refused BEFORE the upload: the honest moment to say "this will not work" is
    // while the person still has the file in front of them.
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
      // Checked on the URL that came BACK: the public host is resolved at upload
      // time, so a misconfiguration surfaces as an unusable link here rather than
      // as a broken picture on the dashboard a week later.
      const urlProblem = logoUrlProblem(url);
      if (urlProblem) {
        console.error("[dashboard] brand logo upload returned an unusable URL", url);
        setProblem(urlProblem);
        return;
      }
      touched.current = true;
      setLogoUrl(url);
    } catch (err) {
      console.error("[dashboard] brand logo upload failed", err);
      setProblem("We could not upload that file. Try again in a moment.");
    } finally {
      setUploading(false);
      // Clear the input or picking the SAME file again fires no change event, and
      // a retry after a failure reads as a dead control.
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // Reveal on SETTLE: an errored read paints the form with what it has rather than
  // skeletoning forever.
  if (isPending && !isError) {
    return (
      <div className="p-5">
        <div className="h-4 w-32 animate-pulse rounded bg-gray-100" />
        <div className="mt-4 h-9 w-full max-w-sm animate-pulse rounded-lg bg-gray-100" />
      </div>
    );
  }

  return (
    <div className="p-5">
      <div className="max-w-sm">
        <label htmlFor="brand-name" className="mb-1 block text-xs text-gray-500">
          Brand name
        </label>
        <input
          id="brand-name"
          type="text"
          value={name}
          placeholder="Acme"
          onChange={(e) => {
            touched.current = true;
            setName(e.target.value);
            setSaved(false);
            setProblem(null);
          }}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
        />
        <p className="mt-1.5 text-xs text-gray-400">
          What this brand is called across your dashboard.
        </p>
      </div>

      <div className="mt-6">
        <span className="mb-2 block text-xs text-gray-500">Logo</span>
        <div className="flex items-center gap-4">
          {/* The mark as it will actually be seen: the same component every other
              surface draws, so what is previewed here is what lands there. */}
          <BrandLogo
            domain={brand?.domain ?? null}
            logoUrl={logoUrl}
            size={48}
            className="h-12 w-12 shrink-0 rounded-lg border border-gray-200 object-contain"
            fallbackClassName="h-12 w-12 shrink-0 text-gray-300"
          />
          <div className="flex flex-wrap items-center gap-2">
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
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className={`rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 ${
                uploading ? "cursor-wait" : ""
              }`}
            >
              {uploading ? "Uploading..." : logoUrl ? "Replace logo" : "Upload a logo"}
            </button>
            {logoUrl && (
              <button
                type="button"
                onClick={() => {
                  touched.current = true;
                  // null is the instruction that CLEARS it, which is what puts the
                  // brand back on the logo we find from its website.
                  setLogoUrl(null);
                  setSaved(false);
                  setProblem(null);
                }}
                // BORDERED like its sibling, not a bare grey word: a quiet text
                // control reads as a label and never gets pressed — the same way
                // the sign-up "Resend code" link went unused for months.
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-500 transition hover:bg-gray-50 hover:text-gray-700"
              >
                Use the one from my website
              </button>
            )}
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          PNG, JPEG or GIF, under 2MB. Without one we use the logo we find on your
          website, which is not always the current one.
        </p>
      </div>

      {problem && <p className="mt-4 text-sm text-red-600">{problem}</p>}

      <SettingsSaveRow
        dirty={dirty}
        saving={saving}
        saved={saved}
        disabled={uploading || name.trim().length === 0}
        onSave={() => mutate()}
      />
    </div>
  );
}
