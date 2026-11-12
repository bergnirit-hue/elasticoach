import { describe, expect, it } from "vitest";
import {
  normalizeCircumferences,
  parseMeasureInput,
  weightDeltas,
} from "@/app/(app)/me/measures";
import { clampWater, waterPercent } from "@/app/(app)/me/water";

const blank = {
  weight: "",
  bodyFatPct: "",
  musclePct: "",
  circumferences: {},
};

describe("parseMeasureInput", () => {
  it("parses numbers, accepting a decimal comma", () => {
    const r = parseMeasureInput({
      ...blank,
      weight: "71,5",
      bodyFatPct: "28",
      circumferences: { waist: "80", hips: "" },
    });
    expect(r).toEqual({
      ok: true,
      values: {
        weight: 71.5,
        body_fat_pct: 28,
        muscle_pct: null,
        circumferences: { waist: 80 },
      },
    });
  });

  it("requires at least one value", () => {
    expect(parseMeasureInput(blank).ok).toBe(false);
  });

  it("rejects out-of-range and non-numeric values", () => {
    expect(parseMeasureInput({ ...blank, weight: "5" }).ok).toBe(false);
    expect(parseMeasureInput({ ...blank, weight: "abc" }).ok).toBe(false);
    expect(parseMeasureInput({ ...blank, bodyFatPct: "120" }).ok).toBe(false);
    expect(
      parseMeasureInput({ ...blank, circumferences: { waist: "1000" } }).ok,
    ).toBe(false);
  });
});

describe("normalizeCircumferences", () => {
  it("keeps only known numeric keys", () => {
    expect(
      normalizeCircumferences({ waist: 80, hips: "x", bogus: 3 }),
    ).toEqual({ waist: 80 });
    expect(normalizeCircumferences(null)).toEqual({});
  });
});

describe("weightDeltas", () => {
  it("compares against the previous entry that has a weight", () => {
    const d = weightDeltas([
      { date: "2026-11-02", weight: 70 },
      { date: "2026-10-26", weight: null },
      { date: "2026-10-19", weight: 71.2 },
      { date: "2026-10-12", weight: 72 },
    ]);
    expect(d.get("2026-11-02")).toBe(-1.2);
    expect(d.get("2026-10-26")).toBeNull();
    expect(d.get("2026-10-19")).toBe(-0.8);
    expect(d.get("2026-10-12")).toBeNull();
  });
});

describe("water", () => {
  it("clamps and computes percent", () => {
    expect(clampWater(-5)).toBe(0);
    expect(clampWater(99999)).toBe(20000);
    expect(clampWater(NaN)).toBe(0);
    expect(waterPercent(1000, 2000)).toBe(50);
    expect(waterPercent(3000, 2000)).toBe(100);
    expect(waterPercent(500, 0)).toBe(0);
  });
});
