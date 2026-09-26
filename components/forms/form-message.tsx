import { CircleAlertIcon, CircleCheckIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import type { FormState } from "@/lib/forms";

/** Shows the overall success or error message of a form, if any. */
export function FormMessage({ state }: { state: FormState }) {
  if (!state.message) return null;
  return (
    <Alert variant={state.ok ? "success" : "destructive"}>
      {state.ok ? <CircleCheckIcon /> : <CircleAlertIcon />}
      <AlertDescription>{state.message}</AlertDescription>
    </Alert>
  );
}
