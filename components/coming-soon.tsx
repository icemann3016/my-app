import Link from "next/link";
import { ConstructionIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ComingSoon({
  title,
  milestone,
  children,
}: {
  title: string;
  milestone: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <ConstructionIcon className="size-6" aria-hidden />
      </span>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">
        {children ?? "This page is coming soon."}{" "}
        <span className="whitespace-nowrap">({milestone})</span>
      </p>
      <Button variant="outline" asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </div>
  );
}
