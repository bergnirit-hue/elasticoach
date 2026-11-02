import { describe, expect, it } from "vitest";
import {
  mealKey,
  parseMenuImport,
  type MenuImport,
} from "@/lib/menus/import";
import { SAMPLE_MENU } from "@/lib/menus/sample-menu";

describe("parseMenuImport — sample menu", () => {
  it("parses the sample menu into a plan", () => {
    const plan = parseMenuImport(SAMPLE_MENU);
    expect(plan.menus).toHaveLength(1);
    expect(plan.meals).toHaveLength(5);
    expect(plan.menus[0].mealKeys).toHaveLength(5);
  });
});

describe("parseMenuImport — de-duplication", () => {
  const data: MenuImport = {
    version: 1,
    menus: [
      {
        name: "שבוע 1",
        publishDate: "2026-11-02",
        meals: [
          { type: "breakfast", text: "חביתה" },
          { type: "lunch-carb", text: "אורז" },
        ],
      },
      {
        name: "שבוע 2",
        publishDate: "2026-11-09",
        meals: [
          // Same meal as week 1 (whitespace differs) → one library row.
          { type: "breakfast", text: "  חביתה  " },
          { type: "dinner", text: "סלט" },
        ],
      },
    ],
  };

  it("collapses the same meal across menus into one row", () => {
    const plan = parseMenuImport(data);
    expect(plan.meals).toHaveLength(3); // חביתה, אורז, סלט
    const key = mealKey("breakfast", "חביתה");
    expect(plan.menus[0].mealKeys).toContain(key);
    expect(plan.menus[1].mealKeys).toContain(key);
  });

  it("is idempotent: parsing twice yields the same keys", () => {
    const a = parseMenuImport(data);
    const b = parseMenuImport(data);
    expect(b.meals.map((m) => m.key)).toEqual(a.meals.map((m) => m.key));
  });
});

describe("parseMenuImport — validation", () => {
  it("rejects an unsupported version", () => {
    expect(() =>
      parseMenuImport({ version: 2 } as unknown as MenuImport),
    ).toThrow(/version/);
  });

  it("rejects an unknown meal type", () => {
    const bad: MenuImport = {
      version: 1,
      menus: [
        {
          name: "x",
          publishDate: "2026-11-02",
          meals: [{ type: "brunch" as never, text: "t" }],
        },
      ],
    };
    expect(() => parseMenuImport(bad)).toThrow(/unknown meal type/);
  });

  it("rejects a bad publish date", () => {
    const bad: MenuImport = {
      version: 1,
      menus: [
        { name: "x", publishDate: "11/02/2026", meals: [{ type: "snack", text: "t" }] },
      ],
    };
    expect(() => parseMenuImport(bad)).toThrow(/YYYY-MM-DD/);
  });

  it("rejects a menu with no meals", () => {
    const bad: MenuImport = {
      version: 1,
      menus: [{ name: "x", publishDate: "2026-11-02", meals: [] }],
    };
    expect(() => parseMenuImport(bad)).toThrow(/no meals/);
  });
});
