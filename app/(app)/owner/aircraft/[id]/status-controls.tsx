"use client";

import { useActionState } from "react";
import { CirclePauseIcon, CircleSlashIcon, RocketIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import type { AircraftStatus } from "@/lib/db/schema";
import { initialFormState } from "@/lib/forms";
import { setAircraftStatus } from "../actions";

const icons = { listed: RocketIcon, paused: CirclePauseIcon, unlisted: CircleSlashIcon } as const;

/** Buttons to list, pause or unlist an aircraft (LST-7). */
export function StatusControls({
  id,
  status,
  actions,
  ready,
}: {
  id: string;
  status: AircraftStatus;
  actions: AircraftStatus[];
  /** Whether it can be listed now (nothing missing). */
  ready: boolean;
}) {
  const t = useTranslations("aircraft.status");
  const [state, formAction] = useActionState(setAircraftStatus, initialFormState);

  return (
    <form action={formAction} className="grid gap-3">
      <FormMessage state={state} />
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap gap-2">
        {actions.map((target) => {
          if (target !== "listed" && target !== "paused" && target !== "unlisted") return null;
          const Icon = icons[target];
          return (
            <SubmitButton
              key={target}
              name="status"
              value={target}
              variant={target === "listed" ? "default" : "outline"}
              disabled={target === "listed" && !ready}
            >
              <Icon aria-hidden />
              {target === "listed" && status === "draft" ? t("publish") : t(`to.${target}`)}
            </SubmitButton>
          );
        })}
      </div>
    </form>
  );
}
