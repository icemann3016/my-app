import {
  CircleCheckIcon,
  CircleSlashIcon,
  ClockIcon,
  PlaneIcon,
  PlaneLandingIcon,
  TimerOffIcon,
  XCircleIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { BookingStatus } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

const styles: Record<BookingStatus, string> = {
  requested: "border-warning/40 text-warning",
  accepted: "border-success/40 text-success",
  declined: "border-destructive/40 text-destructive",
  expired: "border-border text-muted-foreground",
  cancelled: "border-border text-muted-foreground",
  in_progress: "border-primary/40 text-primary",
  completed: "border-success/40 text-success",
};
const icons = {
  requested: ClockIcon,
  accepted: CircleCheckIcon,
  declined: XCircleIcon,
  expired: TimerOffIcon,
  cancelled: CircleSlashIcon,
  in_progress: PlaneIcon,
  completed: PlaneLandingIcon,
} as const;

export function BookingStatusBadge({ status, label }: { status: BookingStatus; label: string }) {
  const Icon = icons[status];
  return (
    <Badge variant="outline" className={cn(styles[status])}>
      <Icon aria-hidden /> {label}
    </Badge>
  );
}
