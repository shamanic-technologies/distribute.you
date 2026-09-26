"use client";

import { CheckIcon } from "@heroicons/react/24/outline";
import {
  builtSubtitle,
  builtSummary,
  type BuiltInput,
} from "@/lib/built-summary";

/**
 * "Here's what we built for you."
 *
 * The screen the whole reorder exists for. Everything on it was assembled in
 * the ten minutes before it, against an org the visitor does not have an
 * account for yet — and the next button is the first time anyone asks them for
 * one.
 *
 * It RENDERS and decides nothing: which sections exist, in what order, and
 * whether there is anything to state at all is `builtSummary`'s call, which is
 * alias-free and carries real unit tests. Everything here is markup.
 *
 * NO FIGURE WE HAVE NOT MEASURED appears on it. No projected return, no
 * promised outcome, no count of anything we have not actually assembled — the
 * visitor is deciding whether to pay us on exactly this evidence, so a number
 * that turns out to be decoration is the most expensive thing that could be on
 * the page.
 */
export function BuiltSummaryPanel({
  input,
  campaignMarks,
}: {
  input: BuiltInput;
  /**
   * A campaign's leg tile, RESOLVED BY THE CALLER, keyed on the campaign key. A
   * campaign with no mark here simply draws none. Same reason the model below names
   * no display string: this component cannot drift from a vocabulary it never reads.
   */
  campaignMarks?: Record<string, React.ReactNode>;
}) {
  const summary = builtSummary(input);
  const subtitle = builtSubtitle(summary);

  // Nothing assembled. Says so rather than rendering an empty card — and the
  // caller still lets them continue, because a thin summary is not a reason to
  // trap somebody who wants to sign up.
  if (summary.isEmpty) {
    return (
      <p className="text-sm leading-6 text-gray-500">
        We could not put your setup together just yet. Create your account and we
        will pick it up from here.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {subtitle && <p className="text-sm text-gray-500">{subtitle}, ready to go.</p>}

      {summary.sections.map((section) => {
        if (section.kind === "services") {
          return (
            <Block key="services" title="What you sell">
              <div className="flex flex-wrap gap-1.5">
                {section.items.map((s) => (
                  <span
                    key={s}
                    className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </Block>
          );
        }

        if (section.kind === "campaigns") {
          return (
            <Block key="campaigns" title="What we'll run">
              <ul className="space-y-2.5">
                {section.items.map((c) => (
                  <li key={c.key} className="flex items-start gap-2.5">
                    {campaignMarks?.[c.key]}
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900">{c.label}</div>
                      <div className="mt-0.5 text-xs leading-5 text-gray-500">Via {c.channelName}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </Block>
          );
        }

        if (section.kind === "targetAudience") {
          return (
            <Block key="targetAudience" title="Who we'll reach out to">
              <p className="whitespace-pre-line text-sm leading-6 text-gray-700">{section.text}</p>
            </Block>
          );
        }

        return (
          <Block key="offer" title="What we'll say">
            <dl className="space-y-2">
              {section.items.map((l) => (
                <div key={l.key}>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    {l.label}
                  </dt>
                  {/* The lever's own words, wrapped rather than truncated: this is
                      the visitor's offer read back to them, and half of it says
                      half of what they meant. */}
                  <dd className="mt-0.5 whitespace-pre-line text-sm leading-6 text-gray-700">
                    {l.value}
                  </dd>
                </div>
              ))}
            </dl>
          </Block>
        );
      })}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
        <CheckIcon className="h-3.5 w-3.5 text-emerald-500" />
        {title}
      </h3>
      {children}
    </section>
  );
}
