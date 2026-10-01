import { readFile } from "fs/promises";
import path from "path";
import { ImageResponse } from "next/og";

// Static export writes this out as a plain `og-image.png` file, so the static
// host serves it as `image/png` with no server behind it. Every page points its
// og:image here (see `DOCS_OG_IMAGE` in src/lib/docs-metadata.ts). Same card as
// the landing's, so a docs link and a homepage link look like one brand.
export const dynamic = "force-static";

export async function GET() {
  const mark = await readFile(path.join(process.cwd(), "public/brand/logo-mark.png"));
  const markSrc = `data:image/png;base64,${mark.toString("base64")}`;

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
          <img src={markSrc} width={52} height={52} style={{ borderRadius: 13 }} alt="" />
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.5 }}>
            distribute.you
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
            Developer docs
          </div>
          <div
            style={{
              fontSize: 34,
              color: "rgba(255,255,255,0.65)",
              lineHeight: 1.3,
              maxWidth: 1000,
            }}
          >
            REST API, MCP server and command line client. Connect Claude, Cursor or your own code to your campaigns.
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
          <div>docs.distribute.you</div>
          <div>Cold email agency</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
