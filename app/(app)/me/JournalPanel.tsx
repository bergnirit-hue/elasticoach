"use client";

import { useState } from "react";
import { saveJournal } from "./actions";
import {
  MAX_MEALS,
  MAX_MEAL_TEXT,
  MAX_NOTES,
  MEAL_TYPES,
  MOODS,
  type Journal,
  type MealType,
  type Mood,
} from "./journal";
import { SaveStatus, useAutosave } from "./useAutosave";

const card = "rounded-xl border border-black/10 p-4 flex flex-col gap-3";
const field = "rounded-lg border border-black/15 bg-background p-2.5 text-start";

export function JournalPanel({
  date,
  initial,
}: {
  date: string;
  initial: Journal;
}) {
  const [journal, setJournal] = useState<Journal>(initial);
  const { state, schedule, flush } = useAutosave();

  function update(next: Journal) {
    setJournal(next);
    schedule(() => saveJournal(date, next));
  }

  function addMeal() {
    if (journal.meals.length >= MAX_MEALS) return;
    update({
      ...journal,
      meals: [
        ...journal.meals,
        { id: crypto.randomUUID(), type: "breakfast", text: "" },
      ],
    });
  }

  function patchMeal(id: string, patch: { type?: MealType; text?: string }) {
    update({
      ...journal,
      meals: journal.meals.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    });
  }

  function removeMeal(id: string) {
    update({ ...journal, meals: journal.meals.filter((m) => m.id !== id) });
    void flush();
  }

  function setMood(mood: Mood) {
    update({ ...journal, mood: journal.mood === mood ? null : mood });
    void flush();
  }

  return (
    <div className={card}>
      <div className="flex items-baseline justify-between">
        <h2 className="font-bold">יומן אכילה ותחושות</h2>
        <SaveStatus state={state} />
      </div>
      <p className="text-sm opacity-70">
        רשמי מה אכלת, עם כמויות אם אפשר, ואיך הרגשת.
      </p>

      <ul className="flex flex-col gap-2">
        {journal.meals.map((m) => (
          <li key={m.id} className="flex flex-col gap-2 sm:flex-row">
            <select
              value={m.type}
              onChange={(e) => {
                patchMeal(m.id, { type: e.target.value as MealType });
                void flush();
              }}
              aria-label="סוג ארוחה"
              className={field}
            >
              {MEAL_TYPES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={m.text}
              maxLength={MAX_MEAL_TEXT}
              onChange={(e) => patchMeal(m.id, { text: e.target.value })}
              onBlur={() => void flush()}
              placeholder="מה אכלת?"
              aria-label="מה אכלת"
              className={`${field} flex-1`}
            />
            <button
              type="button"
              onClick={() => removeMeal(m.id)}
              className="rounded-lg border border-black/15 px-3 py-2 text-sm"
              aria-label="מחיקת ארוחה"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={addMeal}
        disabled={journal.meals.length >= MAX_MEALS}
        className="self-start rounded-lg border border-black/15 px-3 py-1.5 text-sm disabled:opacity-50"
      >
        + הוספת ארוחה
      </button>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm">איך הרגשת היום?</legend>
        <div className="flex gap-2" role="group" aria-label="מצב רוח">
          {MOODS.map((m) => (
            <button
              key={m.value}
              type="button"
              aria-pressed={journal.mood === m.value}
              aria-label={m.label}
              title={m.label}
              onClick={() => setMood(m.value)}
              className={`rounded-lg border px-3 py-1.5 text-xl ${
                journal.mood === m.value
                  ? "border-sky-600 bg-sky-600/10"
                  : "border-black/15"
              }`}
            >
              {m.emoji}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1 text-sm">
        תחושות, רעב ושובע
        <textarea
          rows={3}
          value={journal.notes}
          maxLength={MAX_NOTES}
          onChange={(e) => update({ ...journal, notes: e.target.value })}
          onBlur={() => void flush()}
          className={field}
        />
      </label>
    </div>
  );
}
