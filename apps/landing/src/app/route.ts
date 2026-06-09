import { readFileSync } from "node:fs";
import { join } from "node:path";

export const revalidate = 300;

function landingHtml() {
  const html = readFileSync(
    join(process.cwd(), "public/landing-v2/index.html"),
    "utf8",
  );

  return html.replaceAll('href="css/', 'href="/landing-v2/css/')
    .replaceAll('src="js/', 'src="/landing-v2/js/')
    .replaceAll('src="logo/', 'src="/landing-v2/logo/');
}

export function GET() {
  return new Response(landingHtml(), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "s-maxage=300, stale-while-revalidate=31536000",
    },
  });
}
