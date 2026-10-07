"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import { ApiError, clearBrandLinkedinPage, getBrandLinkedinPage, setBrandLinkedinPage } from "@/lib/api";
import {
  linkedinPageEmptyLabel,
  linkedinPageRefusal,
  linkedinPageSourceLabel,
  shortLinkedinUrl,
  type BrandLinkedinPage,
} from "@/lib/v2/brand-linkedin-page";
import { Shimmer } from "@/components/v2/ui";
import { LinkedinLogoIcon } from "@phosphor-icons/react/dist/csr/LinkedinLogo";
import { PencilSimpleIcon } from "@phosphor-icons/react/dist/csr/PencilSimple";

/**
 * The brand's LinkedIn company page in Brand settings (owner 2026-10-07): the page we hold
 * reads as text with where it came from; a click turns it into its field, leaving it (or
 * Enter) saves, Esc drops it, empty hands the brand back to automatic discovery. The same
 * inline edit as the Offer page (`InlineRate`). A page set here wins over what we find.
 */
export function BrandLinkedinPageRow({ brandId }: { brandId: string }) {
  return (
    <div className="p-4">
      <PageField brandId={brandId} />
    </div>
  );
}

function PageField({ brandId }: { brandId: string }) {
  const qc = useQueryClient();
  const q = useAuthQuery(["brandLinkedinPage", brandId], () => getBrandLinkedinPage(brandId));
  const [text, setText] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  if (q.isPending) return <Shimmer className="h-5 w-64" />;
  if (q.isError || !q.data) {
    return <p className="k-fg3 text-[13px]">The LinkedIn page could not be read. Try again in a minute.</p>;
  }
  const page = q.data;
  const shown = pending !== undefined ? pending : page.linkedinUrl;

  const commit = async () => {
    if (text === null) return;
    const value = text.trim();
    if (value === (page.linkedinUrl ?? "") || (value && page.linkedinUrl && shortLinkedinUrl(value) === shortLinkedinUrl(page.linkedinUrl))) {
      setText(null);
      setError(null);
      return;
    }
    setText(null);
    setError(null);
    setPending(value || null);
    try {
      const saved: BrandLinkedinPage = value ? await setBrandLinkedinPage(brandId, value) : await clearBrandLinkedinPage(brandId);
      qc.setQueryData(["brandLinkedinPage", brandId], saved);
      // The Posts page reads the page's posts: a new page means new posts.
      await qc.invalidateQueries({ queryKey: ["staffBrandLinkedinPosts", brandId] });
    } catch (err) {
      console.error("[brand-settings] LinkedIn page save failed", { brandId, value, err });
      setText(value);
      setError(err instanceof ApiError && err.status === 400 ? linkedinPageRefusal(err.body.reason) : "Not saved. Try again.");
    } finally {
      setPending(undefined);
    }
  };

  const source = pending === undefined ? linkedinPageSourceLabel(page) : null;
  return (
    <div className="flex min-w-0 items-start gap-5">
      <LinkedinLogoIcon weight="fill" aria-hidden className="mt-[3px] h-6 w-6 shrink-0 text-[#0A66C2]" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {/* ONE box for both states, so the field opens exactly where the text sat: same
            border width, padding and font, the input sized by a hidden copy of its value
            in the same grid cell (offer-identity-title.tsx's pattern). */}
        {text !== null ? (
          <span className={`${URL_BOX} border-[var(--accent)]`}>
            <span className="inline-grid min-w-0">
              <span aria-hidden className="invisible col-start-1 row-start-1 whitespace-pre">
                {text || "linkedin.com/company/your-brand"}{" "}
              </span>
              <input
                autoFocus
                size={1}
                aria-label="LinkedIn company page"
                value={text}
                placeholder="linkedin.com/company/your-brand"
                onChange={(e) => {
                  setText(e.target.value);
                  setError(null);
                }}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") {
                    setText(null);
                    setError(null);
                  }
                }}
                className="col-start-1 row-start-1 w-full min-w-0 border-0 bg-transparent p-0 shadow-none outline-none [font:inherit] [letter-spacing:inherit] focus:ring-0"
                /* Inline: the embed layer sets every input to 13px, which would shrink the text on click. */
                style={{ font: "inherit", letterSpacing: "inherit", backgroundColor: "transparent", border: 0, borderRadius: 0 }}
              />
            </span>
            <PencilSimpleIcon aria-hidden className="invisible h-4 w-4 shrink-0" />
          </span>
        ) : (
          <button
            type="button"
            disabled={pending !== undefined}
            onClick={() => setText(page.linkedinUrl ? shortLinkedinUrl(page.linkedinUrl) : "")}
            className={`${URL_BOX} k-hover group border-transparent text-left hover:border-[var(--line)]`}
          >
            {shown ? <span className="k-fg truncate">{shortLinkedinUrl(shown)}</span> : <span className="k-fg3 truncate">{linkedinPageEmptyLabel(page)}</span>}
            <PencilSimpleIcon className="k-fg3 h-4 w-4 shrink-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100" />
          </button>
        )}
        {error ? (
          <p className="text-[12px] leading-[18px] text-[var(--data-rose)]">{error}</p>
        ) : (
          <p className="k-fg3 flex min-h-[18px] items-center gap-1.5 text-[12px] leading-[18px]">
            {source && <span>{source}</span>}
            {source && shown && <span aria-hidden>·</span>}
            {shown && (
              <a href={shown} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--accent)] hover:underline">
                Open on LinkedIn
              </a>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

/** The page's box, identical reading and editing, so nothing moves on click. */
const URL_BOX = "-mx-2 flex h-8 w-fit max-w-full min-w-0 items-center gap-2 rounded-[8px] border px-2 text-[14px]";
