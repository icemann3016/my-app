// Pure helpers for the airport import (unit-tested in transform.test.ts).

/** Airfield types we import. Heliports, seaplane bases, balloon ports and closed fields are skipped. */
export const IMPORTED_TYPES = new Set(["large_airport", "medium_airport", "small_airport"]);

/** Keep European airfields of the types above. */
export function shouldImport(record, continent = "EU") {
  return (
    record.continent === continent &&
    IMPORTED_TYPES.has(record.type) &&
    Boolean(record.ident) &&
    record.latitude_deg !== "" &&
    record.longitude_deg !== ""
  );
}

const blankToNull = (value) => {
  const v = (value ?? "").trim();
  return v === "" ? null : v;
};

/** Convert an OurAirports CSV record into a row for the airports table. */
export function toAirportRow(record, timezoneFor) {
  const latitude = Number(record.latitude_deg);
  const longitude = Number(record.longitude_deg);
  const elevation = blankToNull(record.elevation_ft);
  return {
    ident: record.ident.trim(),
    type: record.type,
    name: record.name.trim(),
    icao_code: blankToNull(record.icao_code),
    iata_code: blankToNull(record.iata_code),
    gps_code: blankToNull(record.gps_code),
    local_code: blankToNull(record.local_code),
    municipality: blankToNull(record.municipality),
    country: record.iso_country.trim(),
    region: blankToNull(record.iso_region),
    latitude,
    longitude,
    elevation_ft: elevation === null ? null : Math.round(Number(elevation)),
    timezone: timezoneFor(latitude, longitude),
    keywords: blankToNull(record.keywords),
  };
}
