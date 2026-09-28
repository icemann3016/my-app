import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { Markdown } from "@/components/help/markdown";
import { getHelpArticle, getHelpArticles, HELP_CATEGORIES, HELP_SLUGS } from "@/lib/help/articles";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const article = await getHelpArticle((await getLocale()) as Locale, (await params).slug);
  return article ? { title: article.title, description: article.summary } : {};
}

/** One help article with the list of all articles beside it. */
export default async function HelpArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const locale = (await getLocale()) as Locale;
  const article = await getHelpArticle(locale, slug);
  if (!article) notFound();
  const t = await getTranslations("help");
  const articles = await getHelpArticles(locale);
  const index = HELP_SLUGS.indexOf(slug);
  const prev = articles.find((a) => a.slug === HELP_SLUGS[index - 1]);
  const next = articles.find((a) => a.slug === HELP_SLUGS[index + 1]);
  const sections = article.blocks.filter((b) => b.type === "heading" && b.level === 2);

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[14rem_1fr]">
      <nav aria-label={t("allArticles")} className="hidden lg:block">
        <Link href="/help" className="text-sm font-medium hover:underline">
          {t("title")}
        </Link>
        {HELP_CATEGORIES.map((category) => (
          <div key={category.key} className="mt-4">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t(`categories.${category.key}`)}
            </p>
            <ul className="mt-1 grid gap-0.5">
              {articles
                .filter((a) => a.category === category.key)
                .map((a) => (
                  <li key={a.slug}>
                    <Link
                      href={`/help/${a.slug}`}
                      aria-current={a.slug === slug ? "page" : undefined}
                      className={cn(
                        "block rounded px-2 py-1 text-sm hover:bg-accent",
                        a.slug === slug && "bg-accent font-medium",
                      )}
                    >
                      {a.title}
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </nav>

      <article className="grid min-w-0 content-start gap-6">
        <Link
          href="/help"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline lg:hidden"
        >
          <ArrowLeftIcon className="size-4" aria-hidden /> {t("title")}
        </Link>
        <div className="grid gap-1">
          <p className="text-sm text-muted-foreground">{t(`categories.${article.category}`)}</p>
          <h1 className="text-3xl font-semibold tracking-tight">{article.title}</h1>
        </div>
        {sections.length > 2 && (
          <nav aria-label={t("onThisPage")} className="rounded-md border p-4 text-sm">
            <p className="mb-2 font-medium">{t("onThisPage")}</p>
            <ul className="grid gap-1">
              {sections.map(
                (s) =>
                  s.type === "heading" && (
                    <li key={s.id}>
                      <a href={`#${s.id}`} className="text-primary hover:underline">
                        {s.text}
                      </a>
                    </li>
                  ),
              )}
            </ul>
          </nav>
        )}
        <Markdown blocks={article.blocks} />
        <nav
          aria-label={t("moreArticles")}
          className="mt-4 flex flex-wrap justify-between gap-4 border-t pt-6 text-sm"
        >
          {prev ? (
            <Link
              href={`/help/${prev.slug}`}
              className="inline-flex items-center gap-1 hover:underline"
            >
              <ArrowLeftIcon className="size-4" aria-hidden /> {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link
              href={`/help/${next.slug}`}
              className="inline-flex items-center gap-1 hover:underline"
            >
              {next.title} <ArrowRightIcon className="size-4" aria-hidden />
            </Link>
          )}
        </nav>
      </article>
    </div>
  );
}
