"use client";

import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";

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
import type { CredentialKind } from "@/lib/pilot/labels";
import { deleteCredential } from "./actions";

export function DeleteCredential({
  kind,
  id,
  name,
}: {
  kind: CredentialKind;
  id: string;
  /** e.g. "PPL(A)", used in the button's accessible name and the dialog. */
  name: string;
}) {
  const t = useTranslations("pilot");
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
        <form action={deleteCredential}>
          <input type="hidden" name="kind" value={kind} />
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
