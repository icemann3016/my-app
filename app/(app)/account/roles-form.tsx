import { CalendarCheckIcon, CheckIcon, PlaneIcon } from "lucide-react";

import { SubmitButton } from "@/components/forms/submit-button";
import type { Enums } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { setRole } from "./actions";

const ROLES = [
  {
    role: "pilot",
    icon: PlaneIcon,
    title: "I'm a pilot",
    text: "Rent aircraft from owners. Next you'll add your licence and medical.",
  },
  {
    role: "owner",
    icon: CalendarCheckIcon,
    title: "I own an aircraft",
    text: "List your aircraft for rent and choose who can fly it.",
  },
] as const;

export function RolesForm({ roles }: { roles: Enums<"app_role">[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {ROLES.map(({ role, icon: Icon, title, text }) => {
        const active = roles.includes(role);
        return (
          <form
            key={role}
            action={setRole}
            className={cn(
              "flex flex-col gap-3 rounded-lg border p-4",
              active && "border-primary/50 bg-accent/50",
            )}
          >
            <input type="hidden" name="role" value={role} />
            <input type="hidden" name="enable" value={active ? "false" : "true"} />
            <div className="flex items-center justify-between">
              <Icon className="size-5 text-primary" aria-hidden />
              {active && (
                <span className="flex items-center gap-1 text-xs font-medium text-primary">
                  <CheckIcon className="size-3.5" aria-hidden /> On
                </span>
              )}
            </div>
            <div>
              <p className="font-medium">{title}</p>
              <p className="text-sm text-muted-foreground">{text}</p>
            </div>
            <SubmitButton
              size="sm"
              variant={active ? "outline" : "default"}
              className="mt-auto self-start"
              aria-label={`${active ? "Switch off" : "Switch on"}: ${title}`}
            >
              {active ? "Switch off" : "Switch on"}
            </SubmitButton>
          </form>
        );
      })}
    </div>
  );
}
