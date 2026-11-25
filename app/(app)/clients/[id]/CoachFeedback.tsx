"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  cleanBody,
  DAY_TARGET,
  MEAL_SLOTS,
  targetLabel,
  toMealKey,
  type Feedback,
} from "@/lib/feedback";

const card =
  "rounded-card border border-line bg-surface shadow-card p-4 flex flex-col gap-3";

/**
 * EC-16 — coach-side create/edit/delete of feedback on a client's day/meal.
 * Writes go directly through the browser Supabase client; RLS allows them only
 * for an actively-linked coach. The client's own display of feedback is a
 * separate, later integration (not in this component).
 */
export function CoachFeedback({
  coachId,
  clientId,
  date,
  initial,
}: {
  coachId: string;
  clientId: string;
  date: string;
  initial: Feedback[];
}) {
  const supabase = createClient();
  const [items, setItems] = useState<Feedback[]>(initial);
  const [target, setTarget] = useState<string>(DAY_TARGET);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  // Inline edit state.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const text = cleanBody(body);
    if (!text) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("coach_feedback")
      .insert({
        coach_id: coachId,
        client_id: clientId,
        date,
        meal_key: toMealKey(target),
        body: text,
      })
      .select("id, coach_id, client_id, date, meal_key, body")
      .single();
    setBusy(false);
    if (!error && data) {
      setItems((x) => [data as Feedback, ...x]);
      setBody("");
      setTarget(DAY_TARGET);
    }
  }

  function startEdit(f: Feedback) {
    setEditingId(f.id);
    setEditBody(f.body);
  }

  async function saveEdit(f: Feedback) {
    const text = cleanBody(editBody);
    if (!text) return;
    setItems((x) =>
      x.map((i) => (i.id === f.id ? { ...i, body: text } : i)),
    );
    setEditingId(null);
    await supabase
      .from("coach_feedback")
      .update({ body: text, updated_at: new Date().toISOString() })
      .eq("id", f.id);
  }

  async function remove(f: Feedback) {
    setItems((x) => x.filter((i) => i.id !== f.id));
    if (editingId === f.id) setEditingId(null);
    await supabase.from("coach_feedback").delete().eq("id", f.id);
  }

  return (
    <div className={card}>
      <h2 className="font-bold">משוב למתאמן/ת</h2>

      {items.length === 0 ? (
        <p className="text-sm text-ink-soft">עדיין לא כתבת משוב ליום הזה.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((f) => (
            <li
              key={f.id}
              className="rounded-sm border border-line p-3 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-pill bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">
                  {targetLabel(f.meal_key)}
                </span>
                {editingId !== f.id && (
                  <div className="flex gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => startEdit(f)}
                      className="text-ink-soft hover:text-ink"
                    >
                      עריכה
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(f)}
                      className="text-ink-soft hover:text-ink"
                    >
                      מחיקה
                    </button>
                  </div>
                )}
              </div>

              {editingId === f.id ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    rows={2}
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    className="rounded-sm border border-line bg-background p-2.5 text-start"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => saveEdit(f)}
                      disabled={!cleanBody(editBody)}
                      className="btn-brand px-3 py-1.5 text-sm"
                    >
                      שמירה
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-sm border border-line px-3 py-1.5 text-sm hover:bg-surface-2"
                    >
                      ביטול
                    </button>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-sm">{f.body}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="flex flex-col gap-2">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm">
            על מה המשוב
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="rounded-sm border border-line bg-background p-2.5"
            >
              <option value={DAY_TARGET}>{targetLabel(DAY_TARGET)}</option>
              {MEAL_SLOTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <textarea
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="כתבי משוב למתאמן/ת…"
          className="rounded-sm border border-line bg-background p-2.5 text-start"
        />
        <button
          type="submit"
          disabled={busy || !cleanBody(body)}
          className="btn-brand self-start px-4 py-2.5"
        >
          {busy ? "שומר…" : "הוספת משוב"}
        </button>
      </form>
    </div>
  );
}
