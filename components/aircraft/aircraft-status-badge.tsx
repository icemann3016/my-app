import {
  CircleCheckIcon,
  CircleDashedIcon,
  CirclePauseIcon,
  CircleSlashIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { AircraftStatus } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

const styles: Record<AircraftStatus, string> = {
  draft: "border-border text-muted-foreground",
  listed: "border-success/40 text-success",
  paused: "border-warning/40 text-warning",
  unlisted: "border-border text-muted-foreground",
  grounded: "border-destructive/40 text-destructive",
};
const icons = {
  draft: CircleDashedIcon,
  listed: CircleCheckIcon,
  paused: CirclePauseIcon,
  unlisted: CircleSlashIcon,
  grounded: TriangleAlertIcon,
} as const;

export function AircraftStatusBadge({ status, label }: { status: AircraftStatus; label: string }) {
  const Icon = icons[status];
  return (
    <Badge variant="outline" className={cn(styles[status])}>
      <Icon aria-hidden /> {label}
    </Badge>
  );
}
