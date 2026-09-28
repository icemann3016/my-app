import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { AdminSearch } from "@/components/admin/search-form";
import { Card, CardContent } from "@/components/ui/card";
import { formatUtc } from "@/lib/aircraft/format";
import { auditLog } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import type { Locale } from "@/lib/i18n/config";
import { AdminHeader } from "../page-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.audit");
  return { title: t("title") };
}

/** Every admin action and document view, newest first, searchable (ADM-2). */
export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin("/admin/audit");
  const q = ((await searchParams).q ?? "").trim().slice(0, 100);
  const t = await getTranslations("admin.audit");
  const locale = (await getLocale()) as Locale;
  const rows = await auditLog(q);

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8">
      <AdminHeader title={t("title")} text={t("description")} />
      <AdminSearch
        action="/admin/audit"
        q={q}
        label={t("search")}
        placeholder={t("placeholder")}
        button={t("searchButton")}
      />
      <Card>
        <CardContent className="overflow-x-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("none")}</p>
          ) : (
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{t("title")}</caption>
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    {t("when")}
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    {t("admin")}
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    {t("action")}
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    {t("target")}
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    {t("reason")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {formatUtc(r.createdAt, locale)}
                    </td>
                    <td className="py-2 pr-3">{r.adminName ?? "—"}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{r.action}</td>
                    <td className="py-2 pr-3 font-mono text-xs break-all">
                      {r.targetType}:{r.targetId.slice(0, 8)}
                    </td>
                    <td className="py-2">{r.reason ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
