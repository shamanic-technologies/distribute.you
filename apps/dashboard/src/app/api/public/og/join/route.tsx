import { ImageResponse } from "next/og";
import { parseInviteBrand } from "@/lib/org-invite";

/**
 * The preview image of a team invite link: `distribute.you × <brand logo>` over
 * "Join the <Brand> team". Public (the unfurler is not signed in) and carries nothing
 * the link does not already carry. A brand logo that fails to load is dropped by the
 * renderer rather than failing the image.
 */
export const runtime = "nodejs";

const SITE = "https://dashboard.distribute.you";

export async function GET(req: Request) {
  const brand = parseInviteBrand(new URL(req.url).searchParams);
  const mono = Boolean(brand?.mono);
  const title = brand ? `Join the ${brand.name} team` : "Join your team";
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: mono ? "#f9fafb" : "#eff4ff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <img src={`${SITE}/logo-distribute.svg`} width={96} height={96} alt="" />
          {brand && <div style={{ fontSize: 56, color: "#9ca3af" }}>×</div>}
          {brand?.logoUrl && <img src={brand.logoUrl} width={96} height={96} alt="" style={{ borderRadius: 16 }} />}
        </div>
        <div style={{ marginTop: 48, fontSize: 64, fontWeight: 700, color: "#111827" }}>{title}</div>
        <div style={{ marginTop: 16, fontSize: 32, color: "#6b7280" }}>on distribute.you</div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
