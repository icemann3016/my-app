import { CircleCheckIcon, WrenchIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { SubmitButton } from "@/components/forms/submit-button";
import { setKnownItem } from "@/app/(app)/owner/aircraft/[id]/remarks/actions";

/** Owner: mark an aircraft remark as a known item, or a known item as fixed (BKG-15). */
export async function KnownItemForm({
  remarkId,
  known,
  resolved,
}: {
  remarkId: string;
  known: boolean;
  resolved: boolean;
}) {
  const t = await getTranslations("flightLog.remarks");
  const markFixed = known && !resolved;
  return (
    <form action={setKnownItem}>
      <input type="hidden" name="remarkId" value={remarkId} />
      <input type="hidden" name="state" value={markFixed ? "resolved" : "known"} />
      <SubmitButton variant="ghost" size="sm">
        {markFixed ? <CircleCheckIcon aria-hidden /> : <WrenchIcon aria-hidden />}
        {markFixed ? t("markFixed") : t("markKnown")}
      </SubmitButton>
    </form>
  );
}
