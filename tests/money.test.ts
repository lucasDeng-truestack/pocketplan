import { describe, expect, it } from "vitest";
import { formatSen, formatSenPlain, parseSen } from "../src/lib/money";
import { addDays, formatRange, isISODate } from "../src/lib/dates";

describe("parseSen", () => {
  it("parses whole, 1dp, 2dp and thousands", () => {
    expect(parseSen("12")).toBe(1200);
    expect(parseSen("12.5")).toBe(1250);
    expect(parseSen("12.50")).toBe(1250);
    expect(parseSen("1,250.00")).toBe(125000);
    expect(parseSen(" RM 0.05 ")).toBe(5);
  });
  it("rejects bad input", () => {
    for (const bad of ["", "-1", "1.234", "abc", "1e3", "0x10", "."]) expect(parseSen(bad)).toBeNull();
  });
});

describe("formatSen", () => {
  it("formats", () => {
    expect(formatSen(123456)).toBe("RM 1,234.56");
    expect(formatSen(5)).toBe("RM 0.05");
    expect(formatSen(0)).toBe("RM 0.00");
    expect(formatSen(-1200)).toBe("−RM 12.00");
  });
  it("throws on floats", () => {
    expect(() => formatSen(1.5)).toThrow();
  });
});

describe("formatSenPlain", () => {
  it("formats without the RM prefix and reads back through parseSen", () => {
    expect(formatSenPlain(123456)).toBe("1,234.56");
    expect(formatSenPlain(5)).toBe("0.05");
    expect(formatSenPlain(0)).toBe("0.00");
    expect(formatSenPlain(-1200)).toBe("−12.00");
    for (const sen of [1, 99, 100, 60000, 123456789]) expect(parseSen(formatSenPlain(sen))).toBe(sen);
  });
  it("throws on floats", () => {
    expect(() => formatSenPlain(1.5)).toThrow();
  });
});

describe("dates", () => {
  it("validates and does calendar arithmetic", () => {
    expect(isISODate("2026-02-29")).toBe(false);
    expect(isISODate("2024-02-29")).toBe(true);
    expect(addDays("2026-11-01", -1)).toBe("2026-10-31");
    expect(formatRange("2026-11-01", "2026-11-30")).toBe("1–30 Nov 2026");
  });
});
