"use client";

import { useActionState } from "react";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { initialFormState } from "@/lib/forms";
import { deleteAircraftDocument } from "./actions";

export function DeleteDocument({
  aircraftId,
  id,
  name,
}: {
  aircraftId: string;
  id: string;
  name: string;
}) {
  const t = useTranslations("aircraft.documents");
  const [state, formAction] = useActionState(deleteAircraftDocument, initialFormState);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={t("deleteLabel", { name })}>
          <Trash2Icon aria-hidden /> {t("delete")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("deleteTitle", { name })}</DialogTitle>
          <DialogDescription>{t("deleteText")}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          <FormMessage state={state} />
          <input type="hidden" name="aircraftId" value={aircraftId} />
          <input type="hidden" name="id" value={id} />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {t("cancel")}
              </Button>
            </DialogClose>
            <SubmitButton variant="destructive" pendingText={t("deleting")}>
              {t("delete")}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
