#!/usr/bin/env node
/**
 * Import European airfields from OurAirports (https://ourairports.com/data/, public domain)
 * into the airports table. Safe to re-run: existing airports are updated.
 *
 *   npm run airports:import                          # download the latest data
 *   npm run airports:import -- --file some.csv       # use a local CSV (tests, offline)
 *
 * Uses DATABASE_URL_MIGRATIONS or DATABASE_URL from .env.local.
 */
import { readFile } from "node:fs/promises";

import nextEnv from "@next/env";
import tzLookup from "@photostructure/tz-lookup";
import { parse } from "csv-parse/sync";
import postgres from "postgres";

import { shouldImport, toAirportRow } from "./airports/transform.mjs";

const SOURCE_URL =
  "https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv";
const BATCH = 500;

nextEnv.loadEnvConfig(process.cwd());
const lookupTimezone = tzLookup.default ?? tzLookup;

async function loadCsv() {
  const fileFlag = process.argv.indexOf("--file");
  if (fileFlag !== -1) return readFile(process.argv[fileFlag + 1], "utf8");
  console.log(`Downloading ${SOURCE_URL} …`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  return res.text();
}

async function main() {
  const url = process.env.DATABASE_URL_MIGRATIONS ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example).");

  const records = parse(await loadCsv(), { columns: true, skip_empty_lines: true });
  const rows = records.filter((r) => shouldImport(r)).map((r) => toAirportRow(r, lookupTimezone));
  console.log(
    `${records.length} airports in the file, ${rows.length} European airfields to import.`,
  );

  const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
  try {
    const columns = Object.keys(rows[0]);
    const updates = columns.filter((c) => c !== "ident");
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      await sql`
        insert into airports ${sql(batch, columns)}
        on conflict (ident) do update set
          ${sql.unsafe(updates.map((c) => `${c} = excluded.${c}`).join(", "))},
          updated_at = now()
      `;
      process.stdout.write(`\r  ${Math.min(i + BATCH, rows.length)} / ${rows.length}`);
    }
    const [{ count }] = await sql`select count(*)::int as count from airports`;
    console.log(`\nDone. The airports table now has ${count} airfields.`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error("\nImport failed:", error.message);
  process.exit(1);
});
