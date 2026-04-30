import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL;
const API_KEY = process.env.ADMIN_DISTRIBUTE_API_KEY;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;

  if (!API_URL || !API_KEY) {
    return NextResponse.json(
      { error: "[admin] API not configured" },
      { status: 500 }
    );
  }

  const url = new URL(
    `/v1/runs/${encodeURIComponent(runId)}/events/stream`,
    API_URL
  );

  const res = await fetch(url.toString(), {
    headers: { "x-api-key": API_KEY },
  });

  if (!res.ok || !res.body) {
    const text = await res.text();
    return new NextResponse(text, { status: res.status });
  }

  return new NextResponse(res.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
