"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { V2TabLink, brandTabs } from "@/components/v2/setup-pages";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getBrand } from "@/lib/api";
import { MaturityBadge } from "@/components/maturity-badge";
import { BrandDomainCard } from "@/components/settings/brand-domain-card";
import { BrandSalesRepCard, SALES_REP_BLURB } from "@/components/settings/brand-sales-rep-card";
import { BrandBookingLinkCard, BOOKING_LINK_BLURB } from "@/components/settings/brand-booking-link-card";
import { BrandConversionRatesCard } from "@/components/settings/brand-conversion-rates-card";
import {
  BrandConversionTrackingCard,
  CONVERSION_TRACKING_BLURB,
} from "@/components/settings/brand-conversion-tracking-card";
import { TopBar } from "@/components/v2/ui";
import { BrandLinkedinPageRow } from "@/components/v2/brand-linkedin-page-row";
import { BrandIdentityTitle } from "@/components/v2/brand-identity-title";

/**
 * Brand settings, laid out the way every settings page of a Linear-grade product is:
 * a rail naming the sections on the left, then one row per section, its title and what
 * it is for beside the card holding the form.
 *
 * The FORMS are still v1's own components (one editor per value, so two surfaces never
 * disagree about it); the `v2-embed` layer gives them the Keel look, and the three that
 * used to carry their own heading and frame take `bare` so nothing is stated twice.
 */

interface Section {
  id: string;
  title: string;
  description: React.ReactNode;
  beta?: boolean;
  body: React.ReactNode;
}

export function V2BrandSettingsPage() {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  // Same key the domain card reads, so this costs no request. The website section
  // only exists while the brand has none: once set, it cannot change here.
  const { data: brandData, isPending: brandPending } = useAuthQuery(["brand", brandId], () => getBrand(brandId));
  const needsWebsite = !brandPending && (brandData?.brand?.domain ?? null) === null;

  const sections: Section[] = [
    ...(needsWebsite
      ? [
          {
            id: "website",
            title: "Website",
            description:
              "Your brand has no website yet. Add it to unlock click destinations and website goals. It can be set only once.",
            body: <BrandDomainCard brandId={brandId} bare />,
          },
        ]
      : []),
    {
      id: "linkedin-page",
      title: "LinkedIn page",
      description: "Your company page on LinkedIn. Click it to change it.",
      body: <BrandLinkedinPageRow brandId={brandId} />,
    },
    {
      id: "sales-rep",
      title: "Sales rep",
      description: SALES_REP_BLURB,
      body: <BrandSalesRepCard brandId={brandId} bare />,
    },
    {
      id: "booking-link",
      title: "Booking link",
      description: BOOKING_LINK_BLURB,
      body: <BrandBookingLinkCard brandId={brandId} bare />,
    },
    {
      id: "conversion-rates",
      title: "Conversion rates",
      description:
        "We use what we measure on your own leads once enough have reached a step, your value until then, and the median of our clients when you have not given one.",
      body: <BrandConversionRatesCard brandId={brandId} />,
    },
    {
      id: "conversion-tracking",
      title: "Conversion tracking",
      description: CONVERSION_TRACKING_BLURB,
      body: <BrandConversionTrackingCard brandId={brandId} bare />,
    },
  ];

  const active = useActiveSection(sections.map((s) => s.id));

  return (
    <>
      <TopBar crumbs={[{ label: "Brand" }, { label: "Settings" }]} />
      <div className="mx-auto max-w-[1100px] px-4 pb-16 pt-6 md:px-6">
        <div className="mb-5">
          {/* The brand's name and logo ARE the title, edited in place (owner 2026-10-10). */}
          <h1 className="text-[24px] font-medium leading-[30px] tracking-[-0.02em]">
            <BrandIdentityTitle brandId={brandId} />
          </h1>
          <p className="k-fg2 mt-1 text-[14px]">Who you are, who answers your leads, and how we measure what they turn into.</p>
        </div>
        {/* Brand = its settings and its integrations (owner 2026-10-10). */}
        <nav className="k-line-subtle mb-6 flex gap-5 border-b" aria-label="Sections">
          {brandTabs(orgId, brandId, "settings").map((t) => (
            <V2TabLink key={t.href} tab={t} />
          ))}
        </nav>

        <div className="lg:grid lg:grid-cols-[168px_minmax(0,1fr)] lg:gap-10">
          <nav aria-label="Settings sections" className="hidden lg:block">
            <ul className="sticky top-20 space-y-0.5">
              {sections.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    aria-current={active === s.id ? "true" : undefined}
                    className={`flex h-7 items-center gap-1.5 rounded-lg px-2 text-[13px] ${
                      active === s.id ? "k-selected k-fg" : "k-fg2 k-hover"
                    }`}
                  >
                    {s.title}
                    {s.beta && <MaturityBadge level="beta" />}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="min-w-0">
            {sections.map((s, i) => (
              <section
                key={s.id}
                id={s.id}
                className={`scroll-mt-20 grid gap-4 md:grid-cols-[220px_minmax(0,1fr)] md:gap-8 ${
                  i === 0 ? "" : "k-line-subtle mt-8 border-t pt-8"
                }`}
              >
                <div>
                  <h2 className="flex items-center gap-1.5 text-[14px] font-medium leading-5">
                    {s.title}
                    {s.beta && <MaturityBadge level="beta" />}
                  </h2>
                  <p className="k-fg3 mt-1 text-[12px] leading-[18px]">{s.description}</p>
                </div>
                <div className="v2-embed min-w-0">
                  <div className="k-card overflow-hidden">{s.body}</div>
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * The section being read: the last one whose top has scrolled past the sticky bar,
 * or the last section once the page is scrolled to its end (a short final section
 * never reaches the bar).
 */
function useActiveSection(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  const key = ids.join("|");
  useEffect(() => {
    const list = key.split("|").filter(Boolean);
    if (list.length === 0) return;
    // The v2 shell scrolls its <main>, not the window, and a scroll event does not
    // bubble: listening in the CAPTURE phase hears whichever container scrolls.
    const onScroll = (e?: Event) => {
      const box = e?.target instanceof HTMLElement ? e.target : document.documentElement;
      const atEnd = box.scrollTop > 0 && box.scrollTop + box.clientHeight >= box.scrollHeight - 2;
      if (atEnd) return setActive(list[list.length - 1]);
      let current = list[0];
      for (const id of list) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 120) current = id;
      }
      setActive(current);
    };
    onScroll();
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => document.removeEventListener("scroll", onScroll, { capture: true });
  }, [key]);
  return active;
}
