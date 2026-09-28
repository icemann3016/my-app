import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ModerationButton } from "@/components/admin/moderation-button";
import { Badge } from "@/components/ui/badge";
import type { ReportTargetView } from "@/lib/admin/queries";

/** What a report points at, with the actions that fit it (ADM-2, ADM-3). */
export async function ReportTarget({
  target,
  reportId,
  open,
}: {
  target: ReportTargetView | null;
  reportId: string;
  open: boolean;
}) {
  const t = await getTranslations("admin.reports");
  const tm = await getTranslations("admin.moderation.ops");
  if (!target) return <p className="text-sm text-muted-foreground">{t("gone")}</p>;
  const act = (op: Parameters<typeof ModerationButton>[0]["op"], id: string, destructive = true) =>
    open ? (
      <ModerationButton
        op={op}
        targetId={id}
        reportId={reportId}
        label={tm(op)}
        destructive={destructive}
      />
    ) : null;
  const person = (id: string | null, name: string | null) =>
    id ? (
      <Link href={`/u/${id}`} className="font-medium hover:underline">
        {name ?? id}
      </Link>
    ) : (
      <span>{t("deletedUser")}</span>
    );

  switch (target.type) {
    case "review":
      return (
        <div className="grid gap-2">
          <p className="text-sm">
            {t("reviewBy")} {person(target.authorId, target.authorName)} ·{" "}
            {target.overall.toFixed(1)}/5{" "}
            {target.hidden && <Badge variant="secondary">{t("hidden")}</Badge>}
          </p>
          {target.comment && (
            <blockquote className="border-l-2 pl-3 text-sm whitespace-pre-line">
              {target.comment}
            </blockquote>
          )}
          <div className="flex flex-wrap gap-2">
            {target.hidden ? act("show_review", target.id, false) : act("hide_review", target.id)}
            {target.authorId && act("suspend", target.authorId)}
          </div>
        </div>
      );
    case "message":
      return (
        <div className="grid gap-2">
          <p className="text-sm">
            {t("messageBy")} {person(target.senderId, target.senderName)}
          </p>
          <blockquote className="border-l-2 pl-3 text-sm whitespace-pre-line">
            {target.body}
          </blockquote>
          <div className="flex flex-wrap gap-2">
            {target.senderId && act("suspend", target.senderId)}
          </div>
        </div>
      );
    case "user":
      return (
        <div className="grid gap-2">
          <p className="text-sm">
            {t("member")} {person(target.id, target.name)}{" "}
            {target.suspended && (
              <Badge variant="outline" className="border-destructive/50 text-destructive">
                {t("suspended")}
              </Badge>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {target.suspended ? act("unsuspend", target.id, false) : act("suspend", target.id)}
          </div>
        </div>
      );
    case "aircraft":
      return (
        <div className="grid gap-2">
          <p className="text-sm">
            {t("listing")}{" "}
            <Link href={`/aircraft/${target.id}`} className="font-mono font-medium hover:underline">
              {target.registration}
            </Link>{" "}
            · {t("owner")} {person(target.ownerId, target.ownerName)} ·{" "}
            <Badge variant="secondary">{target.status}</Badge>
          </p>
          <div className="flex flex-wrap gap-2">
            {target.unlistedReason === "admin"
              ? act("allow_listing", target.id, false)
              : act("unlist", target.id)}
            {act("suspend", target.ownerId)}
          </div>
        </div>
      );
  }
}
