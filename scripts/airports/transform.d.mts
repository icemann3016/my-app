export const IMPORTED_TYPES: Set<string>;
export function shouldImport(record: Record<string, string>, continent?: string): boolean;
export function toAirportRow(
  record: Record<string, string>,
  timezoneFor: (latitude: number, longitude: number) => string,
): {
  ident: string;
  type: string;
  name: string;
  icao_code: string | null;
  iata_code: string | null;
  gps_code: string | null;
  local_code: string | null;
  municipality: string | null;
  country: string;
  region: string | null;
  latitude: number;
  longitude: number;
  elevation_ft: number | null;
  timezone: string;
  keywords: string | null;
};
