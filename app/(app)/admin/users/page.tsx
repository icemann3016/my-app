import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheckIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  listMembers,
  MEMBER_FILTERS,
  MEMBER_SORTS,
  memberCounts,
  MEMBERS_PER_PAGE,
  type MemberFilter,
  type MemberSort,
} from "@/lib/admin/members";
import { requireAdmin } from "@/lib/auth/session";
import { AdminHeader } from "../page-header";
import { MemberFilters, membersHref } from "./member-filters";
import { MemberRow } from "./member-row";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.users");
  return { title: t("title") };
}

const pick = <T extends string>(list: readonly T[], value: string | undefined, fallback: T) =>
  list.includes(value as T) ? (value as T) : fallback;

/** All members: search, filter, sort and page through them; each opens its detail page (ADM-2). */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    filter?: string;
    sort?: string;
    page?: string;
    deleted?: string;
  }>;
}) {
  await requireAdmin("/admin/users");
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 100);
  const filter = pick<MemberFilter>(MEMBER_FILTERS, params.filter, "all");
  const sort = pick<MemberSort>(MEMBER_SORTS, params.sort, "newest");
  const page = Math.max(1, Math.min(10_000, Number.parseInt(params.page ?? "1", 10) || 1));
  const t = await getTranslations("admin.users");
  const tdone = await getTranslations("admin.moderation.done");
  const [{ rows, total }, counts] = await Promise.all([
    listMembers({ q, filter, sort, page }),
    memberCounts(),
  ]);
  const from = total === 0 ? 0 : (page - 1) * MEMBERS_PER_PAGE + 1;
  const to = Math.min(total, page * MEMBERS_PER_PAGE);

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8">
      <AdminHeader title={t("title")} text={t("description")} />
      {params.deleted && (
        <Alert variant="success">
          <CircleCheckIcon />
          <AlertDescription>{tdone("delete_user")}</AlertDescription>
        </Alert>
      )}
      <MemberFilters q={q} filter={filter} sort={sort} counts={counts} />
      <Card>
        <CardContent className="grid gap-2">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("none")}</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{t("showing", { from, to, total })}</p>
              <ul className="grid divide-y">
                {rows.map((m) => (
                  <MemberRow key={m.id} m={m} />
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
      {total > MEMBERS_PER_PAGE && (
        <nav aria-label={t("pagination")} className="flex justify-between gap-2">
          <Button variant="outline" size="sm" asChild disabled={page <= 1}>
            {page > 1 ? (
              <Link href={membersHref({ q, filter, sort, page: page - 1 })}>{t("previous")}</Link>
            ) : (
              <span aria-disabled>{t("previous")}</span>
            )}
          </Button>
          <Button variant="outline" size="sm" asChild>
            {to < total ? (
              <Link href={membersHref({ q, filter, sort, page: page + 1 })}>{t("next")}</Link>
            ) : (
              <span aria-disabled>{t("next")}</span>
            )}
          </Button>
        </nav>
      )}
    </div>
  );
}
