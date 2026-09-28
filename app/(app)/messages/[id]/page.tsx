import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { AutoRefresh } from "@/components/messages/auto-refresh";
import { MessageComposer } from "@/components/messages/message-composer";
import { ReportDialog } from "@/components/reports/report-dialog";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatUtc } from "@/lib/aircraft/format";
import { isUuid } from "@/lib/aircraft/queries";
import { requireUser } from "@/lib/auth/session";
import { avatarUrl } from "@/lib/avatar-url";
import type { Locale } from "@/lib/i18n/config";
import { openConversation } from "@/lib/messages";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("messages");
  return { title: t("title") };
}

/** One conversation: messages oldest first, and a box to reply (MSG-1). */
export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/messages/${id}`);
  if (!isUuid(id)) notFound();
  const c = await openConversation(user.id, id);
  if (!c) notFound();
  const t = await getTranslations("messages");
  const locale = (await getLocale()) as Locale;
  const name = c.other?.name ?? t("deletedUser");

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4 px-4 py-10">
      <AutoRefresh />
      <Button variant="ghost" size="sm" className="-ml-3 justify-self-start" asChild>
        <Link href="/messages">
          <ArrowLeftIcon aria-hidden /> {t("back")}
        </Link>
      </Button>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center gap-3">
          <UserAvatar name={name} url={avatarUrl(c.other?.avatarKey ?? null)} size={40} />
          <div className="grid min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold">
              {c.other ? (
                <Link href={`/u/${c.other.id}`} className="hover:underline">
                  {name}
                </Link>
              ) : (
                name
              )}
            </h1>
            <p className="text-sm text-muted-foreground">
              {c.aircraft.manufacturer} {c.aircraft.model}{" "}
              <span className="font-mono">{c.aircraft.registration}</span> ·{" "}
              {c.bookingId ? (
                <Link href={`/bookings/${c.bookingId}`} className="underline underline-offset-2">
                  {t("bookingFrom", { when: formatUtc(c.booking!.from, locale) })}
                </Link>
              ) : (
                <Link href={`/aircraft/${c.aircraft.id}`} className="underline underline-offset-2">
                  {t("aboutListing")}
                </Link>
              )}
            </p>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {c.messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <ol className="grid gap-3" aria-label={t("thread")}>
              {c.messages.map((m) => {
                const mine = m.senderId === user.id;
                return (
                  <li
                    key={m.id}
                    className={cn("grid max-w-[85%] gap-1", mine && "justify-self-end")}
                  >
                    <div
                      className={cn(
                        "rounded-lg px-3 py-2 text-sm whitespace-pre-line",
                        mine ? "bg-primary text-primary-foreground" : "bg-muted",
                      )}
                    >
                      <span className="sr-only">{mine ? t("you") : name}: </span>
                      {m.body}
                    </div>
                    <div
                      className={cn(
                        "flex items-center gap-2 text-xs text-muted-foreground",
                        mine && "justify-end",
                      )}
                    >
                      <time dateTime={m.createdAt.toISOString()}>
                        {formatUtc(m.createdAt, locale)}
                      </time>
                      {!mine && (
                        <ReportDialog
                          targetType="message"
                          targetId={m.id}
                          className="h-6 px-1.5 text-xs text-muted-foreground"
                        />
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          {c.canWrite ? (
            <MessageComposer conversationId={c.id} />
          ) : (
            <p className="text-sm text-muted-foreground">{t("closed")}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
