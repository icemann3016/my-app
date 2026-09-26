import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">Off the charts</h1>
      <p className="text-muted-foreground">We couldn&apos;t find that page.</p>
      <Button variant="outline" asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </div>
  );
}
