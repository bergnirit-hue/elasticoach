"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isValidYmd } from "@/lib/date";
import { cleanJournal } from "./journal";
import { clampWater } from "./water";
import { parseMeasureInput, type MeasureInput } from "./measures";
import {
  BEFORE_PHOTOS_BUCKET,
  beforePhotoPath,
  validatePhotoFile,
} from "./photo";

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
 * The optional "before" photo (`measures.photo_path`) is wired separately in
 * uploadMeasurePhoto / removeMeasurePhoto (EC-41). The column is left out of
 * this upsert so saving the numeric measurement never overwrites a photo path.
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

  // Read the photo path first so we can remove the storage object after the
  // row is deleted (avoids orphaned files in the private bucket).
  const { data: existing } = await supabase
    .from("measures")
    .select("photo_path")
    .eq("user_id", user.id)
    .eq("date", date)
    .maybeSingle();

  const { error } = await supabase
    .from("measures")
    .delete()
    .eq("user_id", user.id)
    .eq("date", date);
  if (error) return fail("המחיקה נכשלה");

  if (existing?.photo_path) {
    await supabase.storage.from(BEFORE_PHOTOS_BUCKET).remove([existing.photo_path]);
  }
  revalidatePath("/me");
  return { ok: true };
}

/**
 * Upload a "before" photo for the measurement on `date`. FormData carries
 * `date` (string) and `file` (the image). The file is validated (image-only,
 * ≤ 5MB) and stored in the private `before-photos` bucket under `{uid}/...`;
 * the resulting path is saved to `measures.photo_path`. Any previous photo for
 * that date is removed.
 */
export async function uploadMeasurePhoto(
  formData: FormData,
): Promise<ActionResult> {
  const date = formData.get("date");
  const file = formData.get("file");

  if (typeof date !== "string" || !isValidYmd(date)) return fail("תאריך לא תקין");
  if (!(file instanceof File)) return fail("לא נבחר קובץ");

  const valid = validatePhotoFile({ type: file.type, size: file.size });
  if (!valid.ok) return fail(valid.error);

  const { supabase, user } = await session();
  if (!user) return fail("לא מחוברת");

  // Keep the previous path to clean it up after a successful replace.
  const { data: existing } = await supabase
    .from("measures")
    .select("photo_path")
    .eq("user_id", user.id)
    .eq("date", date)
    .maybeSingle();
  const previousPath = existing?.photo_path ?? null;

  const path = beforePhotoPath(user.id, date, file.type, crypto.randomUUID());

  const { error: uploadError } = await supabase.storage
    .from(BEFORE_PHOTOS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return fail("העלאת התמונה נכשלה");

  // Save only photo_path; on conflict PostgREST updates just this column, so a
  // photo-only row is allowed and numeric fields are never clobbered.
  const { error: rowError } = await supabase
    .from("measures")
    .upsert({ user_id: user.id, date, photo_path: path });
  if (rowError) {
    // Roll back the just-uploaded object so we don't leak an orphan.
    await supabase.storage.from(BEFORE_PHOTOS_BUCKET).remove([path]);
    return fail("שמירת התמונה נכשלה");
  }

  if (previousPath && previousPath !== path) {
    await supabase.storage.from(BEFORE_PHOTOS_BUCKET).remove([previousPath]);
  }
  revalidatePath("/me");
  return { ok: true };
}

/** Remove the "before" photo for the measurement on `date` (object + path). */
export async function removeMeasurePhoto(date: string): Promise<ActionResult> {
  if (!isValidYmd(date)) return fail("תאריך לא תקין");
  const { supabase, user } = await session();
  if (!user) return fail("לא מחוברת");

  const { data: existing } = await supabase
    .from("measures")
    .select("photo_path")
    .eq("user_id", user.id)
    .eq("date", date)
    .maybeSingle();
  if (!existing?.photo_path) return { ok: true };

  const { error } = await supabase
    .from("measures")
    .update({ photo_path: null })
    .eq("user_id", user.id)
    .eq("date", date);
  if (error) return fail("הסרת התמונה נכשלה");

  await supabase.storage.from(BEFORE_PHOTOS_BUCKET).remove([existing.photo_path]);
  revalidatePath("/me");
  return { ok: true };
}
