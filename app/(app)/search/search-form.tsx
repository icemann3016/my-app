import Form from "next/form";
import { SearchIcon, SlidersHorizontalIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AirportPicker, type PickerAirport } from "@/components/airport-picker";
import { CheckboxField } from "@/components/forms/checkbox-field";
import { SelectField, TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { CATEGORIES, PRICE_BASES } from "@/lib/aircraft/catalog";
import { RADII_KM, type SearchFilters, SORTS } from "@/lib/validation/search";

/**
 * Search filters as a GET form, so every search is a shareable URL (SRC-1, SRC-2).
 * Dates are local time at the chosen airport.
 */
export async function SearchForm({
  filters: f,
  airport,
  loggedIn,
}: {
  filters: SearchFilters;
  airport: PickerAirport | null;
  loggedIn: boolean;
}) {
  const t = await getTranslations("search");
  const ta = await getTranslations("aircraft");
  const moreOpen = Boolean(
    f.category || f.seats || f.maxPrice || f.fuel || f.night || f.ifr || f.avionics,
  );

  return (
    <Form action="/search" className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <AirportPicker
          name="airport"
          label={t("airport")}
          defaultAirport={airport}
          hint={t("airportHint")}
        />
        <SelectField
          name="radius"
          label={t("radius")}
          defaultValue={String(f.radius)}
          options={RADII_KM.map((r) => ({ value: String(r), label: t("km", { km: r }) }))}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="from" type="datetime-local" label={t("from")} defaultValue={f.from} />
        <TextField name="to" type="datetime-local" label={t("to")} defaultValue={f.to} />
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">{t("timesHint")}</p>

      <details open={moreOpen} className="group rounded-md border p-3">
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <SlidersHorizontalIcon className="size-4" aria-hidden /> {t("moreFilters")}
        </summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <SelectField
            name="category"
            label={ta("fields.category")}
            defaultValue={f.category ?? ""}
            options={[
              { value: "", label: t("any") },
              ...CATEGORIES.map((c) => ({ value: c, label: ta(`categories.${c}`) })),
            ]}
          />
          <TextField
            name="seats"
            type="number"
            inputMode="numeric"
            min={1}
            max={20}
            label={t("seats")}
            defaultValue={f.seats}
          />
          <TextField
            name="maxPrice"
            type="number"
            inputMode="decimal"
            min={1}
            label={t("maxPrice")}
            hint={t("maxPriceHint")}
            defaultValue={f.maxPrice}
          />
          <SelectField
            name="fuel"
            label={ta("fields.priceBasis")}
            defaultValue={f.fuel ?? ""}
            options={[
              { value: "", label: t("any") },
              ...PRICE_BASES.map((b) => ({ value: b, label: ta(`priceBases.${b}`) })),
            ]}
          />
          <TextField
            name="avionics"
            label={ta("fields.avionics")}
            placeholder="G1000"
            maxLength={40}
            defaultValue={f.avionics}
          />
          <div className="grid content-end gap-2">
            <CheckboxField
              name="night"
              value="1"
              label={ta("fields.nightVfr")}
              defaultChecked={f.night}
            />
            <CheckboxField name="ifr" value="1" label={ta("fields.ifr")} defaultChecked={f.ifr} />
          </div>
        </div>
      </details>

      <div className="flex flex-wrap items-end gap-4">
        {loggedIn ? (
          <CheckboxField
            name="eligible"
            value="1"
            label={t("eligible")}
            hint={t("eligibleHint")}
            defaultChecked={f.eligible}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{t("eligibleLogIn")}</p>
        )}
        <div className="ml-auto flex items-end gap-2">
          <SelectField
            name="sort"
            label={t("sort")}
            defaultValue={f.sort}
            options={SORTS.map((s) => ({ value: s, label: t(`sorts.${s}`) }))}
          />
          <Button type="submit">
            <SearchIcon aria-hidden /> {t("submit")}
          </Button>
        </div>
      </div>
    </Form>
  );
}
