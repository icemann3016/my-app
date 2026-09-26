import { CircleAlertIcon, CircleCheckIcon, ClockIcon, TriangleAlertIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { VerificationStatus } from "@/lib/db/schema";
import type { ExpiryState } from "@/lib/pilot/validity";
import { cn } from "@/lib/utils";

const statusStyles: Record<VerificationStatus, string> = {
  verified: "border-success/40 text-success",
  pending: "border-border text-muted-foreground",
  rejected: "border-destructive/40 text-destructive",
};
const statusIcons = {
  verified: CircleCheckIcon,
  pending: ClockIcon,
  rejected: CircleAlertIcon,
} as const;

export function StatusBadge({ status, label }: { status: VerificationStatus; label: string }) {
  const Icon = statusIcons[status];
  return (
    <Badge variant="outline" className={cn(statusStyles[status])}>
      <Icon aria-hidden /> {label}
    </Badge>
  );
}

/** "Valid until …" / "Expires …" (≤ 30 days, amber) / "Expired …" (red). */
export function ExpiryText({ state, text }: { state: ExpiryState; text: string }) {
  if (state === "none") return <span className="text-muted-foreground">{text}</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        state === "expiring" && "font-medium text-warning",
        state === "expired" && "font-medium text-destructive",
      )}
    >
      {state !== "valid" && <TriangleAlertIcon className="size-3.5" aria-hidden />}
      {text}
    </span>
  );
}
