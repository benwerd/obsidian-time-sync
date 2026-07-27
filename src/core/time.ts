import { RoundingMode } from "./types";

/**
 * Rounds `rawMinutes` up to the nearest multiple of the given rounding mode.
 * Used both for billed session minutes at stop time and for invoice totals
 * at invoice time — the caller decides which raw quantity gets rounded.
 */
export function roundUpMinutes(rawMinutes: number, mode: RoundingMode): number {
  if (mode === "none") return rawMinutes;
  const increment = parseInt(mode, 10);
  return Math.ceil(rawMinutes / increment) * increment;
}

/** Formats minutes as a compact `1h 30m` / `45m` / `2h` duration string. */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Formats minutes as decimal hours (e.g. `1.5h`), rounded to 2 decimal places. */
export function formatHours(minutes: number): string {
  const rounded = Math.round((minutes / 60) * 100) / 100;
  return `${rounded}h`;
}

/** Formats an elapsed duration in milliseconds as an `H:MM:SS` clock string, for the live running-timer display. */
export function formatClock(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${h}:${pad(m)}:${pad(s)}`;
}

/** Formats a Date as a local `YYYY-MM-DD` string (not UTC). */
export function dateStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Formats a Date as a local `HH:MM` string (not UTC). */
export function timeStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
