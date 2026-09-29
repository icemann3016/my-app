import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheckIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { ModerationButton } from "@/components/admin/moderation-button";
import { AdminSearch } from "@/components/admin/search-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatUtc } from "@/lib/aircraft/format";
import { searchUsers } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import type { Locale } from "@/lib/i18n/config";
import { AdminHeader } from "../page-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.users");
  return { title: t("title") };
}

/** Find members and suspend or reinstate them (ADM-2). */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; deleted?: string }>;
}) {
  const { userId: adminId } = await requireAdmin("/admin/users");
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 100);
  const t = await getTranslations("admin.users");
  const tm = await getTranslations("admin.moderation.ops");
  const tdone = await getTranslations("admin.moderation.done");
  const tp = await getTranslations("profile.roles");
  const locale = (await getLocale()) as Locale;
  const rows = await searchUsers(q);

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8">
      <AdminHeader title={t("title")} text={t("description")} />
      {params.deleted && (
        <Alert variant="success">
          <CircleCheckIcon />
          <AlertDescription>{tdone("delete_user")}</AlertDescription>
        </Alert>
      )}
      <AdminSearch
        action="/admin/users"
        q={q}
        label={t("search")}
        placeholder={t("placeholder")}
        button={t("searchButton")}
      />
      <Card>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("none")}</p>
          ) : (
            <ul className="grid divide-y">
              {rows.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <Link href={`/u/${u.id}`} className="truncate font-medium hover:underline">
                      {u.name}
                    </Link>
                    <span className="truncate text-sm text-muted-foreground">{u.email}</span>
                    <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                      {u.roles.map((r) => (
                        <Badge key={r} variant="secondary">
                          {r === "admin" ? t("admin") : tp(r as "pilot")}
                        </Badge>
                      ))}
                      {t("joined", { date: formatUtc(u.createdAt, locale) })}
                    </span>
                  </div>
                  {u.suspendedAt && (
                    <Badge variant="outline" className="border-destructive/50 text-destructive">
                      {t("suspended")}
                    </Badge>
                  )}
                  {u.id !== adminId &&
                    (u.suspendedAt ? (
                      <ModerationButton op="unsuspend" targetId={u.id} label={tm("unsuspend")} />
                    ) : (
                      <ModerationButton
                        op="suspend"
                        targetId={u.id}
                        label={tm("suspend")}
                        destructive
                      />
                    ))}
                  {u.id !== adminId && !u.roles.includes("admin") && (
                    <ModerationButton
                      op="delete_user"
                      targetId={u.id}
                      label={tm("delete_user")}
                      destructive
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
