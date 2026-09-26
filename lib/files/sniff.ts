/**
 * Detect a file's real type from its first bytes ("magic numbers") instead of trusting the
 * browser-supplied type or the filename. Returns null for anything we don't accept.
 */
export type SniffedType = "application/pdf" | "image/jpeg" | "image/png" | "image/webp";

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  bytes.length >= offset + signature.length && signature.every((b, i) => bytes[offset + i] === b);

const ascii = (text: string) => Array.from(text, (c) => c.charCodeAt(0));

export function sniffFileType(bytes: Uint8Array): SniffedType | null {
  if (startsWith(bytes, ascii("%PDF-"))) return "application/pdf";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) return "image/webp";
  return null;
}

export const EXTENSIONS: Record<SniffedType, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** A filename that is safe to store and show: no path, no control characters, ≤ 120 chars. */
export function safeFilename(name: string, type: SniffedType): string {
  const base = (name.split(/[\\/]/).pop() ?? "").replace(/[\u0000-\u001f\u007f"]/g, "").trim();
  const ext = EXTENSIONS[type];
  const stem = base.replace(/\.[^.]*$/, "").slice(0, 100) || "document";
  return `${stem}.${ext}`;
}
