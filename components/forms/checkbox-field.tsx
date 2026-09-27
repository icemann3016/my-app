import * as React from "react";

/** A checkbox with its label and an optional hint underneath. Sends "on" when ticked. */
export function CheckboxField({
  name,
  id,
  label,
  hint,
  errors,
  ...inputProps
}: {
  name: string;
  id?: string;
  label: string;
  hint?: React.ReactNode;
  errors?: string[];
} & Omit<React.ComponentProps<"input">, "name" | "id" | "type">) {
  const fieldId = id ?? name;
  const described = errors?.length ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;
  return (
    <div className="grid gap-1">
      <label htmlFor={fieldId} className="flex items-start gap-2 text-sm font-medium">
        <input
          id={fieldId}
          name={name}
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 accent-primary"
          aria-invalid={errors?.length ? true : undefined}
          aria-describedby={described}
          {...inputProps}
        />
        {label}
      </label>
      {hint && !errors?.length && (
        <p id={`${fieldId}-hint`} className="pl-6 text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {errors?.length ? (
        <p id={`${fieldId}-error`} className="pl-6 text-sm text-destructive">
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}
