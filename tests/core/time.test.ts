import { describe, it, expect } from "vitest";
import { roundUpMinutes } from "../../src/core/time";

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
