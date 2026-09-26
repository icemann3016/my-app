"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2Icon, MapPinIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Same shape as AirportSummary in lib/airports.ts (kept here so this stays a client module). */
export type PickerAirport = {
  ident: string;
  code: string;
  iataCode: string | null;
  name: string;
  municipality: string | null;
  country: string;
};

const label = (a: PickerAirport) => `${a.code} – ${a.name}`;

/**
 * Airport search box (combobox). Submits the airport's ident in a hidden input called `name`.
 * Keeps the previous choice until another airport is picked or the field is cleared.
 */
export function AirportPicker({
  name,
  label: fieldLabel,
  hint,
  errors,
  defaultAirport = null,
}: {
  name: string;
  label: string;
  hint?: string;
  errors?: string[];
  defaultAirport?: PickerAirport | null;
}) {
  const t = useTranslations("airportPicker");
  const id = useId();
  const listId = `${id}-list`;
  const [selected, setSelected] = useState<PickerAirport | null>(defaultAirport);
  const [query, setQuery] = useState(defaultAirport ? label(defaultAirport) : "");
  // Results of the last finished search, and the text they were for.
  const [found, setFound] = useState<{ q: string; items: PickerAirport[] }>({ q: "", items: [] });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const q = query.trim();
  const shouldSearch = open && q.length >= 2 && !(selected && query === label(selected));
  const loading = shouldSearch && found.q !== q;
  const results = shouldSearch && found.q === q ? found.items : [];

  // Search as the user types (debounced; stale requests are cancelled).
  useEffect(() => {
    if (!shouldSearch) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/airports?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        const body = (await res.json()) as { results: PickerAirport[] };
        setFound({ q, items: body.results });
        setActive(0);
      } catch {
        // aborted or offline: the next keystroke searches again
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, shouldSearch]);

  function choose(airport: PickerAirport) {
    setSelected(airport);
    setQuery(label(airport));
    setOpen(false);
  }

  function restore() {
    setOpen(false);
    setQuery(selected ? label(selected) : "");
  }

  function clear() {
    setSelected(null);
    setQuery("");
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open && results[active]) {
      e.preventDefault(); // pick the airport instead of submitting the form
      choose(results[active]);
    } else if (e.key === "Escape") {
      restore();
    }
  }

  const showList = shouldSearch;
  const describedBy = errors?.length ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{fieldLabel}</Label>
      <input type="hidden" name={name} value={selected?.ident ?? ""} />
      <div className="relative">
        <MapPinIcon
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && results[active] ? `${id}-opt-${active}` : undefined}
          aria-invalid={errors?.length ? true : undefined}
          aria-describedby={describedBy}
          autoComplete="off"
          placeholder={t("placeholder")}
          className="pr-9 pl-9"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={(e) => {
            e.target.select();
            setOpen(true);
          }}
          onBlur={() => setTimeout(restore, 150)}
          onKeyDown={onKeyDown}
        />
        {loading ? (
          <Loader2Icon
            className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden
          />
        ) : (
          (selected || query) && (
            <button
              type="button"
              onClick={clear}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground"
              aria-label={t("clear")}
            >
              <XIcon className="size-4" />
            </button>
          )
        )}
        {showList && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          >
            {results.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                {loading ? t("searching") : t("noResults")}
              </li>
            ) : (
              results.map((a, i) => (
                <li
                  key={a.ident}
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(a)}
                  className={cn(
                    "flex cursor-pointer items-baseline gap-2 rounded-sm px-3 py-2 text-sm",
                    i === active && "bg-accent text-accent-foreground",
                  )}
                >
                  <span className="font-mono font-medium">{a.code}</span>
                  {a.iataCode && (
                    <span className="font-mono text-xs text-muted-foreground">{a.iataCode}</span>
                  )}
                  <span className="truncate">{a.name}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {[a.municipality, a.country].filter(Boolean).join(", ")}
                  </span>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
      {hint && !errors?.length && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {errors?.length ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}
