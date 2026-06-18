import { ImageResponse } from "next/og";
import { BRAND_LOGO_URL } from "@/lib/seo";

export const runtime = "edge";
export const alt = "distribute — Investor Information";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background:
            "linear-gradient(135deg, #050510 0%, #0e0a1f 50%, #1a1030 100%)",
          color: "white",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <img src={BRAND_LOGO_URL} width={36} height={36} alt="" />
          <div style={{ fontSize: 28, fontWeight: 700 }}>
            distribute · Investors
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              fontSize: 80,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -2,
              maxWidth: 1000,
            }}
          >
            Live platform metrics. Open SAFE round.
          </div>
          <div
            style={{
              fontSize: 30,
              color: "rgba(255,255,255,0.65)",
              lineHeight: 1.3,
              maxWidth: 1000,
            }}
          >
            Growth, revenue, infrastructure, and what we need from investors —
            all public, updated on every load.
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "rgba(255,255,255,0.5)",
            fontSize: 22,
          }}
        >
          <div>distribute.you/investors</div>
          <div>investors@distribute.you</div>
        </div>
      </div>
    ),
    size,
  );
}
