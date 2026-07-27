import { describe, it, expect } from "vitest";
import { parseFrontmatter, setFrontmatterFields, createProjectFile, appendSession, appendInvoice, dailyLogLine, sanitizeProjectName } from "../../src/core/markdown";
import { Session } from "../../src/core/types";

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

const session: Session = {
  date: "2026-07-27",
  start: "09:00",
  end: "10:15",
  rawMinutes: 75,
  billedMinutes: 90,
  note: "Wrote docs",
};

describe("createProjectFile", () => {
  it("has frontmatter, title, Sessions table, and Invoices section", () => {
    const out = createProjectFile("ProjectX", "2026-07-27");
    expect(parseFrontmatter(out)).toEqual({
      uninvoiced_minutes: "0",
      created: "2026-07-27",
    });
    expect(out).toContain("# ProjectX");
    expect(out).toContain("| Date | Start | End | Raw | Billed | Note |");
    expect(out).toContain("## Invoices");
  });
});

describe("appendSession", () => {
  it("appends a row to the Sessions table, before Invoices", () => {
    const out = appendSession(createProjectFile("P", "2026-07-27"), session);
    const row = "| 2026-07-27 | 09:00 | 10:15 | 1h 15m | 1h 30m | Wrote docs |";
    expect(out).toContain(row);
    expect(out.indexOf(row)).toBeLessThan(out.indexOf("## Invoices"));
  });

  it("keeps rows in insertion order", () => {
    const second: Session = { ...session, start: "11:00", end: "11:30", rawMinutes: 30, billedMinutes: 30, note: "Second" };
    const out = appendSession(appendSession(createProjectFile("P", "2026-07-27"), session), second);
    expect(out.indexOf("Wrote docs")).toBeLessThan(out.indexOf("Second"));
  });

  it("escapes pipes and newlines in notes", () => {
    const out = appendSession(createProjectFile("P", "2026-07-27"), {
      ...session,
      note: "a|b\nc",
    });
    expect(out).toContain("a\\|b c");
  });

  it("creates the Sessions section if missing", () => {
    const out = appendSession("---\nuninvoiced_minutes: 0\n---\n\n# P\n", session);
    expect(out).toContain("## Sessions");
    expect(out).toContain("| 2026-07-27 | 09:00 |");
  });
});

describe("appendInvoice", () => {
  it("appends an invoice line in order", () => {
    let out = appendInvoice(createProjectFile("P", "2026-07-27"), "2026-07-01", "12.5h");
    out = appendInvoice(out, "2026-07-27", "3h");
    expect(out).toContain("- 2026-07-01: 12.5h");
    expect(out).toContain("- 2026-07-27: 3h");
    expect(out.indexOf("2026-07-01")).toBeLessThan(out.indexOf("- 2026-07-27: 3h"));
  });

  it("creates the Invoices section if missing", () => {
    const out = appendInvoice("# P\n", "2026-07-27", "1h");
    expect(out).toContain("## Invoices");
    expect(out).toContain("- 2026-07-27: 1h");
  });
});

describe("dailyLogLine", () => {
  it("includes times, durations, and note", () => {
    expect(dailyLogLine(session)).toBe("- 09:00–10:15 (raw 1h 15m, billed 1.5h) — Wrote docs");
  });

  it("omits the note dash when note is empty", () => {
    expect(dailyLogLine({ ...session, note: "" })).toBe("- 09:00–10:15 (raw 1h 15m, billed 1.5h)");
  });
});

describe("sanitizeProjectName", () => {
  it("strips filesystem/Obsidian-unsafe characters", () => {
    expect(sanitizeProjectName('A/B:C#D^E[F]G|H?I*J\\K')).toBe("ABCDEFGHIJK");
  });
  it("trims whitespace", () => {
    expect(sanitizeProjectName("  ProjectX  ")).toBe("ProjectX");
  });
});
