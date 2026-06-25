import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "distribute - Sales cold email outreach done for you.";
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
            "linear-gradient(135deg, #0b0b13 0%, #1a1730 50%, #2a1547 100%)",
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
              background: "#22d3ee",
              boxShadow: "0 0 24px #22d3ee",
            }}
          />
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>
            distribute
          </div>
          <div
            style={{
              fontSize: 14,
              padding: "3px 10px",
              borderRadius: 999,
              background: "rgba(34, 211, 238, 0.15)",
              color: "#67e8f9",
              border: "1px solid rgba(34, 211, 238, 0.4)",
            }}
          >
            BETA
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              fontSize: 84,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -2,
              maxWidth: 1000,
            }}
          >
            Sales cold email outreach done for you.
          </div>
          <div
            style={{
              fontSize: 30,
              color: "rgba(255,255,255,0.65)",
              lineHeight: 1.3,
              maxWidth: 1000,
            }}
          >
            Drop a URL. We find prospects, send sequences, qualify replies, and forward buyers to Gmail.
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
          <div>distribute.you</div>
          <div>Sales automation</div>
        </div>
      </div>
    ),
    size,
  );
}
