import { Badge } from "@/components/ui/badge";
import type { AircraftStatus } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

const styles: Record<AircraftStatus, string> = {
  draft: "text-muted-foreground",
  listed: "border-success/40 text-success",
  paused: "border-warning/50 text-warning",
  unlisted: "text-muted-foreground",
  grounded: "border-destructive/40 text-destructive",
};

export function AircraftStatusBadge({ status, label }: { status: AircraftStatus; label: string }) {
  return (
    <Badge variant="outline" className={cn(styles[status])}>
      {label}
    </Badge>
  );
}
