"use client";

import { useActionState } from "react";
import { TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextField } from "@/components/forms/text-field";
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
import { deleteAccount } from "./actions";

export function DeleteAccount({ hasPassword }: { hasPassword: boolean }) {
  const t = useTranslations("account.data");
  const [state, formAction] = useActionState(deleteAccount, initialFormState);
  const word = t("confirmWord");

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive">{t("delete")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlertIcon className="size-5 text-destructive" aria-hidden />
            {t("dialogTitle")}
          </DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          <FormMessage state={state} />
          {hasPassword && (
            <TextField
              name="password"
              label={t("passwordLabel")}
              type="password"
              autoComplete="current-password"
              required
              errors={state.errors?.password}
            />
          )}
          <TextField
            name="confirm"
            label={t("confirmLabel", { word })}
            autoComplete="off"
            required
            errors={state.errors?.confirm}
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {t("cancel")}
              </Button>
            </DialogClose>
            <SubmitButton variant="destructive" pendingText={t("deleting")}>
              {t("confirm")}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
