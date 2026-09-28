"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";

import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import type { AvatarPreset } from "@/lib/avatar-presets";
import { AVATAR_MAX_BYTES, AVATAR_TYPES } from "@/lib/validation/profile";
import { AvatarPresets } from "./avatar-presets";

/** Profile picture: upload a photo, or pick one of the ready-made avatars. */
export function AvatarUpload({
  name,
  url,
  preset,
}: {
  name: string;
  url: string | null;
  /** The chosen ready-made avatar, if that's what `url` shows. */
  preset: AvatarPreset | null;
}) {
  const t = useTranslations("account.avatar");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function send(init: RequestInit) {
    startTransition(async () => {
      const res = await fetch("/api/account/avatar", init).catch(() => null);
      if (!res?.ok) {
        const body = (await res?.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? t("failed"));
      }
      router.refresh();
    });
  }

  function onFileChosen(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) {
      setError(t("invalidType"));
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setError(t("tooLarge"));
      return;
    }
    const body = new FormData();
    body.append("file", file);
    send({ method: "POST", body });
  }

  const hasPhoto = Boolean(url) && !preset;
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-4">
        <UserAvatar name={name} url={url} size={72} />
        <div className="grid gap-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => inputRef.current?.click()}
            >
              {pending && <Loader2Icon className="animate-spin" aria-hidden />}
              {hasPhoto ? t("change") : t("upload")}
            </Button>
            {url && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => {
                  setError(null);
                  send({ method: "DELETE" });
                }}
              >
                {t("remove")}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{t("hint")}</p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={AVATAR_TYPES.join(",")}
          className="sr-only"
          tabIndex={-1}
          aria-label={t("choose")}
          onChange={(e) => {
            onFileChosen(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      <AvatarPresets
        current={preset}
        disabled={pending}
        onChoose={(chosen) => {
          setError(null);
          send({
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ preset: chosen }),
          });
        }}
      />
    </div>
  );
}
