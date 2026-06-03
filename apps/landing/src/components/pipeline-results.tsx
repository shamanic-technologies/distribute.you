import { ProviderAvatar } from "./provider-avatar";
import {
  CLIENT_RESULTS,
  PIPELINE_SERIES,
  SAMPLE_DATA,
  totalSpendUsd,
  totalPipelineUsd,
  salesPipelineUsd,
  journalistsPipelineUsd,
  blendedRoi,
  type ResultChannel,
} from "@/data/results";

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const usdK = (n: number) => (n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`);

const CHANNEL: Record<ResultChannel, { label: string; stroke: string; fill: string; badge: string; bar: string }> = {
  sales: {
    label: "Sales",
    stroke: "#34d399", // emerald-400
    fill: "rgba(16,185,129,0.28)",
    badge: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    bar: "bg-emerald-400",
  },
  journalists: {
    label: "Journalists",
    stroke: "#38bdf8", // sky-400
    fill: "rgba(14,165,233,0.26)",
    badge: "text-sky-400 bg-sky-500/10 border-sky-500/20",
    bar: "bg-sky-400",
  },
};

// ── Stacked-area chart (hand-rolled SSR SVG — indexable, no client JS) ──────
function StackedArea() {
  const W = 720;
  const H = 240;
  const padL = 44;
  const padR = 10;
  const padT = 16;
  const padB = 28;
  const n = PIPELINE_SERIES.length;

  const maxStacked = Math.max(...PIPELINE_SERIES.map((p) => p.salesUsd + p.journalistsUsd));
  const maxY = Math.ceil(maxStacked / 10000) * 10000; // headroom to nice $10k step

  const xFor = (i: number) => padL + (i * (W - padL - padR)) / (n - 1);
  const yFor = (v: number) => H - padB - (v / maxY) * (H - padT - padB);

  const salesTop = PIPELINE_SERIES.map((p, i) => `${xFor(i)},${yFor(p.salesUsd)}`);
  const stackTop = PIPELINE_SERIES.map((p, i) => `${xFor(i)},${yFor(p.salesUsd + p.journalistsUsd)}`);
  const baseline = PIPELINE_SERIES.map((_, i) => `${xFor(n - 1 - i)},${yFor(0)}`);
  const salesBottomRev = PIPELINE_SERIES.map((p, i) => `${xFor(n - 1 - i)},${yFor(PIPELINE_SERIES[n - 1 - i].salesUsd)}`);

  const salesArea = [...salesTop, ...baseline].join(" ");
  const journalistsArea = [...stackTop, ...salesBottomRev].join(" ");

  const gridlines = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ y: yFor(maxY * f), label: usdK(maxY * f) }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Cumulative pipeline dollars generated over 8 weeks, split by channel">
      {gridlines.map((g) => (
        <g key={g.label}>
          <line x1={padL} y1={g.y} x2={W - padR} y2={g.y} stroke="#1f2937" strokeWidth={1} />
          <text x={padL - 8} y={g.y + 3} textAnchor="end" fontSize={10} fill="#6b7280">
            {g.label}
          </text>
        </g>
      ))}
      <polygon points={salesArea} fill={CHANNEL.sales.fill} />
      <polygon points={journalistsArea} fill={CHANNEL.journalists.fill} />
      <polyline points={salesTop.join(" ")} fill="none" stroke={CHANNEL.sales.stroke} strokeWidth={2} />
      <polyline points={stackTop.join(" ")} fill="none" stroke={CHANNEL.journalists.stroke} strokeWidth={2} />
      {PIPELINE_SERIES.map((p, i) => (
        <text key={p.period} x={xFor(i)} y={H - 8} textAnchor="middle" fontSize={10} fill="#6b7280">
          {p.period}
        </text>
      ))}
    </svg>
  );
}

export function PipelineResults() {
  const rows = [...CLIENT_RESULTS].sort((a, b) => b.pipelineUsd - a.pipelineUsd);
  const split: { channel: ResultChannel; value: number }[] = [
    { channel: "sales", value: salesPipelineUsd },
    { channel: "journalists", value: journalistsPipelineUsd },
  ];

  return (
    <div className="relative mx-auto max-w-5xl">
      <div className="rounded-xl border border-gray-700/50 bg-gray-950 shadow-2xl overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800 bg-gray-900/80">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="bg-gray-800 rounded-md px-4 py-1 text-xs text-gray-400 font-mono">
              app.distribute.you/pipeline
            </div>
          </div>
        </div>

        {/* Headline number */}
        <div className="px-6 py-6 border-b border-gray-800/60">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Pipeline generated · on autopilot</p>
              <p className="font-display text-4xl md:text-5xl font-bold text-white tabular-nums">{usd(totalPipelineUsd)}</p>
              <p className="text-gray-500 text-xs mt-1.5">
                across {CLIENT_RESULTS.length} products · {usd(totalSpendUsd)} spent ·{" "}
                <span className="text-emerald-400 font-medium">{blendedRoi.toFixed(0)}× blended ROI</span>
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              {(["sales", "journalists"] as ResultChannel[]).map((ch) => (
                <div key={ch} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: CHANNEL[ch].stroke }} />
                  <span className="text-gray-400">{CHANNEL[ch].label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="px-4 py-5 border-b border-gray-800/60">
          <StackedArea />
        </div>

        {/* Channel split bars */}
        <div className="px-6 py-5 border-b border-gray-800/60 space-y-3">
          {split.map((s) => {
            const pct = Math.round((s.value / totalPipelineUsd) * 100);
            return (
              <div key={s.channel} className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-20 shrink-0">{CHANNEL[s.channel].label}</span>
                <div className="flex-1 h-2.5 rounded-full bg-gray-800 overflow-hidden">
                  <div className={`h-full rounded-full ${CHANNEL[s.channel].bar}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-gray-300 tabular-nums w-28 text-right shrink-0">
                  {usd(s.value)} · {pct}%
                </span>
              </div>
            );
          })}
        </div>

        {/* Per-client rows */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-900/40">
              <tr className="text-[10px] uppercase tracking-wider text-gray-500">
                <th className="text-left font-medium px-6 py-3">Product</th>
                <th className="text-left font-medium px-3 py-3 hidden sm:table-cell">Channel</th>
                <th className="text-right font-medium px-3 py-3">Spent</th>
                <th className="text-right font-medium px-3 py-3">Pipeline generated</th>
                <th className="text-right font-medium px-6 py-3">ROI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {rows.map((c) => {
                const roi = c.pipelineUsd / c.spendUsd;
                return (
                  <tr key={c.name} className="hover:bg-gray-900/30 transition">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2.5">
                        <ProviderAvatar provider={c.name} providerDomain={c.domain} size={20} />
                        <span className="font-mono text-white">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 hidden sm:table-cell">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-wider font-medium ${CHANNEL[c.channel].badge}`}>
                        <span className="w-1 h-1 rounded-full" style={{ background: CHANNEL[c.channel].stroke }} />
                        {CHANNEL[c.channel].label}
                      </span>
                    </td>
                    <td className="text-right px-3 py-3 text-gray-400 tabular-nums">{usd(c.spendUsd)}</td>
                    <td className="text-right px-3 py-3 text-white font-medium tabular-nums">{usd(c.pipelineUsd)}</td>
                    <td className="text-right px-6 py-3 text-emerald-400 font-medium tabular-nums">{roi.toFixed(0)}×</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-800/60 bg-gray-900/30 text-[10px] text-gray-500 flex items-center justify-between">
          <span>
            Pipeline $ = events we measure × your conversion rate × your LTV.
            {SAMPLE_DATA && <span className="text-amber-400/80"> · sample data</span>}
          </span>
          <span className="text-gray-600">Last 8 weeks</span>
        </div>
      </div>

      {/* Glow */}
      <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-violet-500/10 rounded-2xl blur-3xl -z-10" />
    </div>
  );
}
