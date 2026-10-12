"use client";

import { useState } from "react";
import { getPersonApiCall } from "@/lib/api";
import { callStatusTone, formatBytes, prettyBody, queryValue, type ApiCallDetail } from "@/lib/api-calls";
import { ownQueryData } from "@/lib/own-query-data";
import { useAuthQuery } from "@/lib/use-auth-query";
import { Shimmer } from "@/components/v2/ui";

/** A body longer than this many lines opens folded. */
const BODY_FOLD_LINES = 14;

const TONE: Record<ReturnType<typeof callStatusTone>, { color: string; word: string }> = {
  ok: { color: "var(--data-teal)", word: "Answered" },
  refused: { color: "var(--data-amber)", word: "Refused" },
  failed: { color: "var(--data-rose)", word: "Failed" },
};

/**
 * Under an API / MCP answer in the Unibox thread: the whole call, read on demand from
 * crm-service (keyed by the item's `ref.callId`). Method and path, the inputs, the status,
 * then the answer's body indented and folded when long.
 */
export function ApiCallDetailPanel({ brandId, callId }: { brandId: string; callId: string }) {
  const q = useAuthQuery(["personApiCall", brandId, callId], () => getPersonApiCall(brandId, callId), {
    staleTime: Infinity,
  });
  // Only THIS call's data: the app-wide placeholder would hand it the last call opened.
  const data = ownQueryData(q);
  if (!q.isFetchedAfterMount && !data) {
    return (
      <div className="mt-2 space-y-2" aria-label="Loading the call">
        <Shimmer className="h-5 w-2/3" />
        <Shimmer className="h-16 w-full" />
      </div>
    );
  }
  if (!data) return <p className="k-fg3 mt-2 text-[12px]">We could not load this call. Retrying.</p>;
  return <CallBody call={data} />;
}

export function CallBody({ call }: { call: ApiCallDetail }) {
  const { request, response } = call;
  const tone = TONE[callStatusTone(response.status)];
  const query = Object.entries(request.query);
  const headers = Object.entries(request.headers);
  return (
    <div className="k-line-subtle mt-2 space-y-3 border-t pt-2.5 text-[12px]">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <span className="k-mono min-w-0 break-all text-[12px] text-[var(--fg)]">
          <span className="font-semibold">{request.method}</span> {request.path}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-[var(--fg-2)]">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: tone.color }} />
          {tone.word} <span className="k-mono tabular-nums">{response.status}</span>
        </span>
        <span className="k-mono k-fg3 shrink-0 tabular-nums">{call.durationMs} ms</span>
        {call.mcpTool && <span className="k-chip k-mono shrink-0">{call.mcpTool}</span>}
      </div>

      <section>
        <p className="k-label mb-1">Inputs</p>
        {query.length === 0 && !request.body ? (
          <p className="k-fg3">No inputs.</p>
        ) : (
          <>
            {query.length > 0 && <Pairs rows={query.map(([k, v]) => [k, queryValue(v)])} />}
            {request.body && (
              <Body body={request.body} bytes={request.bodyBytes} truncated={request.bodyTruncated} />
            )}
          </>
        )}
      </section>

      <section>
        <p className="k-label mb-1">
          Response
          {response.contentType ? <span className="ml-2 normal-case tracking-normal">{response.contentType.split(";")[0]}</span> : null}
        </p>
        {response.body ? (
          <Body body={response.body} bytes={response.bodyBytes} truncated={response.bodyTruncated} />
        ) : (
          <p className="k-fg3">Empty answer.</p>
        )}
      </section>

      {headers.length > 0 && (
        <section>
          <p className="k-label mb-1">Headers</p>
          <Pairs rows={headers} />
        </section>
      )}
    </div>
  );
}

function Pairs({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-[minmax(80px,max-content)_minmax(0,1fr)] gap-x-3 gap-y-0.5">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="k-mono k-fg3 truncate">{k}</dt>
          <dd className="k-mono min-w-0 break-all text-[var(--fg-2)]">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Body({ body, bytes, truncated }: { body: string; bytes: number; truncated: boolean }) {
  const [open, setOpen] = useState(false);
  const pretty = prettyBody(body);
  if (!pretty) return null;
  const lines = pretty.text.split("\n").length;
  const long = lines > BODY_FOLD_LINES;
  return (
    <div className="mt-1">
      <pre
        className={`k-panel k-scroll k-mono overflow-x-auto whitespace-pre rounded-lg px-2.5 py-2 text-[11.5px] leading-[17px] text-[var(--fg-2)] ${
          long && !open ? "max-h-[238px] overflow-y-hidden" : "max-h-[60vh] overflow-y-auto"
        }`}
      >
        {pretty.text}
      </pre>
      <div className="k-fg3 mt-1 flex items-center gap-2 tabular-nums">
        <span>
          {formatBytes(bytes)}
          {long ? ` · ${lines.toLocaleString("en-US")} lines` : ""}
          {truncated ? " · cut at 256 KB" : ""}
        </span>
        {long && (
          <button type="button" className="k-btn-ghost h-6 px-1.5 text-[12px]" onClick={() => setOpen((o) => !o)}>
            {open ? "Show less" : "Show all"}
          </button>
        )}
      </div>
    </div>
  );
}
