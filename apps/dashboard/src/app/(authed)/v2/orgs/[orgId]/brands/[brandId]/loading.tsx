import { Shimmer } from "@/components/v2/ui";

/**
 * Every v2 brand page is DYNAMIC (Clerk), so Next neither prefetches its payload nor
 * swaps to it until the whole server render returns. Without a boundary here a click
 * on a row sat on the old page for seconds, reading as a dead click. This paints the
 * v2 frame at once inside the shell, and the page's own reads fill it from the cache.
 */
export default function V2BrandLoading() {
  return (
    <>
      <div className="h-12 shrink-0 bg-[var(--bg-surface)]" />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6" aria-busy="true">
        <Shimmer className="h-8 w-72" />
        <Shimmer className="mt-2 h-4 w-96 max-w-full" />
        <div className="k-card mt-6 overflow-hidden">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="k-row flex h-10 items-center px-4">
              <Shimmer className="h-4 w-full" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
