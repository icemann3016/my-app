import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ModerationButton } from "@/components/admin/moderation-button";
import { AdminSearch } from "@/components/admin/search-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { searchAircraft } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import { AdminHeader } from "../page-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.aircraft");
  return { title: t("title") };
}

/** Find listings and unlist them, or allow listing again (ADM-2). */
export default async function AdminAircraftPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin("/admin/aircraft");
  const q = ((await searchParams).q ?? "").trim().slice(0, 100);
  const t = await getTranslations("admin.aircraft");
  const ta = await getTranslations("aircraft.statuses");
  const tm = await getTranslations("admin.moderation.ops");
  const rows = await searchAircraft(q);

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8">
      <AdminHeader title={t("title")} text={t("description")} />
      <AdminSearch
        action="/admin/aircraft"
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
              {rows.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <Link
                      href={`/aircraft/${a.id}`}
                      className="font-mono font-medium hover:underline"
                    >
                      {a.registration}
                    </Link>
                    <span className="text-sm text-muted-foreground">
                      {a.manufacturer} {a.model} ·{" "}
                      <Link href={`/u/${a.ownerId}`} className="hover:underline">
                        {a.ownerName}
                      </Link>
                    </span>
                  </div>
                  <Badge variant="secondary">{ta(a.status)}</Badge>
                  {a.unlistedReason === "admin" || a.unlistedReason === "suspended" ? (
                    <>
                      <Badge variant="outline" className="border-destructive/50 text-destructive">
                        {t(`reasons.${a.unlistedReason}`)}
                      </Badge>
                      <ModerationButton
                        op="allow_listing"
                        targetId={a.id}
                        label={tm("allow_listing")}
                      />
                    </>
                  ) : (
                    <ModerationButton
                      op="unlist"
                      targetId={a.id}
                      label={tm("unlist")}
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
