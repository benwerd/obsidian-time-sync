import { describe, it, expect } from "vitest";
import { parseFrontmatter, setFrontmatterFields, createProjectFile, createDailyFile, appendDailySession, appendInvoice, sanitizeProjectName, invoiceHoursLabel } from "../../src/core/markdown";
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

  it("preserves list-valued frontmatter fields on update", () => {
    const withTags = `---\nuninvoiced_minutes: 90\ntags:\n  - client-a\n  - billable\ncreated: 2026-06-15\n---\n\n# P\n`;
    const out = setFrontmatterFields(withTags, { uninvoiced_minutes: 120 });
    expect(out).toContain("  - client-a");
    expect(out).toContain("  - billable");
    expect(parseFrontmatter(out)["uninvoiced_minutes"]).toBe("120");
    expect(parseFrontmatter(out)["created"]).toBe("2026-06-15");
  });

  it("updates CRLF files in place without duplicating frontmatter", () => {
    const crlf = "---\r\nuninvoiced_minutes: 90\r\ncreated: 2026-06-15\r\n---\r\n\r\n# ProjectX\r\n";
    const out = setFrontmatterFields(crlf, { uninvoiced_minutes: 120 });
    expect(out.match(/^---/gm)!.length).toBe(2); // exactly one frontmatter block
    expect(parseFrontmatter(out)["uninvoiced_minutes"]).toBe("120");
    expect(out).toContain("# ProjectX");
  });

  it("does not misparse indented continuation lines as keys", () => {
    const withTags = `---\ntags:\n  - a:b\n---\n\nbody\n`;
    expect(parseFrontmatter(withTags)).toEqual({ tags: "" });
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
  it("has frontmatter, title, and Invoices section, but no Sessions table", () => {
    const out = createProjectFile("ProjectX", "2026-07-27");
    expect(parseFrontmatter(out)).toEqual({
      uninvoiced_minutes: "0",
      created: "2026-07-27",
    });
    expect(out).toContain("# ProjectX");
    expect(out).toContain("## Invoices");
    expect(out).not.toContain("## Sessions");
  });
});

describe("createDailyFile", () => {
  it("has a date heading and a table with the session row", () => {
    const out = createDailyFile("2026-07-27", session);
    expect(out).toContain("# 2026-07-27");
    expect(out).toContain("| Start | End | Raw | Billed | Note |");
    expect(out).toContain("| 09:00 | 10:15 | 1h 15m | 1h 30m | Wrote docs |");
  });
});

describe("appendDailySession", () => {
  it("appends a row to the existing table in order", () => {
    const second: Session = { ...session, start: "11:00", end: "11:30", rawMinutes: 30, billedMinutes: 30, note: "Second" };
    const out = appendDailySession(createDailyFile("2026-07-27", session), second);
    expect(out).toContain("| 11:00 | 11:30 | 30m | 30m | Second |");
    expect(out.indexOf("Wrote docs")).toBeLessThan(out.indexOf("Second"));
  });

  it("escapes pipes and newlines in notes", () => {
    const out = appendDailySession(createDailyFile("2026-07-27", session), { ...session, note: "a|b\nc" });
    expect(out).toContain("a\\|b c");
  });

  it("creates a table when the file has none", () => {
    const out = appendDailySession("# 2026-07-27\n\nsome hand-written notes\n", session);
    expect(out).toContain("| Start | End | Raw | Billed | Note |");
    expect(out).toContain("| 09:00 | 10:15 |");
    expect(out.indexOf("hand-written notes")).toBeLessThan(out.indexOf("| Start |"));
  });

  it("appends after the last table row even with prose below the table", () => {
    const withProse = createDailyFile("2026-07-27", session) + "\nSome reflections about the day.\n";
    const second: Session = { ...session, start: "11:00", end: "11:30", note: "" };
    const out = appendDailySession(withProse, second);
    expect(out.indexOf("| 11:00 |")).toBeLessThan(out.indexOf("Some reflections"));
  });

  it("does not append into an unrelated hand-added table", () => {
    const withExpenses =
      createDailyFile("2026-07-27", session) +
      "\n## Expenses\n\n| Item | Cost |\n| ---- | ---- |\n| Coffee | $4 |\n";
    const second: Session = { ...session, start: "11:00", end: "11:30", note: "Second" };
    const out = appendDailySession(withExpenses, second);
    expect(out.indexOf("| 11:00 |")).toBeLessThan(out.indexOf("## Expenses"));
    expect(out).toContain("| Coffee | $4 |\n");
  });

  it("stops at an adjacent unrelated table with no blank line between", () => {
    const adjacent =
      createDailyFile("2026-07-27", session) + "| Item | Cost |\n| ---- | ---- |\n| Coffee | $4 |\n";
    const second: Session = { ...session, start: "11:00", end: "11:30", note: "Second" };
    const out = appendDailySession(adjacent, second);
    expect(out.indexOf("| 11:00 |")).toBeLessThan(out.indexOf("| Item | Cost |"));
    expect(out).toContain("| Coffee | $4 |");
  });

  it("still appends rows whose notes contain escaped pipes", () => {
    const withEscaped = appendDailySession(createDailyFile("2026-07-27", session), {
      ...session,
      start: "11:00",
      end: "11:30",
      note: "a|b",
    });
    const third: Session = { ...session, start: "13:00", end: "13:30", note: "Third" };
    const out = appendDailySession(withEscaped, third);
    expect(out.indexOf("a\\|b")).toBeLessThan(out.indexOf("| 13:00 |"));
  });

  it("ignores pipe-prefixed lines inside code fences", () => {
    const withFence =
      "# 2026-07-27\n\n```\n| not | a | table |\n```\n\n" +
      "| Start | End | Raw | Billed | Note |\n| ----- | --- | --- | ------ | ---- |\n| 09:00 | 10:15 | 1h 15m | 1h 30m | Wrote docs |\n";
    const second: Session = { ...session, start: "11:00", end: "11:30", note: "Second" };
    const out = appendDailySession(withFence, second);
    expect(out.indexOf("| 11:00 |")).toBeGreaterThan(out.indexOf("Wrote docs"));
    expect(out.indexOf("| 11:00 |")).toBeLessThan(out.length);
    expect(out).not.toMatch(/```\n\| not \| a \| table \|\n\| 11:00/);
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

describe("sanitizeProjectName", () => {
  it("strips filesystem/Obsidian-unsafe characters", () => {
    expect(sanitizeProjectName('A/B:C#D^E[F]G|H?I*J\\K')).toBe("ABCDEFGHIJK");
  });
  it("trims whitespace", () => {
    expect(sanitizeProjectName("  ProjectX  ")).toBe("ProjectX");
  });
});

describe("invoiceHoursLabel", () => {
  it("shows just the hours when no rounding happened", () => {
    expect(invoiceHoursLabel(90, 90)).toBe("1.5h");
  });
  it("shows billed hours with raw in parens when rounding happened", () => {
    expect(invoiceHoursLabel(156, 180)).toBe("3h (raw 2.6h)");
  });
});
