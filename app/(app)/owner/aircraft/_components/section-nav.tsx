"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleCheckIcon, CircleIcon, ClockIcon, LayoutListIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { SECTIONS, type Section } from "@/lib/aircraft/catalog";
import type { SectionState } from "@/lib/aircraft/editor";
import { cn } from "@/lib/utils";

/** Overview + the editor sections, with a tick when a section has nothing missing. */
export function SectionNav({
  aircraftId,
  states,
}: {
  aircraftId: string;
  states: Record<Section, SectionState>;
}) {
  const t = useTranslations("owner.sections");
  const pathname = usePathname();
  const base = `/owner/aircraft/${aircraftId}`;
  const items = [
    { href: base, label: t("overview"), icon: LayoutListIcon, state: null },
    ...SECTIONS.map((s) => ({ href: `${base}/${s}`, label: t(s), icon: null, state: states[s] })),
  ];
  const stateLabel = { done: t("done"), todo: t("todo"), waiting: t("waiting") };

  return (
    <nav aria-label={t("label")} className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ol className="flex gap-1 md:flex-col">
        {items.map((item) => {
          const current = pathname === item.href;
          const Icon =
            item.icon ??
            (item.state === "done"
              ? CircleCheckIcon
              : item.state === "waiting"
                ? ClockIcon
                : CircleIcon);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap hover:bg-accent",
                  current && "bg-accent font-medium",
                )}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    item.state === "done" && "text-success",
                    item.state === "waiting" && "text-warning",
                    item.state === "todo" && "text-muted-foreground",
                    !item.state && "text-primary",
                  )}
                  aria-hidden
                />
                {item.label}
                {item.state && <span className="sr-only">({stateLabel[item.state]})</span>}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
