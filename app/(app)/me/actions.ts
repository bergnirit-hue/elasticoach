"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isValidYmd } from "@/lib/date";
import { cleanJournal } from "./journal";
import { clampWater } from "./water";
import { parseMeasureInput, type MeasureInput } from "./measures";

export type ActionResult = { ok: true } | { ok: false; error: string };

const fail = (error: string): ActionResult => ({ ok: false, error });

/** The signed-in user, from the session — never from client input. */
async function session() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/*
 * `days` upserts only send the column they own, so saving the journal never
 * overwrites water or steps (and vice versa). On conflict PostgREST updates
 * just the supplied columns.
 */

export async function saveJournal(
  date: string,
  journal: unknown,
): Promise<ActionResult> {
  if (!isValidYmd(date)) return fail("תאריך לא תקין");
  const { supabase, user } = await session();
  if (!user) return fail("לא מחוברת");

  const { error } = await supabase.from("days").upsert({
    user_id: user.id,
    date,
    journal: cleanJournal(journal),
    updated_at: new Date().toISOString(),
  });
  return error ? fail("השמירה נכשלה") : { ok: true };
}

export async function saveWater(
  date: string,
  waterMl: number,
): Promise<ActionResult> {
  if (!isValidYmd(date)) return fail("תאריך לא תקין");
  const { supabase, user } = await session();
  if (!user) return fail("לא מחוברת");

  const { error } = await supabase.from("days").upsert({
    user_id: user.id,
    date,
    water_ml: clampWater(waterMl),
    updated_at: new Date().toISOString(),
  });
  return error ? fail("השמירה נכשלה") : { ok: true };
}

export async function saveSteps(
  date: string,
  steps: number,
): Promise<ActionResult> {
  if (!isValidYmd(date)) return fail("תאריך לא תקין");
  const { supabase, user } = await session();
  if (!user) return fail("לא מחוברת");

  const { error } = await supabase.from("days").upsert({
    user_id: user.id,
    date,
    steps: Math.min(200000, Math.max(0, Math.round(steps) || 0)),
    updated_at: new Date().toISOString(),
  });
  return error ? fail("השמירה נכשלה") : { ok: true };
}

/*
 * TODO(EC-17): the optional "before" photo (`measures.photo_path`) is not wired
 * yet — no storage bucket exists in the migrations. The column is left out of
 * this upsert so a path set later is never overwritten.
 */
export async function saveMeasure(input: MeasureInput): Promise<ActionResult> {
  if (!isValidYmd(input.date)) return fail("תאריך לא תקין");
  const parsed = parseMeasureInput(input);
  if (!parsed.ok) return fail(parsed.error);

  const { supabase, user } = await session();
  if (!user) return fail("לא מחוברת");

  const { error } = await supabase.from("measures").upsert({
    user_id: user.id,
    date: input.date,
    ...parsed.values,
  });
  if (error) return fail("השמירה נכשלה");
  revalidatePath("/me");
  return { ok: true };
}

export async function deleteMeasure(date: string): Promise<ActionResult> {
  if (!isValidYmd(date)) return fail("תאריך לא תקין");
  const { supabase, user } = await session();
  if (!user) return fail("לא מחוברת");

  const { error } = await supabase
    .from("measures")
    .delete()
    .eq("user_id", user.id)
    .eq("date", date);
  if (error) return fail("המחיקה נכשלה");
  revalidatePath("/me");
  return { ok: true };
}
