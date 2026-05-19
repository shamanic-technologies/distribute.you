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

const CHART_HEIGHT_PX = 90;
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
  const max = Math.max(...numericValues, 0);
  const gridSteps = Array.from({ length: GRID_LINES + 1 }, (_, i) =>
    Math.round((max * (GRID_LINES - i)) / GRID_LINES)
  );
  return (
    <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-4 overflow-hidden">
      <p className="text-sm text-gray-400 mb-3 font-medium">{title}</p>
      <div className="flex">
        <div
          className="flex flex-col justify-between text-[10px] text-gray-500 pr-2 text-right"
          style={{ height: `${CHART_HEIGHT_PX}px`, width: `${Y_AXIS_WIDTH_PX}px` }}
        >
          {gridSteps.map((step, i) => (
            <span key={i}>{formatCents(step)}</span>
          ))}
        </div>
        <div className="flex-1 relative" style={{ height: `${CHART_HEIGHT_PX}px` }}>
          {gridSteps.map((_, i) => (
            <div
              key={i}
              className="absolute left-0 right-0 border-t border-gray-700/40"
              style={{ top: `${(i / GRID_LINES) * 100}%` }}
            />
          ))}
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

export function CGRLineChart({
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
  const rawMax = numericCgrs.length > 0 ? Math.max(...numericCgrs) : 0;
  const rawMin = numericCgrs.length > 0 ? Math.min(...numericCgrs, 0) : 0;
  const span = rawMax - rawMin || 1;
  const gridSteps = Array.from({ length: GRID_LINES + 1 }, (_, i) =>
    Math.round(rawMax - (span * i) / GRID_LINES)
  );
  const n = points.length;
  const yFor = (cgr: number) =>
    CHART_HEIGHT_PX - ((cgr - rawMin) / span) * CHART_HEIGHT_PX;
  const xFor = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * 100);
  const linePoints = points
    .map((p, i) => (p.cgr === null ? null : `${xFor(i)},${yFor(p.cgr)}`))
    .filter((s): s is string => s !== null);
  const polylinePts = linePoints.join(" ");
  return (
    <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-4 overflow-hidden">
      <p className="text-sm text-gray-400 mb-3 font-medium">{title}</p>
      <div className="flex">
        <div
          className="flex flex-col justify-between text-[10px] text-gray-500 pr-2 text-right"
          style={{ height: `${CHART_HEIGHT_PX}px`, width: `${Y_AXIS_WIDTH_PX}px` }}
        >
          {gridSteps.map((step, i) => (
            <span key={i}>{step >= 0 ? `+${step}%` : `${step}%`}</span>
          ))}
        </div>
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
          <svg
            className="absolute inset-0"
            width="100%"
            height={CHART_HEIGHT_PX}
            preserveAspectRatio="none"
            viewBox={`0 0 100 ${CHART_HEIGHT_PX}`}
          >
            <polyline
              points={polylinePts}
              fill="none"
              stroke="rgb(52, 211, 153)"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <div className="absolute inset-0">
            {points.map((p, i) => {
              if (p.cgr === null) return null;
              const left = xFor(i);
              const top = yFor(p.cgr);
              return (
                <div
                  key={p.label}
                  className="absolute -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-400 hover:bg-emerald-300 hover:w-3 hover:h-3 transition-all cursor-pointer"
                  style={{ left: `${left}%`, top: `${top}px` }}
                  title={`${p.label} — ${p.cgr >= 0 ? "+" : ""}${p.cgr}% compound from anchor`}
                />
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
