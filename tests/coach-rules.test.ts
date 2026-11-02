import { describe, expect, it } from "vitest";
import {
  EMPTY_RULES,
  isMealAllowed,
  parseRulesForm,
  parseTagList,
  resolveEffectiveRules,
  type CoachRulesRow,
} from "@/lib/coach-rules";

const COACH = "coach";
const CLIENT = "client-a";
const OTHER_CLIENT = "client-b";

function row(
  over: Partial<CoachRulesRow> & { client_id: string | null },
): CoachRulesRow {
  return { ...EMPTY_RULES, id: crypto.randomUUID(), coach_id: COACH, ...over };
}

describe("resolveEffectiveRules", () => {
  const base = row({
    client_id: null,
    water_goal_ml: 2000,
    protein_goal_g: 100,
    allowed_meal_types: ["breakfast", "dinner"],
    notes: "default note",
  });

  it("returns empty rules when nothing is set", () => {
    expect(resolveEffectiveRules([], COACH, CLIENT)).toEqual(EMPTY_RULES);
  });

  it("uses the coach default when the client has no override", () => {
    const r = resolveEffectiveRules([base], COACH, CLIENT);
    expect(r.water_goal_ml).toBe(2000);
    expect(r.allowed_meal_types).toEqual(["breakfast", "dinner"]);
  });

  it("layers override over default field by field", () => {
    const override = row({
      client_id: CLIENT,
      water_goal_ml: 3000,
      forbidden_meal_tags: ["gluten"],
    });
    const r = resolveEffectiveRules([base, override], COACH, CLIENT);
    expect(r.water_goal_ml).toBe(3000); // overridden
    expect(r.protein_goal_g).toBe(100); // inherited
    expect(r.forbidden_meal_tags).toEqual(["gluten"]); // only in override
    expect(r.notes).toBe("default note"); // inherited
  });

  it("treats 0 as a real value, not as unset", () => {
    const override = row({ client_id: CLIENT, weekly_workout_goal: 0 });
    const withDefault = { ...base, weekly_workout_goal: 4 };
    expect(
      resolveEffectiveRules([withDefault, override], COACH, CLIENT)
        .weekly_workout_goal,
    ).toBe(0);
  });

  it("an empty override array replaces the default list", () => {
    const withTags = { ...base, forbidden_meal_tags: ["dairy"] };
    const override = row({ client_id: CLIENT, forbidden_meal_tags: [] });
    expect(
      resolveEffectiveRules([withTags, override], COACH, CLIENT)
        .forbidden_meal_tags,
    ).toEqual([]);
  });

  it("ignores another client's override and another coach's rows", () => {
    const others = [
      row({ client_id: OTHER_CLIENT, water_goal_ml: 9999 }),
      row({ client_id: null, coach_id: "someone-else", water_goal_ml: 1 }),
    ];
    const r = resolveEffectiveRules([base, ...others], COACH, CLIENT);
    expect(r.water_goal_ml).toBe(2000);
  });

  it("without a client, resolves to the default only", () => {
    const override = row({ client_id: CLIENT, water_goal_ml: 3000 });
    expect(resolveEffectiveRules([base, override], COACH).water_goal_ml).toBe(2000);
  });
});

describe("isMealAllowed", () => {
  const r = {
    ...EMPTY_RULES,
    allowed_meal_types: ["breakfast" as const, "snack" as const],
    forbidden_meal_tags: ["Gluten"],
  };

  it("allows everything when no rules are set", () => {
    expect(isMealAllowed(EMPTY_RULES, { type: "dinner", tags: ["gluten"] })).toBe(true);
  });

  it("blocks meal types outside the allowed list", () => {
    expect(isMealAllowed(r, { type: "dinner" })).toBe(false);
    expect(isMealAllowed(r, { type: "snack" })).toBe(true);
  });

  it("blocks forbidden tags case-insensitively", () => {
    expect(isMealAllowed(r, { type: "snack", tags: [" gluten "] })).toBe(false);
    expect(isMealAllowed(r, { type: "snack", tags: ["vegan"] })).toBe(true);
  });
});

describe("parseRulesForm", () => {
  const form = (entries: [string, string][]) => {
    const fd = new FormData();
    for (const [k, v] of entries) fd.append(k, v);
    return fd;
  };

  it("turns empty input into nulls", () => {
    const res = parseRulesForm(form([["water_goal_ml", ""]]));
    expect(res).toEqual({ ok: true, fields: EMPTY_RULES });
  });

  it("parses a full form", () => {
    const res = parseRulesForm(
      form([
        ["allowed_meal_types", "breakfast"],
        ["allowed_meal_types", "dinner"],
        ["forbidden_meal_tags", "gluten, dairy\nnuts"],
        ["water_goal_ml", "2500"],
        ["protein_goal_g", "120"],
        ["weekly_workout_goal", "4"],
        ["notes", "  hi  "],
      ]),
    );
    expect(res).toEqual({
      ok: true,
      fields: {
        allowed_meal_types: ["breakfast", "dinner"],
        forbidden_meal_tags: ["gluten", "dairy", "nuts"],
        water_goal_ml: 2500,
        protein_goal_g: 120,
        weekly_workout_goal: 4,
        notes: "hi",
      },
    });
  });

  it("rejects unknown meal types", () => {
    expect(parseRulesForm(form([["allowed_meal_types", "brunch"]])).ok).toBe(false);
  });

  it("rejects out-of-range and non-integer numbers", () => {
    expect(parseRulesForm(form([["water_goal_ml", "-5"]])).ok).toBe(false);
    expect(parseRulesForm(form([["protein_goal_g", "1.5"]])).ok).toBe(false);
    expect(parseRulesForm(form([["weekly_workout_goal", "22"]])).ok).toBe(false);
    expect(parseRulesForm(form([["water_goal_ml", "abc"]])).ok).toBe(false);
  });

  it("rejects over-long notes", () => {
    expect(parseRulesForm(form([["notes", "x".repeat(1001)]])).ok).toBe(false);
  });
});

describe("parseTagList", () => {
  it("trims, drops empties and dedupes case-insensitively", () => {
    expect(parseTagList("a, A,, b ,\n c")).toEqual(["a", "b", "c"]);
  });
});
