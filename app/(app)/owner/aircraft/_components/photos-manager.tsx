"use client";

import { useRef, useState } from "react";
import Image from "next/image";
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

import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { shrinkImage } from "@/lib/files/shrink-image";
import { MAX_PHOTOS, PHOTO_MAX_BYTES, PHOTO_TYPES } from "@/lib/validation/aircraft";
import { deletePhoto, movePhoto } from "../actions";

type Photo = { id: string; url: string };

/** Upload up to 20 photos (shrunk in the browser), reorder them and pick the cover. */
export function PhotosManager({ aircraftId, photos }: { aircraftId: string; photos: Photo[] }) {
  const t = useTranslations("owner.photos");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const room = MAX_PHOTOS - photos.length;

  async function upload(files: File[]) {
    setErrors([]);
    const chosen = files.slice(0, Math.max(0, room));
    const problems: string[] = files.length > chosen.length ? [t("tooMany")] : [];
    setProgress({ done: 0, total: chosen.length });
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
      setProgress({ done: i + 1, total: chosen.length });
    }
    setProgress(null);
    setErrors(problems);
    router.refresh();
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={progress !== null || room <= 0}
        >
          {progress ? (
            <Loader2Icon className="animate-spin" aria-hidden />
          ) : (
            <ImagePlusIcon aria-hidden />
          )}
          {progress ? t("uploading", { done: progress.done, total: progress.total }) : t("add")}
        </Button>
        <p className="text-sm text-muted-foreground">
          {t("hint", { count: photos.length, max: MAX_PHOTOS })}
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={PHOTO_TYPES.join(",")}
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
          {errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      )}

      {photos.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo, i) => (
            <li key={photo.id} className="grid gap-2 rounded-lg border p-2">
              <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-muted">
                <Image
                  src={photo.url}
                  alt={t("photoAlt", { n: i + 1 })}
                  fill
                  sizes="(min-width: 640px) 240px, 45vw"
                  className="object-cover"
                />
                {i === 0 && (
                  <span className="absolute top-1.5 left-1.5 rounded bg-background/90 px-1.5 py-0.5 text-xs font-medium">
                    {t("cover")}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <PhotoAction
                  aircraftId={aircraftId}
                  photoId={photo.id}
                  direction="up"
                  label={t("moveEarlier", { n: i + 1 })}
                  disabled={i === 0}
                >
                  <ArrowLeftIcon aria-hidden />
                </PhotoAction>
                <PhotoAction
                  aircraftId={aircraftId}
                  photoId={photo.id}
                  direction="down"
                  label={t("moveLater", { n: i + 1 })}
                  disabled={i === photos.length - 1}
                >
                  <ArrowRightIcon aria-hidden />
                </PhotoAction>
                {i > 0 && (
                  <PhotoAction
                    aircraftId={aircraftId}
                    photoId={photo.id}
                    direction="cover"
                    label={t("makeCover", { n: i + 1 })}
                  >
                    <StarIcon aria-hidden />
                  </PhotoAction>
                )}
                <form action={deletePhoto} className="ml-auto">
                  <input type="hidden" name="aircraftId" value={aircraftId} />
                  <input type="hidden" name="photoId" value={photo.id} />
                  <SubmitButton
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive"
                    aria-label={t("delete", { n: i + 1 })}
                  >
                    <Trash2Icon aria-hidden />
                  </SubmitButton>
                </form>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function PhotoAction({
  aircraftId,
  photoId,
  direction,
  label,
  disabled,
  children,
}: {
  aircraftId: string;
  photoId: string;
  direction: "up" | "down" | "cover";
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <form action={movePhoto}>
      <input type="hidden" name="aircraftId" value={aircraftId} />
      <input type="hidden" name="photoId" value={photoId} />
      <input type="hidden" name="direction" value={direction} />
      <SubmitButton
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label={label}
        title={label}
        disabled={disabled}
      >
        {children}
      </SubmitButton>
    </form>
  );
}
