import Link from "next/link";
import { BellIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { unreadCount } from "@/lib/notifications";

/** Bell with the number of unread notifications (BKG-9). */
export async function NotificationBell({ userId }: { userId: string }) {
  const t = await getTranslations("notifications");
  const unread = await unreadCount(userId);
  return (
    <Button variant="ghost" size="icon" className="relative" asChild>
      <Link
        href="/notifications"
        aria-label={unread ? t("bellUnread", { count: unread }) : t("bell")}
      >
        <BellIcon aria-hidden />
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
