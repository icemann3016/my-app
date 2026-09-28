import { WrenchIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { KnownItem } from "@/lib/bookings/remarks";
import { intlLocale, type Locale } from "@/lib/i18n/config";

/** Open known items of the aircraft, for the renter to read before flying (BKG-15). */
export async function KnownItems({ items }: { items: KnownItem[] }) {
  if (!items.length) return null;
  const t = await getTranslations("flightLog.knownItems");
  const format = new Intl.DateTimeFormat(intlLocale((await getLocale()) as Locale), {
    dateStyle: "medium",
  });
  return (
    <Alert>
      <WrenchIcon />
      <AlertTitle>{t("title")}</AlertTitle>
      <AlertDescription>
        <p>{t("text")}</p>
        <ul className="mt-2 grid list-disc gap-1 pl-4">
          {items.map((item) => (
            <li key={item.id}>
              <span className="whitespace-pre-line">{item.body}</span>{" "}
              <span className="text-xs text-muted-foreground">
                ({t("since", { date: format.format(item.knownSince) })})
              </span>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
