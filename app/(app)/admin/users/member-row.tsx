import Link from "next/link";
import { BadgeCheckIcon, ChevronRightIcon, MailWarningIcon, StarIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { formatUtc } from "@/lib/aircraft/format";
import type { MemberRow as Row } from "@/lib/admin/members";
import { avatarUrl } from "@/lib/avatar-url";
import type { Locale } from "@/lib/i18n/config";

/** One member in the admin list: who, roles and status, activity at a glance. */
export async function MemberRow({ m }: { m: Row }) {
  const t = await getTranslations("admin.users");
  const tp = await getTranslations("profile.roles");
  const locale = (await getLocale()) as Locale;
  return (
    <li>
      <Link
        href={`/admin/users/${m.id}`}
        className="flex flex-wrap items-center gap-3 rounded-md px-2 py-3 hover:bg-accent/60"
      >
        <UserAvatar name={m.name} url={avatarUrl(m.avatarKey)} size={40} />
        <div className="grid min-w-0 flex-1 gap-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="truncate font-medium">{m.name}</span>
            {m.roles.map((r) => (
              <Badge key={r} variant={r === "admin" ? "default" : "secondary"}>
                {r === "admin" ? t("admin") : tp(r as "pilot" | "owner")}
              </Badge>
            ))}
            {m.suspendedAt && (
              <Badge variant="outline" className="border-destructive/50 text-destructive">
                {t("suspended")}
              </Badge>
            )}
          </span>
          <span className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            <span className="truncate">{m.email}</span>
            {!m.emailVerified && (
              <span className="flex items-center gap-1 text-warning">
                <MailWarningIcon className="size-3.5" aria-hidden /> {t("emailUnverified")}
              </span>
            )}
          </span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {m.pilotVerified && (
              <span className="flex items-center gap-1 text-success">
                <BadgeCheckIcon className="size-3.5" aria-hidden /> {t("verifiedPilot")}
              </span>
            )}
            {m.pendingCredentials > 0 && (
              <span className="font-medium text-warning">
                {t("pendingCount", { count: m.pendingCredentials })}
              </span>
            )}
            {m.flights > 0 && <span>{t("flights", { count: m.flights })}</span>}
            {m.aircraft > 0 && <span>{t("aircraftCount", { count: m.aircraft })}</span>}
            {m.ratingCount > 0 && m.ratingAvg !== null && (
              <span className="flex items-center gap-0.5">
                <StarIcon className="size-3" aria-hidden /> {m.ratingAvg.toFixed(1)}
              </span>
            )}
          </span>
        </div>
        <div className="grid justify-items-end gap-0.5 text-xs text-muted-foreground">
          <span>{t("joined", { date: formatUtc(m.createdAt, locale, { dateOnly: true }) })}</span>
          <span>
            {m.lastSeen
              ? t("lastActive", {
                  date: formatUtc(new Date(m.lastSeen), locale, { dateOnly: true }),
                })
              : t("noSession")}
          </span>
        </div>
        <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}
