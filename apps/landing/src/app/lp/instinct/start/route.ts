import { renderedResponse } from "@/lib/static-html";
import { renderInstinctStartPage } from "@/lib/pages/instinct";

export const revalidate = 86400;

// Where the instinct-style landing's one call to action leads: WhatsApp or Telegram.
export async function GET(request: Request) {
  return renderedResponse(renderInstinctStartPage(), request);
}
