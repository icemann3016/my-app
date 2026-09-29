/** "Alice Pilot" → "AP", "bob" → "B", "Maria Georgieva (demo)" → "MG": brackets are ignored. */
export function initials(name: string): string {
  const parts = name
    .replace(/\([^)]*\)?/g, " ")
    .split(/\s+/)
    .map((p) => p.replace(/^[^\p{L}\p{N}]+/u, ""))
    .filter(Boolean);
  const letters = parts.length > 1 ? [parts[0]!, parts[parts.length - 1]!] : parts;
  return letters.map((p) => p[0]!.toUpperCase()).join("") || "?";
}
