"use client";

import { useState, useTransition } from "react";
import type { DailyPlanSlot } from "@/lib/menus/daily";
import type { Meal } from "@/lib/menus/types";
import { MEAL_TYPE_LABELS, type MealType } from "@/lib/menus/types";
import { saveMenuPick, resetMenuPick } from "./menuActions";

/** De-duplicated same-type option set for a slot: the shown meal + its swaps. */
function optionsFor(slot: DailyPlanSlot): Meal[] {
  const seen = new Set<string>();
  const out: Meal[] = [];
  for (const m of [slot.meal, ...slot.alternatives]) {
    if (!seen.has(m.id)) {
      seen.add(m.id);
      out.push(m);
    }
  }
  return out;
}

function RecipeLink({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm font-medium text-brand hover:underline"
    >
      למתכון ↗
    </a>
  );
}

export function DailyPlanCard({
  date,
  slots,
  swapEnabled,
}: {
  date: string;
  slots: DailyPlanSlot[];
  swapEnabled: boolean;
}) {
  // Optimistic per-type override: type → chosen meal id (absent = menu default).
  const [picks, setPicks] = useState<Partial<Record<MealType, string>>>(() => {
    const init: Partial<Record<MealType, string>> = {};
    for (const s of slots) if (s.picked) init[s.type] = s.meal.id;
    return init;
  });
  const [openType, setOpenType] = useState<MealType | null>(null);
  const [animType, setAnimType] = useState<MealType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function choose(slot: DailyPlanSlot, mealId: string) {
    setOpenType(null);
    setError(null);
    if ((picks[slot.type] ?? slot.baseMeal.id) === mealId) return; // no change

    const prev = picks;
    const isDefault = mealId === slot.baseMeal.id;
    setPicks((p) => {
      const next = { ...p };
      if (isDefault) delete next[slot.type];
      else next[slot.type] = mealId;
      return next;
    });
    setAnimType(slot.type);

    startTransition(async () => {
      const res = isDefault
        ? await resetMenuPick(date, slot.type)
        : await saveMenuPick(date, slot.type, mealId);
      if (!res.ok) {
        setPicks(prev); // revert on failure
        setError(res.error);
      }
    });
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="daily-plan-heading">
      <div className="flex items-baseline justify-between">
        <h2 id="daily-plan-heading" className="font-display text-lg">
          התפריט שלי להיום
        </h2>
        {swapEnabled && (
          <span className="text-xs text-ink-soft">אפשר להחליף כל מנה במנה דומה</span>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {slots.map((slot) => {
        const options = optionsFor(slot);
        const shownId = picks[slot.type] ?? slot.meal.id;
        const shown = options.find((m) => m.id === shownId) ?? slot.meal;
        const isPicked = shownId !== slot.baseMeal.id;
        const canSwap = swapEnabled && options.length > 1;
        const isOpen = openType === slot.type;

        return (
          <article
            key={slot.type}
            style={{ boxShadow: "var(--shadow-card)" }}
            className={`flex flex-col gap-2 rounded-card border border-line bg-surface p-4${
              animType === slot.type ? " ec-pop" : ""
            }`}
            onAnimationEnd={() => setAnimType((t) => (t === slot.type ? null : t))}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-ink-soft">
                {MEAL_TYPE_LABELS[slot.type]}
              </span>
              {isPicked && (
                <span className="rounded-pill bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">
                  הוחלף
                </span>
              )}
            </div>

            <p className="leading-snug text-ink">{shown.text}</p>

            <div className="flex flex-wrap items-center gap-3">
              {shown.recipeUrl && <RecipeLink url={shown.recipeUrl} />}
              {canSwap && (
                <button
                  type="button"
                  onClick={() => setOpenType(isOpen ? null : slot.type)}
                  aria-expanded={isOpen}
                  aria-controls={`swap-${slot.type}`}
                  className="me-auto rounded-pill bg-brand-soft px-3 py-1.5 text-sm font-medium text-brand transition-transform hover:scale-[1.03] active:scale-95"
                >
                  ⇄ החלפה
                </button>
              )}
            </div>

            {canSwap && isOpen && (
              <ul
                id={`swap-${slot.type}`}
                className="mt-1 flex flex-col gap-1.5 border-t border-line pt-2"
              >
                {options.map((m) => {
                  const current = m.id === shownId;
                  const isDefault = m.id === slot.baseMeal.id;
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => choose(slot, m.id)}
                        disabled={isPending}
                        aria-pressed={current}
                        className={`flex w-full items-center justify-between gap-2 rounded-sm border px-3 py-2 text-start text-sm transition-colors disabled:opacity-60 ${
                          current
                            ? "border-brand bg-brand-soft text-ink"
                            : "border-line bg-surface hover:bg-surface-2 text-ink"
                        }`}
                      >
                        <span>{m.text}</span>
                        <span className="flex shrink-0 items-center gap-2 text-xs text-ink-soft">
                          {isDefault && <span>ברירת מחדל</span>}
                          {current && <span aria-hidden>✓</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </article>
        );
      })}
    </section>
  );
}
