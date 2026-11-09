import { describe, expect, it } from "vitest";
import { addMonths, daysBetween, daysInMonth, normalizeDate } from "./dates";

describe("dates", () => {
  it("adds months across year ends", () => {
    expect(addMonths("2026-11", 2)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });
  it("knows month lengths", () => {
    expect(daysInMonth("2028-02")).toBe(29);
    expect(daysInMonth("2026-02")).toBe(28);
  });
  it("counts days between dates", () => {
    expect(daysBetween("2026-11-01", "2026-11-08")).toBe(7);
  });
  it("normalises ISO text and sheet serial numbers", () => {
    expect(normalizeDate("2026-11-05")).toBe("2026-11-05");
    expect(normalizeDate(46331)).toBe("2026-11-05");
    expect(normalizeDate("")).toBe("");
  });
});
