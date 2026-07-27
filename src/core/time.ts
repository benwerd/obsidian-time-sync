import { RoundingMode } from "./types";

export function roundUpMinutes(rawMinutes: number, mode: RoundingMode): number {
  if (mode === "none") return rawMinutes;
  const increment = mode === "30" ? 30 : 60;
  return Math.ceil(rawMinutes / increment) * increment;
}
