import { describe, expect, it } from "vitest";
import {
  menuClientId,
  menuDraftFromForm,
  validateMenuDraft,
  MENU_NAME_MAX_LENGTH,
  type MenuDraft,
  type MenuValidationContext,
} from "@/lib/menus/builder";

const ctx: MenuValidationContext = {
  knownMealIds: ["meal-a", "meal-b", "meal-c"],
  clientIds: ["client-1", "client-2"],
};

const base = (over: Partial<MenuDraft> = {}): MenuDraft => ({
  name: "תפריט שבוע 1",
  publishDate: "2026-11-09",
  appliesTo: { kind: "all" },
  selectedMealIds: ["meal-a"],
  newMeals: [],
  ...over,
});

describe("validateMenuDraft", () => {
  it("accepts a valid all-clients draft", () => {
    const r = validateMenuDraft(base(), ctx);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.menu.name).toBe("תפריט שבוע 1");
      expect(r.menu.appliesTo).toEqual({ kind: "all" });
      expect(r.menu.selectedMealIds).toEqual(["meal-a"]);
    }
  });

  it("trims the name and rejects an empty one", () => {
    expect(validateMenuDraft(base({ name: "  לפתי  " }), ctx)).toMatchObject({
      ok: true,
      menu: { name: "לפתי" },
    });
    expect(validateMenuDraft(base({ name: "   " }), ctx)).toMatchObject({
      ok: false,
    });
  });

  it("rejects an over-long name", () => {
    const r = validateMenuDraft(
      base({ name: "x".repeat(MENU_NAME_MAX_LENGTH + 1) }),
      ctx,
    );
    expect(r.ok).toBe(false);
  });

  it("rejects an invalid publish date", () => {
    for (const d of ["", "2026-13-01", "09/11/2026", "2026-11-9", "nope"]) {
      expect(validateMenuDraft(base({ publishDate: d }), ctx).ok).toBe(false);
    }
    expect(validateMenuDraft(base({ publishDate: "2026-02-28" }), ctx).ok).toBe(
      true,
    );
  });

  it("rejects a meal that is not in the coach's library", () => {
    const r = validateMenuDraft(
      base({ selectedMealIds: ["meal-a", "ghost-meal"] }),
      ctx,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("מאגר");
  });

  it("de-dupes selected meal ids", () => {
    const r = validateMenuDraft(
      base({ selectedMealIds: ["meal-a", "meal-a", "meal-b"] }),
      ctx,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.menu.selectedMealIds).toEqual(["meal-a", "meal-b"]);
  });

  it("requires at least one meal", () => {
    const r = validateMenuDraft(
      base({ selectedMealIds: [], newMeals: [] }),
      ctx,
    );
    expect(r.ok).toBe(false);
  });

  describe("applies-to", () => {
    it("accepts a single client that is linked to the coach", () => {
      const r = validateMenuDraft(
        base({ appliesTo: { kind: "client", clientId: "client-1" } }),
        ctx,
      );
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.menu.appliesTo).toEqual({ kind: "client", clientId: "client-1" });
    });

    it("rejects a client that is not linked to the coach", () => {
      const r = validateMenuDraft(
        base({ appliesTo: { kind: "client", clientId: "stranger" } }),
        ctx,
      );
      expect(r.ok).toBe(false);
    });

    it("rejects a client kind with an empty id", () => {
      const r = validateMenuDraft(
        base({ appliesTo: { kind: "client", clientId: "" } }),
        ctx,
      );
      expect(r.ok).toBe(false);
    });
  });

  describe("new meals created inline", () => {
    it("accepts a valid new meal and trims it", () => {
      const r = validateMenuDraft(
        base({
          selectedMealIds: [],
          newMeals: [
            { type: "lunch-carb", text: "  אורז מלא  ", recipeUrl: "https://ex.com/r" },
          ],
        }),
        ctx,
      );
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.menu.newMeals[0]).toEqual({
          type: "lunch-carb",
          text: "אורז מלא",
          recipeUrl: "https://ex.com/r",
        });
      }
    });

    it("rejects an underscore meal type (EC-39 regression guard)", () => {
      const r = validateMenuDraft(
        base({
          selectedMealIds: [],
          newMeals: [{ type: "lunch_carb" as never, text: "אורז" }],
        }),
        ctx,
      );
      expect(r.ok).toBe(false);
    });

    it("accepts every canonical hyphenated meal type", () => {
      for (const type of [
        "breakfast",
        "lunch-carb",
        "lunch-protein",
        "dinner",
        "snack",
      ] as const) {
        const r = validateMenuDraft(
          base({ selectedMealIds: [], newMeals: [{ type, text: "x" }] }),
          ctx,
        );
        expect(r.ok, type).toBe(true);
      }
    });

    it("rejects a new meal with empty text", () => {
      const r = validateMenuDraft(
        base({ selectedMealIds: [], newMeals: [{ type: "dinner", text: "   " }] }),
        ctx,
      );
      expect(r.ok).toBe(false);
    });

    it("rejects a non-http recipe url", () => {
      const r = validateMenuDraft(
        base({
          selectedMealIds: [],
          newMeals: [{ type: "snack", text: "תפוח", recipeUrl: "javascript:alert(1)" }],
        }),
        ctx,
      );
      expect(r.ok).toBe(false);
    });

    it("treats a blank recipe url as none", () => {
      const r = validateMenuDraft(
        base({
          selectedMealIds: [],
          newMeals: [{ type: "snack", text: "תפוח", recipeUrl: "   " }],
        }),
        ctx,
      );
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.menu.newMeals[0].recipeUrl).toBeNull();
    });
  });
});

