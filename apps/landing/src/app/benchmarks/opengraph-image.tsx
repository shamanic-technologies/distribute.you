import { ImageResponse } from "next/og";
import { BRAND_LOGO_URL } from "@/lib/seo";

export const runtime = "edge";
export const alt = "distribute Benchmarks - real campaign performance data";
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
          padding: "78px",
          background:
            "radial-gradient(circle at 20% 18%, rgba(78, 240, 200, 0.22), transparent 34%), linear-gradient(135deg, #050607 0%, #101515 48%, #1d2a25 100%)",
          color: "#f4fff9",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <img src={BRAND_LOGO_URL} width={36} height={36} alt="" />
          <div style={{ fontSize: 29, fontWeight: 760 }}>distribute Benchmarks</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 80,
              fontWeight: 820,
              lineHeight: 1.04,
              maxWidth: 1010,
            }}
          >
            Real cold email performance, public by default.
          </div>
          <div
            style={{
              fontSize: 30,
              color: "rgba(244,255,249,0.68)",
              lineHeight: 1.32,
              maxWidth: 980,
            }}
          >
            Reply rates, cost per positive reply, brand leaderboards, and workflow
            benchmarks from live campaigns.
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "rgba(244,255,249,0.55)",
            fontSize: 22,
          }}
        >
          <div>distribute.you/benchmarks</div>
          <div>Updated from production data</div>
        </div>
      </div>
    ),
    size,
  );
}
