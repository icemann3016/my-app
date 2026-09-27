"use client";

import { useState } from "react";
import { PlaneIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

/** Photo gallery: a large photo with thumbnails; on phones the photos swipe sideways. */
export function Gallery({ photos, name }: { photos: { id: string; url: string }[]; name: string }) {
  const t = useTranslations("aircraft.public");
  const [current, setCurrent] = useState(0);

  if (photos.length === 0) {
    return (
      <div className="flex aspect-[16/9] items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <PlaneIcon className="size-10" aria-hidden />
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      {/* Phones: swipeable strip */}
      <ul
        className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 sm:hidden"
        aria-label={t("photos", { name })}
      >
        {photos.map((p, i) => (
          <li key={p.id} className="w-[85%] shrink-0 snap-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- storage URLs vary by provider */}
            <img
              src={p.url}
              alt={t("photoAlt", { name, number: i + 1, total: photos.length })}
              className="aspect-[4/3] w-full rounded-lg object-cover"
              loading={i === 0 ? "eager" : "lazy"}
            />
          </li>
        ))}
      </ul>
      {/* Larger screens: big photo + thumbnails */}
      <div className="hidden gap-2 sm:grid">
        {/* eslint-disable-next-line @next/next/no-img-element -- storage URLs vary by provider */}
        <img
          src={photos[current]!.url}
          alt={t("photoAlt", { name, number: current + 1, total: photos.length })}
          className="aspect-[16/9] w-full rounded-lg object-cover"
        />
        {photos.length > 1 && (
          <ul className="flex gap-2 overflow-x-auto pb-1" aria-label={t("photos", { name })}>
            {photos.map((p, i) => (
              <li key={p.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setCurrent(i)}
                  aria-label={t("showPhoto", { number: i + 1 })}
                  aria-current={i === current ? "true" : undefined}
                  className={cn(
                    "block overflow-hidden rounded-md border-2",
                    i === current
                      ? "border-primary"
                      : "border-transparent opacity-80 hover:opacity-100",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- storage URLs vary by provider */}
                  <img
                    src={p.url}
                    alt=""
                    className="aspect-[4/3] w-24 object-cover"
                    loading="lazy"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
