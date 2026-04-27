"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  listBrandArticles,
  listBrandOutlets,
  listBrandJournalists,
  type ArticleDiscoveryItem,
} from "@/lib/api";
import { EntitySearchBar } from "@/components/entity-search-bar";

const POLL_INTERVAL = 5_000;

function getArticleTitle(item: ArticleDiscoveryItem): string {
  return item.article.ogTitle || item.article.twitterTitle || item.article.snippet?.slice(0, 80) || "Untitled";
}

function getArticleAuthor(item: ArticleDiscoveryItem): string | null {
  return item.article.articleAuthor || item.article.author || item.article.twitterCreator || null;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Unknown date";
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default function FeatureArticlesPage() {
  const params = useParams();
  const brandId = params.brandId as string;
  const featureSlug = params.featureSlug as string;
  const [selected, setSelected] = useState<ArticleDiscoveryItem | null>(null);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useAuthQuery(
    ["brandArticles", brandId, featureSlug],
    () => listBrandArticles(brandId, featureSlug),
    { refetchInterval: POLL_INTERVAL, refetchIntervalInBackground: false },
  );

  const { data: outletsData } = useAuthQuery(
    ["brandOutlets", brandId, featureSlug],
    () => listBrandOutlets(brandId, featureSlug),
  );

  const { data: journalistsData } = useAuthQuery(
    ["brandJournalists", brandId],
    () => listBrandJournalists(brandId),
  );

  const outletMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of outletsData?.outlets ?? []) {
      map.set(o.id, o.outletName);
    }
    return map;
  }, [outletsData]);

  const journalistMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const j of journalistsData?.campaignJournalists ?? []) {
      map.set(j.id, j.journalistName);
    }
    return map;
  }, [journalistsData]);

  const articles = data?.discoveries ?? [];

  const sorted = useMemo(() =>
    [...articles].sort((a, b) => {
      const dateA = a.article.articlePublished || a.discovery.createdAt;
      const dateB = b.article.articlePublished || b.discovery.createdAt;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    }),
    [articles],
  );

  const filteredArticles = useMemo(() => {
    if (!search) return sorted;
    const q = search.toLowerCase();
    return sorted.filter((item) => {
      const title = (item.article.ogTitle || item.article.twitterTitle || item.article.snippet || "").toLowerCase();
      const outletName = item.discovery.outletId ? (outletMap.get(item.discovery.outletId) ?? "") : "";
      const journalistName = item.discovery.journalistId
        ? (journalistMap.get(item.discovery.journalistId) ?? "")
        : (item.article.articleAuthor || item.article.author || "");
      return title.includes(q) || outletName.toLowerCase().includes(q) || journalistName.toLowerCase().includes(q);
    });
  }, [sorted, search, outletMap, journalistMap]);

  if (isLoading && !data) {
    return (
      <div className="p-4 md:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-32 bg-gray-200 rounded" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-full relative">
      {/* Article List */}
      <div className={`${selected ? "hidden md:block md:w-1/2" : "w-full"} p-4 md:p-8 overflow-y-auto transition-all`}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-xl font-bold text-gray-800">
            Articles
            <span className="ml-2 text-sm font-normal text-gray-500">({articles.length.toLocaleString("en-US")} across all campaigns)</span>
          </h1>
        </div>

        <EntitySearchBar value={search} onChange={setSearch} placeholder="Search by title, outlet, or journalist..." resultCount={filteredArticles.length} totalCount={sorted.length} />

        {filteredArticles.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <h3 className="font-display font-bold text-lg text-gray-800 mb-2">{articles.length === 0 ? "No articles yet" : "No matching articles"}</h3>
            <p className="text-gray-600 text-sm">{articles.length === 0 ? "Articles will appear here once discovered from outlets and journalists." : "Try a different search term."}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredArticles.map((item) => {
              const outletName = item.discovery.outletId
                ? outletMap.get(item.discovery.outletId)
                : null;
              const journalistName = item.discovery.journalistId
                ? journalistMap.get(item.discovery.journalistId)
                : getArticleAuthor(item);

              return (
                <button
                  key={item.discovery.id}
                  onClick={() => setSelected(item)}
                  className={`w-full text-left bg-white rounded-xl border p-4 hover:border-brand-300 hover:shadow-sm transition ${
                    selected?.discovery.id === item.discovery.id ? "border-brand-500 ring-1 ring-brand-500" : "border-gray-200"
                  }`}
                >
                  <p className="font-medium text-gray-800 truncate mb-1">
                    {getArticleTitle(item)}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    {outletName && <span className="truncate">{outletName}</span>}
                    {journalistName && (
                      <>
                        {outletName && <span>-</span>}
                        <span className="truncate">{journalistName}</span>
                      </>
                    )}
                    <span className="flex-shrink-0">
                      {formatDate(item.article.articlePublished)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Article Detail Panel */}
      {selected && (
        <div className="absolute inset-0 md:relative md:w-1/2 bg-gray-50 md:border-l border-gray-200 overflow-y-auto z-10">
          <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
            <button
              onClick={() => setSelected(null)}
              className="md:hidden flex items-center gap-2 text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <h2 className="font-semibold text-gray-800 hidden md:block">Article Details</h2>
            <button
              onClick={() => setSelected(null)}
              className="text-gray-400 hover:text-gray-600 hidden md:block"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-4 md:p-6 space-y-4">
            {/* Title + Link */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-medium text-gray-800 mb-3">{getArticleTitle(selected)}</h3>
              <a
                href={selected.article.articleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline"
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open article
              </a>
            </div>

            {/* Key info */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {(() => {
                  const journalistName = selected.discovery.journalistId
                    ? journalistMap.get(selected.discovery.journalistId)
                    : getArticleAuthor(selected);
                  return journalistName ? (
                    <div>
                      <span className="text-gray-500">Journalist:</span>
                      <p className="font-medium">{journalistName}</p>
                    </div>
                  ) : null;
                })()}
                <div>
                  <span className="text-gray-500">Published:</span>
                  <p className="font-medium">{formatDate(selected.article.articlePublished)}</p>
                </div>
                {(() => {
                  const outletName = selected.discovery.outletId
                    ? outletMap.get(selected.discovery.outletId)
                    : null;
                  return outletName ? (
                    <div>
                      <span className="text-gray-500">Outlet:</span>
                      <p className="font-medium">{outletName}</p>
                    </div>
                  ) : null;
                })()}
                {selected.article.articleSection && (
                  <div>
                    <span className="text-gray-500">Section:</span>
                    <p className="font-medium">{selected.article.articleSection}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Description/Snippet */}
            {(selected.article.ogDescription || selected.article.snippet) && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Summary</h4>
                <p className="text-sm text-gray-700">
                  {selected.article.ogDescription || selected.article.snippet}
                </p>
              </div>
            )}

            {/* Keywords */}
            {selected.article.newsKeywords && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Keywords</h4>
                <div className="flex flex-wrap gap-1.5">
                  {selected.article.newsKeywords.split(",").map((kw, i) => (
                    <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                      {kw.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="text-xs text-gray-400">
              Discovered: {new Date(selected.discovery.createdAt).toLocaleString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
