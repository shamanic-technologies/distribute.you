/**
 * A sales funnel name's face (features-service draws it from the NAME alone), for the signed-out
 * signup: `/api/v1/public/catalogue/faces/*` sits behind the signed-in proxy, so a visitor with no
 * session reads it here. Piped byte-for-byte with its content-type; a refusal keeps its status.
 */
const API_URL = process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";

export async function GET(_req: Request, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  if (!/^.{1,60}\.svg$/.test(file)) return new Response("the face path is /api/public/faces/<name>.svg", { status: 400 });
  try {
    const res = await fetch(`${API_URL}/v1/public/catalogue/faces/${encodeURIComponent(file)}`, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      console.error(`[public-faces] ${file}: ${res.status}`);
      return new Response(await res.text(), { status: res.status });
    }
    return new Response(await res.arrayBuffer(), {
      status: 200,
      headers: { "content-type": res.headers.get("content-type") ?? "image/svg+xml", "cache-control": "public, max-age=86400" },
    });
  } catch (err) {
    console.error(`[public-faces] ${file} read errored:`, err);
    return new Response("face unavailable", { status: 502 });
  }
}
