"use client";

import { useActionState, useId, useRef, useState } from "react";
import { MEAL_TYPE_LABELS, type MealType } from "@/lib/menus/types";
import { saveMenu, type SaveMenuState } from "./actions";
import type { LibraryByType, CoachClientOption } from "./data";

interface NewMealRow {
  key: number;
  type: MealType;
  text: string;
  url: string;
}

interface Props {
  /** null = creating; otherwise editing this menu. */
  menuId: string | null;
  library: LibraryByType[];
  clients: CoachClientOption[];
  defaults: {
    name: string;
    publishDate: string;
    selectedMealIds: string[];
    appliesToClientId: string | null;
  };
}

const card = "rounded-card border border-line bg-surface p-4";
const inputBase =
  "rounded-sm border border-line bg-surface p-2.5 text-start text-ink";

export function MenuBuilder({ menuId, library, clients, defaults }: Props) {
  const [state, formAction, pending] = useActionState<SaveMenuState, FormData>(
    saveMenu,
    {},
  );

  const [appliesTo, setAppliesTo] = useState<"all" | "client">(
    defaults.appliesToClientId ? "client" : "all",
  );
  const [newMeals, setNewMeals] = useState<NewMealRow[]>([]);
  const nameId = useId();
  const dateId = useId();

  const selected = new Set(defaults.selectedMealIds);
  const nextKey = useRef(0);

  const addNewMeal = (type: MealType) =>
    setNewMeals((rows) => [
      ...rows,
      { key: nextKey.current++, type, text: "", url: "" },
    ]);
  const removeNewMeal = (key: number) =>
    setNewMeals((rows) => rows.filter((r) => r.key !== key));
  const patchNewMeal = (key: number, patch: Partial<NewMealRow>) =>
    setNewMeals((rows) =>
      rows.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {menuId && <input type="hidden" name="menu_id" value={menuId} />}

      {/* --- menu header fields --- */}
      <div className={`${card} flex flex-col gap-4`}>
        <label htmlFor={nameId} className="flex flex-col gap-1 text-sm">
          <span className="font-medium">שם התפריט</span>
          <input
            id={nameId}
            name="name"
            required
            maxLength={120}
            defaultValue={defaults.name}
            placeholder="למשל: תפריט שבוע 1"
            className={inputBase}
          />
        </label>

        <label htmlFor={dateId} className="flex flex-col gap-1 text-sm">
          <span className="font-medium">תאריך פרסום</span>
          <input
            id={dateId}
            name="publish_date"
            type="date"
            required
            defaultValue={defaults.publishDate}
            className={`${inputBase} w-full`}
          />
          <span className="text-xs text-ink-soft">
            מתאמנות יראו את התפריט החל מהתאריך הזה, לפי מדיניות התפריטים שלך.
          </span>
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">חל על</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="applies_to"
              value="all"
              checked={appliesTo === "all"}
              onChange={() => setAppliesTo("all")}
            />
            כל המתאמנות
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="applies_to"
              value="client"
              checked={appliesTo === "client"}
              onChange={() => setAppliesTo("client")}
              disabled={clients.length === 0}
            />
            מתאמנת יחידה
          </label>
          {appliesTo === "client" && (
            <select
              name="applies_client_id"
              defaultValue={defaults.appliesToClientId ?? ""}
              required
              className={`${inputBase} mt-1`}
            >
              <option value="" disabled>
                בחרי מתאמנת…
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          {clients.length === 0 && (
            <span className="text-xs text-ink-soft">
              אין מתאמנות משויכות עדיין — התפריט יחול על כל המתאמנות.
            </span>
          )}
        </fieldset>
      </div>

      {/* --- meals, grouped by type --- */}
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">מנות התפריט</h2>
        {library.map(({ type, meals }) => {
          const rows = newMeals.filter((r) => r.type === type);
          return (
            <div key={type} className={`${card} flex flex-col gap-3`}>
              <h3 className="font-display text-base">{MEAL_TYPE_LABELS[type]}</h3>

              {meals.length === 0 && rows.length === 0 ? (
                <p className="text-sm text-ink-soft">
                  אין עדיין מנות מסוג זה במאגר. אפשר להוסיף מנה חדשה.
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {meals.map((m) => (
                    <li key={m.id}>
                      <label className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          name="meal_id"
                          value={m.id}
                          defaultChecked={selected.has(m.id)}
                          className="mt-0.5"
                        />
                        <span>
                          {m.text}
                          {m.recipeUrl && (
                            <a
                              href={m.recipeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ms-2 text-brand underline"
                            >
                              מתכון
                            </a>
                          )}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}

              {/* inline new meals of this type */}
              {rows.map((r) => (
                <div
                  key={r.key}
                  className="flex flex-col gap-2 rounded-sm border border-dashed border-line p-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-ink-soft">
                      מנה חדשה למאגר
                    </span>
                    <button
                      type="button"
                      onClick={() => removeNewMeal(r.key)}
                      className="text-xs text-danger underline"
                    >
                      הסרה
                    </button>
                  </div>
                  <input type="hidden" name="new_meal_type" value={r.type} />
                  <label className="sr-only" htmlFor={`nm-text-${r.key}`}>
                    תיאור המנה
                  </label>
                  <input
                    id={`nm-text-${r.key}`}
                    name="new_meal_text"
                    value={r.text}
                    onChange={(e) => patchNewMeal(r.key, { text: e.target.value })}
                    placeholder="תיאור המנה"
                    maxLength={500}
                    className={inputBase}
                  />
                  <label className="sr-only" htmlFor={`nm-url-${r.key}`}>
                    קישור מתכון (לא חובה)
                  </label>
                  <input
                    id={`nm-url-${r.key}`}
                    name="new_meal_url"
                    value={r.url}
                    onChange={(e) => patchNewMeal(r.key, { url: e.target.value })}
                    placeholder="קישור מתכון (לא חובה)"
                    inputMode="url"
                    className={inputBase}
                  />
                </div>
              ))}

              <button
                type="button"
                onClick={() => addNewMeal(type)}
                className="self-start text-sm text-brand underline"
              >
                + הוספת מנה חדשה
              </button>
            </div>
          );
        })}
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-pill bg-brand px-6 py-2.5 font-medium text-on-brand disabled:opacity-50"
        >
          {pending ? "שומר…" : menuId ? "שמירת שינויים" : "יצירת תפריט"}
        </button>
        <a href="/menus" className="text-sm text-ink-soft underline">
          ביטול
        </a>
      </div>
    </form>
  );
}
