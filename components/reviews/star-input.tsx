"use client";

import { useState } from "react";
import { StarIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

/** Pick 1–5 stars as a group of radio buttons named `name` (keyboard: arrow keys). */
export function StarInput({
  name,
  label,
  hint,
  defaultValue,
  errors,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultValue?: string;
  errors?: string[];
}) {
  const t = useTranslations("reviews");
  const [value, setValue] = useState(Number(defaultValue) || 0);
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <fieldset
      className="grid gap-1"
      aria-describedby={errors?.length ? `${name}-error` : undefined}
    >
      <legend className="text-sm font-medium">{label}</legend>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            className="cursor-pointer rounded-sm p-0.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
            onMouseEnter={() => setHover(n)}
          >
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => setValue(n)}
              className="sr-only"
              aria-label={t("starsLabel", { count: n })}
            />
            <StarIcon
              aria-hidden
              className={cn(
                "size-7 transition-colors",
                n <= shown ? "fill-amber-500 text-amber-500" : "text-muted-foreground/50",
              )}
            />
          </label>
        ))}
        <span className="ml-2 text-sm text-muted-foreground" aria-hidden>
          {shown ? t(`scoreWords.${shown as 1 | 2 | 3 | 4 | 5}`) : ""}
        </span>
      </div>
      {errors?.length ? (
        <p id={`${name}-error`} className="text-sm text-destructive">
          {errors[0]}
        </p>
      ) : null}
    </fieldset>
  );
}
