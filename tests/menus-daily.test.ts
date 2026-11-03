import { describe, expect, it } from "vitest";
import { buildDailyPlan, isAllowedPick } from "@/lib/menus/daily";
import type { AvailabilityMenu } from "@/lib/menus/availability";
import type { Meal, MealType } from "@/lib/menus/types";

// ---------------------------------------------------------------------------
// Fixtures. The meal library has a few same-type meals (three breakfasts, two
// snacks) so cross-menu swap has something to offer; the rest are one-per-type.
// ---------------------------------------------------------------------------
const meal = (id: string, type: MealType, text: string): Meal => ({
  id,
  type,
  text,
});

const MEALS: Meal[] = [
  meal("b1", "breakfast", "חביתה"),
  meal("b2", "breakfast", "שקשוקה"),
  meal("b3", "breakfast", "פנקייק"),
  meal("lc1", "lunch-carb", "אורז מלא"),
  meal("lp1", "lunch-protein", "חזה עוף"),
  meal("d1", "dinner", "סלט גדול"),
  meal("sn1", "snack", "יוגורט"),
  meal("sn2", "snack", "פרי"),
];

// M1 is a full day; M2/M3 are partial (publish later menus that only touch some
// meal types) — this is what makes the "union base plan must stay complete" case
// meaningful.
const M1: AvailabilityMenu = {
  id: "m1",
  publishDate: "2026-11-02",
  mealIds: ["b1", "lc1", "lp1", "d1", "sn1"],
};
const M2: AvailabilityMenu = {
  id: "m2",
  publishDate: "2026-11-09",
  mealIds: ["b2", "sn2"],
};
const M3: AvailabilityMenu = {
  id: "m3",
  publishDate: "2026-11-16",
  mealIds: ["b3"],
};
const MENUS = [M3, M1, M2]; // deliberately unordered

/** Compact view of a plan for easy assertions: type → [shownId, ...altIds]. */
function shape(plan: ReturnType<typeof buildDailyPlan>) {
  return plan.slots.map((s) => ({
    type: s.type,
    meal: s.meal.id,
    picked: s.picked,
    alternatives: s.alternatives.map((m) => m.id),
  }));
}

describe("daily plan — fixed", () => {
  const plan = buildDailyPlan({
    policy: "fixed",
    menus: MENUS,
    meals: MEALS,
    date: "2026-11-05", // only M1 published
  });

  it("shows the one active menu's meals, one per type", () => {
    expect(plan.primaryMenuId).toBe("m1");
    expect(shape(plan)).toEqual([
      { type: "breakfast", meal: "b1", picked: false, alternatives: [] },
      { type: "lunch-carb", meal: "lc1", picked: false, alternatives: [] },
      { type: "lunch-protein", meal: "lp1", picked: false, alternatives: [] },
      { type: "dinner", meal: "d1", picked: false, alternatives: [] },
      { type: "snack", meal: "sn1", picked: false, alternatives: [] },
    ]);
  });

  it("hides swap entirely (swapEnabled false, no alternatives)", () => {
    expect(plan.swapEnabled).toBe(false);
    expect(plan.slots.every((s) => s.alternatives.length === 0)).toBe(true);
  });
});

describe("daily plan — fixed never swaps, even with two same-type meals", () => {
  // A fixed menu that happens to hold two breakfasts: swap must STILL be hidden,
  // and a stale saved pick must be ignored.
  const MFIX: AvailabilityMenu = {
    id: "mf",
    publishDate: "2026-11-02",
    mealIds: ["b1", "b2", "lc1"],
  };
  const plan = buildDailyPlan({
    policy: "fixed",
    menus: [MFIX],
    meals: MEALS,
    date: "2026-11-05",
    picks: { breakfast: "b2" },
  });

  it("keeps the base meal and offers no alternatives", () => {
    expect(plan.swapEnabled).toBe(false);
    const breakfast = plan.slots.find((s) => s.type === "breakfast")!;
    expect(breakfast.meal.id).toBe("b1");
    expect(breakfast.picked).toBe(false);
    expect(breakfast.alternatives).toEqual([]);
  });
});

describe("daily plan — rotating", () => {
  it("shows the current week's menu and enables swap", () => {
    const plan = buildDailyPlan({
      policy: "rotating",
      menus: MENUS,
      meals: MEALS,
      date: "2026-11-02", // week 0 → M1
    });
    expect(plan.primaryMenuId).toBe("m1");
    expect(plan.swapEnabled).toBe(true);
    // Only M1 is active, so there are no same-type alternatives to offer.
    expect(plan.slots.every((s) => s.alternatives.length === 0)).toBe(true);
    expect(plan.slots.map((s) => s.meal.id)).toEqual([
      "b1",
      "lc1",
      "lp1",
      "d1",
      "sn1",
    ]);
  });

  it("offers alternatives from within the active rotation menu", () => {
    const MROT: AvailabilityMenu = {
      id: "mr",
      publishDate: "2026-11-02",
      mealIds: ["b1", "b2"], // two breakfasts in the one active menu
    };
    const plan = buildDailyPlan({
      policy: "rotating",
      menus: [MROT],
      meals: MEALS,
      date: "2026-11-02",
    });
    const breakfast = plan.slots.find((s) => s.type === "breakfast")!;
    expect(breakfast.meal.id).toBe("b1");
    expect(breakfast.alternatives.map((m) => m.id)).toEqual(["b2"]);
  });
});

