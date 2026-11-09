import { describe, expect, it } from "vitest";
import {
  availableMeals,
  effectivePolicy,
  type AvailabilityMenu,
} from "@/lib/menus/availability";

// Three menus published a week apart. Meal "b" appears in two menus to prove
// de-duplication across menus.
const M1: AvailabilityMenu = {
  id: "m1",
  publishDate: "2026-11-02",
  mealIds: ["a", "b"],
};
const M2: AvailabilityMenu = {
  id: "m2",
  publishDate: "2026-11-09",
  mealIds: ["b", "c"],
};
const M3: AvailabilityMenu = {
  id: "m3",
  publishDate: "2026-11-16",
  mealIds: ["d"],
};
const MENUS = [M3, M1, M2]; // deliberately unordered

describe("availability — fixed", () => {
  it("uses the latest menu published on/before the date", () => {
    expect(availableMeals({ policy: "fixed", menus: MENUS, date: "2026-11-02" }))
      .toEqual({ menuIds: ["m1"], mealIds: ["a", "b"] });
    expect(availableMeals({ policy: "fixed", menus: MENUS, date: "2026-11-10" }))
      .toEqual({ menuIds: ["m2"], mealIds: ["b", "c"] });
    expect(availableMeals({ policy: "fixed", menus: MENUS, date: "2026-11-20" }))
      .toEqual({ menuIds: ["m3"], mealIds: ["d"] });
  });

  it("is empty before anything is published", () => {
    expect(
      availableMeals({ policy: "fixed", menus: MENUS, date: "2026-11-01" }),
    ).toEqual({ menuIds: [], mealIds: [] });
  });
});

describe("availability — rotating", () => {
  it("cycles one menu per week from the anchor (default = first publish)", () => {
    // 2026-11-13 → week 1, published = [m1, m2] → index 1 → m2.
    expect(
      availableMeals({ policy: "rotating", menus: MENUS, date: "2026-11-13" }),
    ).toEqual({ menuIds: ["m2"], mealIds: ["b", "c"] });
    // 2026-11-20 → 18 days → week 2, published = [m1, m2, m3] → index 2 → m3.
    expect(
      availableMeals({ policy: "rotating", menus: MENUS, date: "2026-11-20" }),
    ).toEqual({ menuIds: ["m3"], mealIds: ["d"] });
  });

  it("wraps around when the week index exceeds the menu count", () => {
    // 2026-11-23 → 21 days → week 3, published = [m1, m2, m3] → 3 % 3 = 0 → m1.
    expect(
      availableMeals({ policy: "rotating", menus: MENUS, date: "2026-11-23" }),
    ).toEqual({ menuIds: ["m1"], mealIds: ["a", "b"] });
  });

  it("honours an explicit rotation anchor and is empty before it", () => {
    expect(
      availableMeals({
        policy: "rotating",
        menus: MENUS,
        date: "2026-11-05",
        rotationAnchor: "2026-11-10",
      }),
    ).toEqual({ menuIds: [], mealIds: [] });
  });

  it("is empty before anything is published", () => {
    expect(
      availableMeals({ policy: "rotating", menus: MENUS, date: "2026-11-01" }),
    ).toEqual({ menuIds: [], mealIds: [] });
  });
});

describe("availability — cumulative", () => {
  it("unions every menu published so far, de-duplicating meals", () => {
    expect(
      availableMeals({ policy: "cumulative", menus: MENUS, date: "2026-11-10" }),
    ).toEqual({ menuIds: ["m1", "m2"], mealIds: ["a", "b", "c"] });
    expect(
      availableMeals({ policy: "cumulative", menus: MENUS, date: "2026-11-20" }),
    ).toEqual({ menuIds: ["m1", "m2", "m3"], mealIds: ["a", "b", "c", "d"] });
  });

  it("is empty before anything is published", () => {
    expect(
      availableMeals({ policy: "cumulative", menus: MENUS, date: "2026-11-01" }),
    ).toEqual({ menuIds: [], mealIds: [] });
  });
});

describe("availability — full_pool", () => {
  it("exposes the whole pool regardless of publish date", () => {
    // Even before any publish date, the full pool is available.
    expect(
      availableMeals({ policy: "full_pool", menus: MENUS, date: "2026-11-01" }),
    ).toEqual({ menuIds: ["m1", "m2", "m3"], mealIds: ["a", "b", "c", "d"] });
  });
});

describe("availability — empty input", () => {
  it("returns empty for every policy when there are no menus", () => {
    for (const policy of ["fixed", "rotating", "cumulative", "full_pool"] as const) {
      expect(availableMeals({ policy, menus: [], date: "2026-11-10" })).toEqual({
        menuIds: [],
        mealIds: [],
      });
    }
  });
});

describe("effectivePolicy", () => {
  it("prefers the per-client override, then the coach default, then fixed", () => {
    expect(effectivePolicy("cumulative", "full_pool")).toBe("full_pool");
    expect(effectivePolicy("cumulative", null)).toBe("cumulative");
    expect(effectivePolicy(null, null)).toBe("fixed");
    expect(effectivePolicy(undefined, undefined)).toBe("fixed");
  });
});
