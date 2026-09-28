"use client";

import { useActionState, useEffect, useRef } from "react";
import { SendIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { sendMessageAction, startEnquiryAction } from "@/app/(app)/messages/actions";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialFormState } from "@/lib/forms";

/** Write a message: in a conversation, or the first one about a listing. Enter + Ctrl/⌘ sends. */
export function MessageComposer(
  props:
    { conversationId: string; aircraftId?: never } | { aircraftId: string; conversationId?: never },
) {
  const t = useTranslations("messages");
  const [state, formAction] = useActionState(
    props.conversationId ? sendMessageAction : startEnquiryAction,
    initialFormState,
  );
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);
  const error = state.errors?.body?.[0];
  return (
    <form ref={form} action={formAction} className="grid gap-2">
      {!state.ok && state.message && <FormMessage state={state} />}
      {props.conversationId ? (
        <input type="hidden" name="conversationId" value={props.conversationId} />
      ) : (
        <input type="hidden" name="aircraftId" value={props.aircraftId} />
      )}
      <Label htmlFor="message-body" className="sr-only">
        {t("label")}
      </Label>
      <Textarea
        id="message-body"
        name="body"
        rows={3}
        maxLength={4000}
        required
        placeholder={t("placeholder")}
        defaultValue={state.ok ? "" : state.values?.body}
        aria-invalid={error ? true : undefined}
        aria-describedby="message-hint"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) form.current?.requestSubmit();
        }}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id="message-hint" className="text-xs text-muted-foreground">
          {t("hint")}
        </p>
        <SubmitButton size="sm" pendingText={t("sending")}>
          <SendIcon aria-hidden /> {t("send")}
        </SubmitButton>
      </div>
    </form>
  );
}
