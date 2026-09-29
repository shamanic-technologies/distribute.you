import { AiBotReadsChart } from "@/components/ai-bot-reads-chart";
import {
  AI_CATEGORIES,
  AI_CATEGORY_MEANING,
  aiSeries,
  capturedDays,
  categoryTotal,
  windowChangePct,
  type BotTraffic,
} from "@/lib/bot-traffic";

export interface AiBotReads {
  last7: BotTraffic;
  prior7: BotTraffic;
  history: BotTraffic;
}

function formatCount(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

function formatDay(iso: string): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function ChangeLine({ pct, prior }: { pct: number | null; prior: number }) {
  if (pct === null) return <span className="text-gray-500">previous 7 days: {formatCount(prior)}</span>;
  const up = pct >= 0;
  return (
    <span className={up ? "text-green-700" : "text-gray-500"}>
      {up ? "+" : ""}
      {pct.toFixed(0)}% vs previous 7 days ({formatCount(prior)})
    </span>
  );
}

/**
 * How often AI bots read distribute.you, from Cloudflare's verified-bot data
 * (cloudflare-service). AI Assistant is the headline: an assistant fetching a
 * page live to answer a person's question. Server-rendered; the chart is the
 * only client piece and takes data alone.
 */
export function AiBotReadsCard({ data, error }: { data: AiBotReads | null; error: string | null }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-950">AI bot reads</h2>
      <p className="mt-1 text-sm text-gray-500">
        Pages on distribute.you fetched by AI bots that Cloudflare verifies. Counted in requests, not people, and kept apart from the visitor numbers above.
      </p>
      {error || !data ? (
        <p className="mt-4 text-sm text-red-700">Could not read AI bot traffic: {error ?? "no data"}</p>
      ) : (
        <AiBotReadsBody data={data} />
      )}
    </section>
  );
}

function AiBotReadsBody({ data }: { data: AiBotReads }) {
  const { last7, prior7, history } = data;
  const partial = capturedDays(last7) < last7.days.length;
  const series = aiSeries(history);
  return (
    <>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {AI_CATEGORIES.map((category) => {
          const headline = category === "AI Assistant";
          return (
            <div key={category} className={`rounded-lg border p-4 ${headline ? "border-purple-200 bg-purple-50" : "border-gray-200"}`}>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{category}, last 7 days</p>
              <p className={`mt-2 font-semibold text-gray-950 ${headline ? "text-3xl" : "text-2xl"}`}>{formatCount(categoryTotal(last7, category))}</p>
              <p className="mt-1 text-sm">
                <ChangeLine pct={windowChangePct(last7, prior7, category)} prior={categoryTotal(prior7, category)} />
              </p>
              <p className="mt-3 text-sm leading-5 text-gray-600">{AI_CATEGORY_MEANING[category]}</p>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-gray-400">
        {formatDay(last7.from)} to {formatDay(last7.to)} (UTC), today excluded because it is not final.
        {partial ? ` Only ${capturedDays(last7)} of those 7 days are captured so far, so no change is stated.` : ""}
      </p>

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-gray-900">Daily AI bot reads</h3>
        {series.length ? (
          <div className="mt-3">
            <AiBotReadsChart data={series} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-gray-500">No day captured yet in the last 90 days.</p>
        )}
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-gray-900">Top bots, last 7 days</h3>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          {AI_CATEGORIES.map((category) => {
            const bots = last7.totals.find((t) => t.category === category)?.topBots ?? [];
            return (
              <div key={category}>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{category}</p>
                {bots.length ? (
                  <ul className="mt-2 divide-y divide-gray-100">
                    {bots.map((bot) => (
                      <li key={bot.botName} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                        <span className="truncate text-gray-800">{bot.botName}</span>
                        <span className="shrink-0 font-medium text-gray-950">{formatCount(bot.requests)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-gray-500">None in this window.</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
