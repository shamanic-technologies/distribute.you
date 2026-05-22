import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "distribute Pricing — Transparent Variable Costs";
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
            "linear-gradient(135deg, #0b0b13 0%, #16213a 50%, #0b3b2e 100%)",
          color: "white",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              background: "#34d399",
              boxShadow: "0 0 24px #34d399",
            }}
          />
          <div style={{ fontSize: 28, fontWeight: 700 }}>distribute · Pricing</div>
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
            Every unit cost. Live from production.
          </div>
          <div
            style={{
              fontSize: 30,
              color: "rgba(255,255,255,0.65)",
              lineHeight: 1.3,
              maxWidth: 1000,
            }}
          >
            50+ priced API operations. No subscription. Pay only what your
            campaigns consume.
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
          <div>distribute.you/pricing</div>
          <div>Variable. Transparent.</div>
        </div>
      </div>
    ),
    size,
  );
}
