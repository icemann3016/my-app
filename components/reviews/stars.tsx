import { StarIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** 1–5 stars for a score, rounded to the nearest half star. `label` is read by screen readers. */
export function Stars({
  value,
  label,
  className,
}: {
  value: number;
  label: string;
  className?: string;
}) {
  const halves = Math.round(value * 2);
  return (
    <span role="img" aria-label={label} className={cn("inline-flex items-center", className)}>
      {Array.from({ length: 5 }, (_, i) => {
        const fill = halves >= (i + 1) * 2 ? "full" : halves === i * 2 + 1 ? "half" : "none";
        return (
          <span key={i} className="relative inline-flex size-4" aria-hidden>
            <StarIcon className="size-4 text-amber-500/40" />
            {fill !== "none" && (
              <span
                className="absolute inset-y-0 left-0 overflow-hidden"
                style={{ width: fill === "full" ? "100%" : "50%" }}
              >
                <StarIcon className="size-4 fill-amber-500 text-amber-500" />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
