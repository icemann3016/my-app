import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type BaseProps = {
  name: string;
  /** Defaults to `name`; set it when the same field appears more than once on a page. */
  id?: string;
  label: string;
  hint?: React.ReactNode;
  errors?: string[];
};

function FieldShell({
  fieldId,
  label,
  hint,
  errors,
  children,
}: {
  fieldId: string;
  label: string;
  hint?: React.ReactNode;
  errors?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={fieldId}>{label}</Label>
      {children}
      {hint && !errors?.length && (
        <p id={`${fieldId}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {errors?.length ? (
        <p id={`${fieldId}-error`} className="text-sm text-destructive">
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(fieldId: string, hint: unknown, errors?: string[]) {
  if (errors?.length) return `${fieldId}-error`;
  return hint ? `${fieldId}-hint` : undefined;
}

export function TextField({
  name,
  id,
  label,
  hint,
  errors,
  ...inputProps
}: BaseProps & Omit<React.ComponentProps<typeof Input>, "name" | "id">) {
  const fieldId = id ?? name;
  return (
    <FieldShell fieldId={fieldId} label={label} hint={hint} errors={errors}>
      <Input
        id={fieldId}
        name={name}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, errors)}
        {...inputProps}
      />
    </FieldShell>
  );
}

export function TextAreaField({
  name,
  id,
  label,
  hint,
  errors,
  ...textareaProps
}: BaseProps & Omit<React.ComponentProps<typeof Textarea>, "name" | "id">) {
  const fieldId = id ?? name;
  return (
    <FieldShell fieldId={fieldId} label={label} hint={hint} errors={errors}>
      <Textarea
        id={fieldId}
        name={name}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, errors)}
        {...textareaProps}
      />
    </FieldShell>
  );
}

export const selectClassName =
  "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30 dark:[&>option]:bg-popover";

export function SelectField({
  name,
  id,
  label,
  hint,
  errors,
  options,
  className,
  ...selectProps
}: BaseProps & {
  options: { value: string; label: string }[];
} & Omit<React.ComponentProps<"select">, "name" | "id" | "children">) {
  const fieldId = id ?? name;
  return (
    <FieldShell fieldId={fieldId} label={label} hint={hint} errors={errors}>
      <select
        // React resets forms after an action; a <select> would fall back to its first default,
        // so remount it when the default changes (e.g. refilled after a validation error).
        key={selectProps.value === undefined ? String(selectProps.defaultValue ?? "") : undefined}
        id={fieldId}
        name={name}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, errors)}
        className={className ?? selectClassName}
        {...selectProps}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}
