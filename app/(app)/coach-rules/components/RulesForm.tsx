"use client";

import { useActionState } from "react";
import {
  MEAL_TYPES,
  MEAL_TYPE_LABELS,
  NOTES_MAX_LENGTH,
  type CoachRuleFields,
} from "@/lib/coach-rules";
import { saveCoachRules, type SaveRulesState } from "../actions";

const field = "flex flex-col gap-1 text-sm";
const input =
  "rounded-lg border border-black/15 bg-background p-2.5 text-start";

interface Props {
  /** null = editing the coach default. */
  clientId: string | null;
  /** Values stored for this scope (null field = not set). */
  values: CoachRuleFields;
  /** Default values, shown as the inherited value when editing an override. */
  inherited: CoachRuleFields | null;
}

export function RulesForm({ clientId, values, inherited }: Props) {
  const [state, formAction, pending] = useActionState<SaveRulesState, FormData>(
    saveCoachRules,
    {},
  );
  const isOverride = clientId !== null;

  const hint = (v: number | null | undefined) =>
    isOverride && v != null ? `ברירת מחדל: ${v}` : "";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="client_id" value={clientId ?? ""} />

      <p className="text-sm opacity-70">
        {isOverride
          ? "שדה ריק = יורש את ברירת המחדל שלך."
          : "שדה ריק = אין כלל. ברירת המחדל חלה על כל המתאמנים שאין להם עקיפה אישית."}
      </p>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">סוגי ארוחות מותרים</legend>
        <p className="text-xs opacity-70">
          {isOverride
            ? "אם לא תסמנו כלום — יחולו הסוגים מברירת המחדל."
            : "אם לא תסמנו כלום — כל הסוגים מותרים."}
        </p>
        {MEAL_TYPES.map((type) => (
          <label key={type} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="allowed_meal_types"
              value={type}
              defaultChecked={values.allowed_meal_types?.includes(type) ?? false}
            />
            {MEAL_TYPE_LABELS[type]}
          </label>
        ))}
        {isOverride && inherited?.allowed_meal_types && (
          <p className="text-xs opacity-70">
            ברירת מחדל:{" "}
            {inherited.allowed_meal_types.map((t) => MEAL_TYPE_LABELS[t]).join(", ")}
          </p>
        )}
      </fieldset>

      <label className={field}>
        תגיות אסורות בארוחות
        <textarea
          name="forbidden_meal_tags"
          rows={2}
          defaultValue={values.forbidden_meal_tags?.join(", ") ?? ""}
          placeholder="מופרדות בפסיק, למשל: גלוטן, חלב"
          className={input}
        />
        {isOverride && inherited?.forbidden_meal_tags && (
          <span className="text-xs opacity-70">
            ברירת מחדל: {inherited.forbidden_meal_tags.join(", ")}
          </span>
        )}
      </label>

      <div className="grid grid-cols-3 gap-3">
        <label className={field}>
          יעד מים (מ״ל)
          <input
            name="water_goal_ml"
            type="number"
            step="50"
            min={0}
            max={20000}
            inputMode="numeric"
            defaultValue={values.water_goal_ml ?? ""}
            placeholder={hint(inherited?.water_goal_ml)}
            className={input}
          />
        </label>
        <label className={field}>
          יעד חלבון (גרם)
          <input
            name="protein_goal_g"
            type="number"
            step="5"
            min={0}
            max={1000}
            inputMode="numeric"
            defaultValue={values.protein_goal_g ?? ""}
            placeholder={hint(inherited?.protein_goal_g)}
            className={input}
          />
        </label>
        <label className={field}>
          אימונים בשבוע
          <input
            name="weekly_workout_goal"
            type="number"
            step="1"
            min={0}
            max={21}
            inputMode="numeric"
            defaultValue={values.weekly_workout_goal ?? ""}
            placeholder={hint(inherited?.weekly_workout_goal)}
            className={input}
          />
        </label>
      </div>

      <label className={field}>
        הערות (למעקב שלך בלבד)
        <textarea
          name="notes"
          rows={3}
          maxLength={NOTES_MAX_LENGTH}
          defaultValue={values.notes ?? ""}
          className={input}
        />
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.saved && (
        <p role="status" className="text-sm text-green-700">
          נשמר
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-black px-5 py-2.5 font-medium text-white disabled:opacity-50"
      >
        {pending ? "שומר…" : "שמירה"}
      </button>
    </form>
  );
}
