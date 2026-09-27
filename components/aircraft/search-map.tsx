"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

/** Map style (vector tiles). OpenFreeMap: free, no API key; override per environment. */
const STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? "https://tiles.openfreemap.org/styles/liberty";

export type MapAircraft = {
  id: string;
  title: string;
  registration: string;
  price: string | null;
  href: string;
};
export type MapAirfield = {
  ident: string;
  code: string;
  name: string;
  latitude: number;
  longitude: number;
  aircraft: MapAircraft[];
};

/** Search results on a map: one marker per airfield, listing its aircraft (SRC-3). */
export function SearchMap({
  airfields,
  origin,
}: {
  airfields: MapAirfield[];
  origin: { latitude: number; longitude: number; code: string } | null;
}) {
  const t = useTranslations("search.map");
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: import("maplibre-gl").Map | undefined;
    let cancelled = false;
    void import("maplibre-gl").then(({ default: maplibregl }) => {
      if (cancelled || !container.current) return;
      map = new maplibregl.Map({
        container: container.current,
        style: STYLE_URL,
        center: origin ? [origin.longitude, origin.latitude] : [15, 50],
        zoom: origin ? 7 : 3.5,
        attributionControl: { compact: true },
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

      const bounds = new maplibregl.LngLatBounds();
      if (origin) {
        const dot = document.createElement("div");
        dot.className = "size-3 rounded-full border-2 border-white bg-foreground shadow";
        dot.title = origin.code;
        new maplibregl.Marker({ element: dot })
          .setLngLat([origin.longitude, origin.latitude])
          .addTo(map);
        bounds.extend([origin.longitude, origin.latitude]);
      }
      for (const field of airfields) {
        // Built with DOM APIs (never innerHTML): names come from users and airport data.
        const pin = document.createElement("button");
        pin.type = "button";
        pin.className =
          "flex h-7 min-w-7 items-center justify-center rounded-full bg-primary px-2 text-xs font-semibold text-primary-foreground shadow ring-2 ring-white";
        pin.textContent = String(field.aircraft.length);
        pin.setAttribute(
          "aria-label",
          t("marker", { code: field.code, count: field.aircraft.length }),
        );

        const popup = document.createElement("div");
        popup.className = "grid gap-1 text-sm text-neutral-900";
        const heading = document.createElement("strong");
        heading.textContent = `${field.code} · ${field.name}`;
        popup.append(heading);
        for (const a of field.aircraft) {
          const link = document.createElement("a");
          link.href = a.href;
          link.className = "underline underline-offset-2";
          link.textContent = [a.title, a.registration, a.price].filter(Boolean).join(" · ");
          popup.append(link);
        }
        new maplibregl.Marker({ element: pin })
          .setLngLat([field.longitude, field.latitude])
          .setPopup(new maplibregl.Popup({ offset: 16, maxWidth: "280px" }).setDOMContent(popup))
          .addTo(map);
        bounds.extend([field.longitude, field.latitude]);
      }
      if (!bounds.isEmpty() && airfields.length > 0) {
        map.fitBounds(bounds, { padding: 48, maxZoom: 9, duration: 0 });
      }
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [airfields, origin, t]);

  return (
    <div
      ref={container}
      role="region"
      aria-label={t("label")}
      className="h-[60dvh] min-h-80 w-full overflow-hidden rounded-lg border bg-muted"
    />
  );
}
