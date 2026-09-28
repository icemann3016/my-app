import { SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** GET search box for admin lists (`?q=`). */
export function AdminSearch({
  action,
  q,
  label,
  placeholder,
  button,
}: {
  action: string;
  q: string;
  label: string;
  placeholder: string;
  button: string;
}) {
  return (
    <form action={action} method="get" role="search" className="flex gap-2">
      <Label htmlFor="admin-q" className="sr-only">
        {label}
      </Label>
      <Input id="admin-q" name="q" type="search" defaultValue={q} placeholder={placeholder} />
      <Button type="submit" variant="outline">
        <SearchIcon aria-hidden /> {button}
      </Button>
    </form>
  );
}
