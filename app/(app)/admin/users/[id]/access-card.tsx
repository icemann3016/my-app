import { getLocale, getTranslations } from "next-intl/server";

import { ModerationButton } from "@/components/admin/moderation-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUtc } from "@/lib/aircraft/format";
import type { MemberDetail } from "@/lib/admin/member-detail";
import type { Locale } from "@/lib/i18n/config";

/** Admin rights, suspension and deletion, each behind a confirmation and logged. */
export async function AccessCard({ m, adminId }: { m: MemberDetail; adminId: string }) {
  const t = await getTranslations("admin.member.access");
  const tm = await getTranslations("admin.moderation.ops");
  const locale = (await getLocale()) as Locale;
  const self = m.id === adminId;
  const isAdmin = m.roles.includes("admin");
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{t("title")}</CardTitle>
        <CardDescription>{t("text")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm">
        <ul className="grid gap-1">
          <li>{isAdmin ? t("isAdmin") : t("notAdmin")}</li>
          {m.suspendedAt && (
            <li className="text-destructive">
              {t("suspendedSince", { date: formatUtc(m.suspendedAt, locale) })}
            </li>
          )}
        </ul>
        {self ? (
          <p className="text-muted-foreground">{t("ownAccount")}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {isAdmin ? (
                <ModerationButton op="revoke_admin" targetId={m.id} label={tm("revoke_admin")} />
              ) : (
                !m.suspendedAt && (
                  <ModerationButton op="grant_admin" targetId={m.id} label={tm("grant_admin")} />
                )
              )}
              {m.suspendedAt ? (
                <ModerationButton op="unsuspend" targetId={m.id} label={tm("unsuspend")} />
              ) : (
                <ModerationButton op="suspend" targetId={m.id} label={tm("suspend")} destructive />
              )}
              {!isAdmin && (
                <ModerationButton
                  op="delete_user"
                  targetId={m.id}
                  label={tm("delete_user")}
                  destructive
                />
              )}
            </div>
            {isAdmin && <p className="text-xs text-muted-foreground">{t("deleteHint")}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
