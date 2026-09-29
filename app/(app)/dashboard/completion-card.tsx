import Link from "next/link";
import { ChevronDownIcon, UserRoundCheckIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { CompletionList } from "@/components/completion-list";
import { Card, CardContent } from "@/components/ui/card";
import type { ProfileCompletion } from "@/lib/profile-completion";

/** Profile completion as a percentage; opens to what's left for the user to do. */
export async function CompletionCard({ completion }: { completion: ProfileCompletion }) {
  const t = await getTranslations("completion");
  const { percent, todo, waiting } = completion;
  return (
    <Card className="py-4">
      <CardContent>
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
            <UserRoundCheckIcon className="size-5 shrink-0 text-primary" aria-hidden />
            <div className="grid flex-1 gap-1.5">
              <span className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                <span className="font-medium">{t("title", { percent })}</span>
                <span className="text-xs text-muted-foreground">
                  {todo.length ? t("left", { count: todo.length }) : t("complete")}
                </span>
              </span>
              <span
                role="progressbar"
                aria-label={t("progress")}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                className="block h-2 overflow-hidden rounded-full bg-muted"
              >
                <span
                  className="block h-full rounded-full bg-primary transition-all"
                  style={{ width: `${percent}%` }}
                />
              </span>
            </div>
            <ChevronDownIcon
              className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <div className="mt-4 grid gap-3">
            {todo.length === 0 && waiting.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("allDone")}</p>
            ) : (
              <CompletionList items={todo} waiting={waiting} />
            )}
            <Link href="/welcome" className="text-sm underline underline-offset-4">
              {t("openGuide")}
            </Link>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