describe("menuClientId", () => {
  it("is null for an all-clients menu (so editing clears old scoping)", () => {
    expect(menuClientId({ kind: "all" })).toBeNull();
  });

  it("is the client id for a single-client menu", () => {
    expect(menuClientId({ kind: "client", clientId: "client-1" })).toBe("client-1");
  });
});

describe("menuDraftFromForm", () => {
  // Minimal FormData-like over a list of [key, value] pairs.
  const form = (pairs: [string, string][]) => ({
    get: (k: string) => pairs.find(([key]) => key === k)?.[1] ?? null,
    getAll: (k: string) => pairs.filter(([key]) => key === k).map(([, v]) => v),
  });

  it("maps fields, applies-to=all, and selected meals", () => {
    const d = menuDraftFromForm(
      form([
        ["name", "תפריט"],
        ["publish_date", "2026-11-09"],
        ["applies_to", "all"],
        ["meal_id", "meal-a"],
        ["meal_id", "meal-b"],
      ]),
    );
    expect(d).toMatchObject({
      name: "תפריט",
      publishDate: "2026-11-09",
      appliesTo: { kind: "all" },
      selectedMealIds: ["meal-a", "meal-b"],
      newMeals: [],
    });
  });

  it("maps applies-to=client with the chosen client id", () => {
    const d = menuDraftFromForm(
      form([
        ["applies_to", "client"],
        ["applies_client_id", "client-2"],
      ]),
    );
    expect(d.appliesTo).toEqual({ kind: "client", clientId: "client-2" });
  });

  it("collects inline new meals and drops blank-text rows", () => {
    // Mirrors the real form: every row always emits a hidden new_meal_type,
    // so a dropped row is one whose TEXT is blank (not its type).
    const d = menuDraftFromForm(
      form([
        ["new_meal_type", "breakfast"],
        ["new_meal_text", "חביתה"],
        ["new_meal_url", "https://ex.com"],
        ["new_meal_type", "dinner"],
        ["new_meal_text", "   "],
        ["new_meal_url", ""],
      ]),
    );
    expect(d.newMeals).toEqual([
      { type: "breakfast", text: "חביתה", recipeUrl: "https://ex.com" },
    ]);
  });
});
