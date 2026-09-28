import Link from "next/link";
import { MessagesSquareIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { unreadConversations } from "@/lib/messages";

/** Messages icon with the number of conversations that have unread messages (MSG-1). */
export async function MessagesLink({ userId }: { userId: string }) {
  const t = await getTranslations("messages");
  const unread = await unreadConversations(userId);
  return (
    <Button variant="ghost" size="icon" className="relative" asChild>
      <Link href="/messages" aria-label={unread ? t("iconUnread", { count: unread }) : t("title")}>
        <MessagesSquareIcon aria-hidden />
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-none font-semibold text-white"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Link>
    </Button>
  );
}
