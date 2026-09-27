import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";

/** "Continue" to the next setup step of a draft listing (for sections without one form). */
export async function ContinueLink({ href }: { href: string }) {
  const t = await getTranslations("aircraft.edit");
  return (
    <Button className="justify-self-start" asChild>
      <Link href={href}>
        {t("continue")} <ArrowRightIcon aria-hidden />
      </Link>
    </Button>
  );
}
