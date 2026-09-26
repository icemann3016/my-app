import { CLASS_RATINGS, LICENCE_LABELS, type LicenceTypeCode } from "./catalog";

/** Keys under "pilot" in messages/*.json; `t` is a translator for that namespace. */
export type PilotTranslate = (key: string, values?: Record<string, string>) => string;

export type CredentialKind = "licence" | "rating" | "medical";

export type CredentialRef =
  | { kind: "licence"; type: string }
  | { kind: "rating"; ratingKind: string; code: string }
  | { kind: "medical"; class: string };

/** Human name of a credential, e.g. "PPL(A)", "SEP (land)", "Night", "C510 type rating". */
export function credentialLabel(ref: CredentialRef, t: PilotTranslate): string {
  if (ref.kind === "licence") {
    return LICENCE_LABELS[ref.type as LicenceTypeCode] ?? t("licences.other");
  }
  if (ref.kind === "medical") {
    return t("medical.label", { class: t(`medical.classes.${ref.class}`) });
  }
  if (ref.ratingKind === "class") {
    return (CLASS_RATINGS as readonly string[]).includes(ref.code)
      ? t(`classRatings.${ref.code}`)
      : ref.code;
  }
  if (ref.ratingKind === "privilege") return t(`privileges.${ref.code}`);
  return t("ratings.typeLabel", { code: ref.code });
}
