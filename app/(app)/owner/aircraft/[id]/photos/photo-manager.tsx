"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ImagePlusIcon,
  Loader2Icon,
  StarIcon,
  Trash2Icon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { MAX_PHOTOS } from "@/lib/aircraft/catalog";
import { shrinkImage } from "@/lib/files/shrink-image";
import { PHOTO_MAX_BYTES, PHOTO_TYPES } from "@/lib/validation/aircraft";
import { deletePhoto, reorderPhotos } from "./actions";

export type ManagedPhoto = { id: string; url: string };

/** Upload, order and delete an aircraft's photos (LST-3). The first photo is the cover. */
export function PhotoManager({
  aircraftId,
  photos,
}: {
  aircraftId: string;
  photos: ManagedPhoto[];
}) {
  const t = useTranslations("aircraft.photos");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const busy = uploading !== null || pending;

  async function upload(files: File[]) {
    setErrors([]);
    const room = MAX_PHOTOS - photos.length;
    const chosen = files.slice(0, Math.max(room, 0));
    const problems: string[] = files.length > chosen.length ? [t("tooMany")] : [];
    setUploading({ done: 0, total: chosen.length });
    for (const [i, original] of chosen.entries()) {
      if (!(PHOTO_TYPES as readonly string[]).includes(original.type)) {
        problems.push(`${original.name}: ${t("invalidType")}`);
      } else {
        const file = await shrinkImage(original);
        if (file.size > PHOTO_MAX_BYTES) {
          problems.push(`${original.name}: ${t("tooLarge")}`);
        } else {
          const body = new FormData();
          body.append("file", file);
          const res = await fetch(`/api/aircraft/${aircraftId}/photos`, {
            method: "POST",
            body,
          }).catch(() => null);
          if (!res?.ok) {
            const json = (await res?.json().catch(() => null)) as { error?: string } | null;
            problems.push(`${original.name}: ${json?.error ?? t("failed")}`);
          }
        }
      }
      setUploading({ done: i + 1, total: chosen.length });
    }
    setUploading(null);
    setErrors(problems);
    router.refresh();
  }

  function move(index: number, to: number) {
    const order = photos.map((p) => p.id);
    const [moved] = order.splice(index, 1);
    order.splice(to, 0, moved!);
    startTransition(async () => {
      await reorderPhotos(aircraftId, order);
      router.refresh();
    });
  }

  function remove(photoId: string) {
    setErrors([]);
    startTransition(async () => {
      const result = await deletePhoto(aircraftId, photoId);
      if (!result.ok) setErrors([t("lastPhoto")]);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy || photos.length >= MAX_PHOTOS}
        >
          {uploading ? (
            <Loader2Icon className="animate-spin" aria-hidden />
          ) : (
            <ImagePlusIcon aria-hidden />
          )}
          {uploading ? t("uploading", uploading) : t("add")}
        </Button>
        <p className="text-sm text-muted-foreground">
          {t("count", { count: photos.length, max: MAX_PHOTOS })}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={PHOTO_TYPES.join(",")}
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-label={t("choose")}
          onChange={(e) => {
            void upload(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>
      {errors.length > 0 && (
        <ul role="alert" className="grid gap-1 text-sm text-destructive">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {photos.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo, i) => (
            <li key={photo.id} className="grid gap-2 rounded-md border p-2">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- storage URLs vary by provider */}
                <img
                  src={photo.url}
                  alt={t("photoAlt", { number: i + 1 })}
                  className="aspect-[4/3] w-full rounded object-cover"
                />
                {i === 0 && (
                  <span className="absolute top-1 left-1 inline-flex items-center gap-1 rounded bg-background/90 px-1.5 py-0.5 text-xs font-medium">
                    <StarIcon className="size-3" aria-hidden /> {t("cover")}
                  </span>
                )}
              </div>
              <div className="flex gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={busy || i === 0}
                  onClick={() => move(i, i - 1)}
                  aria-label={t("moveEarlier", { number: i + 1 })}
                >
                  <ArrowLeftIcon aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={busy || i === photos.length - 1}
                  onClick={() => move(i, i + 1)}
                  aria-label={t("moveLater", { number: i + 1 })}
                >
                  <ArrowRightIcon aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={busy || i === 0}
                  onClick={() => move(i, 0)}
                  aria-label={t("makeCover", { number: i + 1 })}
                  title={t("makeCover", { number: i + 1 })}
                >
                  <StarIcon aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="ml-auto size-8 text-destructive"
                  disabled={busy}
                  onClick={() => remove(photo.id)}
                  aria-label={t("delete", { number: i + 1 })}
                >
                  <Trash2Icon aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
      <p className="text-xs text-muted-foreground">{t("hint")}</p>
    </div>
  );
}
