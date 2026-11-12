import { decOdds, fmtO } from "./nba";

export type OddsFormat = "decimal" | "american";

/** All odds are stored internally as American; this is display / input only. */
export function fmtOdds(american: number, format: OddsFormat): string {
  return format === "decimal" ? decOdds(american).toFixed(2) : fmtO(american);
}

export function decimalToAmerican(dec: number): number {
  return dec >= 2 ? Math.round((dec - 1) * 100) : Math.round(-100 / (dec - 1));
}

/** Parse what the user typed in the current format into American odds (null if invalid). */
export function parseOdds(text: string, format: OddsFormat): number | null {
  const n = parseFloat(text);
  if (isNaN(n)) return null;
  if (format === "decimal") return n > 1 ? decimalToAmerican(n) : null;
  return Math.abs(n) >= 100 ? Math.round(n) : null;
}
