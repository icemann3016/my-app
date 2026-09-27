"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeftIcon, ChevronRightIcon, PlaneIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Large photo with previous/next and a strip of thumbnails. Works with touch and keyboard. */
export function PhotoGallery({
  photos,
  title,
}: {
  photos: { id: string; url: string }[];
  title: string;
}) {
  const t = useTranslations("aircraft.gallery");
  const [index, setIndex] = useState(0);
  const count = photos.length;
  const current = photos[index];
  const go = (delta: number) => setIndex((i) => (i + delta + count) % count);

  if (!current) {
    return (
      <div className="flex aspect-[16/10] items-center justify-center rounded-xl bg-muted">
        <PlaneIcon className="size-10 text-muted-foreground" aria-hidden />
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <div
        className="relative aspect-[16/10] overflow-hidden rounded-xl bg-muted"
        role="group"
        aria-roledescription={t("carousel")}
        aria-label={t("label", { title })}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") go(-1);
          if (e.key === "ArrowRight") go(1);
        }}
      >
        <Image
          key={current.id}
          src={current.url}
          alt={t("photoOf", { title, n: index + 1, count })}
          fill
          priority={index === 0}
          sizes="(min-width: 1024px) 700px, 100vw"
          className="object-cover"
        />
        {count > 1 && (
          <>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full opacity-90"
              onClick={() => go(-1)}
              aria-label={t("previous")}
            >
              <ChevronLeftIcon aria-hidden />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full opacity-90"
              onClick={() => go(1)}
              aria-label={t("next")}
            >
              <ChevronRightIcon aria-hidden />
            </Button>
            <span className="absolute right-2 bottom-2 rounded bg-background/90 px-2 py-0.5 text-xs">
              {index + 1} / {count}
            </span>
          </>
        )}
      </div>
      {count > 1 && (
        <ul className="flex snap-x gap-2 overflow-x-auto pb-1" aria-label={t("thumbnails")}>
          {photos.map((p, i) => (
            <li key={p.id} className="snap-start">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={t("show", { n: i + 1 })}
                aria-current={i === index ? "true" : undefined}
                className={cn(
                  "relative block h-14 w-20 overflow-hidden rounded-md border-2 border-transparent outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  i === index && "border-primary",
                )}
              >
                <Image src={p.url} alt="" fill sizes="80px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
