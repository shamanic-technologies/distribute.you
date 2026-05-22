import Link from "next/link";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Navbar } from "@/components/navbar";
import { listArticles, type BlogArticle } from "@/lib/blog/db";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Blog — distribute",
  description:
    "Stories, playbooks, and benchmarks for solo builders running their own distribution.",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

async function fetchArticles(): Promise<BlogArticle[]> {
  return listArticles(50);
}

export default async function BlogIndexPage() {
  const headersList = await headers();
  const host = headersList.get("host") ?? "";
  const articles = await fetchArticles();

  return (
    <main className="min-h-screen">
      <Navbar host={host} />

      <section className="pt-20 pb-8 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 text-gray-600 px-4 py-1.5 rounded-full text-sm mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
            distribute blog
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4 text-gray-900 tracking-tight">
            Stories from the solo path
          </h1>
          <p className="text-base md:text-lg text-gray-500 max-w-xl mx-auto">
            Playbooks, benchmarks, and field notes on running distribution for a
            portfolio of products — without a marketing team.
          </p>
        </div>
      </section>

      <section className="px-4 pb-24">
        <div className="max-w-3xl mx-auto">
          {articles.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              No articles yet. Come back soon.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 border-y border-gray-100">
              {articles.map((a) => (
                <li key={a.id} className="py-6">
                  <Link
                    href={`/blog/${a.slug}`}
                    className="group block hover:bg-gray-50 -mx-4 px-4 py-2 rounded-lg transition"
                  >
                    <div className="flex items-center gap-3 text-xs text-gray-400 mb-2">
                      <time dateTime={a.publishedAt}>{formatDate(a.publishedAt)}</time>
                      {a.tags.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                    <h2 className="font-display text-xl font-semibold text-gray-900 group-hover:text-brand-600 transition">
                      {a.title}
                    </h2>
                    {a.excerpt && (
                      <p className="text-sm text-gray-500 mt-1 leading-relaxed line-clamp-2">
                        {a.excerpt}
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
