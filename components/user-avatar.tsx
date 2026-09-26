import Image from "next/image";

import { initials } from "@/lib/avatar";
import { cn } from "@/lib/utils";

/** Round avatar: the uploaded photo, or the person's initials. */
export function UserAvatar({
  name,
  url,
  size = 32,
  className,
}: {
  name: string;
  url: string | null;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.38)) };
  if (url) {
    return (
      <Image
        src={url}
        alt=""
        width={size}
        height={size}
        style={style}
        className={cn("shrink-0 rounded-full bg-muted object-cover", className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={style}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary/15 font-medium text-primary",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
