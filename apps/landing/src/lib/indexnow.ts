// IndexNow — instant crawl notification for Bing + Yandex when content changes.
//
// The key below is a PUBLIC ownership token, not a secret: it is hosted at
// https://distribute.you/<key>.txt (apps/landing/public/<key>.txt) so IndexNow
// can verify we control the domain before accepting our change notifications.
// It is intentionally committed and must stay byte-equal with the .txt file's
// name AND content. Docs: https://www.indexnow.org/documentation
export const INDEXNOW_KEY = "891bb54c81873481a12d9f32f145bf64";

const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

/**
 * Notify IndexNow (Bing, Yandex) that the given URLs changed so those engines
 * recrawl within minutes instead of waiting for the next scheduled crawl.
 *
 * Best-effort by design: a failed ping never blocks the publish — the article
 * is already saved and in the sitemap, so crawlers rediscover it regardless.
 * Failures are logged loud (console.error), never silently swallowed. This is
 * the same fire-and-forget class as the analytics/reassurance side-effects; it
 * is deliberately not fail-loud-throwing because IndexNow being down must not
 * make Outrank retry the whole (already-succeeded) upsert.
 */
export async function pingIndexNow(urls: string[]): Promise<void> {
  if (urls.length === 0) return;
  const host = new URL(urls[0]).host;
  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key: INDEXNOW_KEY,
        keyLocation: `https://${host}/${INDEXNOW_KEY}.txt`,
        urlList: urls,
      }),
    });
    if (!res.ok) {
      console.error(
        `[landing/indexnow] ping failed status=${res.status} urls=${urls.length} host=${host}`,
      );
      return;
    }
    console.log(`[landing/indexnow] pinged urls=${urls.length} host=${host}`);
  } catch (err) {
    console.error("[landing/indexnow] ping error", err);
  }
}
