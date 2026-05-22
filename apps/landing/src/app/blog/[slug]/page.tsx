import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { getArticleBySlug } from "@/lib/blog/db";

export const revalidate = 60;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return { title: "Article not found — distribute" };
  return {
    title: `${article.title} — distribute`,
    description: article.excerpt ?? undefined,
    openGraph: {
      title: article.title,
      description: article.excerpt ?? undefined,
      images: article.coverImageUrl ? [{ url: article.coverImageUrl }] : undefined,
    },
  };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function BlogArticlePage({ params }: Props) {
  const { slug } = await params;
  const headersList = await headers();
  const host = headersList.get("host") ?? "";

  const article = await getArticleBySlug(slug);
  if (!article) notFound();

  const body = article.contentHtml ?? null;

  return (
    <main className="min-h-screen bg-white">
      <Navbar host={host} />

      <article className="max-w-2xl mx-auto px-4 pt-20 pb-24">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600 transition mb-6"
        >
          ← All articles
        </Link>

        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 mb-4">
          <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
          {article.tags.slice(0, 4).map((t) => (
            <span key={t} className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              {t}
            </span>
          ))}
        </div>

        <h1 className="font-display text-3xl md:text-4xl font-bold text-gray-900 tracking-tight mb-4">
          {article.title}
        </h1>

        {article.excerpt && (
          <p className="text-lg text-gray-500 leading-relaxed mb-8">{article.excerpt}</p>
        )}

        {article.coverImageUrl && (
          <Image
            src={article.coverImageUrl}
            alt={article.title}
            width={1280}
            height={720}
            unoptimized
            className="rounded-xl border border-gray-200 mb-10 w-full h-auto"
          />
        )}

        {body ? (
          <div
            className="prose prose-gray max-w-none prose-headings:font-display prose-headings:text-gray-900 prose-a:text-brand-600"
            dangerouslySetInnerHTML={{ __html: body }}
          />
        ) : article.contentMarkdown ? (
          <pre className="whitespace-pre-wrap text-gray-800 leading-relaxed font-sans">
            {article.contentMarkdown}
          </pre>
        ) : (
          <p className="text-gray-400">No content available for this article.</p>
        )}
      </article>
    </main>
  );
}
