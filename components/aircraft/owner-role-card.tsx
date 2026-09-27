import { PlaneTakeoffIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { SubmitButton } from "@/components/forms/submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { setRole } from "@/app/(app)/account/actions";

/** Shown to users without the owner role: switch it on to list aircraft. */
export async function OwnerRoleCard() {
  const t = await getTranslations("aircraft.owner");
  return (
    <Card>
      <CardHeader>
        <PlaneTakeoffIcon className="size-5 text-primary" aria-hidden />
        <CardTitle as="h2">{t("notOwnerTitle")}</CardTitle>
        <CardDescription>{t("notOwnerText")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={setRole}>
          <input type="hidden" name="role" value="owner" />
          <input type="hidden" name="enable" value="true" />
          <SubmitButton>{t("switchOn")}</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
