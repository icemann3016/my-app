import Link from "next/link";
import { ConstructionIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";

export async function ComingSoon({
  title,
  milestone,
  children,
}: {
  title: string;
  milestone: string;
  children?: React.ReactNode;
}) {
  const t = await getTranslations("common.comingSoon");
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <ConstructionIcon className="size-6" aria-hidden />
      </span>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">
        {children ?? t("default")} <span className="whitespace-nowrap">({milestone})</span>
      </p>
      <Button variant="outline" asChild>
        <Link href="/">{t("backHome")}</Link>
      </Button>
    </div>
  );
}
