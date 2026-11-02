import { describe, expect, it } from "vitest";
import {
  cleanBody,
  DAY_TARGET,
  groupByTarget,
  isMealKey,
  targetLabel,
  toMealKey,
  type Feedback,
} from "@/lib/feedback";

function fb(partial: Partial<Feedback>): Feedback {
  return {
    id: "id",
    coach_id: "coach",
    client_id: "client",
    date: "2026-11-02",
    meal_key: null,
    body: "טוב מאוד",
    ...partial,
  };
}

describe("feedback — targets", () => {
  it("labels the whole day for null and the day sentinel", () => {
    expect(targetLabel(null)).toBe("היום");
    expect(targetLabel(DAY_TARGET)).toBe("היום");
  });

  it("labels a known meal slot in Hebrew", () => {
    expect(targetLabel("breakfast")).toBe("בוקר");
    expect(targetLabel("notes")).toBe("תחושות, רעב ושובע");
  });

  it("falls back to the raw key for an unknown slot", () => {
    expect(targetLabel("brunch")).toBe("brunch");
  });

  it("recognizes only real meal keys", () => {
    expect(isMealKey("lunch")).toBe(true);
    expect(isMealKey("brunch")).toBe(false);
    expect(isMealKey(DAY_TARGET)).toBe(false);
  });

  it("normalizes a UI target into a stored meal_key", () => {
    expect(toMealKey(DAY_TARGET)).toBeNull();
    expect(toMealKey(null)).toBeNull();
    expect(toMealKey("dinner")).toBe("dinner");
    expect(toMealKey("brunch")).toBeNull();
  });
});

describe("feedback — cleanBody", () => {
  it("trims and keeps real content", () => {
    expect(cleanBody("  מעולה  ")).toBe("מעולה");
  });

  it("returns null for empty / whitespace / nullish", () => {
    expect(cleanBody("")).toBeNull();
    expect(cleanBody("   ")).toBeNull();
    expect(cleanBody(null)).toBeNull();
    expect(cleanBody(undefined)).toBeNull();
  });
});

describe("feedback — groupByTarget", () => {
  it("buckets whole-day notes under the day sentinel and meals by key", () => {
    const rows = [
      fb({ id: "1", meal_key: null }),
      fb({ id: "2", meal_key: "breakfast" }),
      fb({ id: "3", meal_key: "breakfast" }),
      fb({ id: "4", meal_key: "dinner" }),
    ];
    const grouped = groupByTarget(rows);
    expect(grouped[DAY_TARGET].map((r) => r.id)).toEqual(["1"]);
    expect(grouped.breakfast.map((r) => r.id)).toEqual(["2", "3"]);
    expect(grouped.dinner.map((r) => r.id)).toEqual(["4"]);
    expect(grouped.lunch).toBeUndefined();
  });

  it("returns an empty object for no rows", () => {
    expect(groupByTarget([])).toEqual({});
  });
});
