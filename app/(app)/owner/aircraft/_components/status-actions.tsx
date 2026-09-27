"use client";

import { useActionState } from "react";
import { EyeOffIcon, PauseIcon, RocketIcon, Trash2Icon, XIcon } from "lucide-react";
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
import type { AircraftStatus } from "@/lib/db/schema";
import { initialFormState } from "@/lib/forms";
import { changeStatus, deleteAircraft } from "../actions";

/** Publish / pause / unlist / delete, depending on the current status. */
export function StatusActions({
  id,
  status,
  publishRequested,
  registration,
}: {
  id: string;
  status: AircraftStatus;
  publishRequested: boolean;
  registration: string;
}) {
  const t = useTranslations("owner.status");
  const [state, formAction] = useActionState(changeStatus, initialFormState);
  const canPublish = status !== "listed" && status !== "grounded" && !publishRequested;
  const canDelete = status === "draft" || status === "paused" || status === "unlisted";

  return (
    <div className="grid gap-3">
      <FormMessage state={state} />
      <div className="flex flex-wrap gap-2">
        <form action={formAction} className="contents">
          <input type="hidden" name="id" value={id} />
          {canPublish && (
            <SubmitButton name="action" value="publish" pendingText={t("working")}>
              <RocketIcon aria-hidden /> {status === "draft" ? t("publish") : t("listAgain")}
            </SubmitButton>
          )}
          {publishRequested && (
            <SubmitButton
              name="action"
              value="cancelPublish"
              variant="outline"
              pendingText={t("working")}
            >
              <XIcon aria-hidden /> {t("cancelPublish")}
            </SubmitButton>
          )}
          {status === "listed" && (
            <SubmitButton name="action" value="pause" variant="outline" pendingText={t("working")}>
              <PauseIcon aria-hidden /> {t("pause")}
            </SubmitButton>
          )}
          {(status === "listed" || status === "paused") && (
            <SubmitButton name="action" value="unlist" variant="outline" pendingText={t("working")}>
              <EyeOffIcon aria-hidden /> {t("unlist")}
            </SubmitButton>
          )}
        </form>
        {canDelete && (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" className="text-destructive">
                <Trash2Icon aria-hidden /> {t("delete")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("deleteTitle", { registration })}</DialogTitle>
                <DialogDescription>{t("deleteText")}</DialogDescription>
              </DialogHeader>
              <form action={deleteAircraft}>
                <input type="hidden" name="id" value={id} />
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">
                      {t("cancel")}
                    </Button>
                  </DialogClose>
                  <SubmitButton variant="destructive" pendingText={t("deleting")}>
                    {t("confirmDelete")}
                  </SubmitButton>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
