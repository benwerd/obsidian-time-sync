import { describe, it, expect } from "vitest";
import { roundUpMinutes, formatDuration, formatHours, formatClock, dateStr, timeStr } from "../../src/core/time";

describe("roundUpMinutes", () => {
  it("passes raw minutes through when rounding is off", () => {
    expect(roundUpMinutes(47, "none")).toBe(47);
    expect(roundUpMinutes(0, "none")).toBe(0);
  });

  it("rounds up to the next 30-minute increment", () => {
    expect(roundUpMinutes(1, "30")).toBe(30);
    expect(roundUpMinutes(29, "30")).toBe(30);
    expect(roundUpMinutes(31, "30")).toBe(60);
  });

  it("rounds up to the next 60-minute increment", () => {
    expect(roundUpMinutes(1, "60")).toBe(60);
    expect(roundUpMinutes(61, "60")).toBe(120);
  });

  it("rounds up to the next 6-minute increment", () => {
    expect(roundUpMinutes(1, "6")).toBe(6);
    expect(roundUpMinutes(6, "6")).toBe(6);
    expect(roundUpMinutes(7, "6")).toBe(12);
  });

  it("rounds up to the next 15-minute increment", () => {
    expect(roundUpMinutes(1, "15")).toBe(15);
    expect(roundUpMinutes(15, "15")).toBe(15);
    expect(roundUpMinutes(16, "15")).toBe(30);
  });

  it("does not round exact multiples further", () => {
    expect(roundUpMinutes(30, "30")).toBe(30);
    expect(roundUpMinutes(60, "30")).toBe(60);
    expect(roundUpMinutes(120, "60")).toBe(120);
  });

  it("leaves zero at zero", () => {
    expect(roundUpMinutes(0, "30")).toBe(0);
    expect(roundUpMinutes(0, "60")).toBe(0);
  });
});

describe("formatDuration", () => {
  it("formats minutes only", () => expect(formatDuration(45)).toBe("45m"));
  it("formats whole hours", () => expect(formatDuration(120)).toBe("2h"));
  it("formats hours and minutes", () => expect(formatDuration(75)).toBe("1h 15m"));
  it("formats zero", () => expect(formatDuration(0)).toBe("0m"));
});

describe("formatHours", () => {
  it("formats decimal hours", () => expect(formatHours(90)).toBe("1.5h"));
  it("trims trailing zeros", () => expect(formatHours(120)).toBe("2h"));
  it("rounds to two decimals", () => expect(formatHours(50)).toBe("0.83h"));
});

describe("formatClock", () => {
  it("formats h:mm:ss", () => expect(formatClock(3_723_000)).toBe("1:02:03"));
  it("formats zero", () => expect(formatClock(0)).toBe("0:00:00"));
});

describe("date helpers", () => {
  const d = new Date(2026, 6, 27, 9, 5); // July 27 2026, 09:05 local
  it("dateStr is YYYY-MM-DD", () => expect(dateStr(d)).toBe("2026-07-27"));
  it("timeStr is HH:MM", () => expect(timeStr(d)).toBe("09:05"));
});
