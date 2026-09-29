import { cn } from "@/lib/utils";

/**
 * The "A" of ownAplane: a delta-wing aircraft seen from above (nose at the apex, swept wings as
 * the legs, the tail notch between them, the cockpit as the letter's hole). Takes the text colour.
 * Also used for the app icon (app/icon.svg, docs/brand).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden focusable="false" className={cn("shrink-0", className)}>
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M44 8Q50-3 56 8L97 90C98.5 93 95 98.5 91 97L61 86 56 99H44L39 86 9 97C5 98.5 1.5 93 3 90ZM50 34 40.5 62H59.5Z"
      />
    </svg>
  );
}
