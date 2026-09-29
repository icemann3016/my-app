import Link from "next/link";
import { CircleCheckIcon, CircleIcon, HourglassIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { CompletionItem } from "@/lib/profile-completion";
import { cn } from "@/lib/utils";

/** Completion steps, each linking to where it's done; waiting items shown apart. */
export async function CompletionList({
  items,
  waiting = [],
  showDone = false,
}: {
  items: CompletionItem[];
  waiting?: CompletionItem[];
  /** Also list finished steps (ticked), as on /welcome. */
  showDone?: boolean;
}) {
  const t = await getTranslations("completion");
  const text = (i: CompletionItem) => t(`items.${i.label}` as "items.photo", i.values ?? {});
  const shown = showDone ? items : items.filter((i) => !i.done);
  return (
    <div className="grid gap-3">
      <ul className="grid divide-y">
        {shown.map((i) => (
          <li key={i.key}>
            <Link
              href={i.href}
              className={cn(
                "-mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 text-sm hover:bg-accent",
                i.done && "text-muted-foreground",
              )}
            >
              {i.done ? (
                <CircleCheckIcon className="size-4 shrink-0 text-success" aria-hidden />
              ) : (
                <CircleIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <span className="sr-only">{i.done ? t("done") : t("todo")}: </span>
              <span className="flex-1">{text(i)}</span>
            </Link>
          </li>
        ))}
      </ul>
      {waiting.length > 0 && (
        <div className="grid gap-1 rounded-md bg-muted/50 p-3 text-sm">
          <p className="font-medium">{t("waitingTitle")}</p>
          <ul className="grid gap-1">
            {waiting.map((i) => (
              <li key={i.key} className="flex items-center gap-2 text-muted-foreground">
                <HourglassIcon className="size-4 shrink-0" aria-hidden /> {text(i)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
