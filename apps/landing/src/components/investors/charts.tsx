import { formatCents, computeCGRSeries } from "@/lib/investors/format";

function shortenLabel(label: string): string {
  const parts = label.split("-");
  if (parts.length === 3) return `${parts[1]}-${parts[2]}`;
  if (parts.length === 2) {
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const idx = parseInt(parts[1], 10) - 1;
    return monthNames[idx] ?? parts[1];
  }
  return label;
}

function niceMax(rawMax: number): number {
  if (rawMax <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)));
  const normalized = rawMax / magnitude;
  let niceNormalized: number;
  if (normalized <= 1) niceNormalized = 1;
  else if (normalized <= 2) niceNormalized = 2;
  else if (normalized <= 5) niceNormalized = 5;
  else niceNormalized = 10;
  return niceNormalized * magnitude;
}

const CHART_HEIGHT_PX = 180;
const Y_AXIS_WIDTH_PX = 56;
const GRID_LINES = 4;

export function BarChart({
  data,
  rotateLabels,
  title,
}: {
  data: { label: string; value: string }[];
  rotateLabels?: boolean;
  title: string;
}) {
  const numericValues = data.map((d) => parseFloat(d.value));
  const rawMax = Math.max(...numericValues, 0);
  const max = niceMax(rawMax);
  const gridSteps = Array.from({ length: GRID_LINES + 1 }, (_, i) =>
    Math.round((max * (GRID_LINES - i)) / GRID_LINES)
  );
  return (
    <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-6 overflow-hidden">
      <p className="text-sm text-gray-400 mb-4 font-medium">{title}</p>
      <div className="flex">
        {/* Y-axis */}
        <div
          className="flex flex-col justify-between text-[10px] text-gray-500 pr-2 text-right"
          style={{ height: `${CHART_HEIGHT_PX}px`, width: `${Y_AXIS_WIDTH_PX}px` }}
        >
          {gridSteps.map((step, i) => (
            <span key={i}>{formatCents(step)}</span>
          ))}
        </div>
        {/* Bars + gridlines */}
        <div className="flex-1 relative" style={{ height: `${CHART_HEIGHT_PX}px` }}>
          {/* Horizontal gridlines */}
          {gridSteps.map((_, i) => (
            <div
              key={i}
              className="absolute left-0 right-0 border-t border-gray-700/40"
              style={{ top: `${(i / GRID_LINES) * 100}%` }}
            />
          ))}
          {/* Bars */}
          <div className="absolute inset-0 flex items-end gap-1 px-1">
            {data.map((d, i) => {
              const pct = max > 0 ? (numericValues[i] / max) * 100 : 0;
              return (
                <div
                  key={d.label}
                  className="flex-1 min-w-0 h-full flex items-end"
                  title={`${d.label} — ${formatCents(d.value)}`}
                >
                  <div
                    className="w-full bg-emerald-500/80 hover:bg-emerald-400 rounded-t transition-colors"
                    style={{ height: `${Math.max(pct, 0.5)}%` }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {/* X-axis labels */}
      <div className="flex pt-2" style={{ paddingLeft: `${Y_AXIS_WIDTH_PX}px` }}>
        <div className="flex-1 flex gap-1 px-1">
          {data.map((d) => (
            <div key={d.label} className="flex-1 min-w-0 flex justify-center">
              {rotateLabels ? (
                <span
                  className="text-[10px] text-gray-500 whitespace-nowrap origin-top-left"
                  style={{ writingMode: "vertical-rl", height: "50px" }}
                >
                  {shortenLabel(d.label)}
                </span>
              ) : (
                <span className="text-[10px] text-gray-500 truncate w-full text-center">
                  {shortenLabel(d.label)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CGREvolutionChart({
  data,
  rotateLabels,
  title,
}: {
  data: { label: string; value: string }[];
  rotateLabels?: boolean;
  title: string;
}) {
  const ascNumeric = data.map((d) => parseFloat(d.value));
  const cgrSeries = computeCGRSeries(ascNumeric);
  const points = data.map((d, i) => ({
    label: d.label,
    cgr: cgrSeries[i] === null ? null : Number(cgrSeries[i]),
  }));
  const numericCgrs = points
    .map((p) => p.cgr)
    .filter((v): v is number => v !== null);
  const absMax = niceMax(Math.max(...numericCgrs.map(Math.abs), 0));
  const gridSteps = Array.from({ length: GRID_LINES + 1 }, (_, i) =>
    Math.round((absMax * (GRID_LINES - i * 2)) / GRID_LINES)
  );
  return (
    <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-6 overflow-hidden">
      <p className="text-sm text-gray-400 mb-4 font-medium">{title}</p>
      <p className="text-[10px] text-gray-500 mb-2">
        Compound growth rate from anchor period
      </p>
      <div className="flex">
        {/* Y-axis */}
        <div
          className="flex flex-col justify-between text-[10px] text-gray-500 pr-2 text-right"
          style={{ height: `${CHART_HEIGHT_PX}px`, width: `${Y_AXIS_WIDTH_PX}px` }}
        >
          {gridSteps.map((step, i) => (
            <span key={i}>{step >= 0 ? `+${step}%` : `${step}%`}</span>
          ))}
        </div>
        {/* Bars + gridlines */}
        <div className="flex-1 relative" style={{ height: `${CHART_HEIGHT_PX}px` }}>
          {gridSteps.map((step, i) => (
            <div
              key={i}
              className={`absolute left-0 right-0 ${
                step === 0
                  ? "border-t border-gray-500/70"
                  : "border-t border-gray-700/40"
              }`}
              style={{ top: `${(i / GRID_LINES) * 100}%` }}
            />
          ))}
          <div className="absolute inset-0 flex items-stretch gap-1 px-1">
            {points.map((p) => {
              const pct = p.cgr === null ? 0 : (p.cgr / absMax) * 50;
              const isPositive = (p.cgr ?? 0) >= 0;
              const tooltip =
                p.cgr === null
                  ? `${p.label} — n/a (anchor or value <= 0)`
                  : `${p.label} — ${p.cgr >= 0 ? "+" : ""}${p.cgr}% compound from anchor`;
              return (
                <div
                  key={p.label}
                  className="flex-1 min-w-0 h-full relative"
                  title={tooltip}
                >
                  {p.cgr !== null && (
                    <div
                      className={`absolute left-0 right-0 rounded ${
                        isPositive
                          ? "bg-emerald-500/80 hover:bg-emerald-400"
                          : "bg-red-500/80 hover:bg-red-400"
                      } transition-colors`}
                      style={
                        isPositive
                          ? { bottom: "50%", height: `${Math.max(Math.abs(pct), 0.5)}%` }
                          : { top: "50%", height: `${Math.max(Math.abs(pct), 0.5)}%` }
                      }
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex pt-2" style={{ paddingLeft: `${Y_AXIS_WIDTH_PX}px` }}>
        <div className="flex-1 flex gap-1 px-1">
          {points.map((p) => (
            <div key={p.label} className="flex-1 min-w-0 flex justify-center">
              {rotateLabels ? (
                <span
                  className="text-[10px] text-gray-500 whitespace-nowrap origin-top-left"
                  style={{ writingMode: "vertical-rl", height: "50px" }}
                >
                  {shortenLabel(p.label)}
                </span>
              ) : (
                <span className="text-[10px] text-gray-500 truncate w-full text-center">
                  {shortenLabel(p.label)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
