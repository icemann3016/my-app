import Link from "next/link";
import { PlaneIcon } from "lucide-react";

import { siteConfig } from "@/lib/site";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
      <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <PlaneIcon className="size-4 -rotate-45" aria-hidden />
      </span>
      <span>{siteConfig.name}</span>
    </Link>
  );
}
