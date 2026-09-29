import Link from "next/link";
import { SearchIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MEMBER_FILTERS,
  MEMBER_SORTS,
  type MemberFilter,
  type MemberSort,
} from "@/lib/admin/members";
import { cn } from "@/lib/utils";

export function membersHref(p: { q?: string; filter?: string; sort?: string; page?: number }) {
  const params = new URLSearchParams();
  if (p.q) params.set("q", p.q);
  if (p.filter && p.filter !== "all") params.set("filter", p.filter);
  if (p.sort && p.sort !== "newest") params.set("sort", p.sort);
  if (p.page && p.page > 1) params.set("page", String(p.page));
  const s = params.toString();
  return s ? `/admin/users?${s}` : "/admin/users";
}

/** Search box, sort order and filter chips with counts (all in the URL). */
export async function MemberFilters({
  q,
  filter,
  sort,
  counts,
}: {
  q: string;
  filter: MemberFilter;
  sort: MemberSort;
  counts: Record<MemberFilter, number>;
}) {
  const t = await getTranslations("admin.users");
  return (
    <div className="grid gap-3">
      <form action="/admin/users" method="get" role="search" className="flex flex-wrap gap-2">
        {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
        <Label htmlFor="admin-q" className="sr-only">
          {t("search")}
        </Label>
        <Input
          id="admin-q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder={t("placeholder")}
          className="min-w-48 flex-1"
        />
        <Label htmlFor="admin-sort" className="sr-only">
          {t("sort")}
        </Label>
        <select
          id="admin-sort"
          name="sort"
          defaultValue={sort}
          aria-label={t("sort")}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          {MEMBER_SORTS.map((s) => (
            <option key={s} value={s}>
              {t(`sorts.${s}`)}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline">
          <SearchIcon aria-hidden /> {t("searchButton")}
        </Button>
      </form>
      <nav aria-label={t("filterLabel")} className="flex flex-wrap gap-2">
        {MEMBER_FILTERS.map((f) => (
          <Link
            key={f}
            href={membersHref({ q, filter: f, sort })}
            aria-current={f === filter ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors hover:bg-accent",
              f === filter && "border-primary bg-primary text-primary-foreground hover:bg-primary",
            )}
          >
            {t(`filters.${f}`)} <span className="opacity-75">{counts[f]}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
