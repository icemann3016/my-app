"use client";

import { useTranslations } from "next-intl";

import { AVATAR_PRESETS, type AvatarPreset, presetUrl } from "@/lib/avatar-presets";
import { cn } from "@/lib/utils";

/** The ready-made avatars as a row of buttons; the chosen one is marked (aria-pressed). */
export function AvatarPresets({
  current,
  disabled,
  onChoose,
}: {
  current: AvatarPreset | null;
  disabled: boolean;
  onChoose: (preset: AvatarPreset) => void;
}) {
  const t = useTranslations("account.avatar");
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm font-medium">{t("presetsTitle")}</legend>
      <div className="flex flex-wrap gap-2">
        {AVATAR_PRESETS.map((preset) => {
          const chosen = preset === current;
          return (
            <button
              key={preset}
              type="button"
              disabled={disabled}
              aria-pressed={chosen}
              aria-label={t(`presets.${preset}`)}
              title={t(`presets.${preset}`)}
              onClick={() => onChoose(preset)}
              className={cn(
                "rounded-full p-0.5 ring-offset-background transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50",
                chosen
                  ? "ring-2 ring-primary ring-offset-2"
                  : "hover:ring-2 hover:ring-muted-foreground/40",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- tiny static SVGs */}
              <img
                src={presetUrl(preset)}
                alt=""
                width={44}
                height={44}
                className="block size-11"
              />
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
