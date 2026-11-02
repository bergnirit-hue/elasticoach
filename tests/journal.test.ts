import { describe, expect, it } from "vitest";
import {
  MAX_MEALS,
  MAX_MEAL_TEXT,
  cleanJournal,
  normalizeJournal,
} from "@/app/(app)/me/journal";

describe("normalizeJournal", () => {
  it("returns an empty journal for junk input", () => {
    for (const raw of [null, undefined, "x", 3, [], {}]) {
      expect(normalizeJournal(raw)).toEqual({ meals: [], mood: null, notes: "" });
    }
  });

  it("reads the current shape", () => {
    const j = normalizeJournal({
      meals: [{ id: "a", type: "lunch", text: "אורז ועוף" }],
      mood: 4,
      notes: "שבעה",
    });
    expect(j).toEqual({
      meals: [{ id: "a", type: "lunch", text: "אורז ועוף" }],
      mood: 4,
      notes: "שבעה",
    });
  });

  it("migrates the legacy slot shape without losing text", () => {
    const j = normalizeJournal({
      breakfast: "יוגורט",
      lunch: "  סלט ",
      dinner: "",
      snacks: "תפוח",
      notes: "רעבה בערב",
    });
    expect(j.meals.map((m) => [m.type, m.text])).toEqual([
      ["breakfast", "יוגורט"],
      ["lunch", "סלט"],
      ["snack", "תפוח"],
    ]);
    expect(j.notes).toBe("רעבה בערב");
    expect(j.mood).toBeNull();
  });

  it("falls back on bad meal types, ids and moods", () => {
    const j = normalizeJournal({
      meals: [{ type: "brunch", text: "x" }, { id: "k", type: "dinner" }, 5],
      mood: 9,
    });
    expect(j.meals).toHaveLength(1);
    expect(j.meals[0].type).toBe("snack");
    expect(j.meals[0].id).toBeTruthy();
    expect(j.mood).toBeNull();
  });

  it("caps meal count and text length", () => {
    const meals = Array.from({ length: MAX_MEALS + 5 }, (_, i) => ({
      id: String(i),
      type: "snack",
      text: "x".repeat(MAX_MEAL_TEXT + 10),
    }));
    const j = normalizeJournal({ meals });
    expect(j.meals).toHaveLength(MAX_MEALS);
    expect(j.meals[0].text).toHaveLength(MAX_MEAL_TEXT);
  });
});

describe("cleanJournal", () => {
  it("drops blank meals and trims text", () => {
    const j = cleanJournal({
      meals: [
        { id: "a", type: "dinner", text: "  פסטה " },
        { id: "b", type: "dinner", text: "   " },
      ],
      notes: "  ok ",
    });
    expect(j.meals).toEqual([{ id: "a", type: "dinner", text: "פסטה" }]);
    expect(j.notes).toBe("ok");
  });
});