describe("daily plan — cumulative", () => {
  const plan = buildDailyPlan({
    policy: "cumulative",
    menus: MENUS,
    meals: MEALS,
    date: "2026-11-10", // M1 + M2 published
  });

  it("features the newest menu but keeps a complete day with cross-menu swap", () => {
    expect(plan.primaryMenuId).toBe("m2");
    expect(plan.swapEnabled).toBe(true);
    expect(shape(plan)).toEqual([
      // newest menu (M2) supplies breakfast+snack; M1 fills the rest
      { type: "breakfast", meal: "b2", picked: false, alternatives: ["b1"] },
      { type: "lunch-carb", meal: "lc1", picked: false, alternatives: [] },
      { type: "lunch-protein", meal: "lp1", picked: false, alternatives: [] },
      { type: "dinner", meal: "d1", picked: false, alternatives: [] },
      { type: "snack", meal: "sn2", picked: false, alternatives: ["sn1"] },
    ]);
  });
});

describe("daily plan — full_pool", () => {
  it("exposes the whole pool regardless of publish date", () => {
    const plan = buildDailyPlan({
      policy: "full_pool",
      menus: MENUS,
      meals: MEALS,
      date: "2026-11-01", // before every publish date
    });
    expect(plan.swapEnabled).toBe(true);
    expect(plan.primaryMenuId).toBe("m3"); // newest published
    expect(shape(plan)).toEqual([
      { type: "breakfast", meal: "b3", picked: false, alternatives: ["b1", "b2"] },
      { type: "lunch-carb", meal: "lc1", picked: false, alternatives: [] },
      { type: "lunch-protein", meal: "lp1", picked: false, alternatives: [] },
      { type: "dinner", meal: "d1", picked: false, alternatives: [] },
      { type: "snack", meal: "sn2", picked: false, alternatives: ["sn1"] },
    ]);
  });
});

describe("daily plan — saved picks (days.menu_picks)", () => {
  const base = {
    policy: "cumulative" as const,
    menus: MENUS,
    meals: MEALS,
    date: "2026-11-10",
  };

  it("applies a valid pick, marks it, and drops it from its own alternatives", () => {
    const plan = buildDailyPlan({ ...base, picks: { breakfast: "b1" } });
    const breakfast = plan.slots.find((s) => s.type === "breakfast")!;
    expect(breakfast.meal.id).toBe("b1");
    expect(breakfast.picked).toBe(true);
    expect(breakfast.alternatives.map((m) => m.id)).toEqual(["b2"]);
  });

  it("ignores a pick that is not an available meal", () => {
    const plan = buildDailyPlan({ ...base, picks: { breakfast: "nope" } });
    const breakfast = plan.slots.find((s) => s.type === "breakfast")!;
    expect(breakfast.meal.id).toBe("b2"); // falls back to base
    expect(breakfast.picked).toBe(false);
  });

  it("ignores a pick whose meal is the wrong type for the slot", () => {
    const plan = buildDailyPlan({ ...base, picks: { "lunch-carb": "b1" } });
    const lunch = plan.slots.find((s) => s.type === "lunch-carb")!;
    expect(lunch.meal.id).toBe("lc1");
    expect(lunch.picked).toBe(false);
  });

  it("treats a pick equal to the base meal as no swap", () => {
    const plan = buildDailyPlan({ ...base, picks: { breakfast: "b2" } });
    const breakfast = plan.slots.find((s) => s.type === "breakfast")!;
    expect(breakfast.meal.id).toBe("b2");
    expect(breakfast.picked).toBe(false);
  });
});

describe("daily plan — empty", () => {
  it("returns no slots before anything is published (fixed)", () => {
    const plan = buildDailyPlan({
      policy: "fixed",
      menus: MENUS,
      meals: MEALS,
      date: "2026-11-01",
    });
    expect(plan.primaryMenuId).toBeNull();
    expect(plan.slots).toEqual([]);
  });

  it("returns no slots when the coach has no menus", () => {
    const plan = buildDailyPlan({
      policy: "full_pool",
      menus: [],
      meals: MEALS,
      date: "2026-11-10",
    });
    expect(plan.slots).toEqual([]);
    expect(plan.primaryMenuId).toBeNull();
  });
});

describe("isAllowedPick — server-side swap validation", () => {
  const cumulative = buildDailyPlan({
    policy: "cumulative",
    menus: MENUS,
    meals: MEALS,
    date: "2026-11-10",
  });
  const fixed = buildDailyPlan({
    policy: "fixed",
    menus: MENUS,
    meals: MEALS,
    date: "2026-11-05",
  });

  it("accepts an available same-type meal under a swappable policy", () => {
    expect(isAllowedPick(cumulative, "breakfast", "b1")).toBe(true);
    expect(isAllowedPick(cumulative, "snack", "sn1")).toBe(true);
  });

  it("rejects unknown meals and wrong-type meals", () => {
    expect(isAllowedPick(cumulative, "breakfast", "nope")).toBe(false);
    expect(isAllowedPick(cumulative, "lunch-carb", "b1")).toBe(false);
  });

  it("rejects every pick under a fixed policy", () => {
    expect(isAllowedPick(fixed, "breakfast", "b1")).toBe(false);
  });
});
