import { describe, expect, it } from "vitest";
import { MAX_SEN, formatSen, formatSenPlain, parseSen } from "../src/lib/money";
import { addDays, formatRange, isISODate } from "../src/lib/dates";

describe("parseSen", () => {
  it("parses whole, 1dp, 2dp and thousands", () => {
    expect(parseSen("12")).toBe(1200);
    expect(parseSen("12.5")).toBe(1250);
    expect(parseSen("12.50")).toBe(1250);
    expect(parseSen("20.50")).toBe(2050);
    expect(parseSen("1,250.00")).toBe(125000);
    expect(parseSen("1,000")).toBe(100000);
    expect(parseSen("1,000.50")).toBe(100050);
    expect(parseSen("12,345,678")).toBe(1234567800);
    expect(parseSen(" RM 0.05 ")).toBe(5);
  });
  it("reads a comma followed by 1–2 digits as the decimal point", () => {
    expect(parseSen("20,50")).toBe(2050); // the bug: this used to save RM 2,050.00
    expect(parseSen("20,5")).toBe(2050);
    expect(parseSen("0,99")).toBe(99);
  });
  it("parses zero (senSchema then refuses it as not positive)", () => {
    expect(parseSen("0")).toBe(0);
    expect(parseSen("0.00")).toBe(0);
  });
  it("accepts up to MAX_SEN and no further", () => {
    expect(parseSen("21,474,836.47")).toBe(MAX_SEN);
    expect(parseSen("21474836.48")).toBeNull();
    expect(parseSen("99999999999999999999")).toBeNull();
  });
  it("rejects bad input, never silently dropping a comma", () => {
    for (const bad of ["", "-1", "-12.50", "−5", "1.234", "12.345", "abc", "12a", "1e3", "1E3", "0x10", ".", ",", "12,", ",50",
      "12,345.678", "1,00,000", "12,34,5", "1.000,50", "1,0000", "12 50", "Infinity", "NaN"]) {
      expect(parseSen(bad), bad).toBeNull();
    }
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
