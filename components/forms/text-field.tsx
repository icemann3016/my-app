import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type BaseProps = {
  name: string;
  label: string;
  hint?: React.ReactNode;
  errors?: string[];
};

function FieldShell({
  name,
  label,
  hint,
  errors,
  children,
}: BaseProps & { children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      {children}
      {hint && !errors?.length && (
        <p id={`${name}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {errors?.length ? (
        <p id={`${name}-error`} className="text-sm text-destructive">
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(name: string, hint: unknown, errors?: string[]) {
  if (errors?.length) return `${name}-error`;
  return hint ? `${name}-hint` : undefined;
}

export function TextField({
  name,
  label,
  hint,
  errors,
  ...inputProps
}: BaseProps & Omit<React.ComponentProps<typeof Input>, "name" | "id">) {
  return (
    <FieldShell name={name} label={label} hint={hint} errors={errors}>
      <Input
        id={name}
        name={name}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={describedBy(name, hint, errors)}
        {...inputProps}
      />
    </FieldShell>
  );
}

export function TextAreaField({
  name,
  label,
  hint,
  errors,
  ...textareaProps
}: BaseProps & Omit<React.ComponentProps<typeof Textarea>, "name" | "id">) {
  return (
    <FieldShell name={name} label={label} hint={hint} errors={errors}>
      <Textarea
        id={name}
        name={name}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={describedBy(name, hint, errors)}
        {...textareaProps}
      />
    </FieldShell>
  );
}
