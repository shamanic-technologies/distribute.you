import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { registryFetch } from "@/lib/api-registry";

export const maxDuration = 30;

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await registryFetch("/llm-context");
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=300, s-maxage=600" },
    });
  } catch (err) {
    console.error("[platform/llm-context] failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch LLM context" },
      { status: 502 }
    );
  }
}
