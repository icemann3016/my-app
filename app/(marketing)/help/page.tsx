import type { Metadata } from "next";
import Link from "next/link";
import { SearchIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getHelpArticles, HELP_CATEGORIES, searchHelp } from "@/lib/help/articles";
import type { Locale } from "@/lib/i18n/config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("help");
  return { title: t("title"), description: t("description") };
}

/** Knowledge base: all help articles by category, with a search. */
export default async function HelpPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const t = await getTranslations("help");
  const locale = (await getLocale()) as Locale;
  const raw = (await searchParams).q;
  const query = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 100) ?? "";
  const articles = await getHelpArticles(locale);
  const found = query ? searchHelp(articles, query) : null;

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-8 px-4 py-10">
      <div className="grid gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>
      <form action="/help" role="search" className="flex gap-2">
        <Input
          name="q"
          type="search"
          defaultValue={query}
          placeholder={t("searchPlaceholder")}
          aria-label={t("search")}
          className="max-w-md"
        />
        <Button type="submit" variant="outline">
          <SearchIcon aria-hidden /> {t("search")}
        </Button>
      </form>

      {found ? (
        <section className="grid gap-3" aria-labelledby="results">
          <h2 id="results" className="text-lg font-semibold">
            {t("results", { count: found.length, query })}
          </h2>
          {found.length === 0 ? (
            <p className="text-muted-foreground">{t("noResults")}</p>
          ) : (
            <ul className="grid gap-3">
              {found.map((a) => (
                <li key={a.slug}>
                  <Link
                    href={`/help/${a.slug}`}
                    className="-mx-2 grid gap-1 rounded-md px-2 py-2 hover:bg-accent"
                  >
                    <span className="font-medium text-primary">{a.title}</span>
                    <span className="text-sm text-muted-foreground">
                      {t(`categories.${a.category}`)} · {a.summary}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {HELP_CATEGORIES.map((category) => (
            <Card key={category.key}>
              <CardHeader>
                <CardTitle as="h2">{t(`categories.${category.key}`)}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-3">
                  {articles
                    .filter((a) => a.category === category.key)
                    .map((a) => (
                      <li key={a.slug}>
                        <Link href={`/help/${a.slug}`} className="grid gap-0.5 hover:underline">
                          <span className="font-medium">{a.title}</span>
                          <span className="line-clamp-2 text-sm text-muted-foreground">
                            {a.summary}
                          </span>
                        </Link>
                      </li>
                    ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
