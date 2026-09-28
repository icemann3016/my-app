// CSV files for spreadsheets (RFC 4180, comma-separated, CRLF). Text that a spreadsheet would
// run as a formula (=, +, -, @, tab, CR) is prefixed with ' so exports can't carry formulas.

export type CsvValue = string | number | null | undefined;

function cell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  let text = typeof value === "number" ? String(value) : value;
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Header and rows as CSV text, with a byte order mark so Excel reads UTF-8 (e.g. Cyrillic). */
export function toCsv(header: string[], rows: CsvValue[][]): string {
  return "﻿" + [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}

/** A download response for CSV text. */
export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "private, no-store",
    },
  });
}
