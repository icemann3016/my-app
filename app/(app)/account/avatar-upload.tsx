"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";

import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { AVATAR_MAX_BYTES, AVATAR_TYPES } from "@/lib/validation/profile";
import { setAvatar } from "./actions";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function AvatarUpload({
  userId,
  name,
  url,
}: {
  userId: string;
  name: string;
  url: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onFileChosen(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) {
      setError("Please choose a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setError("That image is larger than 2 MB. Please choose a smaller one.");
      return;
    }

    startTransition(async () => {
      const path = `${userId}/${Date.now()}.${EXTENSIONS[file.type]}`;
      const { error: uploadError } = await createClient()
        .storage.from("avatars")
        .upload(path, file, { contentType: file.type, cacheControl: "3600" });
      if (uploadError) {
        setError("Upload failed. Please try again.");
        return;
      }
      const result = await setAvatar(path);
      if (result.error) setError(result.error);
      router.refresh();
    });
  }

  function onRemove() {
    setError(null);
    startTransition(async () => {
      const result = await setAvatar(null);
      if (result.error) setError(result.error);
      router.refresh();
    });
  }

  return (
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
            {url ? "Change photo" : "Upload photo"}
          </Button>
          {url && (
            <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={onRemove}>
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">JPG, PNG or WebP, up to 2 MB.</p>
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
        aria-label="Choose profile photo"
        onChange={(e) => {
          onFileChosen(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
