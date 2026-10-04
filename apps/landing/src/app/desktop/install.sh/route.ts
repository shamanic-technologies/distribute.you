import { renderDesktopInstallScript } from "@/lib/pages/desktop";

export const revalidate = 86400;

// `curl -fsSL https://distribute.you/desktop/install.sh | sh`
export async function GET() {
  return new Response(renderDesktopInstallScript(), {
    headers: { "content-type": "text/x-shellscript; charset=utf-8", "x-robots-tag": "noindex" },
  });
}
