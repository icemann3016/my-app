// Reading METAR and TAF text (ICAO format, as used in Europe) for what matters to VFR flight:
// visibility and ceiling. Pure functions; see lib/weather/index.ts for fetching.

/** Conditions in one report or forecast period; undefined = not given there. */
export type Conditions = {
  /** Metres; 10 000 = 10 km or more (9999, CAVOK). */
  visibilityM?: number;
  /** Feet above ground of the lowest BKN/OVC layer or vertical visibility; null = no ceiling. */
  ceilingFt?: number | null;
};

const CLOUD = /^(FEW|SCT|BKN|OVC)(\d{3})(CB|TCU|\/\/\/)?$/;
const VV = /^VV(\d{3}|\/\/\/)$/;

/** Visibility and ceiling from the groups of one METAR or TAF period. */
export function readConditions(tokens: string[]): Conditions {
  const c: Conditions = {};
  let clouds = false;
  for (const tok of tokens) {
    if (tok === "CAVOK") {
      c.visibilityM = 10_000;
      c.ceilingFt = null;
      clouds = true;
    } else if (/^\d{4}$/.test(tok) && c.visibilityM === undefined) {
      const v = Number(tok);
      c.visibilityM = v === 9999 ? 10_000 : v;
    } else if (/^(\d+)?(\d\/\d)?SM$/.test(tok) || /^P?\d+SM$/.test(tok)) {
      // Statute miles (rare in Europe): 1 SM = 1609 m.
      const m = tok.match(/^P?(\d+)?(?:(\d)\/(\d))?SM$/)!;
      const miles = Number(m[1] ?? 0) + (m[2] ? Number(m[2]) / Number(m[3]) : 0);
      c.visibilityM = Math.min(10_000, Math.round(miles * 1609));
    } else if (tok === "NSC" || tok === "NCD" || tok === "SKC" || tok === "CLR") {
      clouds = true;
      if (c.ceilingFt === undefined) c.ceilingFt = null;
    } else if (VV.test(tok)) {
      const h = tok.slice(2);
      const ft = h === "///" ? 0 : Number(h) * 100;
      c.ceilingFt = c.ceilingFt == null ? ft : Math.min(c.ceilingFt, ft);
      clouds = true;
    } else {
      const m = tok.match(CLOUD);
      if (m) {
        clouds = true;
        if (c.ceilingFt === undefined) c.ceilingFt = null;
        if (m[1] === "BKN" || m[1] === "OVC") {
          const ft = Number(m[2]) * 100;
          c.ceilingFt = c.ceilingFt == null ? ft : Math.min(c.ceilingFt, ft);
        }
      }
    }
  }
  if (!clouds) delete c.ceilingFt;
  return c;
}

/** EASA VFR minima used for warnings: visibility < 5 km or ceiling below 1 500 ft. */
export const VFR_MIN_VISIBILITY_M = 5000;
export const VFR_MIN_CEILING_FT = 1500;

export function belowVfr(c: Conditions): boolean {
  return (
    (c.visibilityM !== undefined && c.visibilityM < VFR_MIN_VISIBILITY_M) ||
    (c.ceilingFt != null && c.ceilingFt < VFR_MIN_CEILING_FT)
  );
}

/** A METAR's conditions (the remarks and trend after RMK/BECMG/TEMPO/NOSIG are ignored). */
export function parseMetar(raw: string): Conditions {
  const tokens = raw.trim().split(/\s+/);
  const end = tokens.findIndex((t) => ["RMK", "BECMG", "TEMPO", "NOSIG"].includes(t));
  return readConditions(end === -1 ? tokens : tokens.slice(0, end));
}

export type TafPeriod = Conditions & {
  from: Date;
  to: Date;
  /** How sure: the main forecast, a lasting change, or only temporary / possible. */
  kind: "base" | "from" | "becoming" | "temporary" | "probable";
  probability?: number;
};

