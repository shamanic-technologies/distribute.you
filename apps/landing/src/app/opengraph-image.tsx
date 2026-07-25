import { ImageResponse } from "next/og";
import { SITE_URL } from "@/lib/seo";

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
            "linear-gradient(135deg, #06060f 0%, #0a0f1e 55%, #0b1226 100%)",
          color: "white",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <img
            src={`${SITE_URL}/brand/icon.png`}
            width={52}
            height={52}
            style={{ borderRadius: 13 }}
            alt=""
          />
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.5 }}>
            distribute
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
