import { readFileSync } from "node:fs";
import { join } from "node:path";
import { URLS } from "@distribute/content";

export function staticV2Html(fileName: string) {
  const html = readFileSync(
    join(process.cwd(), "public/landing-v2", fileName),
    "utf8",
  );

  return html
    .replaceAll('href="css/', 'href="/landing-v2/css/')
    .replaceAll('src="js/', 'src="/landing-v2/js/')
    .replaceAll('src="logo/logo-distribute-2.svg"', 'src="logo/logo-distribute.svg"')
    .replaceAll('src="logo/', 'src="/landing-v2/logo/')
    .replaceAll('href="index.html"', 'href="/"')
    .replaceAll('href="v2.html"', 'href="/"')
    .replaceAll('href="/docs/api"', `href="${URLS.apiDocs}"`)
    .replaceAll('href="/docs/mcp"', `href="${URLS.mcp}"`)
    .replaceAll('href="/docs"', `href="${URLS.docs}"`)
    .replaceAll('href="/sign-in"', `href="${URLS.signIn}"`)
    .replaceAll('href="/sign-up"', `href="${URLS.signUp}"`)
    .replaceAll('href="https://app.distribute.you/sign-up"', `href="${URLS.signUp}"`)
    .replaceAll(
      'href="https://github.com/distribute-you"',
      `href="${URLS.github}"`,
    );
}

export function staticV2Response(fileName: string) {
  return new Response(staticV2Html(fileName), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "s-maxage=300, stale-while-revalidate=31536000",
    },
  });
}
