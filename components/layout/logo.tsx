import Link from "next/link";

import { siteConfig } from "@/lib/site";
import { LogoMark } from "./logo-mark";

/** The wordmark: "own", the aircraft-shaped A, "plane". Screen readers hear the site name. */
export function Logo() {
  return (
    <Link
      href="/"
      aria-label={siteConfig.name}
      className="flex items-baseline text-xl leading-none font-bold tracking-tight"
    >
      <span aria-hidden>own</span>
      <LogoMark className="mx-px h-[0.8em] w-auto translate-y-[0.03em] self-baseline text-primary" />
      <span aria-hidden className="text-primary">
        plane
      </span>
    </Link>
  );
}