/** Day/hour groups like 2912 or 2912/2918 → dates in the month of `issued`. */
function dayHour(dd: string, hh: string, issued: Date): Date {
  const d = new Date(
    Date.UTC(issued.getUTCFullYear(), issued.getUTCMonth(), Number(dd), Number(hh)),
  );
  // A day far before the issue day belongs to the next month (e.g. issued 31st, valid 01st).
  if (d.getTime() < issued.getTime() - 5 * 86_400_000) d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

const RANGE = /^(\d{2})(\d{2})\/(\d{2})(\d{2})$/;

/**
 * The periods of a TAF, each with its time window. The base forecast lasts until the first
 * FM group; FM changes last until the next FM; BECMG changes apply from their start to the end
 * of the TAF; TEMPO and PROB are their own windows. `issued` is when the TAF was issued.
 */
export function parseTaf(raw: string, issued: Date): TafPeriod[] {
  const tokens = raw
    .trim()
    .replace(/=$/, "")
    .split(/\s+/)
    .filter((t) => !["TAF", "AMD", "COR"].includes(t));
  const validIdx = tokens.findIndex((t) => RANGE.test(t));
  if (validIdx === -1) return [];
  const [, d1, h1, d2, h2] = tokens[validIdx]!.match(RANGE)!;
  const validFrom = dayHour(d1!, h1!, issued);
  const validTo = dayHour(d2!, h2!, issued);
  if (validTo <= validFrom) validTo.setUTCMonth(validTo.getUTCMonth() + 1);

  type Raw = {
    kind: TafPeriod["kind"];
    from: Date;
    to?: Date;
    probability?: number;
    tokens: string[];
  };
  const periods: Raw[] = [{ kind: "base", from: validFrom, tokens: [] }];
  const rest = tokens.slice(validIdx + 1);
  for (let i = 0; i < rest.length; i++) {
    const tok = rest[i]!;
    const fm = tok.match(/^FM(\d{2})(\d{2})(\d{2})$/);
    const prob = tok.match(/^PROB(\d{2})$/);
    if (fm) {
      periods.push({ kind: "from", from: dayHour(fm[1]!, fm[2]!, issued), tokens: [] });
    } else if ((tok === "BECMG" || tok === "TEMPO" || prob) && RANGE.test(rest[i + 1] ?? "")) {
      const [, a, b, c, d] = rest[i + 1]!.match(RANGE)!;
      periods.push({
        kind: tok === "BECMG" ? "becoming" : prob ? "probable" : "temporary",
        probability: prob ? Number(prob[1]) : undefined,
        from: dayHour(a!, b!, issued),
        to: dayHour(c!, d!, issued),
        tokens: [],
      });
      i += 1;
    } else if (prob && rest[i + 1] === "TEMPO" && RANGE.test(rest[i + 2] ?? "")) {
      const [, a, b, c, d] = rest[i + 2]!.match(RANGE)!;
      periods.push({
        kind: "probable",
        probability: Number(prob[1]),
        from: dayHour(a!, b!, issued),
        to: dayHour(c!, d!, issued),
        tokens: [],
      });
      i += 2;
    } else {
      periods.at(-1)!.tokens.push(tok);
    }
  }
  // Base and FM periods end where the next FM begins (or at the end of the TAF).
  const fms = periods.filter((p) => p.kind === "base" || p.kind === "from");
  fms.forEach((p, i) => (p.to = fms[i + 1]?.from ?? validTo));
  return periods.map((p) => ({
    kind: p.kind,
    probability: p.probability,
    from: p.from,
    to: p.kind === "becoming" ? validTo : p.to!,
    ...readConditions(p.tokens),
  }));
}

/** Periods of a TAF that overlap [from, to) and are below VFR minima. */
export function tafWarnings(periods: TafPeriod[], from: Date, to: Date): TafPeriod[] {
  return periods.filter((p) => p.from < to && p.to > from && belowVfr(p));
}
