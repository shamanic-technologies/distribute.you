"use client";

import { useRef, useState } from "react";
import { CHART_DATA } from "@/lib/mock-data";

const W = 700;
const H = 140;
const pad = { t: 10, r: 10, b: 28, l: 10 };

/** SVG grouped-bar chart (sent / opened / replied) with a hover tooltip. Ported from the maquette. */
export function EmailChart() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ index: number; left: number } | null>(null);

  const cw = W - pad.l - pad.r;
  const ch = H - pad.t - pad.b;
  const n = CHART_DATA.length;
  const maxVal = Math.max(...CHART_DATA.map((d) => d.sent));

  const groupW = cw / n;
  const barW = groupW * 0.24;
  const innerGap = 1;
  const outerPad = (groupW - 3 * barW - 2 * innerGap) / 2;

  function onEnter(i: number) {
    const svg = svgRef.current;
    if (!svg) return;
    const gx = pad.l + i * groupW;
    const cx = (gx + groupW / 2) / W;
    const tooltipW = 150; // approximate; clamped below
    const pxLeft = cx * svg.clientWidth;
    let left = pxLeft - tooltipW / 2;
    left = Math.max(4, Math.min(left, svg.clientWidth - tooltipW - 4));
    setHover({ index: i, left });
  }

  const hovered = hover ? CHART_DATA[hover.index] : null;

  return (
    <div className="chart-svg-wrap">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block" }}>
        {CHART_DATA.map((d, i) => {
          const gx = pad.l + i * groupW;
          const x1 = gx + outerPad;
          const x2 = x1 + barW + innerGap;
          const x3 = x2 + barW + innerGap;
          const cx = gx + groupW / 2;
          const hS = (d.sent / maxVal) * ch;
          const hO = (d.opened / maxVal) * ch;
          const hR = d.replied > 0 ? Math.max((d.replied / maxVal) * ch, 5) : 0;
          return (
            <g key={d.label}>
              <rect x={x1.toFixed(1)} y={(pad.t + ch - hS).toFixed(1)} width={barW.toFixed(1)} height={hS.toFixed(1)} fill="var(--accent)" />
              <rect x={x2.toFixed(1)} y={(pad.t + ch - hO).toFixed(1)} width={barW.toFixed(1)} height={hO.toFixed(1)} fill="var(--amber)" />
              {d.replied > 0 && (
                <rect x={x3.toFixed(1)} y={(pad.t + ch - hR).toFixed(1)} width={barW.toFixed(1)} height={hR.toFixed(1)} fill="var(--green)" />
              )}
              <text x={cx.toFixed(1)} y={(H - 6).toFixed(1)} textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="var(--muted)">
                {d.label.replace("Jun ", "")}
              </text>
              <rect
                x={gx.toFixed(1)} y={pad.t.toFixed(1)} width={groupW.toFixed(1)} height={ch.toFixed(1)}
                fill="transparent"
                onMouseEnter={() => onEnter(i)}
                onMouseLeave={() => setHover(null)}
              />
            </g>
          );
        })}
        <text x={pad.l.toFixed(1)} y={(H - 6).toFixed(1)} fontFamily="JetBrains Mono, monospace" fontSize="9" fill="var(--muted)">Jun</text>
      </svg>

      {hovered && hover && (
        <div className="chart-tooltip" style={{ display: "block", left: hover.left }}>
          <div className="chart-tooltip-label">{hovered.label}</div>
          <div className="chart-tooltip-row"><span className="chart-tooltip-dot" style={{ background: "var(--accent)" }} /><span className="chart-tooltip-name">Sent</span><span className="chart-tooltip-val">{hovered.sent}</span></div>
          <div className="chart-tooltip-row"><span className="chart-tooltip-dot" style={{ background: "var(--amber)" }} /><span className="chart-tooltip-name">Opened</span><span className="chart-tooltip-val">{hovered.opened}</span></div>
          <div className="chart-tooltip-row"><span className="chart-tooltip-dot" style={{ background: "var(--green)" }} /><span className="chart-tooltip-name">Replied</span><span className="chart-tooltip-val">{hovered.replied}</span></div>
        </div>
      )}
    </div>
  );
}
