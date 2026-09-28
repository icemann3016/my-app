import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { UserAvatar } from "@/components/user-avatar";
import { Card, CardContent } from "@/components/ui/card";
import { formatUtc } from "@/lib/aircraft/format";
import { requireUser } from "@/lib/auth/session";
import { avatarUrl } from "@/lib/avatar-url";
import type { Locale } from "@/lib/i18n/config";
import { listConversations } from "@/lib/messages";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("messages");
  return { title: t("title") };
}

/** The user's conversations with pilots and owners, newest first (MSG-1). */
export default async function MessagesPage() {
  const user = await requireUser("/messages");
  const t = await getTranslations("messages");
  const locale = (await getLocale()) as Locale;
  const items = (await listConversations(user.id)).filter((c) => c.lastMessage !== null);

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-10">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>
      <Card>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("none")}</p>
          ) : (
            <ul className="grid divide-y">
              {items.map((c) => {
                const name = c.other?.name ?? t("deletedUser");
                return (
                  <li key={c.id}>
                    <Link
                      href={`/messages/${c.id}`}
                      className="-mx-2 flex items-center gap-3 rounded-md px-2 py-3 hover:bg-accent"
                    >
                      <UserAvatar
                        name={name}
                        url={avatarUrl(c.other?.avatarKey ?? null)}
                        size={40}
                      />
                      <div className="grid min-w-0 flex-1 gap-0.5">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                          <span className={cn("truncate text-sm", c.unread && "font-semibold")}>
                            {c.unread && <span className="sr-only">{t("unread")} </span>}
                            {name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatUtc(c.lastMessageAt, locale)}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          <span className="font-mono">{c.aircraft.registration}</span> ·{" "}
                          {t(c.bookingId ? "aboutBooking" : "aboutListing")}
                        </span>
                        <span
                          className={cn(
                            "truncate text-sm",
                            c.unread ? "text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {c.lastMessage}
                        </span>
                      </div>
                      {c.unread && (
                        <span className="size-2.5 shrink-0 rounded-full bg-primary" aria-hidden />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
