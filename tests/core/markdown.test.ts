import { describe, it, expect } from "vitest";
import { parseFrontmatter, setFrontmatterFields } from "../../src/core/markdown";

const SAMPLE = `---
uninvoiced_minutes: 90
created: 2026-06-15
---

# ProjectX

body text
`;

describe("parseFrontmatter", () => {
  it("parses key: value pairs", () => {
    expect(parseFrontmatter(SAMPLE)).toEqual({
      uninvoiced_minutes: "90",
      created: "2026-06-15",
    });
  });

  it("returns empty object when no frontmatter", () => {
    expect(parseFrontmatter("# Just a note\n")).toEqual({});
  });
});

describe("setFrontmatterFields", () => {
  it("updates an existing field, preserving others and the body", () => {
    const out = setFrontmatterFields(SAMPLE, { uninvoiced_minutes: 120 });
    expect(parseFrontmatter(out)).toEqual({
      uninvoiced_minutes: "120",
      created: "2026-06-15",
    });
    expect(out).toContain("# ProjectX");
    expect(out).toContain("body text");
  });

  it("adds a new field", () => {
    const out = setFrontmatterFields(SAMPLE, { last_invoice: "2026-07-27" });
    expect(parseFrontmatter(out)["last_invoice"]).toBe("2026-07-27");
  });

  it("creates frontmatter when the file has none", () => {
    const out = setFrontmatterFields("# Bare note\n", { uninvoiced_minutes: 0 });
    expect(parseFrontmatter(out)).toEqual({ uninvoiced_minutes: "0" });
    expect(out).toContain("# Bare note");
  });
});
