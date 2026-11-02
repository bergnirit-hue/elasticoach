import { describe, expect, it } from "vitest";
import { currentStreak, longestStreak } from "@/lib/streak";

describe("currentStreak", () => {
  it("counts consecutive days ending today", () => {
    const met = new Set(["2026-11-01", "2026-10-31", "2026-10-30"]);
    expect(currentStreak(met, "2026-11-01")).toBe(3);
  });

  it("treats an unlogged today as in-progress (counts from yesterday)", () => {
    const met = new Set(["2026-10-31", "2026-10-30"]);
    expect(currentStreak(met, "2026-11-01")).toBe(2);
  });

  it("breaks on a gap", () => {
    const met = new Set(["2026-11-01", "2026-10-29"]);
    expect(currentStreak(met, "2026-11-01")).toBe(1);
  });

  it("is zero when neither today nor yesterday is met", () => {
    const met = new Set(["2026-10-20"]);
    expect(currentStreak(met, "2026-11-01")).toBe(0);
  });
});

describe("longestStreak", () => {
  it("finds the longest run in range", () => {
    const met = new Set([
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-05",
      "2026-10-06",
    ]);
    expect(longestStreak(met, "2026-10-01", "2026-10-07")).toBe(3);
  });

  it("is zero on an empty set", () => {
    expect(longestStreak(new Set(), "2026-10-01", "2026-10-07")).toBe(0);
  });
});
