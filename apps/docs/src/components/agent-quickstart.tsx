import { Fragment } from "react";
import {
  AGENT_QUICKSTART_LINES,
  AGENT_QUICKSTART_TITLE,
  REPORTING_RULE,
  REPORTING_TITLE,
} from "@/lib/agent-quickstart";

/** Renders the `code` spans of a quickstart sentence; everything else is text. */
function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split("`").map((part, i) =>
        i % 2 === 1 ? (
          <code key={i} className="rounded bg-gray-100 px-1 py-0.5 text-[13px] text-gray-900 break-words">
            {part}
          </code>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/**
 * The first block on the home page, /api and /mcp: what an assistant must know
 * before its first call. Content lives in lib/agent-quickstart.ts, shared with
 * skill.md and llms.txt.
 */
export function AgentQuickstart() {
  return (
    <section
      aria-labelledby="agent-quickstart"
      className="mb-10 rounded-lg border border-gray-200 bg-gray-50 p-5"
    >
      <h2 id="agent-quickstart" className="mb-3 text-base font-semibold text-gray-900">
        {AGENT_QUICKSTART_TITLE}
      </h2>
      <dl className="grid gap-x-4 gap-y-2 text-sm text-gray-700 sm:grid-cols-[120px_minmax(0,1fr)]">
        {AGENT_QUICKSTART_LINES.map((l) => (
          <Fragment key={l.label}>
            <dt className="font-medium text-gray-900">{l.label}</dt>
            <dd className="min-w-0">
              <Inline text={l.text} />
            </dd>
          </Fragment>
        ))}
      </dl>
      <h3 className="mb-1 mt-4 text-sm font-semibold text-gray-900">{REPORTING_TITLE}</h3>
      <p className="text-sm text-gray-700">{REPORTING_RULE}</p>
    </section>
  );
}
